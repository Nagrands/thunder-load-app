import { applyI18n, getLanguage, t } from "./i18n.js";
import { showConfirmationDialog } from "./modals.js";
import { initTooltips } from "./tooltipInitializer.js";

const TOOL_DEFINITIONS = Object.freeze([
  {
    id: "ytDlp",
    displayName: "yt-dlp",
    iconClass: "fa-solid fa-download",
    site: "https://github.com/yt-dlp/yt-dlp",
  },
  {
    id: "ffmpeg",
    displayName: "ffmpeg",
    iconClass: "fa-solid fa-film",
    site: "https://ffmpeg.org",
  },
  {
    id: "deno",
    displayName: "Deno",
    iconClass: "fa-solid fa-code",
    site: "https://deno.com",
  },
]);

const TOOL_IDS = new Set(TOOL_DEFINITIONS.map(({ id }) => id));
const TOOLS_REFRESH_STALE_MS = 20_000;
const SNAPSHOT_KEY = "toolsDependenciesSnapshotV2";
const ADVANCED_SESSION_KEY = "toolsDependenciesAdvancedOpen";
const ACTION_COOLDOWN_MS = 350;
const contexts = new Set();

function firstLine(value = "") {
  return String(value || "").split("\n")[0].trim();
}

function formatDenoVersion(value = "") {
  return firstLine(value).replace(/^deno\s+/i, "").replace(/^v/i, "").trim();
}

function formatVersion(id, value = "") {
  const line = firstLine(value);
  if (id === "ytDlp") return line.replace(/^v/i, "");
  if (id === "ffmpeg") {
    return line.replace(/^ffmpeg version\s*/i, "").split(/\s+/)[0] || "";
  }
  return formatDenoVersion(line);
}

function normVer(value = "") {
  return String(value || "").trim().replace(/^v/i, "").toLowerCase();
}

function parseYtDlpVer(value) {
  const match = normVer(value).match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!match) return null;
  return match.slice(1).map((entry) => Number.parseInt(entry, 10));
}

function parseSemver(value) {
  const match = normVer(value)
    .split("-")[0]
    .split("+")[0]
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!match) return null;
  return match.slice(1).map((entry) => Number.parseInt(entry || "0", 10));
}

function compareParts(latest, current) {
  if (!latest || !current) return null;
  for (let index = 0; index < 3; index += 1) {
    if (latest[index] > current[index]) return 1;
    if (latest[index] < current[index]) return -1;
  }
  return 0;
}

function hasUpdate(id, current, latest) {
  if (!current || !latest) return false;
  const parser = id === "ytDlp" ? parseYtDlpVer : parseSemver;
  return compareParts(parser(latest), parser(current)) === 1;
}

function createToolState(definition, saved = null) {
  const savedStatus = [
    "installed",
    "update_available",
    "missing",
    "unknown_version",
  ].includes(saved?.status)
    ? saved.status
    : "not_checked";
  return {
    id: definition.id,
    displayName: definition.displayName,
    installed: saved?.installed === true,
    currentVersion:
      typeof saved?.currentVersion === "string" ? saved.currentVersion : null,
    latestVersion:
      typeof saved?.latestVersion === "string" ? saved.latestVersion : null,
    updateAvailable: saved?.updateAvailable === true,
    status: savedStatus,
    executablePath: null,
    lastCheckedAt:
      Number.isFinite(Number(saved?.lastCheckedAt)) &&
      Number(saved.lastCheckedAt) > 0
        ? Number(saved.lastCheckedAt)
        : null,
    error: null,
    isChecking: false,
    isUpdating: false,
    skipUpdates: false,
  };
}

function readSnapshot() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null");
    if (!parsed || !Array.isArray(parsed.tools)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSnapshot(tools) {
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        tools: tools.map((tool) => ({
          id: tool.id,
          installed: tool.installed,
          currentVersion: tool.currentVersion,
          latestVersion: tool.latestVersion,
          updateAvailable: tool.updateAvailable,
          status: tool.status,
          lastCheckedAt: tool.lastCheckedAt,
        })),
      }),
    );
  } catch {}
}

function normalizeVersionsPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const normalized = {};
  for (const { id } of TOOL_DEFINITIONS) {
    const raw = payload[id];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      normalized[id] = {
        ok: false,
        path: "",
        version: "",
        error: "invalid-response",
      };
      continue;
    }
    normalized[id] = {
      ok: raw.ok === true,
      path: typeof raw.path === "string" ? raw.path : "",
      version: typeof raw.version === "string" ? raw.version : "",
      error: typeof raw.error === "string" ? raw.error : "",
      skipUpdates: raw.skipUpdates === true,
    };
  }
  return normalized;
}

function normalizeUpdatesPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  if (typeof payload.error === "string" && payload.error) {
    return { error: payload.error };
  }
  const normalized = {};
  for (const { id } of TOOL_DEFINITIONS) {
    const raw = payload[id];
    normalized[id] = {
      current:
        raw && typeof raw.current === "string"
          ? formatVersion(id, raw.current)
          : null,
      latest:
        raw && typeof raw.latest === "string"
          ? formatVersion(id, raw.latest)
          : null,
      canUpdate: raw?.canUpdate === true,
      skipUpdates: raw?.skipUpdates === true,
    };
  }
  return normalized;
}

