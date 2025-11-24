// src/js/modules/downloadQualityModal.js

import { showToast } from "./toast.js";

const modal = document.getElementById("download-quality-modal");
const optionsContainer = document.getElementById("download-quality-options");
const loadingEl = document.getElementById("download-quality-loading");
const emptyEl = document.getElementById("download-quality-empty");
const confirmBtn = document.getElementById("download-quality-confirm");
const cancelBtn = document.getElementById("download-quality-cancel");
const closeBtn = modal?.querySelector("[data-quality-close]");
const tabButtons = Array.from(
  document.querySelectorAll(".quality-tab[data-quality-tab]"),
);
const bestBtn = document.getElementById("download-quality-best");
const thumbEl = document.getElementById("download-quality-thumb");
const titleEl = document.getElementById("download-quality-name");
const uploaderEl = document.getElementById("download-quality-uploader");
const durationEl = document.getElementById("download-quality-duration");
const openSourceBtn = document.getElementById("download-quality-open-source");

const bytesToSize = (bytes) => {
  if (!bytes || Number(bytes) <= 0) return "";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value > 9 ? 0 : 1)} ${units[exponent]}`;
};

const secondsToTime = (sec) => {
  const total = Math.max(0, Number(sec) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

const state = {
  resolver: null,
  rejecter: null,
  currentTab: "video",
  selectedOption: null,
  optionMap: new Map(),
  info: null,
  forceAudio: false,
  defaultQuality: "Source",
};

const extractHeight = (fmt) => {
  if (fmt?.height) return Number(fmt.height) || 0;
  const res =
    fmt?.resolution || fmt?.format_note || fmt?.quality || fmt?.format || "";
  const m1 = String(res).match(/(\d{3,4})[pP]/);
  if (m1) return Number(m1[1]) || 0;
  const m2 = String(res).match(/x(\d{3,4})/);
  if (m2) return Number(m2[1]) || 0;
  return 0;
};

const sortScore = (fmt) => {
  let score = 0;
  const hosts = {
    premiumyoutubekidsclient: -2,
    ytmusic: -1,
  };
  if (fmt?.downloader_options?.http_chunk_size) score -= 0.5;
  if (Array.isArray(fmt?.downloader_options?.http_headers)) {
    const host = fmt.downloader_options.http_headers
      .map((h) => h.value || "")
      .find((val) => /GoogleAccounts|cookie/i.test(val));
    if (host) score -= 1;
  }
  if (fmt.fragment_base_url && state.info?.webpage_url) {
    if (!fmt.fragment_base_url.includes(state.info.webpage_url)) {
      score -= 0.5;
    }
  }
  const realHeight = extractHeight(fmt);
  const fps = Number(fmt?.fps || 0);
  const tbr = Number(fmt?.tbr || fmt?.vbr || 0);
  const abr = Number(fmt?.abr || 0);
  score += realHeight * 2;
  score += fps * 0.5;
  score += (tbr + abr) / 50;
  return score;
};

function setModalOpen(flag) {
  if (!modal) return;
  modal.classList.toggle("is-open", flag);
  modal.setAttribute("aria-hidden", flag ? "false" : "true");
  document.body.classList.toggle("modal-scroll-lock", flag);
}

function resetModalState() {
  state.selectedOption = null;
  state.optionMap.clear();
  optionsContainer.innerHTML = "";
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Скачать выбранное";
  emptyEl?.classList.add("hidden");
}

function setLoading(flag) {
  if (flag) {
    loadingEl?.classList.remove("hidden");
  } else {
    loadingEl?.classList.add("hidden");
  }
}

function renderPreview(info, url) {
  if (!info) return;
  titleEl.textContent = info.title || "Без названия";
  uploaderEl.textContent = info.uploader || info.channel || "";
  durationEl.textContent = info.duration
    ? `Длительность: ${secondsToTime(info.duration)}`
    : "";
  if (info.thumbnail) {
    thumbEl.src = info.thumbnail;
    thumbEl.style.display = "";
  } else {
    thumbEl.removeAttribute("src");
    thumbEl.style.display = "none";
  }
  const targetUrl =
    info.webpage_url || info.original_url || info.url || url || "";
  if (openSourceBtn) {
    openSourceBtn.disabled = !targetUrl;
    openSourceBtn.onclick = () => {
      if (!targetUrl) return;
      window.electron.invoke("open-external-link", targetUrl).catch((err) => {
        console.error("Не удалось открыть источник:", err);
        showToast("Не удалось открыть источник.", "error");
      });
    };
  }
}

function describeFormat(format) {
  const parts = [];
  if (format.height) parts.push(`${format.height}p`);
  else if (format.format_note) parts.push(format.format_note);
  if (format.fps) parts.push(`${format.fps}fps`);
  if (format.vcodec && format.vcodec !== "none")
    parts.push(format.vcodec.replace(/^avc1\./, "h.264"));
  if (format.acodec && format.acodec !== "none")
    parts.push(format.acodec.replace(/^mp4a\./, "aac"));
  return parts.join(" • ").trim();
}

function collectFormats(info, videoUrl) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const muxed = [];
  const videoOnly = [];
  const audioOnly = [];

  formats.forEach((fmt) => {
    if (fmt.vcodec !== "none" && fmt.acodec !== "none") muxed.push(fmt);
    else if (fmt.vcodec !== "none" && fmt.acodec === "none")
      videoOnly.push(fmt);
    else if (fmt.vcodec === "none" && fmt.acodec !== "none")
      audioOnly.push(fmt);
  });

  const sorted = (arr, getter) =>
    arr
      .slice()
      .sort((a, b) => (getter(b) || 0) - (getter(a) || 0))
      .filter((fmt) => !!fmt.format_id);

  const muxedSorted = muxed
    .map((fmt) => ({ fmt, score: sortScore(fmt) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.fmt);

  return {
    muxed: muxedSorted.length
      ? muxedSorted
      : sorted(videoOnly, (f) => f.height || f.tbr),
    videoOnly: sorted(videoOnly, (f) => f.height || f.tbr),
    audioOnly: sorted(audioOnly, (f) => f.abr || f.tbr),
  };
}

function buildOptionPayload({
  type,
  label,
  videoFormat,
  audioFormat,
  videoExt,
  audioExt,
  resolution,
  fps,
  isMuxed,
}) {
  return {
    type,
    label,
    videoFormatId: videoFormat || null,
    audioFormatId: audioFormat || null,
    videoExt: videoExt || null,
    audioExt: audioExt || null,
    resolution: resolution || "",
    fps: fps || null,
    isMuxed: !!isMuxed,
  };
}

function formatOptionData(fmt, overrides = {}) {
  const resolution =
    overrides.resolution ||
    fmt.resolution ||
    (fmt.height ? `${fmt.height}p` : "");
  const fps = overrides.fps || fmt.fps || null;
  const videoExt = overrides.videoExt || fmt.ext || null;
  return { resolution, fps, videoExt };
}

function buildOptions(info) {
  const { muxed, videoOnly, audioOnly } = collectFormats(
    info,
    info?.webpage_url || info?.original_url,
  );
  const bestAudio = audioOnly[0] || null;
  const optionGroups = {
    video: [],
    "video-only": [],
    audio: [],
  };

  muxed.forEach((fmt) => {
    const { resolution, fps, videoExt } = formatOptionData(fmt);
    optionGroups.video.push({
      id: `muxed-${fmt.format_id}`,
      tab: "video",
      title: resolution || fmt.format_note || fmt.format_id,
      description: describeFormat(fmt),
      extLabel: (videoExt || fmt.ext || "").toUpperCase(),
      sizeLabel: bytesToSize(fmt.filesize || fmt.filesize_approx),
      extra: fmt.dynamic_range ? fmt.dynamic_range.toUpperCase() : "",
      score: sortScore(fmt) + 10, // бонус за готовое muxed-видео
      payload: buildOptionPayload({
        type: "muxed",
        label: resolution || fmt.format_note || "Видео",
        videoFormat: fmt.format_id,
        audioFormat: null,
        videoExt,
        audioExt: null,
        resolution,
        fps,
        isMuxed: true,
      }),
    });
  });

  videoOnly.forEach((fmt) => {
    const { resolution, fps, videoExt } = formatOptionData(fmt);
    const hasAudioPair = !!bestAudio;
    optionGroups.video.push({
      id: `pair-${fmt.format_id}`,
      tab: "video",
      title: resolution || fmt.format_note || fmt.format_id,
      description: `${describeFormat(fmt)} • аудио: ${
        bestAudio?.abr ? `${bestAudio.abr}kbps` : "нет"
      }`,
      extLabel: (videoExt || "mp4").toUpperCase(),
      sizeLabel: bytesToSize(
        (fmt.filesize || fmt.filesize_approx || 0) +
          (bestAudio?.filesize || bestAudio?.filesize_approx || 0),
      ),
      extra: hasAudioPair ? "+ лучший звук" : "без аудио",
      score: sortScore(fmt) + (hasAudioPair ? 5 : 0),
      payload: buildOptionPayload({
        type: "pair",
        label: hasAudioPair
          ? `${resolution || "Видео"} + аудио`
          : `${resolution || "Видео"}`,
        videoFormat: fmt.format_id,
        audioFormat: bestAudio?.format_id || null,
        videoExt,
        audioExt: bestAudio?.ext || null,
        resolution,
        fps,
      }),
    });

    optionGroups["video-only"].push({
      id: `video-only-${fmt.format_id}`,
      tab: "video-only",
      title: resolution || fmt.format_note || fmt.format_id,
      description: describeFormat(fmt),
      extLabel: (videoExt || "mp4").toUpperCase(),
      sizeLabel: bytesToSize(fmt.filesize || fmt.filesize_approx),
      extra: "без аудио",
      score: sortScore(fmt),
      payload: buildOptionPayload({
        type: "video-only",
        label: `${resolution || "Видео"} (без звука)`,
        videoFormat: fmt.format_id,
        audioFormat: null,
        videoExt,
        audioExt: null,
        resolution,
        fps,
      }),
    });
  });

  audioOnly.forEach((fmt) => {
    const size = bytesToSize(fmt.filesize || fmt.filesize_approx);
    optionGroups.audio.push({
      id: `audio-${fmt.format_id}`,
      tab: "audio",
      title: fmt.format_note || `${fmt.abr || fmt.tbr || 0}kbps`,
      description: `${(fmt.acodec || "").toUpperCase()} • ${
        fmt.abr || fmt.tbr || "?"
      } kbps`,
      extLabel: (fmt.ext || "m4a").toUpperCase(),
      sizeLabel: size,
      extra: "",
      score: (fmt.abr || fmt.tbr || 0) / 10,
      payload: buildOptionPayload({
        type: "audio-only",
        label: fmt.format_note || "Аудио",
        videoFormat: null,
        audioFormat: fmt.format_id,
        videoExt: null,
        audioExt: fmt.ext || "m4a",
        resolution: fmt.format_note || "audio",
        fps: null,
      }),
    });
  });

  return optionGroups;
}

function renderOptions(tab) {
  const list = (state.optionMap.get(tab) || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  optionsContainer.innerHTML = "";
  if (list.length === 0) {
    emptyEl?.classList.remove("hidden");
    return;
  }
  emptyEl?.classList.add("hidden");
  const frag = document.createDocumentFragment();
  list.forEach((option) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "quality-option";
    el.dataset.optionId = option.id;
    el.setAttribute("role", "radio");
    el.setAttribute("aria-checked", "false");
    el.innerHTML = `
      <div class="quality-option-main">
        <div>
          <p class="quality-option-title">${option.title}</p>
          <p class="quality-option-desc">${option.description || ""}</p>
        </div>
        <div class="quality-option-tags">
          <span class="tag">${option.extLabel || ""}</span>
          ${
            option.sizeLabel
              ? `<span class="tag tag-soft">${option.sizeLabel}</span>`
              : ""
          }
          ${
            option.extra
              ? `<span class="tag tag-accent">${option.extra}</span>`
              : ""
          }
        </div>
      </div>
    `;
    frag.appendChild(el);
  });
  optionsContainer.appendChild(frag);
}

function selectOption(option) {
  state.selectedOption = option;
  confirmBtn.disabled = !option;
  if (option) {
    confirmBtn.textContent = `Скачать (${option.payload.label})`;
  } else {
    confirmBtn.textContent = "Скачать выбранное";
  }
  Array.from(optionsContainer.children).forEach((el) => {
    const isActive = el.dataset.optionId === option?.id;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-checked", String(isActive));
  });
}

function handleOptionClick(event) {
  const optionEl = event.target.closest(".quality-option");
  if (!optionEl) return;
  const options = state.optionMap.get(state.currentTab) || [];
  const option = options.find((opt) => opt.id === optionEl.dataset.optionId);
  if (!option) return;
  selectOption(option);
  if (event.detail >= 2) {
    confirmSelection();
  }
}

function setActiveTab(tab) {
  state.currentTab = tab;
  tabButtons.forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.qualityTab === tab),
  );
  renderOptions(tab);
  selectOption(null);
}

function selectBestFromTab(tab) {
  const list = state.optionMap.get(tab) || [];
  if (!list.length) return false;
  const best = list.reduce(
    (acc, cur) => ((cur.score || 0) > (acc.score || 0) ? cur : acc),
    list[0],
  );
  if (state.currentTab !== tab) setActiveTab(tab);
  selectOption(best);
  return true;
}

function selectBestVideoOption(showWarning = false) {
  const ok = selectBestFromTab("video");
  if (!ok && showWarning) {
    showToast("Видео варианты недоступны для этой ссылки.", "warning");
  }
  return ok;
}

function selectByPreferredLabel(label) {
  if (!label) return false;
  const tabs = ["video", "video-only", "audio"];
  for (const tab of tabs) {
    const options = state.optionMap.get(tab) || [];
    const match = options.find(
      (opt) =>
        opt?.payload?.label === label ||
        opt?.title === label ||
        opt?.payload?.resolution === label,
    );
    if (match) {
      setActiveTab(tab);
      selectOption(match);
      return true;
    }
  }
  return false;
}

function closeModal(result = null) {
  setModalOpen(false);
  resetModalState();
  tabButtons.forEach((btn) => btn.classList.remove("active"));
  tabButtons
    .find((btn) => btn.dataset.qualityTab === "video")
    ?.classList.add("active");
  if (state.resolver) {
    state.resolver(result);
    state.resolver = null;
  }
}

function confirmSelection() {
  if (!state.selectedOption) return;
  closeModal(state.selectedOption.payload);
}

function bindEvents() {
  if (!modal.dataset.listenerAttached) {
    optionsContainer.addEventListener("click", handleOptionClick);
    cancelBtn?.addEventListener("click", () => closeModal(null));
    closeBtn?.addEventListener("click", () => closeModal(null));
    tabButtons.forEach((btn) =>
      btn.addEventListener("click", () => {
        const tab = btn.dataset.qualityTab;
        if (tab) setActiveTab(tab);
      }),
    );
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(null);
    });
    document.addEventListener("keydown", (event) => {
      if (!modal.classList.contains("is-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal(null);
      }
    });
    confirmBtn?.addEventListener("click", confirmSelection);
    bestBtn?.addEventListener("click", () => {
      if (bestBtn.disabled) return;
      selectBestVideoOption(true);
    });
    modal.dataset.listenerAttached = "1";
  }
}

async function openDownloadQualityModal(url, opts = {}) {
  if (!modal) {
    showToast("Не удалось открыть выбор качества.", "error");
    return null;
  }
  bindEvents();
  state.forceAudio = !!opts.forceAudioOnly;
  state.defaultQuality = opts.presetQuality || "Source";
  setModalOpen(true);
  setLoading(true);
  if (bestBtn) bestBtn.disabled = true;
  resetModalState();
  return new Promise(async (resolve) => {
    state.resolver = resolve;
    try {
      const info = await window.electron.ipcRenderer.invoke(
        "get-video-info",
        url,
      );
      state.info = info;
      renderPreview(info, url);
      const groups = buildOptions(info);
      state.optionMap = new Map(Object.entries(groups));
      setLoading(false);
      if (bestBtn) {
        bestBtn.disabled = !((state.optionMap.get("video") || []).length > 0);
      }
      const targetTab = state.forceAudio ? "audio" : "video";
      setActiveTab(targetTab);
      const preferredLabel = opts.preferredLabel || null;
      let picked = false;
      if (preferredLabel) {
        picked = selectByPreferredLabel(preferredLabel);
      }

      if (!picked) {
        if (state.forceAudio || state.defaultQuality === "Audio Only") {
          const audioSelected = selectBestFromTab("audio");
          if (!audioSelected) {
            showToast("Аудио варианты недоступны для этой ссылки.", "warning");
            selectBestVideoOption();
          } else if (state.forceAudio) {
            confirmSelection();
          }
        } else {
          if (!selectBestVideoOption() && !selectBestFromTab("video-only")) {
            selectBestFromTab("audio");
          }
        }
      }
    } catch (error) {
      console.error("Ошибка получения форматов:", error);
      showToast("Не удалось получить доступные качества.", "error");
      closeModal(null);
      resolve(null);
    } finally {
      setLoading(false);
    }
  });
}

export { openDownloadQualityModal };
