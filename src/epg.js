import zlib from "node:zlib";

const EPG_URLS = [
  "https://github.com/TvWasm/autoEPG/releases/latest/download/epg.xml",
  "http://epg.51zmt.top:8000/e.xml.gz"
];
const CACHE_TTL_MS = 30 * 60 * 1000;
const DAY_SECONDS = 24 * 60 * 60;
const CHINA_OFFSET_SECONDS = 8 * 60 * 60;

let cachedGuide = null;
let cachedAt = 0;
let inflight = null;

function decodeEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, number) =>
      String.fromCodePoint(Number.parseInt(number, 16))
    )
    .replace(/&amp;/g, "&");
}

function parseAttributes(text) {
  const result = {};
  const pattern = /([a-zA-Z_:][\w:.-]*)="([^"]*)"/g;
  let match;
  while ((match = pattern.exec(text))) {
    result[match[1]] = decodeEntities(match[2]);
  }
  return result;
}

export function normalizeAlias(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[._·\-()（）]/g, "")
    .replace(/高清|超高清|hd$/g, "");
}

export function parseXmltvTime(value) {
  const match = String(value || "").match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?/
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] =
    match;
  let offset = 0;
  if (sign) {
    offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * 60;
    if (sign === "-") {
      offset = -offset;
    }
  }
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  return Math.floor((utc - offset * 1000) / 1000);
}

export function parseXmltv(xml) {
  const channels = new Map();
  const aliasToChannel = new Map();
  const programmesByChannel = new Map();

  const channelPattern = /<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi;
  let channelMatch;
  while ((channelMatch = channelPattern.exec(xml))) {
    const attributes = parseAttributes(channelMatch[1]);
    const id = attributes.id;
    if (!id) {
      continue;
    }
    const names = [];
    const namePattern = /<display-name\b[^>]*>([\s\S]*?)<\/display-name>/gi;
    let nameMatch;
    while ((nameMatch = namePattern.exec(channelMatch[2]))) {
      names.push(decodeEntities(nameMatch[1]).trim());
    }
    const iconMatch = channelMatch[2].match(
      /<icon\b[^>]*\bsrc="([^"]+)"/i
    );
    channels.set(id, {
      id,
      names,
      logo: iconMatch ? decodeEntities(iconMatch[1]) : ""
    });
    for (const name of [id, ...names]) {
      const alias = normalizeAlias(name);
      if (alias) {
        aliasToChannel.set(alias, id);
      }
    }
  }

  const programmePattern = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
  let programmeMatch;
  while ((programmeMatch = programmePattern.exec(xml))) {
    const attributes = parseAttributes(programmeMatch[1]);
    const channelId = attributes.channel;
    const start = parseXmltvTime(attributes.start);
    const stop = parseXmltvTime(attributes.stop);
    if (!channelId || !start || !stop || stop <= start) {
      continue;
    }
    const body = programmeMatch[2];
    const titleMatch = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = body.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/i);
    const categoryMatch = body.match(
      /<category\b[^>]*>([\s\S]*?)<\/category>/i
    );
    const program = {
      start,
      stop,
      title: titleMatch ? decodeEntities(titleMatch[1]).trim() : "未命名节目",
      description: descMatch ? decodeEntities(descMatch[1]).trim() : "",
      category: categoryMatch
        ? decodeEntities(categoryMatch[1]).trim()
        : ""
    };
    if (!programmesByChannel.has(channelId)) {
      programmesByChannel.set(channelId, []);
    }
    programmesByChannel.get(channelId).push(program);
  }

  for (const programmes of programmesByChannel.values()) {
    programmes.sort((left, right) => left.start - right.start);
  }
  return { channels, aliasToChannel, programmesByChannel };
}

async function downloadGuide() {
  let lastError = null;
  for (const url of EPG_URLS) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "ntv-ysp/0.1" },
        signal: AbortSignal.timeout(25000)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      let body = Buffer.from(await response.arrayBuffer());
      if (body[0] === 0x1f && body[1] === 0x8b) {
        body = zlib.gunzipSync(body);
      }
      const xml = body.toString("utf8");
      if (!xml.includes("<tv")) {
        throw new Error("not XMLTV");
      }
      return parseXmltv(xml);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`节目单下载失败: ${lastError?.message || "unknown error"}`);
}

export async function getGuide(force = false) {
  if (!force && cachedGuide && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedGuide;
  }
  if (!inflight) {
    inflight = downloadGuide()
      .then((guide) => {
        cachedGuide = guide;
        cachedAt = Date.now();
        return guide;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function shanghaiDateKey(seconds) {
  const date = new Date((Number(seconds) + CHINA_OFFSET_SECONDS) * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`;
}

export function shanghaiDayRange(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("日期格式应为 YYYY-MM-DD");
  }
  const start =
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 1000 -
    CHINA_OFFSET_SECONDS;
  return { start, end: start + DAY_SECONDS };
}

function channelLookupKeys(channel) {
  const keys = [
    channel.slug,
    channel.name,
    channel.epgId,
    channel.sid,
    channel.pid
  ];
  if (channel.slug === "cctv5p") {
    keys.push("cctv5plus", "CCTV-5+");
  }
  return [...new Set(keys.map(normalizeAlias).filter(Boolean))];
}

export async function programmesForChannel(channel, dateKey, force = false) {
  const guide = await getGuide(force);
  let channelId = null;
  for (const key of channelLookupKeys(channel)) {
    channelId = guide.aliasToChannel.get(key);
    if (channelId) {
      break;
    }
  }
  if (!channelId) {
    return { channelId: "", programs: [] };
  }
  const range = shanghaiDayRange(dateKey);
  const programs = (guide.programmesByChannel.get(channelId) || [])
    .filter((program) => program.start < range.end && program.stop > range.start)
    .map((program) => ({
      ...program,
      date: shanghaiDateKey(program.start),
      replayable: program.stop <= Math.floor(Date.now() / 1000)
    }));
  return { channelId, programs };
}

export function epgCacheState() {
  return {
    loaded: Boolean(cachedGuide),
    ageSec: cachedGuide ? Math.floor((Date.now() - cachedAt) / 1000) : null,
    channels: cachedGuide?.channels.size || 0,
    programmes: cachedGuide
      ? [...cachedGuide.programmesByChannel.values()].reduce(
          (total, programs) => total + programs.length,
          0
        )
      : 0
  };
}

