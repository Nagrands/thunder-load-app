import { setLanguage, setLanguagePreview, getLanguage } from "./i18n.js";
import { setTheme, getTheme } from "./settingsStore.js";
import { updateModuleBadge } from "./settings.js";

const FIRST_RUN_KEY = "firstRunCompleted";

const DEFAULT_TAB_FLAGS = {
  wireguard: true,
  backup: true,
};

const getFlag = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) === true;
  } catch {
    return fallback;
  }
};

const setFlag = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(!!value));
  } catch {}
};

const applyTabFlags = (flags) => {
  const wgDisabled = !flags.wireguard;
  const backupDisabled = !flags.backup;
  setFlag("wgUnlockDisabled", wgDisabled);
  setFlag("backupDisabled", backupDisabled);
  updateModuleBadge("wg", wgDisabled);
  updateModuleBadge("backup", backupDisabled);
  window.dispatchEvent(
    new CustomEvent("wg:toggleDisabled", { detail: { disabled: wgDisabled } }),
  );
  window.dispatchEvent(
    new CustomEvent("backup:toggleDisabled", { detail: { disabled: backupDisabled } }),
  );
};

const getSelectedRadio = (name) => {
  const checked = document.querySelector(
    `input[name="${name}"]:checked`,
  );
  return checked ? checked.value : "";
};

const setRadioValue = (name, value) => {
  const target = document.querySelector(
    `input[name="${name}"][value="${value}"]`,
  );
  if (target) target.checked = true;
};

const setCheckboxValue = (name, value, checked) => {
  const target = document.querySelector(
    `input[name="${name}"][value="${value}"]`,
  );
  if (target) target.checked = !!checked;
};

export function initFirstRunModal() {
  const modal = document.getElementById("first-run-modal");
  if (!modal) return;
  const applyButton = document.getElementById("first-run-apply");
  if (!applyButton) return;

  const alreadyCompleted = localStorage.getItem(FIRST_RUN_KEY) === "1";
  if (alreadyCompleted) return;

  const currentLang = getLanguage();
  setRadioValue("first-run-language", currentLang);

  const langOptions = Array.from(
    document.querySelectorAll('input[name="first-run-language"]'),
  );
  langOptions.forEach((option) => {
    option.addEventListener("change", () => {
      const selected = getSelectedRadio("first-run-language");
      if (selected) {
        setLanguagePreview(selected);
      }
    });
  });

  const currentTheme = getTheme();
  setRadioValue("first-run-theme", currentTheme || "dark");

  const themeOptions = Array.from(
    document.querySelectorAll('input[name="first-run-theme"]'),
  );
  themeOptions.forEach((option) => {
    option.addEventListener("change", async () => {
      const selected = getSelectedRadio("first-run-theme");
      if (selected) {
        await setTheme(selected);
      }
    });
  });

  setCheckboxValue(
    "first-run-tab",
    "wireguard",
    !getFlag("wgUnlockDisabled", DEFAULT_TAB_FLAGS.wireguard) ? true : false,
  );
  setCheckboxValue(
    "first-run-tab",
    "backup",
    !getFlag("backupDisabled", DEFAULT_TAB_FLAGS.backup) ? true : false,
  );

  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";

  applyButton.addEventListener("click", async () => {
    const lang = getSelectedRadio("first-run-language") || "ru";
    const theme = getSelectedRadio("first-run-theme") || "system";
    const selectedTabs = Array.from(
      document.querySelectorAll('input[name="first-run-tab"]:checked'),
    ).map((el) => el.value);
    const flags = {
      wireguard: selectedTabs.includes("wireguard"),
      backup: selectedTabs.includes("backup"),
    };

    await setTheme(theme);
    applyTabFlags(flags);
    setLanguage(lang);

    try {
      localStorage.setItem(FIRST_RUN_KEY, "1");
    } catch {}

    const isTestEnv =
      typeof process !== "undefined" &&
      process.env &&
      process.env.NODE_ENV === "test";
    if (!isTestEnv) {
      window.location.reload();
    }
  });
}
