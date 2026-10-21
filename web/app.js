const state = {
  channels: [],
  current: null,
  hls: null,
  live: true,
  lastChannelKey: "ntv-ysp.last-channel"
};

const elements = {
  list: document.querySelector("#list"),
  meta: document.querySelector("#meta"),
  search: document.querySelector("#search"),
  video: document.querySelector("#video"),
  status: document.querySelector("#status"),
  liveButton: document.querySelector("#liveButton"),
  seekTime: document.querySelector("#seekTime"),
  seekLength: document.querySelector("#seekLength"),
  replayButton: document.querySelector("#replayButton"),
  epgButton: document.querySelector("#epgButton"),
  soundButton: document.querySelector("#soundButton"),
  nowPlaying: document.querySelector("#nowPlaying"),
  clock: document.querySelector("#clock"),
  epgBackdrop: document.querySelector("#epgBackdrop"),
  epgPanel: document.querySelector("#epgPanel"),
  epgTitle: document.querySelector("#epgTitle"),
  epgSubtitle: document.querySelector("#epgSubtitle"),
  epgDate: document.querySelector("#epgDate"),
  epgRefresh: document.querySelector("#epgRefresh"),
  epgClose: document.querySelector("#epgClose"),
  epgList: document.querySelector("#epgList")
};

let epgRequestId = 0;

function setStatus(text, error = false) {
  elements.status.textContent = text;
  elements.status.classList.toggle("error", error);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDateTime(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function compactDate(date) {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function dateKey(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  );
}

function timeText(seconds) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(seconds * 1000));
}

function defaultCatchupTime() {
  elements.seekTime.value = localDateTime(new Date(Date.now() - 30 * 60 * 1000));
}

function renderChannels(filter = "") {
  const needle = filter.trim().toLowerCase();
  const groups = new Map();
  for (const channel of state.channels) {
    if (needle && !channel.name.toLowerCase().includes(needle)) {
      continue;
    }
    if (!groups.has(channel.group)) {
      groups.set(channel.group, []);
    }
    groups.get(channel.group).push(channel);
  }

  elements.list.replaceChildren();
  for (const [group, channels] of groups) {
    const heading = document.createElement("div");
    heading.className = "group";
    heading.textContent = group;
    elements.list.append(heading);
    for (const channel of channels) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "channel";
      button.dataset.slug = channel.slug;
      button.setAttribute("role", "option");
      if (state.current?.slug === channel.slug) {
        button.classList.add("active");
        button.setAttribute("aria-selected", "true");
      }

      const dot = document.createElement("span");
      dot.className = "dot";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = channel.name;
      button.append(dot, name);

      if (channel.catchup) {
        const badge = document.createElement("span");
        badge.className = "catchup";
        badge.textContent = "回看";
        button.append(badge);
      }
      button.addEventListener("click", () => playChannel(channel, { live: true }));
      elements.list.append(button);
    }
  }
}

function destroyPlayer() {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
  elements.video.pause();
  elements.video.removeAttribute("src");
  elements.video.load();
}

function attachPlayer(url, channel, live) {
  destroyPlayer();
  state.live = live;
  state.current = channel;
  state.current.url = url;
  localStorage.setItem(state.lastChannelKey, channel.slug);
  elements.nowPlaying.textContent = `${channel.name} · ${live ? "直播" : "回看"}`;
  elements.liveButton.classList.toggle("primary", live);
  renderChannels(elements.search.value);
  if (!elements.epgPanel.hidden) {
    loadEpg(channel);
  }

  const onReady = () => {
    setStatus(`${channel.name} · ${live ? "直播" : "回看"} · 已载入`);
  };
  const onError = (message) => {
    setStatus(`${channel.name} · ${message}`, true);
  };

  if (window.Hls && window.Hls.isSupported()) {
    const hls = new window.Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 60,
      manifestLoadingTimeOut: 20000,
      levelLoadingTimeOut: 20000,
      fragLoadingTimeOut: 30000
    });
    state.hls = hls;
    hls.loadSource(url);
    hls.attachMedia(elements.video);
    hls.on(window.Hls.Events.MANIFEST_PARSED, onReady);
    hls.on(window.Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) {
        return;
      }
      if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
        onError("载入失败，正在重试");
        window.setTimeout(() => hls.startLoad(), 1200);
      } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
        onError("解码异常，正在恢复");
        hls.recoverMediaError();
      } else {
        onError("播放器无法继续");
        hls.destroy();
      }
    });
  } else if (elements.video.canPlayType("application/vnd.apple.mpegurl")) {
    elements.video.src = url;
    elements.video.addEventListener("loadedmetadata", onReady, { once: true });
    elements.video.addEventListener("error", () => onError("浏览器不支持此视频流"), {
      once: true
    });
  } else {
    onError("当前浏览器不支持 HLS 播放");
    return;
  }

  elements.video.muted = false;
  elements.video.volume = 1;
  elements.video.play().then(() => {
    elements.soundButton.textContent = "声音";
  }).catch(() => {
    elements.video.muted = true;
    elements.soundButton.textContent = "开声音";
    elements.video.play().catch(() => {});
    setStatus(`${channel.name} · 点一下画面开启声音`);
  });
}

