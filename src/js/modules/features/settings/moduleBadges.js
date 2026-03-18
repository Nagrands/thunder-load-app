import { t } from "../../i18n.js";

export const MODULE_BADGE_MAP = {
  wg: {
    tab: "wgunlock-settings",
    badgeId: "tab-badge-wg",
    statusBadgeId: "settings-wg-status-badge",
    statusTextId: "settings-wg-status-text",
    enabledTextKey: "settings.module.wg.enabled",
    disabledTextKey: "settings.module.wg.disabled",
  },
  backup: {
    statusBadgeId: "settings-backup-status-badge",
    statusTextId: "settings-backup-status-text",
    enabledTextKey: "settings.module.backup.enabled",
    disabledTextKey: "settings.module.backup.disabled",
  },
};

const MODULE_BADGES_I18N_BOUND_KEY =
  "__thunder_settings_module_badges_i18n_bound__";
const MODULE_BADGES_STATE_KEY = "__thunder_settings_module_badges_state__";

function readBoolFlag(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) === true;
  } catch {
    return defaultValue;
  }
}

function getModuleBadgesState() {
  const state = window[MODULE_BADGES_STATE_KEY];
  if (state) return state;
  const next = { bound: false, sync: null };
  window[MODULE_BADGES_STATE_KEY] = next;
  return next;
}

export function updateModuleBadge(moduleKey, disabled) {
  const map = MODULE_BADGE_MAP[moduleKey];
  if (!map) return;

  const btn = map.tab
    ? document.querySelector(`.tab-link[data-tab="${map.tab}"]`)
    : null;
  const badge =
    (map.badgeId && document.getElementById(map.badgeId)) ||
    btn?.querySelector(".tab-badge") ||
    null;
  const isDisabled = !!disabled;

  if (btn && badge) {
    badge.hidden = false;
    badge.removeAttribute("hidden");
    badge.classList.toggle("tab-badge-off", isDisabled);
    btn.classList.toggle("tab-disabled", isDisabled);
    btn.dataset.disabled = isDisabled ? "1" : "0";
    badge.textContent = isDisabled
      ? t("settings.tab.disabled")
      : t("settings.tab.enabled");
    badge.setAttribute(
      "aria-label",
      isDisabled
        ? t("settings.tab.disabled.aria")
        : t("settings.tab.enabled.aria"),
    );
    badge.setAttribute("aria-hidden", isDisabled ? "false" : "true");
    badge.style.display = isDisabled ? "" : "none";
  }

  const statusBadge = map.statusBadgeId
    ? document.getElementById(map.statusBadgeId)
    : null;
  if (statusBadge) {
    statusBadge.textContent = isDisabled
      ? t("settings.tab.disabled")
      : t("settings.tab.enabled");
    statusBadge.classList.toggle("is-disabled", isDisabled);
  }

  const statusText = map.statusTextId
    ? document.getElementById(map.statusTextId)
    : null;
  if (statusText) {
    const textKey = isDisabled ? map.disabledTextKey : map.enabledTextKey;
    if (textKey) {
      statusText.innerHTML = t(textKey);
    }
  }
}

export function syncModuleBadges(readBool = readBoolFlag) {
  updateModuleBadge("wg", readBool("wgUnlockDisabled", true));
  updateModuleBadge("backup", readBool("backupDisabled", false));
}

export function bindModuleBadgesI18nSync() {
  const state = getModuleBadgesState();
  state.sync = syncModuleBadges;
  if (state.bound || window[MODULE_BADGES_I18N_BOUND_KEY]) return;
  state.bound = true;
  window[MODULE_BADGES_I18N_BOUND_KEY] = true;

  window.addEventListener("i18n:changed", () => {
    window[MODULE_BADGES_STATE_KEY]?.sync?.();
  });
}
