const ANALYZE_DELAY_MS = 450;

function parseSingleUrl(value) {
  const input = String(value || "").trim();
  if (!input) return { error: "empty", url: "" };
  if (/\s/.test(input)) return { error: "multiple", url: "" };
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { error: "invalid", url: "" };
    }
    return { error: "", url: url.toString() };
  } catch {
    return { error: "invalid", url: "" };
  }
}

function optionLabel(option = {}) {
  return option.meta ? `${option.title} (${option.meta})` : option.title;
}

function createCompactQuality({
  input,
  videoSelect,
  audioSelect,
  status,
  actions,
  request,
}) {
  let preview = null;
  let analyzedUrl = "";
  let timer = null;
  let requestVersion = 0;

  const setStatus = (text, tone = "muted") => {
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const setActionsDisabled = (disabled) => {
    actions.forEach((button) => {
      button.disabled = disabled;
    });
  };

  const reset = (
    message = "Вставьте одну ссылку для анализа форматов",
    tone = "muted",
  ) => {
    preview = null;
    analyzedUrl = "";
    videoSelect.replaceChildren();
    audioSelect.replaceChildren();
    videoSelect.disabled = true;
    audioSelect.disabled = true;
    setActionsDisabled(true);
    setStatus(message, tone);
  };

  const renderSelect = (select, options) => {
    select.replaceChildren();
    options.forEach((option) => {
      const node = document.createElement("option");
      node.value = option.id;
      node.textContent = optionLabel(option);
      node.disabled = Boolean(option.disabled);
      select.appendChild(node);
    });
    select.disabled = options.length === 0;
  };

  const selectedOption = (options, select) =>
    options.find((option) => option.id === select.value) || options[0] || null;

  const syncAudioOptions = () => {
    if (!preview) return;
    const video = selectedOption(preview.videoOptions, videoSelect);
    preview.audioOptions.forEach((option) => {
      if (option.source === "mp3") option.disabled = video?.kind !== "none";
      if (option.kind === "none")
        option.disabled = video?.source !== "video-only";
    });
    const previous = audioSelect.value;
    renderSelect(audioSelect, preview.audioOptions);
    const reusable = preview.audioOptions.find(
      (option) => option.id === previous && !option.disabled,
    );
    const fallback = preview.audioOptions.find(
      (option) => option.kind === "audio" && !option.disabled,
    );
    audioSelect.value = reusable?.id || fallback?.id || "";
  };

  const getQuality = () => {
    if (!preview) return null;
    const video = selectedOption(preview.videoOptions, videoSelect);
    const audio = selectedOption(preview.audioOptions, audioSelect);
    if (!video || !audio || video.disabled || audio.disabled) return null;
    if (video.kind === "none") return audio.payload;
    if (audio.kind === "none")
      return video.source === "video-only" ? video.payload : null;
    if (video.source === "muxed") return video.payload;
    if (!video.payload?.videoFormatId || !audio.payload?.audioFormatId)
      return null;
    return {
      ...video.payload,
      type: "pair",
      label: `${video.title} с аудио`,
      audioFormatId: audio.payload.audioFormatId,
      audioExt: audio.payload.audioExt,
      isMuxed: false,
    };
  };

  const syncSelection = () => {
    const quality = getQuality();
    setActionsDisabled(!quality);
    setStatus(
      quality
        ? "Форматы готовы к загрузке"
        : "Выберите совместимые видео и аудио",
      quality ? "success" : "warning",
    );
  };

  const analyze = async () => {
    const parsed = parseSingleUrl(input.value);
    if (parsed.error === "empty") {
      reset();
      return;
    }
    if (parsed.error === "multiple") {
      reset("Компактный режим принимает только одну ссылку", "error");
      return;
    }
    if (parsed.error) {
      reset("Введите корректный HTTP(S) URL", "error");
      return;
    }
    const version = ++requestVersion;
    reset("Анализируем доступные форматы…", "loading");
    try {
      const { preview: result } = await request("/api/preview", {
        method: "POST",
        body: JSON.stringify({ url: parsed.url }),
      });
      if (version !== requestVersion) return;
      preview = result;
      analyzedUrl = parsed.url;
      renderSelect(videoSelect, preview.videoOptions || []);
      syncAudioOptions();
      syncSelection();
    } catch {
      if (version !== requestVersion) return;
      reset("Не удалось получить форматы для этой ссылки", "error");
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    requestVersion += 1;
    setActionsDisabled(true);
    timer = setTimeout(() => void analyze(), ANALYZE_DELAY_MS);
  };

  input.addEventListener("input", schedule);
  videoSelect.addEventListener("change", () => {
    syncAudioOptions();
    syncSelection();
  });
  audioSelect.addEventListener("change", syncSelection);
  reset();

  return {
    analyze,
    clear() {
      clearTimeout(timer);
      requestVersion += 1;
      reset();
    },
    getPayload() {
      const parsed = parseSingleUrl(input.value);
      if (parsed.error || parsed.url !== analyzedUrl) return null;
      const quality = getQuality();
      return quality ? { quality, url: parsed.url } : null;
    },
  };
}

const compactQualityApi = { createCompactQuality, parseSingleUrl };
if (typeof module !== "undefined") module.exports = compactQualityApi;
if (typeof window !== "undefined") window.WebCompactQuality = compactQualityApi;
