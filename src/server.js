import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHANNELS, buildM3u, findChannel } from "./channels.js";
import {
  epgCacheState,
  programmesForChannel,
  shanghaiDateKey
} from "./epg.js";
import { getTimeshiftUrl } from "./jce.js";
import {
  buildLivePlaylist,
  parseCatchupQuery,
  rewritePlaylist
} from "./playlist.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..", "web");
const PORT = Number(process.env.PORT || 8768);
const HOST = process.env.HOST || "0.0.0.0";
const MEDIA_TTL_MS = 30 * 60 * 1000;
const PLAYLIST_CACHE_MS = 3500;
const mediaTokens = new Map();
const playlistCache = new Map();
const startedAt = Date.now();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function requestOrigin(request) {
  if (process.env.PUBLIC_ORIGIN) {
    return process.env.PUBLIC_ORIGIN.replace(/\/+$/, "");
  }
  const proto = String(request.headers["x-forwarded-proto"] || "http")
    .split(",")[0]
    .trim();
  return `${proto}://${request.headers.host || `localhost:${PORT}`}`;
}

function send(response, status, body, headers = {}) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Content-Length": data.length,
    ...headers
  });
  response.end(data);
}

function sendJson(response, status, value) {
  send(response, status, `${JSON.stringify(value, null, 2)}\n`, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
}

function addMediaToken(url, headers) {
  const token = crypto.randomBytes(18).toString("base64url");
  mediaTokens.set(token, {
    url,
    headers,
    expiresAt: Date.now() + MEDIA_TTL_MS
  });
  return token;
}

function takeMediaToken(token) {
  const item = mediaTokens.get(token);
  if (!item || item.expiresAt <= Date.now()) {
    mediaTokens.delete(token);
    return null;
  }
  return item;
}

function cleanupTokens() {
  const now = Date.now();
  for (const [token, item] of mediaTokens) {
    if (item.expiresAt <= now) {
      mediaTokens.delete(token);
    }
  }
  for (const [key, item] of playlistCache) {
    if (item.expiresAt <= now) {
      playlistCache.delete(key);
    }
  }
}

function mediaHeaders(extra = {}) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://live.cctv.cn/",
    ...extra
  };
}

async function fetchPlaylist(url, headers) {
  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    throw new Error(`upstream playlist HTTP ${response.status}`);
  }
  return {
    text: await response.text(),
    finalUrl: response.url || url
  };
}

async function resolvePlaylist(channel, range) {
  const catchup = Boolean(range);
  const now = Math.floor(Date.now() / 1000);
  const start = range ? range.start : now - 100;
  const end = range ? range.end : now - 15;
  const cacheBucket = Math.floor(Date.now() / PLAYLIST_CACHE_MS);
  const cacheKey = catchup
    ? `${channel.slug}:catchup:${start}:${end}`
    : `${channel.slug}:live:${cacheBucket}`;
  const cached = playlistCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const upstreamUrl = await getTimeshiftUrl({
    pid: channel.pid,
    sid: channel.sid,
    start,
    end,
    stream: channel.stream || "fhd"
  });
  const headers = mediaHeaders();
  const playlist = await fetchPlaylist(upstreamUrl, headers);
  let value;
  if (catchup) {
    value = {
      kind: "catchup",
      playlist: playlist.text,
      baseUrl: playlist.finalUrl,
      headers
    };
  } else {
    const live = buildLivePlaylist(playlist.text, playlist.finalUrl, 9);
    if (!live) {
      throw new Error("upstream returned no media segments");
    }
    value = {
      kind: "live",
      playlist: live.text,
      baseUrl: playlist.finalUrl,
      headers
    };
  }
  playlistCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + PLAYLIST_CACHE_MS
  });
  return value;
}

async function serveChannel(request, response, channel, searchParams) {
  if (!channel.catchup && searchParams.has("playseek")) {
    sendJson(response, 409, {
      error: "catchup_not_supported",
      channel: channel.name,
      message: "当前上游没有为这个频道标记稳定回看，仍可尝试直播。"
    });
    return;
  }
  try {
    const range = parseCatchupQuery(searchParams.toString());
    const resolved = await resolvePlaylist(channel, range);
    const origin = requestOrigin(request);
    const rewritten = rewritePlaylist(
      resolved.playlist,
      resolved.baseUrl,
      (url) => {
        const token = addMediaToken(url, resolved.headers);
        return `${origin}/media/${token}`;
      }
    );
    send(response, 200, rewritten, {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": resolved.kind === "live" ? "no-store" : "private, max-age=15"
    });
  } catch (error) {
    console.error(`[${channel.slug}] ${error.message}`);
    sendJson(response, 502, {
      error: "upstream_error",
      channel: channel.name,
      message: error.message
    });
  }
}

