export const CHANNELS = [
  { slug: "cctv1", name: "CCTV-1 综合", sid: "2024078201", pid: "600001859", group: "央视", catchup: true },
  { slug: "cctv2", name: "CCTV-2 财经", sid: "2024075401", pid: "600001800", group: "央视", catchup: true },
  { slug: "cctv3", name: "CCTV-3 综艺", sid: "2024068501", pid: "600001801", group: "央视", catchup: true },
  { slug: "cctv4", name: "CCTV-4 中文国际", sid: "2029797101", pid: "600001814", group: "央视", catchup: true },
  { slug: "cctv5", name: "CCTV-5 体育", sid: "2024078401", pid: "600001818", group: "央视", catchup: true },
  { slug: "cctv5p", name: "CCTV-5+ 体育赛事", sid: "2024078001", pid: "600001817", group: "央视", catchup: true },
  { slug: "cctv6", name: "CCTV-6 电影", sid: "2013693901", pid: "600108442", group: "央视", catchup: true },
  { slug: "cctv7", name: "CCTV-7 国防军事", sid: "2024072001", pid: "600004092", group: "央视", catchup: true },
  { slug: "cctv8", name: "CCTV-8 电视剧", sid: "2029793001", pid: "600001803", group: "央视", catchup: true },
  { slug: "cctv9", name: "CCTV-9 纪录", sid: "2024078601", pid: "600004078", group: "央视", catchup: true },
  { slug: "cctv10", name: "CCTV-10 科教", sid: "2024078701", pid: "600001805", group: "央视", catchup: true },
  { slug: "cctv11", name: "CCTV-11 戏曲", sid: "2027248701", pid: "600001806", group: "央视", catchup: false },
  { slug: "cctv12", name: "CCTV-12 社会与法", sid: "2027248801", pid: "600001807", group: "央视", catchup: false },
  { slug: "cctv13", name: "CCTV-13 新闻", sid: "2029797201", pid: "600001811", group: "央视", catchup: true },
  { slug: "cctv14", name: "CCTV-14 少儿", sid: "2027248901", pid: "600001809", group: "央视", catchup: false },
  { slug: "cctv15", name: "CCTV-15 音乐", sid: "2027249001", pid: "600001815", group: "央视", catchup: false },
  { slug: "cctv16", name: "CCTV-16 奥林匹克", sid: "2027249101", pid: "600098637", group: "央视", catchup: false },
  { slug: "cctv164k", name: "CCTV-16 4K", sid: "2027249301", pid: "600099502", group: "央视", catchup: false },
  { slug: "cctv17", name: "CCTV-17 农业农村", sid: "2027249401", pid: "600001810", group: "央视", catchup: false },
  { slug: "cctv4k", name: "CCTV-4K 超高清", sid: "2029810301", pid: "600002264", group: "央视", catchup: false },
  { slug: "cctv8k", name: "CCTV-8K 超高清", sid: "2026774101", pid: "600156816", group: "央视", catchup: true },
  { slug: "cgtn", name: "CGTN", sid: "2024181701", pid: "600014550", group: "央视", catchup: true },
  { slug: "cgtnfr", name: "CGTN 法语", sid: "2024181801", pid: "600084704", group: "央视", catchup: true },
  { slug: "cgtnru", name: "CGTN 俄语", sid: "2024181901", pid: "600084758", group: "央视", catchup: true },
  { slug: "cgtnar", name: "CGTN 阿拉伯语", sid: "2024182001", pid: "600084782", group: "央视", catchup: true },
  { slug: "cgtnes", name: "CGTN 西班牙语", sid: "2024182101", pid: "600084744", group: "央视", catchup: true },
  { slug: "cgtndoc", name: "CGTN 纪录", sid: "2024182301", pid: "600084781", group: "央视", catchup: true },
  { slug: "cctvfyjc", name: "CCTV 风云剧场", sid: "2025637102", pid: "600099658", group: "央视", catchup: false },
  { slug: "cctvdyjc", name: "CCTV 第一剧场", sid: "2026874202", pid: "600099655", group: "央视", catchup: false },
  { slug: "cctvhjjc", name: "CCTV 怀旧剧场", sid: "2026874302", pid: "600099620", group: "央视", catchup: false },
  { slug: "bjws", name: "北京卫视", sid: "2024052703", pid: "600002309", group: "卫视", catchup: true },
  { slug: "jsws", name: "江苏卫视", sid: "2024171103", pid: "600002521", group: "卫视", catchup: true },
  { slug: "dfws", name: "东方卫视", sid: "2024054503", pid: "600002483", group: "卫视", catchup: true },
  { slug: "zjws", name: "浙江卫视", sid: "2024054703", pid: "600002520", group: "卫视", catchup: true },
  { slug: "hnws", name: "湖南卫视", sid: "2024054803", pid: "600002475", group: "卫视", catchup: true },
  { slug: "hbws", name: "湖北卫视", sid: "2024171203", pid: "600002508", group: "卫视", catchup: true },
  { slug: "gdws", name: "广东卫视", sid: "2024060903", pid: "600002485", group: "卫视", catchup: true },
  { slug: "gxws", name: "广西卫视", sid: "2024060703", pid: "600002509", group: "卫视", catchup: true },
  { slug: "hljws", name: "黑龙江卫视", sid: "2029797003", pid: "600002498", group: "卫视", catchup: true },
  { slug: "hainanws", name: "海南卫视", sid: "2024055603", pid: "600002506", group: "卫视", catchup: true },
  { slug: "cqws", name: "重庆卫视", sid: "2024061103", pid: "600002531", group: "卫视", catchup: true },
  { slug: "szws", name: "深圳卫视", sid: "2024061303", pid: "600002481", group: "卫视", catchup: true },
  { slug: "scws", name: "四川卫视", sid: "2024061403", pid: "600002516", group: "卫视", catchup: true },
  { slug: "henanws", name: "河南卫视", sid: "2029797303", pid: "600002525", group: "卫视", catchup: true },
  { slug: "dnws", name: "东南卫视", sid: "2024061503", pid: "600002484", group: "卫视", catchup: true },
  { slug: "gzws", name: "贵州卫视", sid: "2024061603", pid: "600002490", group: "卫视", catchup: true },
  { slug: "jxws", name: "江西卫视", sid: "2024061703", pid: "600002503", group: "卫视", catchup: true },
  { slug: "lnws", name: "辽宁卫视", sid: "2024171303", pid: "600002505", group: "卫视", catchup: true },
  { slug: "ahws", name: "安徽卫视", sid: "2024171403", pid: "600002532", group: "卫视", catchup: true },
  { slug: "hebws", name: "河北卫视", sid: "2024171503", pid: "600002493", group: "卫视", catchup: true },
  { slug: "sdws", name: "山东卫视", sid: "2029787903", pid: "600002513", group: "卫视", catchup: true },
  { slug: "tjws", name: "天津卫视", sid: "2019927003", pid: "600152137", group: "卫视", catchup: true },
  { slug: "jlws", name: "吉林卫视", sid: "2025561503", pid: "600190405", group: "卫视", catchup: true },
  { slug: "saxws", name: "陕西卫视", sid: "2029795103", pid: "600190400", group: "卫视", catchup: true },
  { slug: "nxws", name: "宁夏卫视", sid: "2025608503", pid: "600190737", group: "卫视", catchup: true },
  { slug: "nmgws", name: "内蒙古卫视", sid: "2025561203", pid: "600190401", group: "卫视", catchup: true },
  { slug: "ynws", name: "云南卫视", sid: "2025561303", pid: "600190402", group: "卫视", catchup: true },
  { slug: "shanxiws", name: "山西卫视", sid: "2025560803", pid: "600190407", group: "卫视", catchup: true },
  { slug: "gsws", name: "甘肃卫视", sid: "2025561703", pid: "600190408", group: "卫视", catchup: true },
  { slug: "qhws", name: "青海卫视", sid: "2025559103", pid: "600190406", group: "卫视", catchup: true },
  { slug: "xizangws", name: "西藏卫视", sid: "2025558003", pid: "600190403", group: "卫视", catchup: true },
  { slug: "xjws", name: "新疆卫视", sid: "2019927403", pid: "600152138", group: "卫视", catchup: true },
  { slug: "cetv1", name: "CETV-1", sid: "2022823801", pid: "600171827", group: "卫视", catchup: true },
  { slug: "guoxue", name: "国学频道", sid: "2029360403", pid: "600213139", group: "卫视", catchup: true }
];

