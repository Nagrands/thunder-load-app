import { t } from "../i18n.js";
import { refreshPlayerIcons } from "./playerIcons.js";

function unwrap(result) {
  if (result?.success === false) {
    const error = new Error(
      result.error?.message || t("nowPlaying.audioTracks.loadError"),
    );
    error.code = result.error?.code || "AUDIO_TRACKS_FAILED";
    throw error;
  }
  return result?.data || result || {};
}

function getLanguageName(code) {
  if (!code) return "";
  try {
    return (
      new Intl.DisplayNames([document.documentElement.lang || "ru"], {
        type: "language",
      }).of(code) || code.toUpperCase()
    );
  } catch {
    return code.toUpperCase();
  }
}

function getChannelLabel(channels) {
  if (channels === 1) return t("nowPlaying.audioTracks.mono");
  if (channels === 2) return t("nowPlaying.audioTracks.stereo");
  if (channels === 6) return "5.1";
  if (channels === 8) return "7.1";
  return channels > 0
    ? t("nowPlaying.audioTracks.channels", { count: channels })
    : "";
}

function createOption({
  id,
  title,
  details,
  isDefault,
  selected,
  disabled = false,
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "now-playing__audio-option";
  button.dataset.action = "select-audio-track";
  button.dataset.audioTrackId = id || "";
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(selected));
  button.disabled = disabled;

  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", id ? "audio-lines" : "wand-sparkles");
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = title;
  const small = document.createElement("small");
  small.textContent = details;
  small.hidden = !details;
  copy.append(strong, small);

  const meta = document.createElement("span");
  meta.className = "now-playing__audio-option-meta";
  if (isDefault) {
    const badge = document.createElement("em");
    badge.textContent = t("nowPlaying.audioTracks.default");
    meta.appendChild(badge);
  }
  const check = document.createElement("i");
  check.className = "now-playing__audio-option-check";
  check.setAttribute("data-lucide", "check");
  check.setAttribute("aria-hidden", "true");
  meta.appendChild(check);
  button.append(icon, copy, meta);
  return button;
}

