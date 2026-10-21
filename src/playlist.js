const MEDIA_LINE = /^(?!#)(.+)$/;

export function parseCatchupQuery(query) {
  const params = new URLSearchParams(query || "");
  const now = Math.floor(Date.now() / 1000);
  let start = parseTime(params.get("start") || params.get("starttime"));
  let end = parseTime(params.get("end") || params.get("endtime"));
  const playseek = params.get("playseek");

  if (playseek) {
    const range = playseek.match(/^(\d{14})-(\d{14})$/);
    if (range) {
      start = parseTime(range[1]);
      end = parseTime(range[2]);
    } else {
      start = parseTime(playseek);
    }
  }

  if (!start) {
    return null;
  }
  end = Math.min(end || start + 1800, now);
  if (end <= start) {
    end = Math.min(start + 1800, now);
  }
  if (end <= start) {
    return null;
  }
  const earliest = now - 7 * 24 * 60 * 60;
  start = Math.max(start, earliest);
  return { start, end };
}

export function parseTime(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }

  if (text.includes("T") || (text.includes("-") && text.includes(":"))) {
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  const digits = text.replace(/\.\d+/, "").replace(/\D/g, "");
  if (digits.length === 10) {
    return Number(digits);
  }
  if (digits.length === 13) {
    return Math.floor(Number(digits) / 1000);
  }
  if (digits.length === 14) {
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6)) - 1;
    const day = Number(digits.slice(6, 8));
    const hour = Number(digits.slice(8, 10));
    const minute = Number(digits.slice(10, 12));
    const second = Number(digits.slice(12, 14));
    const utc = text.toUpperCase().endsWith("Z");
    const millis = utc
      ? Date.UTC(year, month, day, hour, minute, second)
      : new Date(year, month, day, hour, minute, second).getTime();
    return Math.floor(millis / 1000);
  }
  return null;
}

export function splitPlaylist(text) {
  const entries = [];
  let duration = 6;
  let programDate = "";
  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("#EXTINF:")) {
      duration = Number(line.slice(8).split(",", 1)[0]) || 6;
    } else if (line.startsWith("#EXT-X-PROGRAM-DATE-TIME:")) {
      programDate = line.slice(25).trim();
    } else if (line && !line.startsWith("#") && MEDIA_LINE.test(line)) {
      entries.push({ duration, programDate, uri: line.trim() });
      programDate = "";
      duration = 6;
    }
  }
  return entries;
}

export function buildLivePlaylist(playlist, baseUrl, limit = 9) {
  const entries = splitPlaylist(playlist);
  if (!entries.length) {
    return null;
  }
  const selected = entries.slice(-Math.max(3, limit));
  const targetDuration = Math.max(
    1,
    ...selected.map((entry) => Math.ceil(entry.duration))
  );
  const firstTime = selected[0].programDate
    ? Date.parse(selected[0].programDate)
    : Date.now();
  const mediaSequence = Math.max(
    0,
    Math.floor((Number.isFinite(firstTime) ? firstTime : Date.now()) / 1000 / targetDuration)
  );
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    `#EXT-X-MEDIA-SEQUENCE:${mediaSequence}`
  ];
  for (const entry of selected) {
    const absoluteUrl = new URL(entry.uri, baseUrl).toString();
    if (entry.programDate) {
      lines.push(`#EXT-X-PROGRAM-DATE-TIME:${entry.programDate}`);
    }
    lines.push(`#EXTINF:${entry.duration.toFixed(3)},`);
    lines.push(absoluteUrl);
  }
  return {
    text: `${lines.join("\n")}\n`,
    entries: selected.map((entry) => ({
      ...entry,
      uri: new URL(entry.uri, baseUrl).toString()
    }))
  };
}

export function rewritePlaylist(playlist, baseUrl, rewriteUrl) {
  const lines = playlist.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  for (const line of lines) {
    if (!line) {
      output.push(line);
      continue;
    }
    if (line.startsWith("#")) {
      output.push(
        line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          return `URI="${rewriteUrl(new URL(uri, baseUrl).toString())}"`;
        })
      );
      continue;
    }
    output.push(rewriteUrl(new URL(line.trim(), baseUrl).toString()));
  }
  return output.join("\n");
}

export function toCatchupRange(start, end) {
  return `${formatCompactTime(start)}-${formatCompactTime(end)}`;
}

export function formatCompactTime(seconds) {
  const date = new Date(Number(seconds) * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}