function playChannel(channel, options = {}) {
  const live = options.live !== false;
  if (!live && !channel.catchup) {
    setStatus(`${channel.name} 暂无稳定回看`, true);
    return;
  }
  const query = live ? "" : `?playseek=${options.range}`;
  attachPlayer(`/${channel.slug}.m3u8${query}`, channel, live);
}

function playCatchup() {
  const channel = state.current;
  if (!channel) {
    setStatus("请先选择频道", true);
    return;
  }
  if (!channel.catchup) {
    setStatus(`${channel.name} 暂无稳定回看`, true);
    return;
  }
  const end = new Date(elements.seekTime.value);
  if (!Number.isFinite(end.getTime())) {
    setStatus("请选择有效的回看时间", true);
    return;
  }
  const minutes = Math.max(1, Math.min(240, Number(elements.seekLength.value) || 30));
  const start = new Date(end.getTime() - minutes * 60 * 1000);
  const now = new Date();
  if (end > now) {
    end.setTime(now.getTime());
  }
  playChannel(channel, {
    live: false,
    range: `${compactDate(start)}-${compactDate(end)}`
  });
}

function populateEpgDates() {
  const selected = elements.epgDate.value;
  const options = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let offset = 0; offset > -7; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const value = dateKey(date);
    const label =
      offset === 0
        ? "今天"
        : offset === -1
          ? "昨天"
          : new Intl.DateTimeFormat("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              weekday: "short"
            }).format(date);
    options.push({ value, label });
  }
  elements.epgDate.replaceChildren();
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    elements.epgDate.append(element);
  }
  if (options.some((option) => option.value === selected)) {
    elements.epgDate.value = selected;
  }
}

