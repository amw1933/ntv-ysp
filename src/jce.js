import crypto from "node:crypto";
import zlib from "node:zlib";

const APP_ID = "1200013";
const QMF_APP_ID = 10012;
const QMF_PLATFORM = 1;
const BIZ_ID = 0;
const CHAN_ID = "10070";
const VERSION_NAME = "3.2.7.26212";
const VERSION_CODE = "302070";
const GUID = crypto.randomBytes(16).toString("hex");

class Writer {
  constructor() {
    this.parts = [];
  }

  push(value) {
    this.parts.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
  }

  head(type, tag) {
    if (tag < 15) {
      this.push(Buffer.from([((tag & 0x0f) << 4) | (type & 0x0f)]));
      return;
    }
    this.push(Buffer.from([0xf0 | (type & 0x0f), tag]));
  }

  byte(value, tag) {
    const number = Number(value);
    if (number === 0) {
      this.head(12, tag);
      return;
    }
    this.head(0, tag);
    const data = Buffer.alloc(1);
    data.writeInt8(number);
    this.push(data);
  }

  short(value, tag) {
    const number = Number(value);
    if (number >= -128 && number <= 127) {
      this.byte(number, tag);
      return;
    }
    this.head(1, tag);
    const data = Buffer.alloc(2);
    data.writeInt16BE(number);
    this.push(data);
  }

  int(value, tag) {
    const number = Number(value);
    if (number >= -32768 && number <= 32767) {
      this.short(number, tag);
      return;
    }
    this.head(2, tag);
    const data = Buffer.alloc(4);
    data.writeInt32BE(number);
    this.push(data);
  }

  long(value, tag) {
    const number = BigInt(value);
    if (number >= -2147483648n && number <= 2147483647n) {
      this.int(Number(number), tag);
      return;
    }
    this.head(3, tag);
    const data = Buffer.alloc(8);
    data.writeBigInt64BE(number);
    this.push(data);
  }

  float(value, tag) {
    this.head(4, tag);
    const data = Buffer.alloc(4);
    data.writeFloatBE(Number(value));
    this.push(data);
  }

  double(value, tag) {
    this.head(5, tag);
    const data = Buffer.alloc(8);
    data.writeDoubleBE(Number(value));
    this.push(data);
  }

  string(value, tag) {
    if (value === null || value === undefined) {
      return;
    }
    const data = Buffer.from(String(value), "utf8");
    if (data.length > 255) {
      this.head(7, tag);
      const size = Buffer.alloc(4);
      size.writeInt32BE(data.length);
      this.push(size);
    } else {
      this.head(6, tag);
      this.push(Buffer.from([data.length]));
    }
    this.push(data);
  }

  bytes(data, tag) {
    const value = Buffer.from(data);
    this.head(13, tag);
    this.head(0, 0);
    this.int(value.length, 0);
    this.push(value);
  }

  struct(write, tag) {
    this.head(10, tag);
    write(this);
    this.head(11, 0);
  }

  list(items, tag, write) {
    this.head(9, tag);
    this.int(items.length, 0);
    if (write) {
      for (const item of items) {
        write(this, item);
      }
    }
  }

  buffer() {
    return Buffer.concat(this.parts);
  }
}

class Reader {
  constructor(buffer) {
    this.buffer = Buffer.from(buffer);
    this.position = 0;
  }

  remaining() {
    return this.buffer.length - this.position;
  }

  read(size) {
    if (this.position + size > this.buffer.length) {
      throw new Error("Unexpected end of JCE response");
    }
    const result = this.buffer.subarray(this.position, this.position + size);
    this.position += size;
    return result;
  }

  uint8() {
    return this.read(1)[0];
  }

  head() {
    const value = this.uint8();
    const type = value & 0x0f;
    let tag = (value & 0xf0) >>> 4;
    if (tag === 15) {
      tag = this.uint8();
    }
    return { type, tag };
  }

  value(type) {
    switch (type) {
      case 0:
        return this.read(1).readInt8();
      case 1:
        return this.read(2).readInt16BE();
      case 2:
        return this.read(4).readInt32BE();
      case 3:
        return Number(this.read(8).readBigInt64BE());
      case 4:
        return this.read(4).readFloatBE();
      case 5:
        return this.read(8).readDoubleBE();
      case 6: {
        const size = this.uint8();
        return this.read(size).toString("utf8");
      }
      case 7: {
        const size = this.read(4).readInt32BE();
        return this.read(size).toString("utf8");
      }
      case 8: {
        const size = this.readIntValue();
        const result = {};
        for (let index = 0; index < size; index += 1) {
          result[this.readAnyValue()] = this.readAnyValue();
        }
        return result;
      }
      case 9: {
        const size = this.readIntValue();
        const result = [];
        for (let index = 0; index < size; index += 1) {
          result.push(this.readAnyValue());
        }
        return result;
      }
      case 10:
        return this.struct();
      case 11:
        return null;
      case 12:
        return 0;
      case 13: {
        this.head();
        const size = this.readIntValue();
        return this.read(size);
      }
      default:
        throw new Error(`Unsupported JCE type ${type}`);
    }
  }

  readAnyValue() {
    const { type } = this.head();
    return this.value(type);
  }

  readIntValue() {
    return Number(this.readAnyValue());
  }

