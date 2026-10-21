import crypto from "node:crypto";

const PLATFORM = 4330403;
const APP_VERSION = "V8.22.1035.3031";
const TEA_KEY = Buffer.from("59b2f7cf725ef43c34fdd7c123411ed3", "hex");
const GUARD_TEA_KEY = Buffer.from("110dbec10c23e7d2e56a1cad6914ef1b", "hex");
const XOR_KEY = Buffer.from([
  132, 46, 237, 8, 240, 102, 230, 234, 72, 180, 202, 169, 145, 237, 111, 243
]);
const GUARD_XOR_KEY = Buffer.from([179, 201, 83, 160, 105, 19, 173, 77]);
const H264_PROFILE = Buffer.from(
  "H(30:1080,60:1080|30:1080,60:1080)"
).toString("base64");

function uint32(value) {
  return Number(value) >>> 0;
}

export function teaBlock(block, key) {
  let y = block.readUInt32BE(0);
  let z = block.readUInt32BE(4);
  const k0 = key.readUInt32BE(0);
  const k1 = key.readUInt32BE(4);
  const k2 = key.readUInt32BE(8);
  const k3 = key.readUInt32BE(12);
  let sum = 0;
  for (let round = 0; round < 16; round += 1) {
    sum = uint32(sum + 0x9e3779b9);
    y = uint32(
      y +
        (uint32(uint32(z << 4) + k0) ^
          uint32(z + sum) ^
          uint32((z >>> 5) + k1))
    );
    z = uint32(
      z +
        (uint32(uint32(y << 4) + k2) ^
          uint32(y + sum) ^
          uint32((y >>> 5) + k3))
    );
  }
  const result = Buffer.alloc(8);
  result.writeUInt32BE(y, 0);
  result.writeUInt32BE(z, 4);
  return result;
}

function checksum(buffer) {
  let value = 0;
  for (const byte of buffer) {
    value = (value * 131 + byte) % 0x80000000;
  }
  return value;
}

export function teaPacket(data, key, randomBytes = crypto.randomBytes) {
  const padding = (8 - ((data.length + 10) % 8)) % 8;
  const prefix = Buffer.alloc(1 + padding + 2);
  prefix[0] = (randomBytes(1)[0] & 0xf8) | padding;
  randomBytes(padding + 2).copy(prefix, 1);
  const plain = Buffer.concat([
    prefix,
    Buffer.from(data),
    Buffer.alloc(7)
  ]);
  const output = Buffer.alloc(plain.length);
  let previousPlain = Buffer.alloc(8);
  let previousCipher = Buffer.alloc(8);
  for (let offset = 0; offset < plain.length; offset += 8) {
    const mixed = Buffer.alloc(8);
    for (let index = 0; index < 8; index += 1) {
      mixed[index] = plain[offset + index] ^ previousCipher[index];
    }
    const encrypted = teaBlock(mixed, key);
    const cipher = Buffer.alloc(8);
    for (let index = 0; index < 8; index += 1) {
      cipher[index] = encrypted[index] ^ previousPlain[index];
    }
    cipher.copy(output, offset);
    previousPlain = mixed;
    previousCipher = cipher;
  }
  return output;
}

function packedString(value) {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  const length = Buffer.alloc(2);
  length.writeUInt16BE(data.length);
  return Buffer.concat([length, data]);
}

function tail(value) {
  const text = String(value);
  return text.length >= 5 ? text.slice(-5) : "";
}

function guard(timestamp, guid, randomBytes) {
  const timestampBuffer = Buffer.alloc(4);
  timestampBuffer.writeUInt32BE(timestamp);
  const body = Buffer.concat([
    timestampBuffer,
    packedString(tail(guid)),
    packedString(tail("null")),
    packedString(tail("null")),
    packedString("-1")
  ]);
  const plain = packedString(body);
  let encrypted = Buffer.concat([
    teaPacket(plain, GUARD_TEA_KEY, randomBytes),
    Buffer.alloc(4)
  ]);
  encrypted.writeUInt32BE(checksum(plain), encrypted.length - 4);
  for (let index = 0; index < encrypted.length; index += 1) {
    encrypted[index] ^= GUARD_XOR_KEY[index & 7];
  }
  return encrypted.toString("hex").toUpperCase();
}