export function summarizeToolsState(payload) {
  const normalized = normalizeVersionsPayload(payload) || {};
  const details = TOOL_DEFINITIONS.map(({ id, displayName }) => {
    const raw = normalized[id] || {};
    const version = raw.ok ? formatVersion(id, raw.version) || null : null;
    return {
      id: id === "ytDlp" ? "yt" : id === "ffmpeg" ? "ff" : "deno",
      toolId: id,
      label: displayName,
      ok: raw.ok && !!raw.path,
      version,
      skip: raw.skipUpdates,
    };
  });
  const missing = details.filter((item) => !item.ok).map((item) => item.label);
  return {
    state: missing.length ? "error" : "ok",
    hasAll: missing.length === 0,
    missing,
    text: missing.length
      ? t("tools.summary.missingList", { items: missing.join(", ") })
      : t("tools.summary.ok"),
    versions: {
      yt: details[0].version,
      ff: details[1].version,
      deno: details[2].version,
    },
    details,
  };
}

export function resolvePendingToolUpdates(currentVersions, updatesPayload) {
  const versions = normalizeVersionsPayload(currentVersions) || {};
  const updates = normalizeUpdatesPayload(updatesPayload) || {};
  return {
    yt:
      updates.ytDlp?.canUpdate === true ||
      hasUpdate(
        "ytDlp",
        formatVersion("ytDlp", versions.ytDlp?.version),
        updates.ytDlp?.latest,
      ),
    ff:
      updates.ffmpeg?.skipUpdates !== true &&
      (updates.ffmpeg?.canUpdate === true ||
        hasUpdate(
          "ffmpeg",
          formatVersion("ffmpeg", versions.ffmpeg?.version),
          updates.ffmpeg?.latest,
        )),
    deno:
      updates.deno?.canUpdate === true ||
      hasUpdate(
        "deno",
        formatVersion("deno", versions.deno?.version),
        updates.deno?.latest,
      ),
  };
}

export async function installAllTools(options = {}) {
  if (!window.electron?.tools?.installAll) {
    throw new Error(t("tools.error.installUnavailable"));
  }
  return window.electron.tools.installAll(options);
}