  struct() {
    const result = {};
    while (this.remaining() > 0) {
      const { type, tag } = this.head();
      if (type === 11) {
        break;
      }
      result[tag] = this.value(type);
    }
    return result;
  }
}

function writeQua(writer) {
  writer.string(VERSION_NAME, 0);
  writer.string(VERSION_CODE, 1);
  writer.int(1080, 2);
  writer.int(2400, 3);
  writer.int(3, 4);
  writer.string("12", 5);
  writer.int(1, 6);
  writer.int(1, 7);
  writer.int(420, 8);
  writer.string(CHAN_ID, 9);
  for (let index = 10; index < 15; index += 1) {
    writer.string("", index);
  }
  writer.struct((nested) => {
    nested.int(0, 0);
    nested.byte(0, 1);
    nested.string("", 2);
  }, 15);
  writer.string("", 16);
  writer.string("", 17);
  writer.string("", 18);
  writer.struct((nested) => {
    nested.int(0, 0);
    nested.float(0, 1);
    nested.float(0, 2);
    nested.double(0, 3);
  }, 19);
  writer.string(GUID.slice(0, 16), 20);
  writer.string("Pixel 6", 21);
  writer.int(1, 22);
  for (let index = 23; index < 27; index += 1) {
    writer.int(0, index);
  }
  writer.string("", 27);
  writer.string("", 28);
  writer.string(GUID, 29);
}

function writeHeader(writer, command, requestId) {
  writer.int(requestId, 0);
  writer.int(command, 1);
  writer.struct(writeQua, 2);
  writer.string(APP_ID, 3);
  writer.string(GUID, 4);
  writer.list([], 5);
  writer.struct(() => {}, 6);
  writer.list([], 7);
  writer.int(0, 8);
  writer.int(0, 9);
  writer.int(0, 10);
}

function wrapPacket(command, body, requestId) {
  const writer = new Writer();
  writer.struct((nested) => writeHeader(nested, command, requestId), 0);
  writer.bytes(body, 1);
  const request = writer.buffer();

  const inner = Buffer.concat([
    Buffer.from([38]),
    Buffer.alloc(4),
    Buffer.from([1]),
    Buffer.alloc(10),
    request,
    Buffer.from([40])
  ]);
  inner.writeInt32BE(request.length + 17, 1);
  const compressed = zlib.gzipSync(inner);

  const guid = Buffer.alloc(32);
  Buffer.from(GUID).copy(guid);
  const code = Buffer.alloc(4);
  code.writeInt32BE(Number(VERSION_CODE));
  const header = Buffer.alloc(21);
  header[0] = 19;
  header.writeInt16BE(2, 5);
  header.writeUInt16BE(65281, 7);
  header.writeUInt16BE(command, 9);
  header.writeUInt16BE(0, 11);
  header.writeBigInt64BE(BigInt(requestId), 13);

  const qmf = Buffer.alloc(16);
  qmf.writeInt32BE(531, 0);
  qmf.writeInt32BE(QMF_APP_ID, 4);
  qmf.writeBigInt64BE(BigInt(BIZ_ID), 8);

  const tail = Buffer.concat([
    Buffer.from([QMF_PLATFORM]),
    code,
    Buffer.alloc(6),
    Buffer.from([0]),
    Buffer.alloc(2),
    Buffer.alloc(2)
  ]);

  const size = Buffer.alloc(4);
  size.writeInt32BE(inner.length);
  const packet = Buffer.concat([
    header,
    qmf,
    guid,
    tail,
    size,
    compressed,
    Buffer.from([3])
  ]);
  packet.writeInt32BE(packet.length, 1);
  return packet;
}

function unwrapPacket(data) {
  if (data.length < 90 || data[0] !== 0x13) {
    throw new Error("Invalid JCE response header");
  }
  const flags = data.readInt32BE(21);
  let payload = data.subarray(89, data.length - 1);
  if ((flags & 2) !== 0) {
    payload = zlib.gunzipSync(payload);
  }
  if (payload[0] !== 0x26 || payload[payload.length - 1] !== 0x28) {
    throw new Error("Invalid JCE response payload");
  }
  const response = new Reader(payload.subarray(16, payload.length - 1)).struct();
  return response[1] || Buffer.alloc(0);
}

export class JceError extends Error {}

export async function getTimeshiftUrl({
  pid,
  sid,
  start,
  end,
  stream = "fhd",
  timeoutMs = 15000
}) {
  const writer = new Writer();
  writer.string(pid, 0);
  writer.string(sid, 1);
  writer.long(start, 2);
  writer.long(end, 3);
  writer.string(stream, 4);
  const command = 25312;
  const requestId = Date.now() & 0x7fffffff;
  const packet = wrapPacket(command, writer.buffer(), requestId);

  let response;
  try {
    response = await fetch("https://jacc.ysp.cctv.cn", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: packet,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new JceError(`JCE request failed: ${error.message}`);
  }
  if (!response.ok) {
    throw new JceError(`JCE HTTP ${response.status}`);
  }
  const body = unwrapPacket(Buffer.from(await response.arrayBuffer()));
  if (!body.length) {
    throw new JceError("JCE returned an empty body");
  }
  const result = new Reader(body).struct();
  if (Number(result[0] || 0) !== 0) {
    throw new JceError(String(result[1] || `JCE error ${result[0]}`));
  }
  const url = String(result[2] || "");
  if (!url) {
    throw new JceError("JCE returned no playlist URL");
  }
  return url;
}