async function loadEpg(channel = state.current, force = false) {
  if (!channel) {
    return;
  }
  const requestId = ++epgRequestId;
  elements.epgTitle.textContent = `${channel.name} 节目单`;
  elements.epgSubtitle.textContent = "正在读取";
  elements.epgList.replaceChildren();
  const loading = document.createElement("div");
  loading.id = "epgEmpty";
  loading.textContent = "正在加载节目单...";
  elements.epgList.append(loading);

  try {
    const params = new URLSearchParams({ date: elements.epgDate.value });
    if (force) {
      params.set("refresh", "1");
    }
    const response = await fetch(
      `/api/epg/${encodeURIComponent(channel.slug)}?${params}`,
      { cache: "no-store" }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (requestId !== epgRequestId || state.current?.slug !== channel.slug) {
      return;
    }
    elements.epgSubtitle.textContent = data.channelId
      ? `${data.programs.length} 个节目 · ${data.date}`
      : `节目单没有匹配到 ${channel.name}`;
    elements.epgList.replaceChildren();
    if (!data.programs.length) {
      const empty = document.createElement("div");
      empty.id = "epgEmpty";
      empty.textContent = "当前日期没有节目数据";
      elements.epgList.append(empty);
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    for (const program of data.programs) {
      const current = now >= program.start && now < program.stop;
      const future = program.start > now;
      const replayable = channel.catchup && program.stop <= now;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "program";
      button.setAttribute("role", "listitem");
      if (current) {
        button.classList.add("live");
      }
      button.disabled = future || (!current && !replayable);

      const time = document.createElement("span");
      time.className = "time";
      time.textContent = `${timeText(program.start)} - ${timeText(program.stop)}`;
      const title = document.createElement("span");
      title.className = "title";
      title.textContent = program.title;
      title.title = program.description || program.title;
      const status = document.createElement("span");
      status.className = "state";
      status.textContent = current
        ? "直播中"
        : future
          ? "未开始"
          : replayable
            ? "可回看"
            : "不可回看";
      button.append(time, title, status);

      if (current) {
        button.addEventListener("click", () => {
          playChannel(channel, { live: true });
          closeEpg();
        });
      } else if (replayable) {
        button.addEventListener("click", () => {
          elements.seekTime.value = localDateTime(new Date(program.stop * 1000));
          elements.seekLength.value = Math.max(
            1,
            Math.min(240, Math.round((program.stop - program.start) / 60))
          );
          playChannel(channel, {
            live: false,
            range: `${compactDate(new Date(program.start * 1000))}-${compactDate(
              new Date(program.stop * 1000)
            )}`
          });
          closeEpg();
        });
      }
      elements.epgList.append(button);
    }
  } catch (error) {
    if (requestId !== epgRequestId) {
      return;
    }
    elements.epgSubtitle.textContent = "读取失败";
    elements.epgList.replaceChildren();
    const empty = document.createElement("div");
    empty.id = "epgEmpty";
    empty.textContent = `节目单加载失败：${error.message}`;
    elements.epgList.append(empty);
  }
}

function openEpg() {
  if (!state.current) {
    setStatus("请先选择频道", true);
    return;
  }
  populateEpgDates();
  elements.epgBackdrop.hidden = false;
  elements.epgPanel.hidden = false;
  loadEpg(state.current);
  elements.epgClose.focus();
}

function closeEpg() {
  epgRequestId += 1;
  elements.epgBackdrop.hidden = true;
  elements.epgPanel.hidden = true;
  elements.epgButton.focus();
}

function setSound(on) {
  elements.video.muted = !on;
  elements.video.volume = 1;
  elements.soundButton.textContent = on ? "声音" : "开声音";
  if (on) {
    elements.video.play().catch(() => {});
  }
}

async function loadChannels() {
  try {
    const response = await fetch("/api/channels", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    state.channels = data.channels;
    elements.meta.textContent = `${state.channels.length} 路频道 · ${
      state.channels.filter((channel) => channel.catchup).length
    } 路支持七天回看`;
    renderChannels();
    const saved = localStorage.getItem(state.lastChannelKey);
    const initial =
      state.channels.find((channel) => channel.slug === saved) ||
      state.channels.find((channel) => channel.slug === "cctv1") ||
      state.channels[0];
    if (initial) {
      playChannel(initial, { live: true });
    }
  } catch (error) {
    elements.meta.textContent = "频道读取失败";
    setStatus(`无法连接服务：${error.message}`, true);
  }
}

function updateClock() {
  elements.clock.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date());
}

elements.search.addEventListener("input", () => renderChannels(elements.search.value));
elements.liveButton.addEventListener("click", () => {
  if (state.current) {
    playChannel(state.current, { live: true });
  }
});
elements.replayButton.addEventListener("click", playCatchup);
elements.epgButton.addEventListener("click", openEpg);
elements.epgClose.addEventListener("click", closeEpg);
elements.epgBackdrop.addEventListener("click", closeEpg);
elements.epgDate.addEventListener("change", () => loadEpg(state.current));
elements.epgRefresh.addEventListener("click", () => loadEpg(state.current, true));
elements.soundButton.addEventListener("click", () => setSound(elements.video.muted));
elements.video.addEventListener("click", () => setSound(true));
elements.video.addEventListener("volumechange", () => {
  elements.soundButton.textContent = elements.video.muted ? "开声音" : "声音";
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.epgPanel.hidden) {
    closeEpg();
  }
});

defaultCatchupTime();
populateEpgDates();
updateClock();
window.setInterval(updateClock, 1000);
loadChannels();