async function serveMedia(request, response, token) {
  const item = takeMediaToken(token);
  if (!item) {
    sendJson(response, 404, {
      error: "expired_media_token",
      message: "播放链接已过期，请重新打开频道。"
    });
    return;
  }
  const headers = { ...item.headers };
  if (request.headers.range) {
    headers.Range = request.headers.range;
  }
  try {
    const upstream = await fetch(item.url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(30000)
    });
    if (!upstream.ok) {
      sendJson(response, upstream.status, {
        error: "upstream_media_error",
        status: upstream.status
      });
      return;
    }
    const contentType = upstream.headers.get("content-type") || "";
    const finalUrl = upstream.url || item.url;
    const isPlaylist =
      contentType.includes("mpegurl") ||
      /\.m3u8(?:$|\?)/i.test(finalUrl);
    if (isPlaylist) {
      const text = await upstream.text();
      const rewritten = rewritePlaylist(text, finalUrl, (url) => {
        const next = addMediaToken(url, item.headers);
        return `${requestOrigin(request)}/media/${next}`;
      });
      send(response, 200, rewritten, {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "private, max-age=5"
      });
      return;
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    const responseHeaders = {
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=60"
    };
    for (const name of ["content-range", "accept-ranges", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) {
        responseHeaders[name] = value;
      }
    }
    send(response, upstream.status, body, responseHeaders);
  } catch (error) {
    sendJson(response, 502, {
      error: "media_proxy_error",
      message: error.message
    });
  }
}

async function serveStatic(request, response, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(WEB_ROOT, relative);
  if (!target.startsWith(`${WEB_ROOT}${path.sep}`) && target !== WEB_ROOT) {
    sendJson(response, 403, { error: "forbidden" });
    return;
  }
  try {
    const body = await fs.readFile(target);
    send(response, 200, body, {
      "Content-Type": MIME_TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "not_found" });
      return;
    }
    sendJson(response, 500, { error: "static_read_failed", message: error.message });
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    send(response, 204, Buffer.alloc(0));
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      version: "0.1.0",
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      channels: CHANNELS.length,
      catchupChannels: CHANNELS.filter((channel) => channel.catchup).length,
      activeMediaTokens: mediaTokens.size,
      epg: epgCacheState()
    });
    return;
  }
  if (pathname === "/api/channels") {
    sendJson(response, 200, {
      channels: CHANNELS.map((channel) => ({
        ...channel,
        url: `/${channel.slug}.m3u8`
      }))
    });
    return;
  }
  const epgMatch = pathname.match(/^\/api\/epg\/([a-z0-9_-]+)$/i);
  if (epgMatch) {
    const channel = findChannel(epgMatch[1]);
    if (!channel) {
      sendJson(response, 404, { error: "unknown_channel" });
      return;
    }
    const date =
      url.searchParams.get("date") || shanghaiDateKey(Date.now() / 1000);
    try {
      const result = await programmesForChannel(
        channel,
        date,
        url.searchParams.get("refresh") === "1"
      );
      sendJson(response, 200, {
        channel: {
          slug: channel.slug,
          name: channel.name,
          catchup: channel.catchup
        },
        date,
        channelId: result.channelId,
        programs: result.programs,
        now: Math.floor(Date.now() / 1000)
      });
    } catch (error) {
      sendJson(response, 502, {
        error: "epg_unavailable",
        message: error.message
      });
    }
    return;
  }
  if (pathname === "/all.m3u" || pathname === "/all.m3u8") {
    send(response, 200, buildM3u(requestOrigin(request)), {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Cache-Control": "no-store"
    });
    return;
  }
  if (pathname.startsWith("/media/")) {
    await serveMedia(request, response, pathname.slice("/media/".length));
    return;
  }
  const channelMatch = pathname.match(/^\/([a-z0-9_-]+)\.m3u8$/i);
  if (channelMatch) {
    const channel = findChannel(channelMatch[1]);
    if (!channel) {
      sendJson(response, 404, { error: "unknown_channel" });
      return;
    }
    await serveChannel(request, response, channel, url.searchParams);
    return;
  }
  await serveStatic(request, response, pathname);
});

setInterval(cleanupTokens, 60 * 1000).unref();
server.listen(PORT, HOST, () => {
  console.log(`nTv YSP listening on http://localhost:${PORT}`);
  console.log(`M3U: http://localhost:${PORT}/all.m3u`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
