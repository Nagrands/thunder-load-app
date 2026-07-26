import { t } from "../i18n.js";
import {
  closeRegisteredModal,
  openRegisteredModal,
  registerModal,
} from "../modalManager.js";
import {
  acquireOverlayActive,
  releaseOverlayActive,
} from "../scrollLockManager.js";
import { refreshPlayerIcons, setPlayerIcon } from "./playerIcons.js";
import {
  formatMediaCodec,
  formatMediaDimensions,
  formatMediaResolution,
  formatMediaSize,
  formatPlaybackTime,
} from "./viewUtils.js";

const PLAYER_MODAL_OVERLAY_OWNER = "player-form-modal";

const MODE_ALIASES = {
  create: "createPlaylist",
  rename: "renamePlaylist",
  youtube: "youtubeUrl",
  addTrack: "addToPlaylist",
};

const SUBMIT_MODES = {
  createPlaylist: "create",
  renamePlaylist: "rename",
  youtubeUrl: "youtube",
  youtubeQuality: "youtubeQuality",
  addToPlaylist: "addTrack",
  renameTrack: "renameTrack",
};

function formatQualityOption(option = {}) {
  const specialLabel = {
    auto: t("nowPlaying.youtube.quality.auto"),
    best: t("nowPlaying.youtube.quality.best"),
    audio: t("nowPlaying.youtube.quality.audio"),
  }[option.id];
  const details = [
    option.height ? `${option.height}p` : "",
    option.fps ? `${option.fps} FPS` : "",
    option.videoCodec || option.audioCodec || "",
    option.container || "",
    option.bitrateKbps ? `${Math.round(option.bitrateKbps)} kbps` : "",
    option.sizeBytes ? formatMediaSize(option.sizeBytes) : "",
  ].filter(Boolean);
  return [specialLabel || option.label || option.id, ...details].join(" · ");
}

function getConfig(mode, context) {
  const configs = {
    createPlaylist: {
      title: "nowPlaying.playlists.create",
      hint: "nowPlaying.playlists.createHint",
      label: "nowPlaying.playlists.name",
      submit: "nowPlaying.playlists.createAction",
      type: "text",
      maxLength: 80,
      value: "",
    },
    renamePlaylist: {
      title: "nowPlaying.playlists.rename",
      hint: "nowPlaying.playlists.renameHint",
      label: "nowPlaying.playlists.name",
      submit: "nowPlaying.playlists.save",
      type: "text",
      maxLength: 80,
      value: context.activePlaylist?.title || "",
    },
    youtubeUrl: {
      title: "nowPlaying.youtube.add",
      hint: "nowPlaying.youtube.hint",
      label: "nowPlaying.youtube.url",
      submit: "nowPlaying.youtube.addAction",
      type: "url",
      maxLength: 2048,
      value: "",
    },
    youtubeQuality: {
      title: "nowPlaying.youtube.quality.title",
      hintText:
        context.analysis?.track?.title || t("nowPlaying.youtube.quality.hint"),
      label: "nowPlaying.youtube.quality.label",
      submit: "nowPlaying.youtube.addAction",
      type: "select",
      options: context.qualities || context.analysis?.qualities || [],
    },
    addToPlaylist: {
      title: "nowPlaying.playlists.addItem",
      hint: "nowPlaying.playlists.addItemHint",
      label: "nowPlaying.playlists.target",
      submit: "nowPlaying.playlists.addItemAction",
      type: "select",
      options: context.userPlaylists || [],
    },
    renameTrack: {
      title: "nowPlaying.context.rename",
      hint: "nowPlaying.context.renameHint",
      label: "nowPlaying.context.displayTitle",
      submit: "nowPlaying.playlists.save",
      type: "text",
      maxLength: 160,
      value: context.track?.displayTitle || context.track?.title || "",
    },
    trackInfo: {
      title: "nowPlaying.context.info",
      submit: "modal.close",
      type: "info",
    },
  };
  return configs[mode] || null;
}

