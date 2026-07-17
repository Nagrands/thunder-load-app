import { t } from "../../i18n.js";
import { QUALITY_PROFILE_DEFAULT, QUALITY_PROFILE_KEY } from "./defaults.js";
import { onOpenSettings } from "./openSettingsBus.js";

const OPTIONS = ["remember", "audio"];
const CONTROLLERS = new WeakMap();
const SUMMARY_META = Object.freeze({
  remember: {
    icon: "fa-solid fa-rotate",
    titleKey: "settings.downloader.profile.summary.remember.title",
    hintKey: "settings.downloader.profile.summary.remember.hint",
  },
  audio: {
    icon: "fa-solid fa-music",
    titleKey: "settings.downloader.profile.summary.audio.title",
    hintKey: "settings.downloader.profile.summary.audio.hint",
  },
});

function normalizeDownloadQualityProfile(value) {
  return OPTIONS.includes(value) ? value : QUALITY_PROFILE_DEFAULT;
}

function readDownloadQualityProfile() {
  try {
    return normalizeDownloadQualityProfile(
      localStorage.getItem(QUALITY_PROFILE_KEY),
    );
  } catch {
    return QUALITY_PROFILE_DEFAULT;
  }
}

function writeDownloadQualityProfile(value) {
  const normalized = normalizeDownloadQualityProfile(value);
  try {
    localStorage.setItem(QUALITY_PROFILE_KEY, normalized);
  } catch {}
  window.electron
    ?.invoke?.("toast", t("settings.qualityProfile.saved"), "success")
    ?.catch?.(() => {});
  return normalized;
}

function getElements() {
  const segment = document.getElementById("quality-profile-segment");
  const rememberBtn = document.getElementById(
    "quality-profile-segment-remember",
  );
  const audioBtn = document.getElementById("quality-profile-segment-audio");
  const summaryIcon = document.getElementById("quality-profile-summary-icon");
  const summaryTitle = document.getElementById("quality-profile-summary-title");
  const summaryHint = document.getElementById("quality-profile-summary-hint");
  if (!segment || !rememberBtn || !audioBtn || !summaryTitle || !summaryHint) {
    return null;
  }
  return {
    segment,
    buttons: [rememberBtn, audioBtn],
    summaryIcon,
    summaryTitle,
    summaryHint,
  };
}

function renderDownloadQualityProfile(elements, value) {
  const current = normalizeDownloadQualityProfile(value);
  elements.buttons.forEach((btn) => {
    const isActive = btn.dataset.value === current;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-checked", isActive ? "true" : "false");
    btn.tabIndex = isActive ? 0 : -1;
  });
  const meta = SUMMARY_META[current];
  if (elements.summaryIcon) {
    elements.summaryIcon.innerHTML = `<i class="${meta.icon}"></i>`;
  }
  elements.summaryTitle.setAttribute("data-i18n", meta.titleKey);
  elements.summaryTitle.textContent = t(meta.titleKey);
  elements.summaryHint.setAttribute("data-i18n", meta.hintKey);
  elements.summaryHint.textContent = t(meta.hintKey);
  return current;
}

function createDownloadQualityProfileController(elements) {
  const abortController = new AbortController();
  let currentSelection = renderDownloadQualityProfile(
    elements,
    readDownloadQualityProfile(),
  );

  const apply = (value) => {
    currentSelection = renderDownloadQualityProfile(elements, value);
    return currentSelection;
  };

  const commit = (value) => {
    const normalized = writeDownloadQualityProfile(value);
    apply(normalized);
  };

  const moveSelection = (offset, { commit: shouldCommit = false } = {}) => {
    const current = normalizeDownloadQualityProfile(currentSelection);
    const index = OPTIONS.indexOf(current);
    const next = OPTIONS[(index + offset + OPTIONS.length) % OPTIONS.length];
    apply(next);
    if (shouldCommit) writeDownloadQualityProfile(next);
  };

  const moveToEdge = (toLast, { commit: shouldCommit = false } = {}) => {
    const next = toLast ? OPTIONS[OPTIONS.length - 1] : OPTIONS[0];
    apply(next);
    if (shouldCommit) writeDownloadQualityProfile(next);
  };

  elements.buttons.forEach((btn) => {
    btn.addEventListener(
      "click",
      () => {
        commit(btn.dataset.value);
      },
      { signal: abortController.signal },
    );
  });

  elements.segment.addEventListener(
    "keydown",
    (event) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          moveSelection(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          moveSelection(-1);
          break;
        case "Home":
          event.preventDefault();
          moveToEdge(false);
          break;
        case "End":
          event.preventDefault();
          moveToEdge(true);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          commit(currentSelection);
          break;
        default:
          break;
      }
    },
    { signal: abortController.signal },
  );

  return {
    refresh: () => apply(readDownloadQualityProfile()),
    destroy: () => abortController.abort(),
  };
}

function initDownloadQualityProfileSettings() {
  const elements = getElements();
  if (!elements) return null;

  const existingController = CONTROLLERS.get(elements.segment);
  existingController?.destroy();

  const controller = createDownloadQualityProfileController(elements);
  CONTROLLERS.set(elements.segment, controller);
  onOpenSettings("download-quality-profile", controller.refresh);
  return controller;
}

export {
  initDownloadQualityProfileSettings,
  normalizeDownloadQualityProfile,
  renderDownloadQualityProfile,
};