export function createAudioTracksController({
  root,
  api,
  getCurrentTrack,
  getNativeAudioTrackState,
  onOpenChange = () => {},
  onSelect,
  getReturnFocus = (trigger) => trigger,
}) {
  const menu = root.querySelector('[data-ui="audio-track-menu"]');
  const list = root.querySelector('[data-ui="audio-track-list"]');
  const status = root.querySelector('[data-ui="audio-track-status"]');
  const triggers = [
    ...root.querySelectorAll('[data-action="toggle-audio-tracks"]'),
  ];
  if (!menu || !list || !status || !triggers.length) return null;

  let currentTrackId = "";
  let tracks = [];
  let selectedAudioTrackId = null;
  let requestVersion = 0;
  let returnFocus = null;
  let busy = false;
  let selectionAvailable = false;
  let nativeIssueCode = "AUDIO_TRACKS_NOT_READY";

  function getIssueMessage(code, count = 0) {
    if (code === "AUDIO_TRACKS_NATIVE_MISMATCH") {
      return t("nowPlaying.audioTracks.nativeMismatch");
    }
    if (code === "AUDIO_TRACKS_FALLBACK_UNSUPPORTED") {
      return t("nowPlaying.audioTracks.fallbackUnsupported");
    }
    if (count === 1) return t("nowPlaying.audioTracks.single");
    return t("nowPlaying.audioTracks.nativeUnavailable");
  }

  function setBusy(value) {
    busy = value;
    menu.setAttribute("aria-busy", String(value));
    triggers.forEach((trigger) => {
      trigger.classList.toggle("is-loading", value);
    });
    list.querySelectorAll("button").forEach((button) => {
      button.disabled = value || !selectionAvailable;
    });
  }

  function setStatus(message, { error = false } = {}) {
    status.hidden = !message;
    status.classList.toggle("is-error", error);
    status.textContent = message || "";
  }

  function render() {
    list.replaceChildren();
    const autoOption = createOption({
      id: "",
      title: t("nowPlaying.audioTracks.auto"),
      details: t("nowPlaying.audioTracks.autoHint"),
      selected: !selectedAudioTrackId,
      disabled: !selectionAvailable,
    });
    list.appendChild(autoOption);
    tracks.forEach((track, index) => {
      const title =
        track.title ||
        getLanguageName(track.language) ||
        t("nowPlaying.audioTracks.numbered", { number: index + 1 });
      const details = [
        track.title ? getLanguageName(track.language) : "",
        String(track.codec || "").toUpperCase(),
        getChannelLabel(track.channels),
      ]
        .filter(Boolean)
        .join(" · ");
      list.appendChild(
        createOption({
          id: track.id,
          title,
          details,
          isDefault: track.isDefault,
          selected: selectedAudioTrackId === track.id,
          disabled: !selectionAvailable,
        }),
      );
    });
    refreshPlayerIcons(list);
  }

  function setExpanded(value) {
    triggers.forEach((trigger) =>
      trigger.setAttribute("aria-expanded", String(value)),
    );
  }

  function close({ restoreFocus = false } = {}) {
    requestVersion += 1;
    menu.hidden = true;
    onOpenChange(false);
    setExpanded(false);
    setBusy(false);
    if (restoreFocus) returnFocus?.focus?.();
    returnFocus = null;
  }

  async function open(trigger) {
    const track = getCurrentTrack();
    if (
      !track ||
      track.providerId !== "local" ||
      track.availability === "missing" ||
      busy
    ) {
      return false;
    }
    if (!menu.hidden) {
      close({ restoreFocus: true });
      return true;
    }
    returnFocus = getReturnFocus(trigger) || trigger;
    menu.hidden = false;
    onOpenChange(true);
    setExpanded(true);
    setStatus(t("nowPlaying.audioTracks.loading"));
    setBusy(true);
    list.replaceChildren();
    const version = ++requestVersion;
    try {
      const nativeState = getNativeAudioTrackState?.() || {
        supported: false,
        code: "AUDIO_TRACKS_NATIVE_UNAVAILABLE",
        count: 0,
      };
      const payload = unwrap(
        await api?.getAudioTracks?.({ trackId: track.id }),
      );
      if (version !== requestVersion || getCurrentTrack()?.id !== track.id) {
        return false;
      }
      currentTrackId = track.id;
      tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
      selectedAudioTrackId = track.selectedAudioTrackId || null;
      nativeIssueCode = nativeState.code;
      selectionAvailable =
        nativeState.supported === true &&
        nativeState.count > 1 &&
        nativeState.count === tracks.length;
      if (nativeState.supported && nativeState.count !== tracks.length) {
        nativeIssueCode = "AUDIO_TRACKS_NATIVE_MISMATCH";
      }
      render();
      setStatus(
        selectionAvailable
          ? ""
          : tracks.length
            ? getIssueMessage(nativeIssueCode, nativeState.count)
            : t("nowPlaying.audioTracks.empty"),
      );
      setBusy(false);
      list.querySelector('[aria-selected="true"]')?.focus();
      return true;
    } catch (error) {
      if (version !== requestVersion) return false;
      setBusy(false);
      setStatus(error?.message || t("nowPlaying.audioTracks.loadError"), {
        error: true,
      });
      return false;
    }
  }

  async function select(target) {
    if (busy || currentTrackId !== getCurrentTrack()?.id) return false;
    const nextId = target.dataset.audioTrackId || null;
    if (nextId === selectedAudioTrackId) {
      close({ restoreFocus: true });
      return true;
    }
    const version = ++requestVersion;
    setBusy(true);
    setStatus(t("nowPlaying.audioTracks.switching"));
    try {
      const changed = await onSelect({
        audioTrackId: nextId,
        tracks,
      });
      if (version !== requestVersion) return false;
      if (!changed) throw new Error(t("nowPlaying.audioTracks.switchError"));
      selectedAudioTrackId = nextId;
      render();
      close({ restoreFocus: true });
      return true;
    } catch (error) {
      if (version !== requestVersion) return false;
      setBusy(false);
      setStatus(error?.message || t("nowPlaying.audioTracks.switchError"), {
        error: true,
      });
      return false;
    }
  }

  function sync(snapshot) {
    const track = snapshot?.currentTrack || null;
    const isLocal =
      track?.providerId === "local" && track.availability !== "missing";
    const nativeState = isLocal
      ? getNativeAudioTrackState?.() || {
          supported: false,
          code: "AUDIO_TRACKS_NATIVE_UNAVAILABLE",
          count: 0,
        }
      : null;
    const supported = isLocal && nativeState.supported && nativeState.count > 1;
    if (track?.id !== currentTrackId) {
      selectionAvailable = false;
      nativeIssueCode =
        nativeState?.code ||
        (isLocal
          ? "AUDIO_TRACKS_NATIVE_UNAVAILABLE"
          : "AUDIO_TRACKS_LOCAL_ONLY");
    }
    triggers.forEach((trigger) => {
      trigger.setAttribute("aria-disabled", String(!supported));
      trigger.classList.toggle("is-disabled", !supported);
      trigger.setAttribute(
        "title",
        supported
          ? t("nowPlaying.audioTracks.open")
          : isLocal
            ? getIssueMessage(nativeIssueCode, nativeState?.count)
            : t("nowPlaying.audioTracks.localOnly"),
      );
      trigger.setAttribute(
        "aria-label",
        supported
          ? t("nowPlaying.audioTracks.open")
          : isLocal
            ? getIssueMessage(nativeIssueCode, nativeState?.count)
            : t("nowPlaying.audioTracks.localOnly"),
      );
    });
    if (track?.id !== currentTrackId && !menu.hidden) close();
    if (track?.id === currentTrackId) {
      selectedAudioTrackId = track.selectedAudioTrackId || null;
    }
  }

  function handleAction(action, target) {
    if (action === "toggle-audio-tracks") return open(target);
    if (action === "select-audio-track") return select(target);
    return undefined;
  }

  function handleKeydown(event) {
    const option = event.target.closest('[data-action="select-audio-track"]');
    if (option && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const options = [...list.querySelectorAll("button:not(:disabled)")];
      const index = options.indexOf(option);
      const targetIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length;
      options[targetIndex]?.focus();
      return true;
    }
    if (option && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      option.click();
      return true;
    }
    if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close({ restoreFocus: true });
      return true;
    }
    return false;
  }

  function handleOutsideClick(target) {
    if (
      !menu.hidden &&
      !target.closest('[data-ui="audio-track-menu"]') &&
      !target.closest('[data-action="toggle-audio-tracks"]')
    ) {
      close();
    }
  }

  function refreshI18n() {
    if (!menu.hidden) render();
    sync({ currentTrack: getCurrentTrack() });
  }

  setExpanded(false);
  triggers.forEach((trigger) => {
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-controls", "now-playing-audio-list");
  });
  sync({ currentTrack: null });

  return {
    close,
    dispose: close,
    handleAction,
    handleKeydown,
    handleOutsideClick,
    refreshI18n,
    sync,
  };
}

export default createAudioTracksController;