export function createClientKey(channelId, options = {}) {
  const randomBytes = options.randomBytes || crypto.randomBytes;
  const timestamp = options.timestamp || Math.floor(Date.now() / 1000);
  const guid = options.guid || randomBytes(16).toString("hex");
  const guardValue = guard(timestamp, guid, randomBytes);
  const uid = options.uid || randomBytes(4).toString("hex").toUpperCase();
  const fixed = Buffer.from("0000004200000004000004d2", "hex");
  const platform = Buffer.alloc(4);
  platform.writeUInt32BE(PLATFORM);
  const zero = Buffer.alloc(4);
  const time = Buffer.alloc(4);
  time.writeUInt32BE(timestamp);
  const one = Buffer.alloc(4);
  one.writeUInt32BE(1);

  const body = Buffer.concat([
    fixed,
    platform,
    zero,
    time,
    packedString("dcgh"),
    packedString("_zj1A5Gh6QYcxWjIUGos2w=="),
    packedString(APP_VERSION),
    packedString(channelId),
    packedString(guid),
    one,
    one,
    packedString(uid),
    packedString("nil"),
    packedString("57eab0c4-2c58-44c6-8ae9-dd2757525dc5"),
    packedString("nil"),
    packedString("v0.1.000"),
    packedString("com.cctv.yangshipin.app.iphone"),
    packedString(String(PLATFORM)),
    packedString("ex_json_bus"),
    packedString("ex_json_vs"),
    packedString(guardValue)
  ]);

  const length = Buffer.alloc(2);
  length.writeUInt16BE(body.length);
  let packet = Buffer.concat([length, body]);
  packet.writeUInt32BE(checksum(packet), 18);
  let encrypted = Buffer.concat([
    teaPacket(packet, TEA_KEY, randomBytes),
    Buffer.alloc(4)
  ]);
  encrypted.writeUInt32BE(checksum(packet), encrypted.length - 4);
  for (let index = 0; index < encrypted.length; index += 1) {
    encrypted[index] ^= XOR_KEY[index & 15];
  }
  return {
    cKey:
      "--01" +
      encrypted.toString("base64").replace(/\+/g, "_").replace(/\//g, "-").replace(/=+$/, ""),
    guid,
    timestamp,
    guard: guardValue,
    flowId: `${crypto.randomUUID().replace(/-/g, "").toUpperCase()}_${PLATFORM}`
  };
}

export async function getBkPlayUrls(channelId, livePid, definition = "fhd") {
  const key = createClientKey(channelId);
  const query = new URLSearchParams({
    atime: "120",
    livepid: livePid,
    cnlid: channelId,
    appVer: APP_VERSION,
    app_version: "300090",
    caplv: "1",
    cmd: "2",
    defn: definition,
    device: "iPhone",
    encryptVer: "4.2",
    getpreviewinfo: "0",
    hevclv: "0",
    lang: "zh-Hans_CN",
    livequeue: "0",
    logintype: "1",
    nettype: "1",
    newnettype: "1",
    newplatform: String(PLATFORM),
    platform: String(PLATFORM),
    sdtfrom: "v3021",
    spacode: "23",
    spaudio: "1",
    spdemuxer: "6",
    spdrm: "2",
    spdynamicrange: "1",
    spflv: "1",
    spflvaudio: "1",
    sphdrfps: "60",
    sphttps: "1",
    spvcode: H264_PROFILE,
    spvideo: "4",
    stream: "1",
    system: "1",
    sysver: "ios18.2.1",
    uhd_flag: "0",
    cKey: key.cKey,
    guid: key.guid,
    fntick: String(key.timestamp),
    flowid: key.flowId,
    playbacktime: "0"
  });
  const response = await fetch(`https://bkliveinfo.ysp.cctv.cn/?${query}`, {
    headers: { "User-Agent": "qqlive", Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error(`bkliveinfo HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (Number(payload.iretcode) !== 0) {
    throw new Error(
      `bkliveinfo ${payload.iretcode || "error"} ${payload.errinfo || ""}`.trim()
    );
  }
  const urls = [];
  if (payload.playurl) {
    urls.push(payload.playurl);
  }
  const backup =
    payload.backurl_list || payload.backurlList || payload.backurl || [];
  if (Array.isArray(backup)) {
    for (const item of backup) {
      urls.push(
        typeof item === "string"
          ? item
          : item.url || item.playurl || item.playUrl || ""
      );
    }
  } else if (typeof backup === "string") {
    urls.push(...backup.split(/[;,]/));
  }
  const unique = [...new Set(urls.filter((url) => url && url.includes(".cctv.")))];
  unique.sort((left, right) => {
    const score = (url) => (url.includes("bklive-") ? 0 : 1);
    return score(left) - score(right) || left.localeCompare(right);
  });
  if (!unique.length) {
    throw new Error("bkliveinfo returned no playable URL");
  }
  return unique;
}

export async function fetchBkPlaylist(url) {
  const headers = {
    "User-Agent": "qqlive",
    Referer: "https://live.cctv.cn/",
    Accept: "application/vnd.apple.mpegurl,application/json,*/*"
  };
  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    throw new Error(`bklive playlist HTTP ${response.status}`);
  }
  const text = await response.text();
  const finalUrl = response.url || url;
  if (!text.includes("#EXTM3U")) {
    throw new Error("bklive response is not an HLS playlist");
  }
  if (!text.includes("#EXT-X-STREAM-INF")) {
    return { text, finalUrl, headers };
  }
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("#EXT-X-STREAM-INF")) {
      continue;
    }
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next].trim();
      if (!candidate || candidate.startsWith("#")) {
        continue;
      }
      return fetchBkPlaylist(new URL(candidate, finalUrl).toString());
    }
  }
  throw new Error("bklive master playlist has no media playlist");
}
