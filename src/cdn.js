const ORIGINS = [
  {
    base: "https://ldocctvwbcdbyte.volcfcdn.com",
    path: "/ldocctvwbcd"
  },
  {
    base: "https://ldcctvwbcdks.v.kcdnvip.com",
    path: "/ldcctvwbcd"
  },
  {
    base: "https://ldcctvwbcdtxy.liveplay.myqcloud.com",
    path: "/ldcctvwbcd"
  },
  {
    base: "https://ldocctvwbcdks.v.kcdnvip.com",
    path: "/ldocctvwbcd"
  }
];
const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Referer: "https://tv.cctv.com/"
};

const STREAM_IDS = {
  cctv5p: "cctv5plus"
};

function masterUrls(channel) {
  const streamId = STREAM_IDS[channel.slug] || channel.slug;
  const candidates = [];
  const add = (origin, id) => {
    candidates.push(
      `${origin.base}${origin.path}/cdrmld${id}_1/index.m3u8?b=200-4000`
    );
  };
  if (channel.slug === "cctv16") {
    add(ORIGINS[1], "cctv16");
    add(ORIGINS[0], "cctv16");
    add(ORIGINS[2], "cctv16");
    return [...new Set(candidates)];
  }
  if (channel.slug === "cctv164k") {
    add(ORIGINS[1], "cctv16");
    add(ORIGINS[0], "cctv16");
    add(ORIGINS[0], "cctv164k");
    add(ORIGINS[2], "cctv164k");
    return [...new Set(candidates)];
  }
  if (channel.slug === "cctv11" || channel.slug === "cctv12"
      || channel.slug === "cctv14" || channel.slug === "cctv15"
      || channel.slug === "cctv17") {
    add(ORIGINS[3], streamId);
    add(ORIGINS[0], streamId);
    add(ORIGINS[2], streamId);
    return [...new Set(candidates)];
  }
  add(ORIGINS[0], streamId);
  add(ORIGINS[1], streamId);
  add(ORIGINS[2], streamId);
  return [...new Set(candidates)];
}

async function fetchText(url) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        throw new Error(`direct CDN HTTP ${response.status}`);
      }
      return {
        text: await response.text(),
        finalUrl: response.url || url
      };
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }
  throw lastError;
}

function variants(playlist, baseUrl) {
  if (!playlist.includes("#EXT-X-STREAM-INF")) {
    return [];
  }
  const result = [];
  const lines = playlist.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("#EXT-X-STREAM-INF")) {
      continue;
    }
    const resolution = lines[index].match(/RESOLUTION=(\d+)x(\d+)/);
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next].trim();
      if (!candidate || candidate.startsWith("#")) {
        continue;
      }
      result.push({
        url: new URL(candidate, baseUrl).toString(),
        width: resolution ? Number(resolution[1]) : 0,
        height: resolution ? Number(resolution[2]) : 0
      });
      break;
    }
  }
  return result;
}

function chooseVariant(variantsList, quality) {
  if (!variantsList.length) {
    return null;
  }
  const requested = String(quality || "1080").toLowerCase();
  if (requested === "4k") {
    return (
      variantsList.find((item) => item.height >= 2160) ||
      variantsList.reduce((best, item) =>
        item.height > best.height ? item : best
      )
    );
  }
  const target = requested === "720" ? 720 : requested === "480" ? 480 : 1080;
  return (
    variantsList.find((item) => item.height === target) ||
    variantsList.find((item) => item.height >= target) ||
    variantsList[0]
  );
}

export async function fetchDirectPlaylist(channel, quality = "1080") {
  let lastError = null;
  for (const masterUrl of masterUrls(channel)) {
    try {
      const master = await fetchText(masterUrl);
      const variantList = variants(master.text, master.finalUrl);
      if (!variantList.length) {
        if (master.text.includes("#EXTINF:")) {
          return {
            text: master.text,
            finalUrl: master.finalUrl,
            headers: HEADERS,
            quality: { requested: quality, actual: "unknown" }
          };
        }
        throw new Error("direct CDN master has no variants");
      }
      const selected = chooseVariant(variantList, quality);
      for (const variant of [selected, ...variantList]) {
        try {
          const media = await fetchText(variant.url);
          if (media.text.includes("#EXTINF:")) {
            return {
              text: media.text,
              finalUrl: media.finalUrl,
              headers: HEADERS,
              quality: {
                requested: quality,
                actual: variant.height ? `${variant.height}p` : "unknown"
              }
            };
          }
        } catch (error) {
          lastError = error;
        }
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("direct CDN unavailable");
}