export const CHANNEL_BY_SLUG = new Map(CHANNELS.map((channel) => [channel.slug, channel]));

export function findChannel(value) {
  const slug = String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.m3u8$/i, "")
    .toLowerCase();
  return CHANNEL_BY_SLUG.get(slug) || null;
}

export function channelLogo(slug) {
  return `https://garysclub.sharewithyou.dpdns.org/logos/ysp-live-logos/${slug}.png`;
}

export function buildM3u(origin) {
  const lines = [
    '#EXTM3U url-tvg="https://github.com/TvWasm/autoEPG/releases/latest/download/epg.xml"'
  ];
  for (const channel of CHANNELS) {
    const attrs = [
      `tvg-id="${channel.name.replace(/\s+/g, "")}"`,
      `tvg-name="${channel.name}"`,
      `tvg-logo="${channelLogo(channel.slug)}"`,
      `group-title="${channel.group}"`
    ];
    if (channel.catchup) {
      attrs.push('catchup="append"');
      attrs.push('catchup-days="7"');
      attrs.push('catchup-source="?playseek=${(b)yyyyMMddHHmmss}-${(e)yyyyMMddHHmmss}"');
    }
    lines.push(`#EXTINF:-1 ${attrs.join(" ")} ,${channel.name}`);
    lines.push(`${origin}/${channel.slug}.m3u8`);
  }
  return `${lines.join("\n")}\n`;
}
