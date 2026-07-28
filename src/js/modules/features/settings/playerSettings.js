import { t } from "../../i18n.js";
import { showToast } from "../../toast.js";
import {
  applyPlayerSettings,
  onPlayerSettingsState,
} from "../../nowPlaying/settingsEvents.js";
import {
  DEFAULT_PLAYER_SETTINGS,
  DEFAULT_VISUALIZER_SETTINGS,
} from "./defaults.js";
import { normalizeVisualizerSettings } from "../../nowPlaying/visualizerSettings.js";

export { DEFAULT_PLAYER_SETTINGS, DEFAULT_VISUALIZER_SETTINGS };
export { normalizeVisualizerSettings };

export function normalizePlayerSettings(value = {}) {
  const rawVolume = Number(value.volume);
  const volume = Number.isFinite(rawVolume)
    ? Math.min(1, Math.max(0, rawVolume))
    : 1;
  return {
    sidebarPinned: value.sidebarPinned === true,
    backgroundPlayback:
      typeof value.backgroundPlayback === "boolean"
        ? value.backgroundPlayback
        : true,
    shuffle: value.shuffle === true,
    repeat: ["off", "one", "all"].includes(value.repeat) ? value.repeat : "off",
    volume,
    muted: volume === 0 || value.muted === true,
    visualizer: normalizeVisualizerSettings(value.visualizer),
  };
}

function unwrap(result) {
  if (result?.success === false) {
    throw new Error(result.error?.message || t("settings.player.saveError"));
  }
  return result?.data || result || {};
}

export function createPlayerSettingsController({
  root = document,
  api = window.electron?.nowPlaying,
} = {}) {
  const sidebarPinned = root.getElementById("settings-player-sidebar-pinned");
  const backgroundPlayback = root.getElementById(
    "settings-player-background-playback",
  );
  const shuffle = root.getElementById("settings-player-shuffle");
  const repeat = [...root.querySelectorAll("[data-player-repeat]")];
  const volume = root.getElementById("settings-player-volume");
  const volumeValue = root.getElementById("settings-player-volume-value");
  if (
    !sidebarPinned ||
    !backgroundPlayback ||
    !shuffle ||
    !repeat.length ||
    !volume ||
    !volumeValue
  ) {
    return null;
  }

  let state = { ...DEFAULT_PLAYER_SETTINGS };
  let requestVersion = 0;

  function render(nextState = state) {
    state = normalizePlayerSettings(nextState);
    sidebarPinned.checked = state.sidebarPinned;
    backgroundPlayback.checked = state.backgroundPlayback;
    shuffle.checked = state.shuffle;
    repeat.forEach((button) => {
      const selected = button.dataset.playerRepeat === state.repeat;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    const effectiveVolume = state.muted ? 0 : state.volume;
    const percent = Math.round(effectiveVolume * 100);
    volume.value = String(percent);
    volume.style.setProperty("--settings-player-volume", `${percent}%`);
    volume.setAttribute("aria-valuetext", `${percent}%`);
    volumeValue.value = `${percent}%`;
    volumeValue.textContent = `${percent}%`;
  }

  async function load() {
    const version = ++requestVersion;
    try {
      const loaded = normalizePlayerSettings(unwrap(await api?.getState?.()));
      if (version === requestVersion) render(loaded);
      return loaded;
    } catch (error) {
      if (version === requestVersion) {
        showToast(error?.message || t("settings.player.loadError"), "error");
      }
      return null;
    }
  }

  async function update(patch) {
    const previous = state;
    const optimistic = normalizePlayerSettings({ ...state, ...patch });
    const version = ++requestVersion;
    render(optimistic);
    try {
      const saved = normalizePlayerSettings(
        unwrap(await api?.updateSettings?.(patch)),
      );
      if (version !== requestVersion) return saved;
      render(saved);
      applyPlayerSettings(saved);
      return saved;
    } catch (error) {
      if (version === requestVersion) {
        render(previous);
        showToast(error?.message || t("settings.player.saveError"), "error");
      }
      return null;
    }
  }

  sidebarPinned.addEventListener(
    "change",
    () => void update({ sidebarPinned: sidebarPinned.checked }),
  );
  backgroundPlayback.addEventListener(
    "change",
    () => void update({ backgroundPlayback: backgroundPlayback.checked }),
  );
  shuffle.addEventListener(
    "change",
    () => void update({ shuffle: shuffle.checked }),
  );
  repeat.forEach((button) => {
    button.addEventListener(
      "click",
      () => void update({ repeat: button.dataset.playerRepeat }),
    );
    button.addEventListener("keydown", (event) => {
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        return;
      }
      event.preventDefault();
      const index = repeat.indexOf(button);
      const offset = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
      repeat[(index + offset + repeat.length) % repeat.length]?.click();
    });
  });
  volume.addEventListener("input", () => {
    const nextVolume = Math.min(1, Math.max(0, Number(volume.value) / 100));
    void update({ volume: nextVolume, muted: nextVolume === 0 });
  });

  const unsubscribe = onPlayerSettingsState((event) => {
    render(event.detail);
  });
  const onSettingsOpened = () => void load();
  window.addEventListener("settings:opened", onSettingsOpened);
  render();

  return {
    load,
    render,
    update,
    getState: () => ({ ...state }),
    dispose() {
      unsubscribe();
      window.removeEventListener("settings:opened", onSettingsOpened);
    },
  };
}

let controller = null;

export function initPlayerSettings() {
  controller?.dispose?.();
  controller = createPlayerSettingsController();
  return controller;
}

export default initPlayerSettings;