export function createPlayerDialog({ element, onSubmit } = {}) {
  const modal = element || document.querySelector('[data-ui="player-form-modal"]');
  if (!(modal instanceof HTMLElement)) {
    throw new Error("Player form modal is not available");
  }
  const form = modal.querySelector('[data-ui="player-form-modal-form"]');
  const title = modal.querySelector('[data-ui="player-form-modal-title"]');
  const hint = modal.querySelector('[data-ui="player-form-modal-hint"]');
  const info = modal.querySelector('[data-ui="player-form-modal-info"]');
  const infoArtwork = modal.querySelector(
    '[data-ui="player-form-modal-info-artwork"]',
  );
  const infoFallback = modal.querySelector(
    '[data-ui="player-form-modal-info-fallback"]',
  );
  const infoTitle = modal.querySelector(
    '[data-ui="player-form-modal-info-title"]',
  );
  const infoSubtitle = modal.querySelector(
    '[data-ui="player-form-modal-info-subtitle"]',
  );
  const infoBadges = modal.querySelector(
    '[data-ui="player-form-modal-info-badges"]',
  );
  const field = modal.querySelector('[data-ui="player-form-modal-field"]');
  const label = modal.querySelector('[data-ui="player-form-modal-label"]');
  const input = modal.querySelector('[data-ui="player-form-modal-input"]');
  const select = modal.querySelector('[data-ui="player-form-modal-select"]');
  const error = modal.querySelector('[data-ui="player-form-modal-error"]');
  const submit = modal.querySelector('[data-ui="player-form-modal-submit"]');
  const cancel = modal.querySelector('[data-ui="player-form-modal-cancel"]');
  const closeButtons = modal.querySelectorAll(
    '[data-ui="player-form-modal-close"], [data-ui="player-form-modal-cancel"]',
  );
  const unregister = registerModal(modal);
  let activeMode = "";
  let activeContext = {};
  let returnFocus = null;
  let busy = false;

  function setInfoField(name, value) {
    const row = info?.querySelector(`[data-info-field="${name}"]`);
    const target = row?.querySelector("dd");
    if (!row || !target) return;
    target.textContent = String(value || "");
    row.hidden = !target.textContent;
  }

  function showInfoArtwork(visible) {
    if (infoArtwork) infoArtwork.hidden = !visible;
    if (infoFallback) infoFallback.hidden = visible;
  }

  function resetTrackInfo() {
    if (!info) return;
    info.hidden = true;
    infoTitle.textContent = "";
    infoSubtitle.textContent = "";
    infoSubtitle.hidden = true;
    infoBadges.replaceChildren();
    infoBadges.hidden = true;
    info.querySelectorAll("[data-info-field]").forEach((row) => {
      row.hidden = true;
      const value = row.querySelector("dd");
      if (value) value.textContent = "";
    });
    infoArtwork?.removeAttribute("src");
    showInfoArtwork(false);
  }

  function renderTrackInfo(context = {}) {
    const track = context.track || {};
    const mediaInfo = track.mediaInfo || {};
    const titleText =
      track.displayTitle || track.title || t("nowPlaying.info.untitled");
    const subtitleText = [track.artist, track.album].filter(Boolean).join(" · ");
    info.hidden = false;
    infoTitle.textContent = titleText;
    infoSubtitle.textContent = subtitleText;
    infoSubtitle.hidden = !subtitleText;

    const badgeLabels = [
      formatMediaResolution(mediaInfo),
      formatMediaCodec(mediaInfo.videoCodec),
      formatMediaCodec(mediaInfo.audioCodec),
    ].filter(Boolean);
    const availability = String(track.availability || "");
    if (availability && availability !== "available") {
      badgeLabels.push({
        label: t(`nowPlaying.info.availability.${availability}`),
        warning: true,
      });
    }
    infoBadges.replaceChildren(
      ...badgeLabels.map((badgeValue) => {
        const badge =
          typeof badgeValue === "string"
            ? { label: badgeValue, warning: false }
            : badgeValue;
        const badgeElement = document.createElement("span");
        badgeElement.textContent = badge.label;
        badgeElement.classList.toggle("is-warning", badge.warning);
        return badgeElement;
      }),
    );
    infoBadges.hidden = badgeLabels.length === 0;

    const duration = Number(track.duration);
    setInfoField(
      "duration",
      Number.isFinite(duration) && duration > 0
        ? formatPlaybackTime(duration)
        : "",
    );
    setInfoField("size", formatMediaSize(track.sizeBytes));
    setInfoField("dimensions", formatMediaDimensions(mediaInfo));
    setInfoField(
      "container",
      String(mediaInfo.container || "").trim().toUpperCase(),
    );
    setInfoField(
      "kind",
      track.kind ? t(`nowPlaying.info.kind.${track.kind}`) : "",
    );
    setInfoField(
      "provider",
      track.providerId
        ? t(`nowPlaying.info.provider.${track.providerId}`)
        : "",
    );

    setPlayerIcon(
      infoFallback,
      track.kind === "audio" ? "music-2" : "film",
    );
    const posterUrl = String(context.posterUrl || track.artworkUrl || "");
    if (posterUrl && infoArtwork) {
      infoArtwork.src = posterUrl;
      showInfoArtwork(true);
    } else {
      showInfoArtwork(false);
    }
    refreshPlayerIcons(info);
  }

  function getFocusable() {
    return [...modal.querySelectorAll("button:not([disabled]), input:not([hidden]):not([disabled]), select:not([hidden]):not([disabled])")].filter(
      (item) => !item.hidden,
    );
  }

  function showError(message) {
    error.textContent = message || t("nowPlaying.error");
    error.hidden = false;
    const focusTarget = input.hidden ? select : input;
    focusTarget?.focus();
  }

  function setBusy(nextBusy, labelKey = null) {
    busy = nextBusy;
    form.setAttribute("aria-busy", String(busy));
    submit.disabled = busy;
    closeButtons.forEach((button) => {
      button.disabled = busy;
    });
    if (labelKey) submit.textContent = t(labelKey);
  }

  function close({ restoreFocus = true } = {}) {
    if (busy) return false;
    closeRegisteredModal(modal);
    releaseOverlayActive(PLAYER_MODAL_OVERLAY_OWNER);
    activeMode = "";
    activeContext = {};
    delete modal.dataset.mode;
    modal.setAttribute("aria-describedby", "player-form-modal-hint");
    resetTrackInfo();
    error.hidden = true;
    error.textContent = "";
    if (restoreFocus) returnFocus?.focus?.();
    returnFocus = null;
    return true;
  }

  function populateSelect(mode, config, context) {
    const options = config.options || [];
    select.replaceChildren(
      ...options.map((item) => {
        const option = document.createElement("option");
        option.value = mode === "youtubeQuality" ? item.id : item.id;
        option.textContent =
          mode === "youtubeQuality" ? formatQualityOption(item) : item.title;
        return option;
      }),
    );
    if (mode !== "youtubeQuality") return;
    const defaultId = options.find(
      (quality) =>
        JSON.stringify(quality.selector) ===
        JSON.stringify(context.analysis?.defaultSelection),
    )?.id;
    select.value = defaultId || options[0]?.id || "";
  }

  function open(requestedMode, context = {}) {
    const mode = MODE_ALIASES[requestedMode] || requestedMode;
    const normalizedContext =
      mode === "youtubeQuality"
        ? {
            ...context,
            qualities: context.qualities || context.analysis?.qualities || [],
          }
        : context;
    const config = getConfig(mode, normalizedContext);
    if (!config) return false;
    if (modal.getAttribute("aria-hidden") !== "false") {
      returnFocus = document.activeElement;
    }
    activeMode = mode;
    activeContext = normalizedContext;
    title.textContent = t(config.title);
    hint.textContent =
      config.hintText || (config.hint ? t(config.hint) : "");
    label.textContent = config.label ? t(config.label) : "";
    submit.textContent = t(config.submit);
    error.hidden = true;
    error.textContent = "";
    const isSelect = config.type === "select";
    const isInfo = config.type === "info";
    modal.dataset.mode = mode;
    modal.setAttribute(
      "aria-describedby",
      isInfo ? "player-form-modal-info-title" : "player-form-modal-hint",
    );
    hint.hidden = isInfo;
    info.hidden = !isInfo;
    cancel.hidden = isInfo;
    field.hidden = isInfo;
    input.hidden = isSelect || isInfo;
    select.hidden = !isSelect;
    if (isInfo) renderTrackInfo(normalizedContext);
    else resetTrackInfo();
    if (isSelect) populateSelect(mode, config, normalizedContext);
    if (!isSelect && !isInfo) {
      input.type = config.type;
      input.maxLength = config.maxLength;
      input.value = config.value;
    }
    const hasOptions = !isSelect || select.options.length > 0;
    submit.disabled = !hasOptions;
    if (!hasOptions) showError(t("nowPlaying.youtube.quality.empty"));
    openRegisteredModal(modal);
    acquireOverlayActive(PLAYER_MODAL_OVERLAY_OWNER);
    queueMicrotask(() => {
      const focusTarget = isInfo ? submit : isSelect ? select : input;
      focusTarget.focus();
      if (!isSelect && !isInfo) focusTarget.select();
    });
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    if (activeMode === "trackInfo") {
      close();
      return;
    }
    const value = select.hidden ? input.value.trim() : select.value;
    if (!value) {
      showError(t("nowPlaying.library.required"));
      return;
    }
    const mode = activeMode;
    const context = activeContext;
    const submitLabel = submit.textContent;
    setBusy(true, mode === "youtubeUrl" ? "nowPlaying.youtube.fetching" : null);
    try {
      const result = await onSubmit?.(SUBMIT_MODES[mode], value, context);
      if (result?.step === "quality") {
        setBusy(false);
        open("youtubeQuality", result);
        return;
      }
      if (result === false) return;
      setBusy(false);
      close();
    } catch (submitError) {
      showError(submitError?.message || t("nowPlaying.error"));
    } finally {
      if (activeMode === mode && modal.getAttribute("aria-hidden") === "false") {
        setBusy(false);
        submit.textContent = submitLabel;
      }
    }
  }

  function handleKeydown(event) {
    if (modal.getAttribute("aria-hidden") !== "false") return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusable();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleOverlayClick(event) {
    if (event.target === modal) close();
  }

  function handleInfoArtworkError() {
    showInfoArtwork(false);
  }

  form.addEventListener("submit", handleSubmit);
  infoArtwork?.addEventListener("error", handleInfoArtworkError);
  modal.addEventListener("keydown", handleKeydown);
  modal.addEventListener("click", handleOverlayClick);
  closeButtons.forEach((button) => button.addEventListener("click", close));

  return {
    close,
    dispose() {
      setBusy(false);
      close({ restoreFocus: false });
      form.removeEventListener("submit", handleSubmit);
      modal.removeEventListener("keydown", handleKeydown);
      modal.removeEventListener("click", handleOverlayClick);
      infoArtwork?.removeEventListener("error", handleInfoArtworkError);
      closeButtons.forEach((button) => button.removeEventListener("click", close));
      unregister();
    },
    open,
    showError,
    showYouTubeQualities(payload) {
      return open("youtubeQuality", payload);
    },
  };
}

export default createPlayerDialog;
