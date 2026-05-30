// src/js/modules/urlInputHandler.js

import { urlInput } from "./domElements.js";
import { initTooltips } from "./tooltipInitializer.js";
import { isValidUrl, isSupportedUrl, normalizeUrlInput } from "./validation.js";
import { setCachedVideoInfo } from "./videoInfoCache.js";
import { updateButtonState } from "./state.js";
import { t } from "./i18n.js";
import { formatDownloadErrorToast } from "./downloadErrorUi.js";
import {
  RECOVERY_EVENT,
  applyDownloaderBackgroundPreview,
  clearDownloaderBackgroundPreview,
} from "./downloaderBackgroundPreview.js";
import {
  PLAY_EVENT as LIVE_PREVIEW_PLAY_EVENT,
  RETRY_EVENT as LIVE_PREVIEW_RETRY_EVENT,
  STATE_EVENT as LIVE_PREVIEW_STATE_EVENT,
  hideDownloaderLivePreview,
} from "./downloaderLivePreview.js";

const clearButton = document.getElementById("clear-url");
const pasteButton = document.getElementById("paste-url");
const selectFolderButton = document.getElementById("select-folder");
const sourceLinkButton = document.getElementById("url-source-link");
const urlErrorEl = document.getElementById("url-inline-error");
const previewSpinner = document.getElementById("url-preview-spinner");
const helperTextEl = document.getElementById("url-helper-text");
const BACKGROUND_RECOVERY_HANDLER_KEY =
  "__thunderLoadDownloaderBackgroundRecoveryHandler";
const LIVE_PREVIEW_RETRY_HANDLER_KEY =
  "__thunderLoadDownloaderLivePreviewRetryHandler";
const LIVE_PREVIEW_STATE_HANDLER_KEY =
  "__thunderLoadDownloaderLivePreviewStateHandler";
const AUTO_OPEN_QUALITY_MODAL_KEY = "downloadAutoOpenQualityModal";