function createIcon(className) {
  const icon = document.createElement("i");
  icon.className = className;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function createButton({
  id,
  className = "",
  icon,
  labelKey,
  titleKey = labelKey,
}) {
  const button = document.createElement("button");
  button.type = "button";
  if (id) button.id = id;
  if (className) button.className = className;
  if (icon) button.appendChild(createIcon(icon));
  if (labelKey) {
    const label = document.createElement("span");
    label.dataset.i18n = labelKey;
    label.textContent = t(labelKey);
    button.appendChild(label);
  }
  if (titleKey) {
    button.dataset.i18nTitle = titleKey;
    button.dataset.i18nAria = titleKey;
    button.title = t(titleKey);
    button.setAttribute("aria-label", t(titleKey));
  }
  return button;
}

function renderSkeleton(section) {
  section.replaceChildren();

  const page = document.createElement("div");
  page.id = "tools-panel";
  page.className = "dependency-manager";
  page.dataset.summaryState = "not_checked";

  const live = document.createElement("div");
  live.className = "tools-sr-only";
  live.id = "tools-live-status";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");

  const header = document.createElement("header");
  header.className = "dependency-manager__header";
  const heading = document.createElement("div");
  heading.className = "dependency-manager__heading";
  const mark = document.createElement("span");
  mark.className = "dependency-manager__heading-icon";
  mark.appendChild(createIcon("fa-solid fa-download"));
  const headingCopy = document.createElement("div");
  const title = document.createElement("h2");
  title.dataset.i18n = "tools.dependencies.title";
  title.textContent = t("tools.dependencies.title");
  const description = document.createElement("p");
  description.dataset.i18n = "tools.dependencies.description";
  description.textContent = t("tools.dependencies.description");
  headingCopy.append(title, description);
  heading.append(mark, headingCopy);
  const checkButton = createButton({
    id: "tools-check-btn",
    className: "dependency-manager__check",
    icon: "fa-solid fa-rotate",
    labelKey: "tools.button.check",
    titleKey: "tools.button.checkTooltip",
  });
  header.append(heading, checkButton);

  const summary = document.createElement("section");
  summary.className = "dependency-summary";
  summary.setAttribute("aria-labelledby", "tools-summary-title");
  const summaryIcon = document.createElement("span");
  summaryIcon.id = "tools-summary-icon";
  summaryIcon.className = "dependency-summary__icon";
  summaryIcon.appendChild(createIcon("fa-solid fa-circle-minus"));
  const summaryCopy = document.createElement("div");
  summaryCopy.className = "dependency-summary__copy";
  const summaryTitle = document.createElement("h3");
  summaryTitle.id = "tools-summary-title";
  const summaryDescription = document.createElement("p");
  summaryDescription.id = "tools-summary-description";
  summaryCopy.append(summaryTitle, summaryDescription);
  const checked = document.createElement("div");
  checked.className = "dependency-summary__checked";
  const checkedLabel = document.createElement("span");
  checkedLabel.dataset.i18n = "tools.summary.lastChecked";
  checkedLabel.textContent = t("tools.summary.lastChecked");
  const checkedValue = document.createElement("strong");
  checkedValue.id = "tools-last-checked";
  checked.append(checkedLabel, checkedValue);
  const badge = document.createElement("span");
  badge.id = "tools-summary-badge";
  badge.className = "dependency-status-badge";
  summary.append(summaryIcon, summaryCopy, checked, badge);

  const listSection = document.createElement("section");
  listSection.className = "dependency-list-section";
  const listTitle = document.createElement("h3");
  listTitle.dataset.i18n = "tools.dependencies.installedTitle";
  listTitle.textContent = t("tools.dependencies.installedTitle");
  const list = document.createElement("div");
  list.id = "tools-status-cards";
  list.className = "dependency-list";
  list.setAttribute("role", "list");
  listSection.append(listTitle, list);

  const location = document.createElement("section");
  location.className = "dependency-location";
  const locationTitle = document.createElement("h3");
  locationTitle.dataset.i18n = "tools.location.title";
  locationTitle.textContent = t("tools.location.title");
  const locationSurface = document.createElement("div");
  locationSurface.className = "dependency-location__surface";
  const pathWrap = document.createElement("div");
  pathWrap.className = "dependency-location__path";
  pathWrap.appendChild(createIcon("fa-regular fa-folder"));
  const pathValue = document.createElement("span");
  pathValue.id = "ti-tools-location-path";
  pathWrap.appendChild(pathValue);
  const locationActions = document.createElement("div");
  locationActions.className = "dependency-location__actions";
  const openButton = createButton({
    id: "ti-tools-location-open",
    icon: "fa-regular fa-folder-open",
    labelKey: "tools.location.openShort",
    titleKey: "tools.location.open",
  });
  const revealButton = createButton({
    id: "ti-tools-location-reveal",
    icon: "fa-solid fa-folder-tree",
    labelKey: "tools.location.reveal.generic",
    titleKey: "tools.location.reveal.generic",
  });
  const copyButton = createButton({
    id: "ti-tools-location-copy",
    icon: "fa-regular fa-copy",
    labelKey: "tools.location.copy",
    titleKey: "tools.location.copy",
  });
  locationActions.append(openButton, revealButton, copyButton);
  locationSurface.append(pathWrap, locationActions);
  const locationError = document.createElement("p");
  locationError.id = "tools-location-error";
  locationError.className = "dependency-location__error";
  locationError.hidden = true;
  location.append(locationTitle, locationSurface, locationError);

  const advanced = document.createElement("section");
  advanced.className = "dependency-advanced";
  const advancedToggle = createButton({
    id: "tools-advanced-toggle",
    className: "dependency-advanced__toggle",
    titleKey: "tools.advanced.toggle",
  });
  advancedToggle.setAttribute("aria-expanded", "false");
  advancedToggle.setAttribute("aria-controls", "tools-advanced-panel");
  const advancedCopy = document.createElement("span");
  advancedCopy.className = "dependency-advanced__copy";
  const advancedTitle = document.createElement("strong");
  advancedTitle.dataset.i18n = "tools.more";
  advancedTitle.textContent = t("tools.more");
  const advancedDescription = document.createElement("small");
  advancedDescription.dataset.i18n = "tools.advanced.description";
  advancedDescription.textContent = t("tools.advanced.description");
  advancedCopy.append(advancedTitle, advancedDescription);
  advancedToggle.append(advancedCopy, createIcon("fa-solid fa-chevron-down"));
  const advancedPanel = document.createElement("div");
  advancedPanel.id = "tools-advanced-panel";
  advancedPanel.className = "dependency-advanced__panel";
  advancedPanel.hidden = true;
  const chooseButton = createButton({
    id: "ti-tools-location-choose",
    icon: "fa-solid fa-folder-plus",
    labelKey: "tools.location.choose",
  });
  const resetButton = createButton({
    id: "ti-tools-location-reset",
    icon: "fa-solid fa-rotate-left",
    labelKey: "tools.location.reset",
  });
  const reinstallAll = createButton({
    id: "tools-install-btn",
    icon: "fa-solid fa-arrow-rotate-right",
    labelKey: "tools.button.force",
  });
  advancedPanel.append(chooseButton, resetButton, reinstallAll);
  advanced.append(advancedToggle, advancedPanel);

  page.append(live, header, summary, listSection, location, advanced);
  section.appendChild(page);
}

function createToolRow(definition) {
  const row = document.createElement("article");
  row.className = "dependency-row";
  row.dataset.tool = definition.id;
  row.setAttribute("role", "listitem");

  const icon = document.createElement("span");
  icon.className = "dependency-row__icon";
  icon.appendChild(createIcon(definition.iconClass));
  const identity = document.createElement("div");
  identity.className = "dependency-row__identity";
  const name = document.createElement("strong");
  name.textContent = definition.displayName;
  const version = document.createElement("span");
  version.className = "dependency-row__version";
  identity.append(name, version);
  const status = document.createElement("span");
  status.className = "dependency-status-badge dependency-row__status";
  const menuButton = createButton({
    className: "dependency-row__menu-button",
    icon: "fa-solid fa-ellipsis",
    titleKey: "tools.menu.open",
  });
  menuButton.dataset.toolMenuTrigger = definition.id;
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "dependency-row__menu";
  menu.dataset.toolMenu = definition.id;
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  const error = document.createElement("p");
  error.className = "dependency-row__error";
  error.hidden = true;
  row.append(icon, identity, status, menuButton, menu, error);
  return row;
}

function getOverallState(tools, forcedState = null) {
  if (forcedState) return forcedState;
  if (tools.some((tool) => tool.isChecking || tool.isUpdating)) {
    return "checking";
  }
  if (tools.some((tool) => tool.status === "error")) return "error";
  if (tools.some((tool) => tool.status === "missing")) return "missing";
  if (tools.some((tool) => tool.status === "unknown_version")) return "error";
  if (tools.some((tool) => tool.status === "update_available")) {
    return "updates_available";
  }
  if (tools.every((tool) => tool.status === "installed")) return "ready";
  return "not_checked";
}

const OVERALL_COPY = Object.freeze({
  not_checked: {
    title: "tools.summary.notCheckedTitle",
    description: "tools.summary.notCheckedDescription",
    badge: "tools.summary.notChecked",
    icon: "fa-solid fa-circle-minus",
  },
  checking: {
    title: "tools.summary.checkingTitle",
    description: "tools.summary.checkingDescription",
    badge: "tools.summary.checking",
    icon: "fa-solid fa-circle-notch fa-spin",
  },
  ready: {
    title: "tools.summary.readyText",
    description: "tools.summary.readyDescription",
    badge: "tools.summary.ok",
    icon: "fa-solid fa-circle-check",
  },
  updates_available: {
    title: "tools.summary.updatesTitle",
    description: "tools.summary.updatesDescription",
    badge: "tools.summary.update",
    icon: "fa-solid fa-circle-arrow-up",
  },
  missing: {
    title: "tools.summary.missingTitle",
    description: "tools.summary.missingDescription",
    badge: "tools.summary.missing",
    icon: "fa-solid fa-circle-exclamation",
  },
  error: {
    title: "tools.summary.errorTitle",
    description: "tools.summary.errorDescription",
    badge: "tools.summary.error",
    icon: "fa-solid fa-triangle-exclamation",
  },
  offline: {
    title: "tools.summary.offlineTitle",
    description: "tools.summary.offlineDescription",
    badge: "tools.summary.offline",
    icon: "fa-solid fa-wifi",
  },
});

function formatCheckedAt(value) {
  if (!value) return t("tools.summary.neverChecked");
  try {
    return new Intl.DateTimeFormat(getLanguage() === "en" ? "en" : "ru", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return t("tools.summary.neverChecked");
  }
}

function toolStatusKey(tool) {
  if (tool.isUpdating) return "tools.toolStatus.updating";
  if (tool.isChecking) return "tools.toolStatus.checking";
  return {
    installed: "tools.toolStatus.installed",
    update_available: "tools.toolStatus.updateAvailable",
    missing: "tools.toolStatus.missing",
    error: "tools.toolStatus.error",
    unknown_version: "tools.toolStatus.unknownVersion",
    not_checked: "tools.toolStatus.notChecked",
  }[tool.status];
}

function createContext(section) {
  renderSkeleton(section);
  const snapshot = readSnapshot();
  const savedById = new Map(
    (snapshot?.tools || [])
      .filter((tool) => TOOL_IDS.has(tool?.id))
      .map((tool) => [tool.id, tool]),
  );
  const tools = TOOL_DEFINITIONS.map((definition) =>
    createToolState(definition, savedById.get(definition.id)),
  );
  const elements = {
    panel: section.querySelector("#tools-panel"),
    live: section.querySelector("#tools-live-status"),
    checkButton: section.querySelector("#tools-check-btn"),
    summaryTitle: section.querySelector("#tools-summary-title"),
    summaryDescription: section.querySelector("#tools-summary-description"),
    summaryIcon: section.querySelector("#tools-summary-icon"),
    summaryBadge: section.querySelector("#tools-summary-badge"),
    lastChecked: section.querySelector("#tools-last-checked"),
    list: section.querySelector("#tools-status-cards"),
    locationPath: section.querySelector("#ti-tools-location-path"),
    locationError: section.querySelector("#tools-location-error"),
    locationOpen: section.querySelector("#ti-tools-location-open"),
    locationReveal: section.querySelector("#ti-tools-location-reveal"),
    locationCopy: section.querySelector("#ti-tools-location-copy"),
    locationChoose: section.querySelector("#ti-tools-location-choose"),
    locationReset: section.querySelector("#ti-tools-location-reset"),
    reinstallAll: section.querySelector("#tools-install-btn"),
    advancedToggle: section.querySelector("#tools-advanced-toggle"),
    advancedPanel: section.querySelector("#tools-advanced-panel"),
  };
  TOOL_DEFINITIONS.forEach((definition) =>
    elements.list.appendChild(createToolRow(definition)),
  );

  const state = {
    tools,
    location: "",
    defaultLocation: "",
    platform: "",
    isDefaultLocation: true,
    forcedOverallState: null,
    refreshPromise: null,
    checkPromise: null,
    requestId: 0,
    lastRefreshedAt: 0,
    active: true,
    disposed: false,
    cooldowns: new Map(),
    openMenuId: null,
    menuTrigger: null,
  };
  const cleanups = [];
  const on = (target, type, listener, options) => {
    target?.addEventListener(type, listener, options);
    cleanups.push(() => target?.removeEventListener(type, listener, options));
  };

  const announce = (message) => {
    if (!state.active || !elements.live) return;
    elements.live.textContent = "";
    const schedule =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(callback, 0);
    schedule(() => {
      if (state.active && elements.live) elements.live.textContent = message;
    });
  };

  const setLocationError = (message = "") => {
    elements.locationError.textContent = message;
    elements.locationError.hidden = !message;
  };

  const closeMenu = ({ restoreFocus = false } = {}) => {
    if (!state.openMenuId) return;
    const menu = elements.list.querySelector(
      `[data-tool-menu="${state.openMenuId}"]`,
    );
    const trigger = state.menuTrigger;
    menu.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
    state.openMenuId = null;
    state.menuTrigger = null;
    if (restoreFocus) trigger?.focus();
  };

  const addMenuItem = (menu, { action, icon, labelKey, disabled = false }) => {
    const item = createButton({
      className: "dependency-row__menu-item",
      icon,
      labelKey,
      titleKey: null,
    });
    item.dataset.toolAction = action;
    item.setAttribute("role", "menuitem");
    item.disabled = disabled;
    menu.appendChild(item);
  };

  const rebuildMenu = (tool, menu) => {
    menu.replaceChildren();
    addMenuItem(menu, {
      action: "check",
      icon: "fa-solid fa-rotate",
      labelKey: "tools.menu.check",
      disabled: tool.isChecking || tool.isUpdating || !navigator.onLine,
    });
    if (!tool.installed) {
      addMenuItem(menu, {
        action: "install",
        icon: "fa-solid fa-download",
        labelKey: "tools.menu.install",
        disabled: tool.isUpdating || !navigator.onLine,
      });
    } else if (tool.updateAvailable && !tool.skipUpdates) {
      addMenuItem(menu, {
        action: "update",
        icon: "fa-solid fa-arrow-up",
        labelKey: "tools.menu.update",
        disabled: tool.isUpdating || !navigator.onLine,
      });
    }
    if (tool.installed) {
      addMenuItem(menu, {
        action: "reinstall",
        icon: "fa-solid fa-arrow-rotate-right",
        labelKey: "tools.menu.reinstall",
        disabled: tool.isUpdating || !navigator.onLine,
      });
      addMenuItem(menu, {
        action: "reveal",
        icon: "fa-regular fa-folder-open",
        labelKey: "tools.menu.reveal",
        disabled: !tool.executablePath,
      });
      addMenuItem(menu, {
        action: "copy-version",
        icon: "fa-regular fa-copy",
        labelKey: "tools.menu.copyVersion",
        disabled: !tool.currentVersion,
      });
    }
    addMenuItem(menu, {
      action: "site",
      icon: "fa-solid fa-arrow-up-right-from-square",
      labelKey: "tools.link.openSite",
    });
  };

  const render = () => {
    if (state.disposed) return;
    const overall = getOverallState(state.tools, state.forcedOverallState);
    const copy = OVERALL_COPY[overall] || OVERALL_COPY.error;
    elements.panel.dataset.summaryState = overall;
    elements.summaryTitle.textContent = t(copy.title);
    elements.summaryDescription.textContent = t(copy.description);
    elements.summaryBadge.textContent = t(copy.badge);
    elements.summaryBadge.dataset.status = overall;
    elements.summaryIcon.dataset.status = overall;
    elements.summaryIcon.replaceChildren(createIcon(copy.icon));
    const lastCheckedAt = Math.max(
      0,
      ...state.tools.map((tool) => Number(tool.lastCheckedAt) || 0),
    );
    elements.lastChecked.textContent = formatCheckedAt(lastCheckedAt);

    state.tools.forEach((tool) => {
      const row = elements.list.querySelector(`[data-tool="${tool.id}"]`);
      if (!row) return;
      row.dataset.status = tool.isUpdating ? "updating" : tool.status;
      const version = row.querySelector(".dependency-row__version");
      version.textContent = tool.currentVersion
        ? t("tools.version.current", { version: tool.currentVersion })
        : t("tools.version.unavailable");
      const status = row.querySelector(".dependency-row__status");
      const statusKey = toolStatusKey(tool);
      status.textContent = t(statusKey || "tools.toolStatus.error");
      status.dataset.status = tool.isUpdating ? "updating" : tool.status;
      const error = row.querySelector(".dependency-row__error");
      error.textContent = tool.error ? t("tools.toolStatus.errorHint") : "";
      error.hidden = !tool.error;
      const menu = row.querySelector(`[data-tool-menu="${tool.id}"]`);
      rebuildMenu(tool, menu);
      row.querySelector("[data-tool-menu-trigger]").disabled =
        tool.isUpdating || tool.isChecking;
    });

    const pathAvailable = !!state.location;
    elements.locationPath.textContent =
      state.location || t("tools.location.unavailable");
    elements.locationPath.title = state.location || "";
    elements.locationOpen.disabled = !pathAvailable;
    elements.locationReveal.disabled = !pathAvailable;
    elements.locationCopy.disabled = !pathAvailable;
    elements.locationReset.disabled =
      !pathAvailable || state.isDefaultLocation;
    elements.checkButton.disabled =
      !!state.checkPromise ||
      state.tools.some((tool) => tool.isUpdating || tool.isChecking) ||
      !navigator.onLine;
    elements.checkButton.classList.toggle(
      "is-loading",
      !!state.checkPromise || state.tools.some((tool) => tool.isChecking),
    );
  };

  const applyVersions = (payload, checkedAt = Date.now()) => {
    const normalized = normalizeVersionsPayload(payload);
    if (!normalized) return false;
    state.tools.forEach((tool) => {
      const raw = normalized[tool.id];
      tool.installed = raw.ok && !!raw.path;
      tool.currentVersion = tool.installed
        ? formatVersion(tool.id, raw.version) || null
        : null;
      tool.latestVersion = null;
      tool.updateAvailable = false;
      tool.executablePath = raw.path || null;
      tool.lastCheckedAt = checkedAt;
      tool.error = raw.error || null;
      tool.skipUpdates = raw.skipUpdates;
      tool.status = !tool.installed
        ? raw.error && raw.error !== "missing"
          ? "error"
          : "missing"
        : tool.currentVersion
          ? "installed"
          : "unknown_version";
    });
    saveSnapshot(state.tools);
    return true;
  };

  const refreshLocation = async () => {
    const result = await window.electron?.tools?.getLocation?.();
    if (!result || result.success !== true || typeof result.path !== "string") {
      state.location = "";
      setLocationError(t("tools.location.unavailableDescription"));
      return;
    }
    state.location = result.path;
    state.defaultLocation =
      typeof result.defaultPath === "string" ? result.defaultPath : "";
    state.isDefaultLocation = result.isDefault === true;
    setLocationError("");
  };

  const refreshPlatform = async () => {
    const info =
      typeof window.electron?.getPlatformInfo === "function"
        ? await window.electron.getPlatformInfo().catch(() => null)
        : null;
    state.platform = String(info?.platform || "");
    const key =
      state.platform === "darwin"
        ? "tools.location.reveal.darwin"
        : state.platform === "win32"
          ? "tools.location.reveal.win32"
          : "tools.location.reveal.linux";
    const label = elements.locationReveal.querySelector("span");
    if (label) {
      label.dataset.i18n = key;
      label.textContent = t(key);
    }
    elements.locationReveal.dataset.i18nTitle = key;
    elements.locationReveal.dataset.i18nAria = key;
    elements.locationReveal.title = t(key);
    elements.locationReveal.setAttribute("aria-label", t(key));
  };

  const refresh = async ({ force = false } = {}) => {
    if (state.disposed) return;
    if (state.refreshPromise) return state.refreshPromise;
    if (!force && Date.now() - state.lastRefreshedAt < 1200) return;
    const requestId = ++state.requestId;
    state.tools.forEach((tool) => {
      tool.isChecking = true;
    });
    state.forcedOverallState = "checking";
    render();
    state.refreshPromise = (async () => {
      try {
        const [versions] = await Promise.all([
          window.electron?.tools?.getVersions?.(),
          refreshLocation(),
          refreshPlatform(),
        ]);
        if (
          state.disposed ||
          !state.active ||
          requestId !== state.requestId
        ) {
          return;
        }
        if (!applyVersions(versions)) {
          throw new Error("Invalid versions response");
        }
        state.forcedOverallState = navigator.onLine ? null : "offline";
        state.lastRefreshedAt = Date.now();
        window.dispatchEvent(
          new CustomEvent("tools:status", {
            detail: { summary: summarizeToolsState(versions), raw: versions },
          }),
        );
      } catch (error) {
        if (requestId !== state.requestId || state.disposed) return;
        state.tools.forEach((tool) => {
          tool.status = "error";
          tool.error = error?.message || "refresh-failed";
          tool.lastCheckedAt = Date.now();
        });
        state.forcedOverallState = "error";
      } finally {
        state.tools.forEach((tool) => {
          tool.isChecking = false;
        });
        state.refreshPromise = null;
        if (
          requestId === state.requestId &&
          !state.disposed &&
          state.active
        ) {
          applyI18n(section);
          render();
          initTooltips();
        }
      }
    })();
    return state.refreshPromise;
  };

  const checkUpdates = async (toolId = null) => {
    if (state.checkPromise || !navigator.onLine || state.disposed) return;
    const selected = toolId
      ? state.tools.filter((tool) => tool.id === toolId)
      : state.tools;
    selected.forEach((tool) => {
      tool.isChecking = true;
      tool.error = null;
    });
    state.forcedOverallState = "checking";
    render();
    const requestId = ++state.requestId;
    state.checkPromise = (async () => {
      try {
        const payload = await window.electron?.tools?.checkUpdates?.({
          noCache: true,
          forceFetch: true,
          ...(toolId ? { toolId } : {}),
        });
        const updates = normalizeUpdatesPayload(payload);
        if (!updates || updates.error) {
          throw new Error(updates?.error || "Invalid updates response");
        }
        if (
          state.disposed ||
          !state.active ||
          requestId !== state.requestId
        ) {
          return;
        }
        selected.forEach((tool) => {
          const update = updates[tool.id];
          if (!update) return;
          if (update.current) tool.currentVersion = update.current;
          tool.latestVersion = update.latest;
          tool.skipUpdates = update.skipUpdates;
          tool.updateAvailable =
            !tool.skipUpdates &&
            (update.canUpdate ||
              hasUpdate(tool.id, tool.currentVersion, tool.latestVersion));
          if (tool.installed) {
            tool.status = tool.updateAvailable
              ? "update_available"
              : tool.currentVersion
                ? "installed"
                : "unknown_version";
          }
          tool.lastCheckedAt = Date.now();
        });
        state.forcedOverallState = null;
        saveSnapshot(state.tools);
        announce(
          state.tools.some((tool) => tool.updateAvailable)
            ? t("tools.status.updatesFound")
            : t("tools.status.upToDate"),
        );
      } catch (error) {
        selected.forEach((tool) => {
          tool.status = "error";
          tool.error = error?.message || "check-failed";
          tool.lastCheckedAt = Date.now();
        });
        state.forcedOverallState = "error";
        announce(t("tools.error.update"));
      } finally {
        selected.forEach((tool) => {
          tool.isChecking = false;
        });
        state.checkPromise = null;
        if (!state.disposed && state.active) render();
      }
    })();
    return state.checkPromise;
  };

  const runToolAction = async (tool, action) => {
    if (!tool || tool.isUpdating || !navigator.onLine) return;
    const cooldownKey = `${tool.id}:${action}`;
    const now = Date.now();
    if ((state.cooldowns.get(cooldownKey) || 0) > now) return;
    state.cooldowns.set(cooldownKey, now + ACTION_COOLDOWN_MS);

    if (action === "reinstall") {
      const confirmed = await showConfirmationDialog({
        title: t("tools.confirm.single.title", { tool: tool.displayName }),
        subtitle: t("tools.confirm.force.subtitle"),
        message: t("tools.confirm.single.message", {
          tool: tool.displayName,
        }),
        confirmText: t("tools.confirm.force.confirm"),
        cancelText: t("tools.confirm.force.cancel"),
        tone: "danger",
      });
      if (!confirmed) return;
    }

    tool.isUpdating = true;
    tool.error = null;
    render();
    try {
      const result = await window.electron?.tools?.runDependencyAction?.({
        id: tool.id,
        action,
      });
      if (!result || result.success !== true) {
        throw new Error(result?.error || "Dependency action failed");
      }
      announce(
        t("tools.action.success", {
          tool: tool.displayName,
        }),
      );
      await refresh({ force: true });
    } catch (error) {
      tool.status = "error";
      tool.error = error?.message || "action-failed";
      announce(t("tools.action.error", { tool: tool.displayName }));
    } finally {
      tool.isUpdating = false;
      render();
    }
  };

  const chooseDirectory = async () => {
    try {
      const dialogResult = await window.electron?.invoke?.(
        "dialog:choose-tools-dir",
      );
      const selected =
        dialogResult?.filePaths?.[0] ||
        dialogResult?.paths?.[0] ||
        (typeof dialogResult === "string" ? dialogResult : "");
      if (!selected) return;
      const result = await window.electron?.tools?.setLocation?.(selected);
      if (result?.success !== true) throw new Error(result?.error);
      await refresh({ force: true });
    } catch {
      setLocationError(t("tools.location.setError"));
    }
  };

  const setAdvancedOpen = (open) => {
    elements.advancedToggle.setAttribute("aria-expanded", String(open));
    elements.advancedPanel.hidden = !open;
    if ("inert" in elements.advancedPanel) {
      elements.advancedPanel.inert = !open;
    }
    try {
      sessionStorage.setItem(ADVANCED_SESSION_KEY, open ? "1" : "0");
    } catch {}
  };

  on(elements.checkButton, "click", () => checkUpdates());
  on(elements.advancedToggle, "click", () => {
    setAdvancedOpen(
      elements.advancedToggle.getAttribute("aria-expanded") !== "true",
    );
  });
  on(elements.locationOpen, "click", async () => {
    const result = await window.electron?.tools?.openLocation?.();
    if (result?.success !== true) {
      setLocationError(t("tools.location.openError"));
    }
  });
  on(elements.locationReveal, "click", async () => {
    const result = await window.electron?.tools?.showInFolder?.(state.location);
    if (result?.success !== true) {
      setLocationError(t("tools.location.revealError"));
    }
  });
  on(elements.locationCopy, "click", async () => {
    try {
      await navigator.clipboard.writeText(state.location);
      announce(t("tools.location.copied"));
    } catch {
      announce(t("tools.location.copyError"));
    }
  });
  on(elements.locationChoose, "click", chooseDirectory);
  on(elements.locationReset, "click", async () => {
    const result = await window.electron?.tools?.resetLocation?.();
    if (result?.success !== true) {
      setLocationError(t("tools.location.resetError"));
      return;
    }
    await refresh({ force: true });
  });
  on(elements.reinstallAll, "click", async () => {
    const confirmed = await showConfirmationDialog({
      title: t("tools.confirm.force.title"),
      subtitle: t("tools.confirm.force.subtitle"),
      message: t("tools.confirm.force.message"),
      confirmText: t("tools.confirm.force.confirm"),
      cancelText: t("tools.confirm.force.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;
    state.tools.forEach((tool) => {
      tool.isUpdating = true;
    });
    render();
    try {
      const result = await installAllTools();
      if (result?.success !== true) throw new Error(result?.error);
      await refresh({ force: true });
    } catch {
      state.forcedOverallState = "error";
      announce(t("tools.toast.installError"));
    } finally {
      state.tools.forEach((tool) => {
        tool.isUpdating = false;
      });
      render();
    }
  });
  on(elements.list, "click", async (event) => {
    const trigger = event.target.closest?.("[data-tool-menu-trigger]");
    if (trigger) {
      event.stopPropagation();
      const toolId = trigger.dataset.toolMenuTrigger;
      if (state.openMenuId === toolId) {
        closeMenu();
        return;
      }
      closeMenu();
      const menu = elements.list.querySelector(`[data-tool-menu="${toolId}"]`);
      state.openMenuId = toolId;
      state.menuTrigger = trigger;
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      menu.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
      return;
    }
    const actionButton = event.target.closest?.("[data-tool-action]");
    if (!actionButton) return;
    const row = actionButton.closest("[data-tool]");
    const tool = state.tools.find((entry) => entry.id === row?.dataset.tool);
    const action = actionButton.dataset.toolAction;
    closeMenu({ restoreFocus: true });
    if (!tool) return;
    if (action === "check") await checkUpdates(tool.id);
    else if (["install", "update", "reinstall"].includes(action)) {
      await runToolAction(tool, action);
    } else if (action === "reveal" && tool.executablePath) {
      await window.electron?.tools?.showInFolder?.(tool.executablePath);
    } else if (action === "copy-version" && tool.currentVersion) {
      await navigator.clipboard.writeText(tool.currentVersion).catch(() => {});
      announce(t("tools.version.copied"));
    } else if (action === "site") {
      const definition = TOOL_DEFINITIONS.find(({ id }) => id === tool.id);
      window.electron?.openExternal?.(definition?.site);
    }
  });
  on(document, "click", (event) => {
    if (!state.openMenuId) return;
    const insideCurrentMenu = event.target.closest?.(
      `[data-tool-menu="${state.openMenuId}"], [data-tool-menu-trigger="${state.openMenuId}"]`,
    );
    if (!insideCurrentMenu) closeMenu();
  });
  on(document, "keydown", (event) => {
    const isEscape =
      event.key === "Escape" ||
      event.key === "Esc" ||
      event.code === "Escape";
    if (isEscape && state.openMenuId) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu({ restoreFocus: true });
      return;
    }
    if (
      state.openMenuId &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      const menu = elements.list.querySelector(
        `[data-tool-menu="${state.openMenuId}"]`,
      );
      const items = Array.from(
        menu?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [],
      );
      if (!items.length) return;
      event.preventDefault();
      event.stopPropagation();
      const currentIndex = items.indexOf(document.activeElement);
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : event.key === "ArrowUp"
              ? (currentIndex - 1 + items.length) % items.length
              : (currentIndex + 1) % items.length;
      items[nextIndex].focus();
    }
  }, true);
  on(window, "online", () => {
    state.forcedOverallState = null;
    render();
  });
  on(window, "offline", () => {
    state.forcedOverallState = "offline";
    closeMenu();
    render();
  });
  on(window, "i18n:changed", () => {
    applyI18n(section);
    render();
  });

  const ctx = {
    state,
    refresh,
    activate() {
      state.active = true;
      render();
    },
    deactivate() {
      state.active = false;
      state.requestId += 1;
      closeMenu();
    },
    destroy() {
      if (state.disposed) return;
      state.disposed = true;
      state.active = false;
      state.requestId += 1;
      closeMenu();
      cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
      contexts.delete(ctx);
      delete section.__toolsInfoCtx;
    },
  };
  contexts.add(ctx);
  section.__toolsInfoCtx = ctx;

  let advancedOpen = false;
  try {
    advancedOpen = sessionStorage.getItem(ADVANCED_SESSION_KEY) === "1";
  } catch {}
  setAdvancedOpen(advancedOpen);
  render();
  applyI18n(section);
  initTooltips();
  return ctx;
}

export async function refreshToolsInfoState(options = {}) {
  const section = document.getElementById("tools-info");
  if (!section) return;
  const context = section.__toolsInfoCtx || createContext(section);
  context.activate();
  await context.refresh(options);
}

export async function renderToolsInfo(options = {}) {
  return refreshToolsInfoState(options);
}

export function isToolsInfoStale(maxAgeMs = TOOLS_REFRESH_STALE_MS) {
  const section = document.getElementById("tools-info");
  const timestamp = section?.__toolsInfoCtx?.state?.lastRefreshedAt || 0;
  return Date.now() - timestamp > maxAgeMs;
}

export function deactivateToolsInfo() {
  document.getElementById("tools-info")?.__toolsInfoCtx?.deactivate();
}

export function destroyToolsInfo() {
  document.getElementById("tools-info")?.__toolsInfoCtx?.destroy();
}

export function __resetToolsInfoForTests() {
  Array.from(contexts).forEach((context) => context.destroy());
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
    sessionStorage.removeItem(ADVANCED_SESSION_KEY);
  } catch {}
}
