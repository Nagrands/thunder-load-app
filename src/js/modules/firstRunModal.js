import { setLanguage, setLanguagePreview, getLanguage, t } from "./i18n.js";
import { setTheme, getTheme } from "./settingsStore.js";
import { updateModuleBadge } from "./settings.js";

const FIRST_RUN_KEY = "firstRunCompleted";
const STEP_COUNT = 4;

const DEFAULT_TAB_FLAGS = {
  wireguard: true,
  backup: true,
};

const LANGUAGE_LABEL_KEYS = {
  ru: "language.ru",
  en: "language.en",
};

const THEME_LABEL_KEYS = {
  dark: "settings.appearance.theme.dark",
  midnight: "settings.appearance.theme.midnight",
  sunset: "settings.appearance.theme.sunset",
  violet: "settings.appearance.theme.violet",
  light: "settings.appearance.theme.light",
};

const TAB_LABEL_KEYS = {
  download: "tabs.download",
  wireguard: "tabs.tools",
  backup: "tabs.backup",
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
    new CustomEvent("backup:toggleDisabled", {
      detail: { disabled: backupDisabled },
    }),
  );
};

const getSelectedRadio = (name) => {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
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

const getSelectedTabs = () =>
  Array.from(document.querySelectorAll('input[name="first-run-tab"]:checked')).map(
    (el) => el.value,
  );

export function initFirstRunModal() {
  const modal = document.getElementById("first-run-modal");
  if (!modal) return;
  const panels = Array.from(
    modal.querySelectorAll("[data-first-run-panel]"),
  );
  const stepButtons = Array.from(
    modal.querySelectorAll(".first-run-step"),
  );
  const stepLabel = document.getElementById("first-run-step-label");
  const stepCounter = document.getElementById("first-run-step-counter");
  const backButton = document.getElementById("first-run-back");
  const primaryButton = document.getElementById("first-run-primary");
  const summaryLanguage = document.getElementById("first-run-summary-language");
  const summaryTabs = document.getElementById("first-run-summary-tabs");
  const summaryTheme = document.getElementById("first-run-summary-theme");
  if (
    !backButton ||
    !primaryButton ||
    !stepLabel ||
    !stepCounter ||
    !summaryLanguage ||
    !summaryTabs ||
    !summaryTheme
  ) {
    return;
  }

  const alreadyCompleted = localStorage.getItem(FIRST_RUN_KEY) === "1";
  if (alreadyCompleted) return;
  let currentStep = 0;

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

  const syncSelectedCards = () => {
    Array.from(modal.querySelectorAll(".first-run-option")).forEach((option) => {
      const input = option.querySelector("input");
      if (!input) return;
      option.classList.toggle("is-selected", !!input.checked);
      option.classList.toggle("is-disabled", !!input.disabled);
    });
  };

  const updateSummary = () => {
    const lang = getSelectedRadio("first-run-language") || "ru";
    const theme = getSelectedRadio("first-run-theme") || "dark";
    const selectedTabs = getSelectedTabs();
    summaryLanguage.textContent = t(LANGUAGE_LABEL_KEYS[lang] || "language.ru");
    summaryTheme.textContent = t(
      THEME_LABEL_KEYS[theme] || "settings.appearance.theme.dark",
    );
    summaryTabs.textContent = selectedTabs
      .map((tab) => t(TAB_LABEL_KEYS[tab] || "tabs.download"))
      .join(", ");
  };

  const renderStep = () => {
    panels.forEach((panel, index) => {
      const isActive = index === currentStep;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });

    stepButtons.forEach((button, index) => {
      const isActive = index === currentStep;
      const isCompleted = index < currentStep;
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("is-complete", isCompleted);
      if (isActive) {
        button.setAttribute("aria-current", "step");
      } else {
        button.removeAttribute("aria-current");
      }
      button.disabled = index > currentStep;
    });

    const activeStepButton = stepButtons[currentStep];
    const labelKey =
      activeStepButton?.dataset.stepLabelKey || "firstRun.steps.language";
    stepLabel.textContent = t(labelKey);
    stepCounter.textContent = t("firstRun.stepCounter", {
      current: currentStep + 1,
      total: STEP_COUNT,
    });

    const isSummaryStep = currentStep === STEP_COUNT - 1;
    backButton.disabled = currentStep === 0;
    primaryButton.textContent = isSummaryStep
      ? t("firstRun.apply")
      : t("firstRun.next");
    primaryButton.classList.toggle("btn-primary", isSummaryStep);
    primaryButton.classList.toggle("btn-secondary", !isSummaryStep);
    primaryButton.setAttribute(
      "data-i18n",
      isSummaryStep ? "firstRun.apply" : "firstRun.next",
    );
    if (isSummaryStep) {
      updateSummary();
    }
  };

  const goToStep = (index) => {
    const nextIndex = Math.max(0, Math.min(STEP_COUNT - 1, Number(index) || 0));
    if (nextIndex > currentStep + 1) return;
    currentStep = nextIndex;
    renderStep();
  };

  Array.from(
    modal.querySelectorAll('input[name="first-run-tab"], input[name="first-run-language"], input[name="first-run-theme"]'),
  ).forEach((input) => {
    input.addEventListener("change", () => {
      syncSelectedCards();
      updateSummary();
    });
  });

  stepButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      goToStep(Number(button.dataset.stepIndex || 0));
    });
  });

  backButton.addEventListener("click", () => goToStep(currentStep - 1));
  primaryButton.addEventListener("click", async () => {
    if (currentStep !== STEP_COUNT - 1) {
      goToStep(currentStep + 1);
      return;
    }

    const lang = getSelectedRadio("first-run-language") || "ru";
    const theme = getSelectedRadio("first-run-theme") || "dark";
    const selectedTabs = getSelectedTabs();
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

  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  syncSelectedCards();
  updateSummary();
  renderStep();
}
