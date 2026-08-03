import { getLanguage, t } from "../../i18n.js";
import { showToast } from "../../toast.js";
import { onOpenSettings } from "./openSettingsBus.js";

export const YTDLP_COOKIES_DEFAULT = Object.freeze({
  mode: "off",
  browser: "chrome",
  filePath: "",
});

const YTDLP_COOKIES_MODES = ["off", "browser", "file"];
const YTDLP_COOKIES_BROWSERS = [
  "chrome",
  "firefox",
  "safari",
  "edge",
  "brave",
  "chromium",
  "vivaldi",
  "opera",
];
const CONTROLLERS = new WeakMap();
const YOUTUBE_COOKIES_GUIDE_URL =
  "https://nagrands.github.io/thunder-load-app";

function getYouTubeCookiesGuideUrl() {
  const locale = getLanguage() === "en" ? "en" : "ru";
  return `${YOUTUBE_COOKIES_GUIDE_URL}/${locale}/blog/youtube-cookies/`;
}

export function normalizeYtDlpCookiesSettings(value) {
  const raw = value && typeof value === "object" ? value : {};
  const mode = YTDLP_COOKIES_MODES.includes(raw.mode)
    ? raw.mode
    : YTDLP_COOKIES_DEFAULT.mode;
  const browser = YTDLP_COOKIES_BROWSERS.includes(raw.browser)
    ? raw.browser
    : YTDLP_COOKIES_DEFAULT.browser;
  const filePath =
    typeof raw.filePath === "string" && !raw.filePath.includes("\u0000")
      ? raw.filePath.trim()
      : "";
  return { mode, browser, filePath };
}

function createCustomSelect(select, type) {
  return {
    select,
    root: document.querySelector(`[data-settings-cookies-select="${type}"]`),
    trigger: document.getElementById(`settings-ytdlp-cookies-${type}-trigger`),
    label: document.getElementById(`settings-ytdlp-cookies-${type}-label`),
    menu: document.getElementById(`settings-ytdlp-cookies-${type}-menu`),
  };
}

function getOptions(instance) {
  return Array.from(
    instance.menu?.querySelectorAll(".settings-cookies-select__option") || [],
  );
}

function closeCustomSelect(instance, { restoreFocus = false } = {}) {
  instance?.root?.classList.remove("is-open");
  instance?.trigger?.setAttribute("aria-expanded", "false");
  instance?.menu?.classList.add("hidden");
  if (restoreFocus) instance?.trigger?.focus();
}

function getOptionLabel(option) {
  const key = option?.dataset?.labelKey || "";
  if (key) return t(key);
  return option?.querySelector("span")?.textContent?.trim() || "";
}

function syncCustomSelect(instance) {
  if (!instance?.select) return;
  const options = getOptions(instance);
  const selected = options.find(
    (option) => option.dataset.value === instance.select.value,
  );
  options.forEach((option) => {
    option.setAttribute("aria-selected", String(option === selected));
    option.tabIndex = option === selected ? 0 : -1;
  });
  if (instance.label && selected) {
    instance.label.textContent = getOptionLabel(selected);
  }
}

function focusOption(instance, direction = 1) {
  const options = getOptions(instance);
  if (!options.length) return;
  const selectedIndex = options.findIndex(
    (option) => option.getAttribute("aria-selected") === "true",
  );
  const fallbackIndex = direction < 0 ? options.length - 1 : 0;
  options[selectedIndex >= 0 ? selectedIndex : fallbackIndex]?.focus();
}

function moveOptionFocus(instance, option, key) {
  const options = getOptions(instance);
  const index = options.indexOf(option);
  if (index < 0) return;
  const lastIndex = options.length - 1;
  const targetByKey = {
    ArrowDown: index === lastIndex ? 0 : index + 1,
    ArrowRight: index === lastIndex ? 0 : index + 1,
    ArrowUp: index === 0 ? lastIndex : index - 1,
    ArrowLeft: index === 0 ? lastIndex : index - 1,
    Home: 0,
    End: lastIndex,
  };
  options[targetByKey[key]]?.focus();
}

function bindCustomSelect(instance, closeOthers) {
  if (
    !instance.root ||
    !instance.trigger ||
    !instance.menu ||
    instance.root.dataset.cookiesSelectBound === "1"
  ) {
    return;
  }
  instance.root.dataset.cookiesSelectBound = "1";

  const open = ({ focus = false, direction = 1 } = {}) => {
    closeOthers(instance);
    instance.root.classList.add("is-open");
    instance.trigger.setAttribute("aria-expanded", "true");
    instance.menu.classList.remove("hidden");
    if (focus) focusOption(instance, direction);
  };

  instance.trigger.addEventListener("click", () => {
    if (instance.root.classList.contains("is-open")) {
      closeCustomSelect(instance);
    } else {
      open();
    }
  });
  instance.trigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      open({ focus: true });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      open({ focus: true, direction: -1 });
      return;
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      closeCustomSelect(instance);
    }
  });

  getOptions(instance).forEach((option) => {
    option.addEventListener("click", () => {
      instance.select.value = option.dataset.value || "";
      instance.select.dispatchEvent(new Event("change", { bubbles: true }));
      closeCustomSelect(instance, { restoreFocus: true });
    });
    option.addEventListener("keydown", (event) => {
      if (
        [
          "ArrowDown",
          "ArrowRight",
          "ArrowUp",
          "ArrowLeft",
          "Home",
          "End",
        ].includes(event.key)
      ) {
        event.preventDefault();
        moveOptionFocus(instance, option, event.key);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        option.click();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeCustomSelect(instance, { restoreFocus: true });
      }
    });
  });
}