function initUrlInputHandler() {
  if (!urlInput || !clearButton || !pasteButton || !selectFolderButton) return;

  const inputContainer = document.querySelector(".input-container");
  const wrapperEl = document.querySelector(".url-input-wrapper");
  const actionRowEl = document.querySelector(".url-input-action-row");

  const setStateClass = (className, enabled) => {
    wrapperEl?.classList.toggle(className, enabled);
    inputContainer?.classList.toggle(className, enabled);
  };

  const getIdleHelperKey = () => {
    const currentOnlyBtn = document.getElementById("preview-current-only");
    const isPlaylistPreviewVisible =
      currentOnlyBtn && currentOnlyBtn.style.display !== "none";
    if (isPlaylistPreviewVisible) return "input.url.helper.playlistChoice";
    const validation = getValidationState();
    return validation.isValid ? "input.url.helper.valid" : "input.url.helper";
  };

  const setHelperText = (messageKey = "input.url.helper", vars = {}) => {
    if (!helperTextEl) return;
    helperTextEl.textContent = t(messageKey, vars);
  };

  const syncShellState = (value = urlInput.value) => {
    const normalized = normalizeUrlInput(value).trim();
    const isEmpty = normalized === "";
    setStateClass("is-empty", isEmpty);
    setStateClass("has-value", !isEmpty);
    if (actionRowEl) {
      actionRowEl.hidden = isEmpty;
      actionRowEl.setAttribute("aria-hidden", isEmpty ? "true" : "false");
    }
    if (sourceLinkButton) {
      sourceLinkButton.disabled = !(
        normalized &&
        isValidUrl(normalized) &&
        isSupportedUrl(normalized)
      );
    }
  };

  const toggleButtons = () => {
    const isEmpty = urlInput.value.trim() === "";
    clearButton.classList.toggle("hidden", isEmpty);
    pasteButton.classList.toggle("hidden", !isEmpty);

    if (selectFolderButton) {
      selectFolderButton.classList.remove("hidden"); // папка должна быть всегда видна (если не загрузка)
    }
  };

  let previewTimer = null;
  let lastPreviewUrl = "";
  let hasInteracted = false;
  let previewRequestId = 0;
  let dragDepth = 0;
  let backgroundRecoveryInFlight = false;
  let livePreviewButton = null;
  let currentLivePreview = null;
  let livePreviewOpen = false;
  let pendingAutoQualityUrl = "";
  let lastPreviewData = null;

  const isAutoQualityModalEnabled = () => {
    try {
      return localStorage.getItem(AUTO_OPEN_QUALITY_MODAL_KEY) !== "0";
    } catch {
      return true;
    }
  };

  const markAutoQualityCandidate = (value) => {
    const normalized = normalizeUrlInput(value).trim();
    pendingAutoQualityUrl =
      normalized && isValidUrl(normalized) && isSupportedUrl(normalized)
        ? normalized
        : "";
  };

  const hasPreviewImage = (data) => {
    if (String(data?.thumbnail || "").trim()) return true;
    if (!Array.isArray(data?.thumbnails)) return false;
    return data.thumbnails.some((thumb) => String(thumb?.url || "").trim());
  };

  const hasUsableQualityInfo = (data) =>
    !!data?.success &&
    !!String(data?.title || "").trim() &&
    hasPreviewImage(data) &&
    Array.isArray(data?.formats) &&
    data.formats.length > 0;

  const maybeOpenQualityModalAfterPaste = (url, data) => {
    if (!pendingAutoQualityUrl || pendingAutoQualityUrl !== url) return;
    if (!isAutoQualityModalEnabled() || !hasUsableQualityInfo(data)) {
      pendingAutoQualityUrl = "";
      return;
    }
    const qualityModal = document.getElementById("download-quality-modal");
    if (qualityModal?.classList.contains("is-open")) {
      pendingAutoQualityUrl = "";
      return;
    }
    const downloadBtn = document.getElementById("download-button");
    updateButtonState();
    if (!downloadBtn || downloadBtn.disabled) return;
    pendingAutoQualityUrl = "";
    setTimeout(() => {
      if (!downloadBtn.disabled) downloadBtn.click();
    }, 0);
  };

  const setPreviewLoading = (isLoading) => {
    wrapperEl?.classList.toggle("is-preview-loading", isLoading);
    setStateClass("is-preview-loading", isLoading);
    if (previewSpinner) {
      previewSpinner.classList.toggle("hidden", !isLoading);
      previewSpinner.setAttribute("aria-hidden", isLoading ? "false" : "true");
    }
    if (isLoading) {
      setHelperText("input.url.helper.loading");
    } else if (!urlErrorEl || urlErrorEl.classList.contains("hidden")) {
      setHelperText(getIdleHelperKey());
    }
  };

  const getValidationState = (value = urlInput.value) => {
    const normalized = normalizeUrlInput(value);
    const hasValue = normalized.trim() !== "";
    const isValid =
      hasValue && isValidUrl(normalized) && isSupportedUrl(normalized);
    return { normalized, hasValue, isValid };
  };

  const showInlineError = (
    messageKey = "input.url.error.invalidOrUnsupported",
  ) => {
    wrapperEl?.classList.add("is-invalid");
    wrapperEl?.classList.remove("is-valid");
    setStateClass("is-invalid", true);
    setStateClass("is-valid", false);
    if (!urlErrorEl) return;
    urlErrorEl.textContent = t(messageKey);
    urlErrorEl.classList.remove("hidden");
  };

  const showInlineErrorText = (message) => {
    wrapperEl?.classList.add("is-invalid");
    wrapperEl?.classList.remove("is-valid");
    setStateClass("is-invalid", true);
    setStateClass("is-valid", false);
    if (!urlErrorEl) return;
    urlErrorEl.textContent = String(message || "");
    urlErrorEl.classList.remove("hidden");
  };

  const hideInlineError = () => {
    wrapperEl?.classList.remove("is-invalid");
    setStateClass("is-invalid", false);
    if (!urlErrorEl) return;
    urlErrorEl.textContent = "";
    urlErrorEl.classList.add("hidden");
  };

  const normalizeInputValue = () => {
    const before = urlInput.value;
    const normalized = normalizeUrlInput(before);
    if (before !== normalized) {
      urlInput.value = normalized;
      return true;
    }
    return false;
  };

  const syncUrlUiState = ({ showError = false, errorOnEmpty = false } = {}) => {
    const validation = getValidationState();
    wrapperEl?.classList.toggle(
      "is-valid",
      validation.hasValue && validation.isValid,
    );
    setStateClass("is-valid", validation.hasValue && validation.isValid);
    syncShellState(validation.normalized);
    if (showError && !validation.isValid) {
      if (!validation.hasValue) {
        if (errorOnEmpty) {
          showInlineError("input.url.error.empty");
        } else {
          hideInlineError();
        }
      } else if (!isValidUrl(validation.normalized)) {
        showInlineError("input.url.error.invalid");
      } else if (!isSupportedUrl(validation.normalized)) {
        showInlineError("input.url.error.unsupported");
      } else {
        showInlineError();
      }
    } else if (!showError || validation.isValid || !hasInteracted) {
      hideInlineError();
    }
    if (!showError || validation.isValid || !hasInteracted) {
      setHelperText(getIdleHelperKey());
    }
    updateButtonState();
    return validation;
  };

  const durationToStr = (sec) => {
    const s = Math.max(0, Number(sec) || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = Math.floor(s % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
      : `${m}:${String(r).padStart(2, "0")}`;
  };

  const syncLivePreviewButton = () => {
    if (!livePreviewButton) return;
    if (!currentLivePreview?.src) {
      livePreviewButton.style.display = "none";
      livePreviewButton.onclick = null;
      return;
    }

    if (livePreviewOpen) {
      livePreviewButton.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${t("input.url.preview.closeLive")}`;
      livePreviewButton.setAttribute(
        "title",
        t("input.url.preview.closeLiveTitle"),
      );
      livePreviewButton.style.display = "";
      livePreviewButton.onclick = () => {
        hideDownloaderLivePreview();
      };
      return;
    }

    livePreviewButton.innerHTML = `<i class="fa-solid fa-volume-high"></i> ${t("input.url.preview.openLive")}`;
    livePreviewButton.setAttribute(
      "title",
      t("input.url.preview.openLiveTitle"),
    );
    livePreviewButton.style.display = "";
    livePreviewButton.onclick = () => {
      window.dispatchEvent(
        new CustomEvent(LIVE_PREVIEW_PLAY_EVENT, {
          detail: {
            preview: currentLivePreview,
            options: {
              pageUrl:
                currentLivePreview?.pageUrl ||
                lastPreviewUrl ||
                urlInput.value.trim(),
            },
          },
        }),
      );
    };
  };

  const renderPreview = (data) => {
    const card = document.getElementById("preview-card");
    const previewTitleEl = document.getElementById("preview-title");
    const previewDurationEl = document.getElementById("preview-duration");
    const img = document.getElementById("preview-thumb");
    let playlistMetaEl = document.getElementById("preview-playlist-meta");
    let previewActionsEl = document.getElementById("preview-actions");
    let currentOnlyBtn = document.getElementById("preview-current-only");
    let addAllBtn = document.getElementById("preview-enqueue-all");
    if (!card || !previewTitleEl || !previewDurationEl || !img) return;
    if (!data || !data.success) {
      currentLivePreview = null;
      livePreviewOpen = false;
      card.style.display = "none";
      card.classList.remove("pos-top");
      setStateClass("has-preview", false);
      if (addAllBtn) addAllBtn.style.display = "none";
      if (livePreviewButton) livePreviewButton.style.display = "none";
      clearDownloaderBackgroundPreview();
      hideDownloaderLivePreview();
      return;
    }
    lastPreviewData = data;
    const previewUrl = lastPreviewUrl || data.webpage_url || data.original_url;
    try {
      setCachedVideoInfo(previewUrl || urlInput.value.trim(), data);
    } catch (_) {}
    hideInlineError();
    previewTitleEl.textContent = data.title || "";
    previewDurationEl.textContent = data.duration
      ? t("input.url.preview.duration", {
          duration: durationToStr(data.duration),
        })
      : "";
    previewTitleEl.setAttribute("title", data.title || "");
    if (data.thumbnail) {
      img.src = data.thumbnail;
      img.style.display = "";
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
    }
    card.style.display = data.title || data.thumbnail ? "" : "none";
    card.classList.add("visible");
    setStateClass("has-preview", card.style.display !== "none");
    currentLivePreview = data.livePreview
      ? {
          ...data.livePreview,
          pageUrl:
            data?.webpage_url || data?.original_url || lastPreviewUrl || "",
        }
      : null;

    try {
      const container = document.querySelector(".input-container");
      const wrap = document.querySelector(".url-input-wrapper");
      if (container && wrap) {
        requestAnimationFrame(() => {
          const vH = window.innerHeight;
          const wRect = wrap.getBoundingClientRect();
          const cardH = card.offsetHeight || 110;
          const margin = 24;
          const spaceBelow = vH - wRect.bottom;
          const placeTop = spaceBelow < cardH + margin; // если снизу места меньше высоты карточки
          card.classList.toggle("pos-top", placeTop);
        });
      }
    } catch (_) {}

    const count = Number(data.playlistCount || data.entries?.length || 0) || 0;
    const playlistDuration = Number(data.playlistDuration || 0) || 0;
    if (!playlistMetaEl) {
      playlistMetaEl = document.createElement("div");
      playlistMetaEl.id = "preview-playlist-meta";
      playlistMetaEl.className = "preview-playlist-meta hidden";
      previewDurationEl.insertAdjacentElement("afterend", playlistMetaEl);
    }
    if (!previewActionsEl) {
      previewActionsEl = document.createElement("div");
      previewActionsEl.id = "preview-actions";
      previewActionsEl.className = "preview-actions";
      const previewMeta = card.querySelector(".preview-meta");
      previewMeta?.appendChild(previewActionsEl);
    }
    if (!livePreviewButton) {
      livePreviewButton = document.createElement("button");
      livePreviewButton.id = "preview-open-live";
      livePreviewButton.className =
        "preview-action-button preview-action-button--secondary";
      livePreviewButton.setAttribute("type", "button");
      previewActionsEl?.appendChild(livePreviewButton);
    }
    if (!currentLivePreview?.src) {
      livePreviewOpen = false;
      hideDownloaderLivePreview();
    }
    syncLivePreviewButton();
    if (count > 1 && Array.isArray(data.entries) && data.entries.length) {
      setHelperText("input.url.helper.playlistChoice");
      playlistMetaEl.innerHTML = `
        <span class="preview-playlist-chip">${t("input.url.preview.playlistCount", { count })}</span>
        ${
          playlistDuration > 0
            ? `<span class="preview-playlist-chip">${t(
                "input.url.preview.playlistDuration",
                {
                  duration: durationToStr(playlistDuration),
                },
              )}</span>`
            : ""
        }
      `;
      playlistMetaEl.classList.remove("hidden");
      if (!currentOnlyBtn) {
        currentOnlyBtn = document.createElement("button");
        currentOnlyBtn.id = "preview-current-only";
        currentOnlyBtn.className =
          "preview-action-button preview-action-button--secondary";
        currentOnlyBtn.innerHTML = `<i class="fa-solid fa-circle-play"></i> ${t("input.url.preview.currentOnly")}`;
        currentOnlyBtn.setAttribute("data-bs-toggle", "tooltip");
        currentOnlyBtn.setAttribute("data-bs-placement", "top");
        currentOnlyBtn.setAttribute(
          "title",
          t("input.url.preview.currentOnlyTitle"),
        );
        previewActionsEl?.appendChild(currentOnlyBtn);
        try {
          initTooltips();
        } catch (_) {}
      } else {
        currentOnlyBtn.innerHTML = `<i class="fa-solid fa-circle-play"></i> ${t("input.url.preview.currentOnly")}`;
        currentOnlyBtn.style.display = "";
      }
      if (!addAllBtn) {
        addAllBtn = document.createElement("button");
        addAllBtn.id = "preview-enqueue-all";
        addAllBtn.className = "preview-action-button";
        addAllBtn.innerHTML = `<i class="fa-solid fa-list"></i> ${t("input.url.preview.addAll", { count: data.entries.length })}`;
        addAllBtn.setAttribute("data-bs-toggle", "tooltip");
        addAllBtn.setAttribute("data-bs-placement", "top");
        addAllBtn.setAttribute("title", t("input.url.preview.addAllTitle"));
        previewActionsEl?.appendChild(addAllBtn);
        try {
          initTooltips();
        } catch (_) {}
      } else {
        addAllBtn.innerHTML = `<i class="fa-solid fa-list"></i> ${t("input.url.preview.addAll", { count: data.entries.length })}`;
        addAllBtn.style.display = "";
        try {
          initTooltips();
        } catch (_) {}
      }
      addAllBtn.onclick = () => {
        try {
          const ev = new CustomEvent("queue:addMany", {
            detail: { urls: data.entries },
          });
          window.dispatchEvent(ev);
        } catch (_) {}
      };
      currentOnlyBtn.onclick = () => {
        document.getElementById("download-button")?.click();
      };
    } else if (addAllBtn) {
      addAllBtn.style.display = "none";
      if (currentOnlyBtn) currentOnlyBtn.style.display = "none";
      playlistMetaEl?.classList.add("hidden");
      if (playlistMetaEl) playlistMetaEl.innerHTML = "";
      setHelperText("input.url.helper.valid");
    } else {
      setHelperText("input.url.helper.valid");
    }

    let closeBtn = card.querySelector(".preview-close");
    if (!closeBtn) {
      closeBtn = document.createElement("button");
      closeBtn.className = "preview-close";
      closeBtn.setAttribute("aria-label", t("input.url.preview.close"));
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", () => {
        currentLivePreview = null;
        livePreviewOpen = false;
        card.style.display = "none";
        card.classList.remove("visible");
        card.classList.remove("pos-top");
        setStateClass("has-preview", false);
        clearDownloaderBackgroundPreview();
        hideDownloaderLivePreview();
      });
      card.appendChild(closeBtn);
    }

    let wrap = img?.closest(".preview-thumb-wrap");
    if (!wrap && img) {
      wrap = document.createElement("div");
      wrap.className = "preview-thumb-wrap";
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
    }

    let saveBtn = wrap ? wrap.querySelector(".preview-save") : null;
    const sanitizeFilename = (s) => {
      try {
        const base = String(s || "")
          .replace(/[\\/:*?"<>|]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return base.length ? base.slice(0, 80) : "preview";
      } catch {
        return "preview";
      }
    };
    const pickExt = (blob, src) => {
      const byType = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      }[blob?.type || ""];
      if (byType) return byType;
      try {
        const u = new URL(src);
        const m = (u.pathname.match(/\.([a-z0-9]+)$/i) || [])[1];
        if (m) return m.toLowerCase();
      } catch {}
      return "jpg";
    };
    const ensureSaveHandler = (btn, src, title) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const useSrc = src || btn.dataset.src || data.thumbnail;
        if (!src) return;
        try {
          const resp = await fetch(useSrc, { cache: "no-cache" });
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const safe = sanitizeFilename(
            title || previewTitleEl.textContent || "preview",
          );
          const ext = pickExt(blob, useSrc);
          a.download = `${safe}.${ext}`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
          }, 0);
        } catch (err) {
          console.error("Save preview failed", err);
        }
      };
    };
    if (wrap && img && img.style.display !== "none" && data.thumbnail) {
      if (!saveBtn) {
        saveBtn = document.createElement("button");
        saveBtn.className = "preview-save";
        saveBtn.innerHTML =
          '<i class="fa-solid fa-download" aria-hidden="true"></i>';
        wrap.appendChild(saveBtn);
      }
      saveBtn.dataset.src = data.thumbnail;
      const ttl = (data.title || "").trim();
      saveBtn.title = ttl
        ? t("input.url.preview.saveWithTitle", { title: ttl })
        : t("input.url.preview.save");
      ensureSaveHandler(saveBtn, data.thumbnail, ttl);
    } else if (saveBtn) {
      saveBtn.remove();
    }
  };

  const syncBackgroundPreview = async (data) => {
    const pageUrl =
      data?.webpage_url || data?.original_url || lastPreviewUrl || "";
    if (data?.success && data?.backgroundPreview?.src) {
      await applyDownloaderBackgroundPreview(data.backgroundPreview, {
        pageUrl,
      });
      return;
    }
    clearDownloaderBackgroundPreview();
  };

  const fetchPreviewInfo = async (url) => {
    return window.electron.ipcRenderer.invoke("get-video-info", url);
  };

  const refreshBackgroundPreview = async () => {
    const url = normalizeUrlInput(urlInput.value).trim();
    if (!url || url !== lastPreviewUrl || backgroundRecoveryInFlight) return;

    backgroundRecoveryInFlight = true;
    try {
      const data = await fetchPreviewInfo(url);
      if (!data?.success) {
        clearDownloaderBackgroundPreview();
        hideDownloaderLivePreview();
        livePreviewOpen = false;
        syncLivePreviewButton();
        return;
      }
      await syncBackgroundPreview(data);
    } catch {
      clearDownloaderBackgroundPreview();
      hideDownloaderLivePreview();
      livePreviewOpen = false;
      syncLivePreviewButton();
    } finally {
      backgroundRecoveryInFlight = false;
    }
  };

  const refreshLivePreview = async (requestedUrl = "", resumeTime = null) => {
    const url = normalizeUrlInput(urlInput.value).trim();
    if (!url || (requestedUrl && requestedUrl !== url)) return;

    try {
      const data = await fetchPreviewInfo(url);
      if (!data?.success || !data?.livePreview?.src) {
        currentLivePreview = null;
        livePreviewOpen = false;
        hideDownloaderLivePreview();
        syncLivePreviewButton();
        return;
      }

      currentLivePreview = {
        ...data.livePreview,
        pageUrl: data?.webpage_url || data?.original_url || url,
      };
      livePreviewOpen = true;
      syncLivePreviewButton();
      window.dispatchEvent(
        new CustomEvent(LIVE_PREVIEW_PLAY_EVENT, {
          detail: {
            preview: currentLivePreview,
            options: {
              pageUrl: currentLivePreview.pageUrl,
              resumeTime,
            },
          },
        }),
      );
    } catch {
      currentLivePreview = null;
      livePreviewOpen = false;
      hideDownloaderLivePreview();
      syncLivePreviewButton();
    }
  };

  const maybeFetchPreview = async () => {
    const url = urlInput.value.trim();
    if (!isValidUrl(url) || !isSupportedUrl(url)) {
      setPreviewLoading(false);
      renderPreview(null);
      pendingAutoQualityUrl = "";
      lastPreviewData = null;
      return;
    }
    if (url === lastPreviewUrl) {
      setPreviewLoading(false);
      maybeOpenQualityModalAfterPaste(url, lastPreviewData);
      return; // не повторяем
    }
    lastPreviewUrl = url;
    const currentRequest = ++previewRequestId;
    setPreviewLoading(true);
    hideDownloaderLivePreview();
    livePreviewOpen = false;
    syncLivePreviewButton();
    try {
      const data = await fetchPreviewInfo(url);
      if (currentRequest !== previewRequestId) return;
      const fetchError = !data?.success ? formatDownloadErrorToast(data) : "";
      if (fetchError) {
        showInlineErrorText(fetchError);
        renderPreview(null);
        pendingAutoQualityUrl = "";
        lastPreviewData = null;
        return;
      }
      renderPreview(data);
      await syncBackgroundPreview(data);
      maybeOpenQualityModalAfterPaste(url, data);
    } catch {
      if (currentRequest !== previewRequestId) return;
      renderPreview(null);
      pendingAutoQualityUrl = "";
      lastPreviewData = null;
    } finally {
      if (currentRequest !== previewRequestId) return;
      setPreviewLoading(false);
    }
  };

  // Внешний триггер принудительного показа предпросмотра (например, из истории → Повторить)
  urlInput.addEventListener("force-preview", async () => {
    if (previewTimer) clearTimeout(previewTimer);
    // сбрасываем кэш URL, чтобы форсировать повторный запрос
    lastPreviewUrl = "";
    // вызываем немедленно без debounce
    const url = urlInput.value.trim();
    if (!isValidUrl(url) || !isSupportedUrl(url)) {
      setPreviewLoading(false);
      renderPreview(null);
      pendingAutoQualityUrl = "";
      lastPreviewData = null;
      return;
    }
    lastPreviewUrl = url;
    setPreviewLoading(true);
    hideDownloaderLivePreview();
    livePreviewOpen = false;
    syncLivePreviewButton();
    try {
      const data = await fetchPreviewInfo(url);
      const fetchError = !data?.success ? formatDownloadErrorToast(data) : "";
      if (fetchError) {
        showInlineErrorText(fetchError);
        renderPreview(null);
        pendingAutoQualityUrl = "";
        lastPreviewData = null;
        return;
      }
      renderPreview(data);
      await syncBackgroundPreview(data);
      maybeOpenQualityModalAfterPaste(url, data);
    } catch {
      renderPreview(null);
      pendingAutoQualityUrl = "";
      lastPreviewData = null;
    } finally {
      setPreviewLoading(false);
    }
  });

  urlInput.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData?.("text") || "";
    if (text) {
      markAutoQualityCandidate(text);
    } else {
      pendingAutoQualityUrl = "__pending_native_paste__";
    }
  });

  urlInput.addEventListener("input", (event) => {
    const isPasteInput =
      event?.inputType === "insertFromPaste" ||
      pendingAutoQualityUrl === "__pending_native_paste__";
    if (isPasteInput) {
      normalizeInputValue();
    }
    toggleButtons();
    const val = urlInput.value.trim();
    if (isPasteInput) {
      markAutoQualityCandidate(val);
    }
    syncUrlUiState({ showError: false });
    // Если поле пустое — моментально скрываем превью без ожидания debounce
    if (val === "") {
      hasInteracted = false;
      if (previewTimer) clearTimeout(previewTimer);
      lastPreviewUrl = "";
      lastPreviewData = null;
      livePreviewOpen = false;
      setPreviewLoading(false);
      renderPreview(null);
      syncShellState("");
      setHelperText("input.url.helper");
      return;
    }
    if (previewTimer) clearTimeout(previewTimer);
    setPreviewLoading(true);
    previewTimer = setTimeout(() => {
      previewTimer = null;
      maybeFetchPreview();
    }, 500);
  });
  urlInput.addEventListener("focus", () => {
    toggleButtons();
    syncShellState();
    try {
      if (urlInput.value && urlInput.value.length > 0) urlInput.select();
    } catch (_) {}
  });
  urlInput.addEventListener("blur", () => {
    normalizeInputValue();
    hasInteracted = true;
    syncUrlUiState({ showError: true, errorOnEmpty: false });
    toggleButtons();
  });

  // Старт загрузки по Enter (без модификаторов)
  urlInput.addEventListener("keydown", (e) => {
    const qualityModal = document.getElementById("download-quality-modal");
    if (qualityModal?.classList.contains("is-open")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      hasInteracted = false;
      urlInput.value = "";
      lastPreviewUrl = "";
      lastPreviewData = null;
      livePreviewOpen = false;
      setPreviewLoading(false);
      renderPreview(null);
      hideInlineError();
      toggleButtons();
      updateButtonState();
      syncShellState("");
      setHelperText("input.url.helper");
      return;
    }

    if (e.key !== "Enter") return;
    normalizeInputValue();
    hasInteracted = true;
    const validation = syncUrlUiState({ showError: true, errorOnEmpty: true });
    if (!validation.isValid) {
      e.preventDefault();
      lastPreviewUrl = "";
      lastPreviewData = null;
      renderPreview(null);
      return;
    }

    const btn = document.getElementById("download-button");
    if (!btn || btn.disabled) return;
    // Shift+Enter → только в очередь
    if (e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      btn.dataset.enqueueOnly = "1";
      btn.click();
      return;
    }

    // Любые прочие модификаторы не имеют отдельнего действия
    if (e.altKey || e.ctrlKey || e.metaKey) {
      return;
    }

    // Обычный Enter → как прежде
    e.preventDefault();
    btn.click();
  });

  clearButton.addEventListener("click", () => {
    urlInput.value = "";
    hasInteracted = false;
    toggleButtons();
    // Немедленно скрываем превью
    lastPreviewUrl = "";
    lastPreviewData = null;
    livePreviewOpen = false;
    setPreviewLoading(false);
    renderPreview(null);
    hideInlineError();
    updateButtonState();
    syncShellState("");
    setHelperText("input.url.helper");
    urlInput.focus();
  });

  pasteButton.addEventListener("click", async () => {
    const text = (await navigator.clipboard.readText()) || "";
    hasInteracted = false;
    urlInput.value = normalizeUrlInput(text.trim());
    lastPreviewData = null;
    markAutoQualityCandidate(urlInput.value);
    toggleButtons();
    hideInlineError();
    urlInput.dispatchEvent(new Event("input", { bubbles: true })); // запускаем реакцию
    urlInput.dispatchEvent(new Event("force-preview"));
    urlInput.focus();
  });

  sourceLinkButton?.addEventListener("click", async () => {
    const normalized = normalizeUrlInput(urlInput.value).trim();
    if (!normalized || !isValidUrl(normalized) || !isSupportedUrl(normalized)) {
      hasInteracted = true;
      syncUrlUiState({ showError: true, errorOnEmpty: true });
      return;
    }
    try {
      await window.electron?.invoke?.("open-external-link", normalized);
    } catch (error) {
      console.error("Failed to open source link from URL input:", error);
    }
  });

  if (window[BACKGROUND_RECOVERY_HANDLER_KEY]) {
    window.removeEventListener(
      RECOVERY_EVENT,
      window[BACKGROUND_RECOVERY_HANDLER_KEY],
    );
  }
  window[BACKGROUND_RECOVERY_HANDLER_KEY] = async (event) => {
    const requestedUrl = String(event?.detail?.url || "").trim();
    if (!requestedUrl || requestedUrl !== lastPreviewUrl) return;
    await refreshBackgroundPreview();
  };
  window.addEventListener(
    RECOVERY_EVENT,
    window[BACKGROUND_RECOVERY_HANDLER_KEY],
  );

  if (window[LIVE_PREVIEW_RETRY_HANDLER_KEY]) {
    window.removeEventListener(
      LIVE_PREVIEW_RETRY_EVENT,
      window[LIVE_PREVIEW_RETRY_HANDLER_KEY],
    );
  }
  window[LIVE_PREVIEW_RETRY_HANDLER_KEY] = async (event) => {
    const requestedUrl = String(event?.detail?.url || "").trim();
    const resumeTime = Number(event?.detail?.resumeTime);
    await refreshLivePreview(
      requestedUrl,
      Number.isFinite(resumeTime) ? resumeTime : null,
    );
  };
  window.addEventListener(
    LIVE_PREVIEW_RETRY_EVENT,
    window[LIVE_PREVIEW_RETRY_HANDLER_KEY],
  );

  if (window[LIVE_PREVIEW_STATE_HANDLER_KEY]) {
    window.removeEventListener(
      LIVE_PREVIEW_STATE_EVENT,
      window[LIVE_PREVIEW_STATE_HANDLER_KEY],
    );
  }
  window[LIVE_PREVIEW_STATE_HANDLER_KEY] = (event) => {
    livePreviewOpen = !!event?.detail?.isOpen;
    syncLivePreviewButton();
  };
  window.addEventListener(
    LIVE_PREVIEW_STATE_EVENT,
    window[LIVE_PREVIEW_STATE_HANDLER_KEY],
  );

  // Drag & Drop ссылок в область ввода URL
  const wrapper = document.querySelector(".url-input-wrapper");
  if (wrapper) {
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
      wrapper.addEventListener(ev, prevent),
    );
    wrapper.addEventListener("dragenter", () => {
      dragDepth += 1;
      wrapper.classList.add("drag-over");
      setStateClass("drag-over", true);
      setHelperText("input.url.helper.drag");
    });
    wrapper.addEventListener("dragover", () => {
      wrapper.classList.add("drag-over");
      setStateClass("drag-over", true);
    });
    wrapper.addEventListener("dragleave", () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        wrapper.classList.remove("drag-over");
        setStateClass("drag-over", false);
        syncUrlUiState({ showError: false });
      }
    });
    wrapper.addEventListener("drop", () => {
      dragDepth = 0;
      wrapper.classList.remove("drag-over");
      setStateClass("drag-over", false);
    });
    wrapper.addEventListener("drop", (e) => {
      try {
        const text = (
          e.dataTransfer.getData("text/uri-list") ||
          e.dataTransfer.getData("text") ||
          ""
        ).trim();
        if (text) {
          hasInteracted = false;
          urlInput.value = normalizeUrlInput(text);
          hideInlineError();
          urlInput.dispatchEvent(new Event("input", { bubbles: true }));
          urlInput.focus();
        }
      } catch (_) {}
    });
  }

  setPreviewLoading(false);
  syncShellState();
  setHelperText("input.url.helper");
  syncUrlUiState({ showError: false });

  window.addEventListener("download:url-submitted", () => {
    try {
      urlInput.focus();
    } catch {}
  });
}

function hideUrlActionButtons() {
  pasteButton?.classList.add("hidden");
  selectFolderButton?.classList.add("hidden");
}

function showUrlActionButtons() {
  pasteButton?.classList.remove("hidden");
  selectFolderButton?.classList.remove("hidden");
}

export { initUrlInputHandler, hideUrlActionButtons, showUrlActionButtons };