export function initYtDlpCookiesSettings() {
  const modeSelect = document.getElementById("settings-ytdlp-cookies-mode");
  const browserSelect = document.getElementById(
    "settings-ytdlp-cookies-browser",
  );
  const browserRow = document.getElementById(
    "settings-ytdlp-cookies-browser-row",
  );
  const fileRow = document.getElementById("settings-ytdlp-cookies-file-row");
  const fileButton = document.getElementById(
    "settings-ytdlp-cookies-file-button",
  );
  const fileLabel = document.getElementById(
    "settings-ytdlp-cookies-file-label",
  );
  const summaryState = document.getElementById(
    "settings-ytdlp-cookies-summary-state",
  );
  const guideButton = document.getElementById(
    "settings-ytdlp-cookies-guide",
  );
  if (!modeSelect || !browserSelect || !fileButton || !fileLabel) return;

  const existingController = CONTROLLERS.get(modeSelect);
  if (existingController) {
    onOpenSettings("ytdlp-cookies-settings", existingController.load);
    existingController.load();
    return;
  }

  let current = { ...YTDLP_COOKIES_DEFAULT };
  let operationVersion = 0;
  let saveQueue = Promise.resolve();
  const customSelects = [
    createCustomSelect(modeSelect, "mode"),
    createCustomSelect(browserSelect, "browser"),
  ];
  const closeAllCustomSelects = (except = null) => {
    customSelects.forEach((instance) => {
      if (instance !== except) closeCustomSelect(instance);
    });
  };
  const syncAllCustomSelects = () => {
    customSelects.forEach(syncCustomSelect);
  };
  const syncSummaryState = () => {
    if (!summaryState) return;
    summaryState.textContent =
      current.mode === "browser"
        ? t("settings.downloader.cookies.mode.browser")
        : current.mode === "file"
          ? t("settings.downloader.cookies.mode.file")
          : t("settings.downloader.cookies.mode.off");
    summaryState.dataset.mode = current.mode;
  };

  customSelects.forEach((instance) => {
    bindCustomSelect(instance, closeAllCustomSelects);
  });

  const apply = (settings) => {
    current = normalizeYtDlpCookiesSettings(settings);
    modeSelect.value = current.mode;
    browserSelect.value = current.browser;
    syncAllCustomSelects();
    closeAllCustomSelects();
    if (browserRow) browserRow.hidden = current.mode !== "browser";
    if (fileRow) fileRow.hidden = current.mode !== "file";
    fileLabel.textContent =
      current.filePath || t("settings.downloader.cookies.file.empty");
    syncSummaryState();
  };

  const save = async (next, { toast = true } = {}) => {
    const settings = normalizeYtDlpCookiesSettings(next);
    const previous = current;
    const version = ++operationVersion;

    saveQueue = saveQueue.then(async () => {
      try {
        const result = await window.electron.invoke(
          "set-ytdlp-cookies-settings",
          settings,
        );
        if (result?.success === false) {
          throw new Error(result.error || "Unable to save cookies settings");
        }
        if (version === operationVersion) {
          apply(result?.settings || settings);
          if (toast) {
            showToast(t("settings.downloader.cookies.saved"), "success");
          }
        }
      } catch (error) {
        if (version === operationVersion) {
          apply(previous);
          showToast(
            t("settings.downloader.cookies.saveError", {
              message: error?.message || String(error),
            }),
            "error",
          );
        }
      }
    });

    await saveQueue;
  };

  const load = async () => {
    const version = ++operationVersion;
    await saveQueue;
    try {
      const settings = await window.electron.invoke(
        "get-ytdlp-cookies-settings",
      );
      if (version === operationVersion) apply(settings);
    } catch {
      if (version === operationVersion) apply(YTDLP_COOKIES_DEFAULT);
    }
  };

  if (modeSelect.dataset.cookiesSettingBound !== "1") {
    modeSelect.dataset.cookiesSettingBound = "1";
    modeSelect.addEventListener("change", () => {
      save({ ...current, mode: modeSelect.value });
    });
    browserSelect.addEventListener("change", () => {
      save({ ...current, browser: browserSelect.value });
    });
    fileButton.addEventListener("click", async () => {
      try {
        const result = await window.electron.invoke(
          "select-ytdlp-cookies-file",
        );
        if (result?.canceled) return;
        if (result?.success && result.filePath) {
          await save({ ...current, mode: "file", filePath: result.filePath });
          return;
        }
        throw new Error(result?.error || "Unable to select cookies file");
      } catch (error) {
        showToast(
          t("settings.downloader.cookies.file.error", {
            message: error?.message || String(error),
          }),
          "error",
        );
      }
    });
    guideButton?.addEventListener("click", async () => {
      try {
        const result = await window.electron.invoke(
          "open-external-link",
          getYouTubeCookiesGuideUrl(),
        );
        if (result?.success !== false) return;
      } catch {}
      showToast(t("external.open.error"), "error");
    });
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("[data-settings-cookies-select]")) return;
      closeAllCustomSelects();
    });
    window.addEventListener("i18n:changed", () => {
      syncAllCustomSelects();
      syncSummaryState();
    });
  }

  CONTROLLERS.set(modeSelect, { load });
  onOpenSettings("ytdlp-cookies-settings", load);
  load();
}
