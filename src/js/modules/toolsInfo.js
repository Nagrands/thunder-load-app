// src/js/modules/toolsInfo.js
import { initTooltips } from "./tooltipInitializer.js";
import { showConfirmationDialog } from "./modals.js";
import { applyI18n, t } from "./i18n.js";
import {
  closeDismissibleOverlays,
  registerDismissibleOverlay,
} from "./overlayManager.js";

function firstLine(s = "") {
  return s.split("\n")[0];
}

function formatDenoVersion(s = "") {
  const line = firstLine(s).trim();
  if (!line) return "";
  const parts = line.split(/\s+/);
  if (parts.length >= 2 && parts[0].toLowerCase() === "deno") {
    return parts[1];
  }
  return line.replace(/^deno\s+/i, "").trim();
}

function normVer(v = "") {
  if (!v || v === "—") return "";
  return String(v).trim().replace(/^v/i, "").toLowerCase();
}

function parseYtDlpVer(v) {
  v = normVer(v);
  const m = v.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function cmpYtDlp(latest, current) {
  const L = parseYtDlpVer(latest);
  const C = parseYtDlpVer(current);
  if (!L || !C) return null;
  for (let i = 0; i < 3; i += 1) {
    if (L[i] > C[i]) return 1;
    if (L[i] < C[i]) return -1;
  }
  return 0;
}

function parseSemverDetailed(v) {
  v = normVer(v);
  v = v.split("-")[0].split("+")[0];
  const m = v.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return null;
  return {
    major: parseInt(m[1] || "0", 10),
    minor: parseInt(m[2] || "0", 10),
    patch: m[3] !== undefined ? parseInt(m[3], 10) : null,
  };
}

function cmpFfSemver(latest, current) {
  const L = parseSemverDetailed(latest);
  const C = parseSemverDetailed(current);
  if (!L || !C) return null;
  if (L.major === C.major && L.minor === C.minor && L.patch === null) {
    return 0;
  }
  const lp = L.patch == null ? 0 : L.patch;
  const cp = C.patch == null ? 0 : C.patch;
  if (L.major !== C.major) return L.major > C.major ? 1 : -1;
  if (L.minor !== C.minor) return L.minor > C.minor ? 1 : -1;
  if (lp !== cp) return lp > cp ? 1 : -1;
  return 0;
}

export function summarizeToolsState(res) {
  const yt = res?.ytDlp;
  const ff = res?.ffmpeg;
  const dn = res?.deno;

  const hasYt = !!(yt?.ok && yt?.path);
  const hasFf = !!(ff?.ok && ff?.path);
  const hasDn = !!(dn?.ok && dn?.path);

  const ytVer = hasYt ? firstLine(yt.version || "").replace(/^v/i, "") : null;
  const ffVer = hasFf
    ? firstLine(ff.version || "")
        .replace(/^ffmpeg version\s*/i, "")
        .split(" ")[0]
    : null;
  const dnVer = hasDn ? formatDenoVersion(dn.version || "") : null;

  const versions = { yt: ytVer, ff: ffVer, deno: dnVer };

  const missing = [];
  if (!hasYt) missing.push("yt-dlp");
  if (!hasFf) missing.push("ffmpeg");
  if (!hasDn) missing.push("Deno");

  const details = [
    { id: "yt", label: "yt-dlp", ok: hasYt, version: ytVer },
    {
      id: "ff",
      label: "ffmpeg",
      ok: hasFf,
      version: ffVer,
      skip: ff?.skipUpdates,
    },
    { id: "deno", label: "Deno", ok: hasDn, version: dnVer },
  ];

  if (!missing.length) {
    return {
      state: "ok",
      hasAll: true,
      missing,
      text: t("tools.summary.ok"),
      versions,
      details,
    };
  }

  return {
    state: "error",
    hasAll: false,
    missing,
    text: t("tools.summary.missingList", { items: missing.join(", ") }),
    versions,
    details,
  };
}

function emitToolsStatus(res) {
  try {
    const summary = summarizeToolsState(res || {});
    window.dispatchEvent(
      new CustomEvent("tools:status", { detail: { summary, raw: res } }),
    );
  } catch (e) {
    console.warn("[toolsInfo] emitToolsStatus failed:", e);
  }
}

export async function installAllTools(options = {}) {
  if (!window.electron?.tools?.installAll) {
    throw new Error("installAll недоступен в этой сборке");
  }
  return window.electron.tools.installAll({
    force: true,
    ...options,
  });
}

const TOOL_LINKS = {
  yt: "https://github.com/yt-dlp/yt-dlp",
  ff: "https://ffmpeg.org",
  deno: "https://deno.com",
};

const TOOLS_REFRESH_STALE_MS = 20_000;
const UPDATES_CACHE_TTL_MS = 5 * 60 * 1000;
const ACTION_COOLDOWN_MS = 350;
const updatesCheckCache = {
  ts: 0,
  versionsSignature: "",
  payload: null,
  etag: "",
};

function buildVersionsSignature(res) {
  const yt = normVer(firstLine(res?.ytDlp?.version || "").replace(/^v/i, ""));
  const ff = normVer(
    firstLine(res?.ffmpeg?.version || "")
      .replace(/^ffmpeg version\s*/i, "")
      .split(" ")[0],
  );
  const dn = formatDenoVersion(res?.deno?.version || "");
  return `${yt}|${ff}|${dn}`;
}

function getCachedUpdates(versionsSignature) {
  const now = Date.now();
  if (
    !updatesCheckCache.payload ||
    !updatesCheckCache.ts ||
    now - updatesCheckCache.ts > UPDATES_CACHE_TTL_MS
  ) {
    return null;
  }
  if (updatesCheckCache.versionsSignature !== versionsSignature) return null;
  return updatesCheckCache.payload;
}

function setCachedUpdates(versionsSignature, payload) {
  if (!payload) return;
  updatesCheckCache.ts = Date.now();
  updatesCheckCache.versionsSignature = versionsSignature;
  updatesCheckCache.payload = payload;
  updatesCheckCache.etag = String(payload?.etag || "");
}

function startDotsAnimator(labelEl, base) {
  let dots = 0;
  const id = setInterval(() => {
    dots = (dots + 1) % 4;
    labelEl.textContent = base + ".".repeat(dots);
  }, 400);
  return { stop: () => clearInterval(id) };
}

function applyNetworkState(buttons = [], isInstalling, isChecking) {
  const offline = !navigator.onLine;
  buttons.forEach((btn) => {
    if (!btn) return;
    btn.disabled = offline || isInstalling || isChecking;
  });
}

function setSummaryState(el, state = "neutral", text = "") {
  const dotClass = ["tools-panel__dot", `tools-panel__dot--${state}`].join(" ");
  if (el.panel) {
    el.panel.setAttribute("data-summary-state", state);
  }
  if (el.summaryDotEl) el.summaryDotEl.className = dotClass;
  if (el.summaryStatusEl) el.summaryStatusEl.textContent = text || "—";
  if (el.summaryBadgeEl) {
    el.summaryBadgeEl.className = `tools-panel__badge tools-panel__badge--${state}`;
    const badgeKey =
      state === "ok"
        ? "tools.summary.ok"
        : state === "update"
          ? "tools.summary.update"
          : state === "missing"
            ? "tools.summary.missing"
            : state === "checking"
              ? "tools.summary.checking"
              : state === "offline"
                ? "tools.summary.offline"
                : state === "busy"
                  ? "tools.summary.busy"
                  : state === "error"
                    ? "tools.summary.error"
                    : null;
    el.summaryBadgeEl.textContent = badgeKey ? t(badgeKey) : "—";
  }
}

function buildToolsCardItems(summary, overrides = {}) {
  return (summary?.details || []).map((detail) => {
    let state = detail.ok ? "ok" : "missing";
    if (overrides[detail.id] === "update") state = "update";
    return {
      ...detail,
      state,
      version: detail.version || (detail.ok ? "—" : t("tools.version.missing")),
    };
  });
}

function buildSingleToolCardMarkup({ id, label, version, state }) {
  return `
    <div class="tool-card tool-card--${state}" data-tool="${id}" role="listitem">
      <span class="tool-card__dot"></span>
      <div class="tool-card__label">
        ${label}
        ${
          TOOL_LINKS[id]
            ? `<span
                 class="tool-external-link"
                 data-tool="${id}"
                 title="${t("tools.link.openSite")}"
                 data-i18n-title="tools.link.openSite"
               ><i class="fa-solid fa-arrow-up-right-from-square"></i></span>`
            : ""
        }
      </div>
      <div class="tool-card__version">${version || "—"}</div>
    </div>`;
}

function patchToolCards(container, items = []) {
  if (!container) return;
  const nextIds = new Set(items.map((item) => item.id));

  container.querySelectorAll(".tool-card[data-tool]").forEach((card) => {
    const id = card.getAttribute("data-tool");
    if (!nextIds.has(id)) {
      card.remove();
    }
  });

  items.forEach((item) => {
    let card = container.querySelector(`.tool-card[data-tool="${item.id}"]`);
    if (!card) {
      container.insertAdjacentHTML(
        "beforeend",
        buildSingleToolCardMarkup(item),
      );
      return;
    }
    card.className = `tool-card tool-card--${item.state}`;
    const versionEl = card.querySelector(".tool-card__version");
    if (versionEl) versionEl.textContent = item.version || "—";
  });
}

function renderToolsInfoSkeleton(section) {
  section.innerHTML = `
    <details class="tools-panel" id="tools-panel" data-tools-state="compact">
      <summary class="tools-panel__summary" id="tools-panel-summary" aria-controls="tools-panel-body" aria-expanded="false">
        <div class="tools-panel__summary-left">
          <span class="tools-panel__dot tools-panel__dot--neutral" id="tools-summary-dot" aria-hidden="true"></span>
          <div class="tools-panel__titles">
            <h2 data-i18n="tools.title">${t("tools.title")}</h2>
            <small id="tools-summary-status" class="muted" aria-live="polite" data-i18n="tools.summary.checking">${t("tools.summary.checking")}</small>
          </div>
        </div>
        <div class="tools-panel__summary-right">
          <span class="tools-panel__badge tools-panel__badge--neutral" id="tools-summary-badge">${t("tools.summary.checking")}</span>
          <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
        </div>
      </summary>

      <div class="tools-panel__body" id="tools-panel-body" aria-live="polite">
        <div class="tools-panel-quick">
          <small id="tools-status" class="muted"></small>
          <div class="tools-panel-quick-actions">
            <button id="tools-check-btn" type="button" title="${t("tools.button.check")}" data-i18n-title="tools.button.check">
              <i class="fa-solid fa-rotate" id="tools-check-icon"></i>
              <span id="tools-check-label" data-i18n="tools.button.check">${t("tools.button.check")}</span>
            </button>
            <button id="tools-update-btn" type="button" title="${t("tools.button.update")}" data-i18n-title="tools.button.update" style="display:none;">
              <i class="fa-solid fa-download" id="tools-update-icon"></i>
              <span id="tools-update-label" data-i18n="tools.button.update">${t("tools.button.update")}</span>
            </button>
            <button id="tools-quick-retry-btn" type="button" title="${t("tools.quick.retry")}" data-i18n-title="tools.quick.retry" style="display:none;">
              <i class="fa-solid fa-rotate-right"></i>
              <span data-i18n="tools.quick.retry">${t("tools.quick.retry")}</span>
            </button>
            <button id="tools-quick-open-location-btn" type="button" title="${t("tools.quick.openLocation")}" data-i18n-title="tools.quick.openLocation" style="display:none;">
              <i class="fa-solid fa-folder-open"></i>
              <span data-i18n="tools.quick.openLocation">${t("tools.quick.openLocation")}</span>
            </button>
          </div>
        </div>

        <div class="tools-status-cards" id="tools-status-cards" role="list"></div>

        <details class="tools-advanced" id="tools-advanced" aria-label="${t("tools.moreMenu")}" data-i18n-aria="tools.moreMenu">
          <summary class="tools-advanced__toggle" id="tools-advanced-toggle">
            <span data-i18n="tools.more">${t("tools.more")}</span>
          </summary>

          <div class="tools-advanced__body">
            <div class="tools-wizard" id="tools-wizard" role="region" aria-label="${t("tools.wizard.title")}" data-i18n-aria="tools.wizard.title">
              <div class="tools-wizard__header">
                <h3 data-i18n="tools.wizard.title">${t("tools.wizard.title")}</h3>
              </div>
              <div class="tools-wizard__steps" id="tools-wizard-steps">
                <div class="tools-wizard__step">
                  <div class="tools-wizard__step-index">1</div>
                  <div class="tools-wizard__step-body">
                    <h4 data-i18n="tools.wizard.step1.title">${t("tools.wizard.step1.title")}</h4>
                    <p class="muted" data-i18n="tools.wizard.step1.desc">${t("tools.wizard.step1.desc")}</p>
                    <div id="tools-wizard-location"></div>
                  </div>
                </div>
                <div class="tools-wizard__step">
                  <div class="tools-wizard__step-index">2</div>
                  <div class="tools-wizard__step-body">
                    <h4 data-i18n="tools.wizard.step2.title">${t("tools.wizard.step2.title")}</h4>
                    <p class="muted" data-i18n="tools.wizard.step2.desc">${t("tools.wizard.step2.desc")}</p>
                    <button id="tools-install-btn" type="button">
                      <i class="fa-solid fa-download"></i>
                      <span data-i18n="tools.button.install">${t("tools.button.install")}</span>
                    </button>
                  </div>
                </div>
                <div class="tools-wizard__step">
                  <div class="tools-wizard__step-index">3</div>
                  <div class="tools-wizard__step-body">
                    <h4 data-i18n="tools.wizard.step3.title">${t("tools.wizard.step3.title")}</h4>
                    <p class="muted" data-i18n="tools.wizard.step3.desc">${t("tools.wizard.step3.desc")}</p>
                    <small id="tools-wizard-status" class="muted"></small>
                  </div>
                </div>
              </div>
            </div>

            <div id="tools-location-host">
              <div class="tools-location module">
                <label for="ti-tools-location-path">
                  <i class="fa-solid fa-folder"></i>
                  <span data-i18n="tools.location.title">${t("tools.location.title")}</span>
                </label>
                <div class="tools-location-row">
                  <input id="ti-tools-location-path" type="text" readonly />
                  <button id="ti-tools-location-choose" data-bs-toggle="tooltip" title="${t("tools.location.choose")}" data-i18n-title="tools.location.choose"><i class="fa-solid fa-folder-open"></i></button>
                  <button id="ti-tools-location-open" data-bs-toggle="tooltip" title="${t("tools.location.open")}" data-i18n-title="tools.location.open"><i class="fa-regular fa-folder-open"></i></button>
                  <button id="ti-tools-location-reset" data-bs-toggle="tooltip" title="${t("tools.location.reset")}" data-i18n-title="tools.location.reset"><i class="fa-solid fa-rotate-left"></i></button>
                  <button id="ti-tools-location-migrate" data-bs-toggle="tooltip" title="${t("tools.location.migrate")}" data-i18n-title="tools.location.migrate"><i class="fa-solid fa-database"></i></button>
                </div>
              </div>
            </div>

            <small id="tools-hint" class="muted"></small>
            <small id="ti-tools-location-info" class="muted"></small>

            <div class="tools-footer">
              <div class="tools-actions" id="tools-actions"></div>
              <div id="tools-more" class="tools-more">
                <button id="tools-more-btn" class="tools-more-btn" title="${t("tools.more")}" aria-label="${t("tools.more")}" data-i18n-title="tools.more" data-i18n-aria="tools.more">
                  <i class="fa-solid fa-ellipsis"></i>
                </button>
                <div id="tools-more-menu" class="tools-more-menu" role="menu" aria-label="${t("tools.moreMenu")}" data-i18n-aria="tools.moreMenu">
                  <button id="tools-force-btn" type="button" title="${t("tools.button.force")}" data-bs-toggle="tooltip" data-i18n-title="tools.button.force">
                    <i class="fa-solid fa-arrow-rotate-right"></i>
                    <span data-i18n="tools.button.force">${t("tools.button.force")}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </details>
  `;
}

function getElements(section) {
  return {
    panel: section.querySelector("#tools-panel"),
    panelSummary: section.querySelector("#tools-panel-summary"),
    panelBody: section.querySelector("#tools-panel-body"),
    advanced: section.querySelector("#tools-advanced"),
    advancedToggle: section.querySelector("#tools-advanced-toggle"),
    statusCardsEl: section.querySelector("#tools-status-cards"),
    summaryDotEl: section.querySelector("#tools-summary-dot"),
    summaryStatusEl: section.querySelector("#tools-summary-status"),
    summaryBadgeEl: section.querySelector("#tools-summary-badge"),
    statusEl: section.querySelector("#tools-status"),
    hintEl: section.querySelector("#tools-hint"),
    wizardEl: section.querySelector("#tools-wizard"),
    wizardStatusEl: section.querySelector("#tools-wizard-status"),
    wizardLocationSlot: section.querySelector("#tools-wizard-location"),
    locationHost: section.querySelector("#tools-location-host"),
    checkBtn: section.querySelector("#tools-check-btn"),
    checkIcon: section.querySelector("#tools-check-icon"),
    checkLabel: section.querySelector("#tools-check-label"),
    updateBtn: section.querySelector("#tools-update-btn"),
    updateLabel: section.querySelector("#tools-update-label"),
    quickRetryBtn: section.querySelector("#tools-quick-retry-btn"),
    quickOpenLocationBtn: section.querySelector(
      "#tools-quick-open-location-btn",
    ),
    installBtn: section.querySelector("#tools-install-btn"),
    moreWrap: section.querySelector("#tools-more"),
    moreBtn: section.querySelector("#tools-more-btn"),
    moreMenu: section.querySelector("#tools-more-menu"),
    forceBtn: section.querySelector("#tools-force-btn"),
    locInput: section.querySelector("#ti-tools-location-path"),
    locChoose: section.querySelector("#ti-tools-location-choose"),
    locOpen: section.querySelector("#ti-tools-location-open"),
    locReset: section.querySelector("#ti-tools-location-reset"),
    locMigrate: section.querySelector("#ti-tools-location-migrate"),
  };
}

function setText(el, value = "") {
  if (el) el.textContent = value;
}

function initContext(section) {
  renderToolsInfoSkeleton(section);

  const el = getElements(section);
  const state = {
    isChecking: false,
    isInstalling: false,
    pendingUpdate: { yt: false, ff: false },
    requestId: 0,
    lastRefreshedAt: 0,
    versions: null,
    actionLocks: new Map(),
  };

  const ctx = {
    section,
    el,
    state,
    refresh: async () => {},
  };

  const allButtons = [
    el.checkBtn,
    el.updateBtn,
    el.quickRetryBtn,
    el.quickOpenLocationBtn,
    el.installBtn,
    el.forceBtn,
    el.locChoose,
    el.locOpen,
    el.locReset,
    el.locMigrate,
  ];

  const setStatusText = (text = "") => {
    setText(el.statusEl, text);
    setText(el.wizardStatusEl, text);
  };

  const setHintText = (text = "") => {
    setText(el.hintEl, text);
  };

  const isActionLocked = (key, cooldownMs = ACTION_COOLDOWN_MS) => {
    const now = Date.now();
    const nextAllowedAt = state.actionLocks.get(key) || 0;
    if (nextAllowedAt > now) return true;
    state.actionLocks.set(key, now + cooldownMs);
    return false;
  };

  const setQuickActionsVisibility = ({
    showRetry = false,
    showOpenLocation = false,
  } = {}) => {
    if (el.quickRetryBtn) {
      el.quickRetryBtn.style.display = showRetry ? "" : "none";
    }
    if (el.quickOpenLocationBtn) {
      el.quickOpenLocationBtn.style.display = showOpenLocation ? "" : "none";
    }
  };

  const setQuickState = (
    summaryState,
    text,
    { showRetry = false, showOpenLocation = false } = {},
  ) => {
    setSummaryState(el, summaryState, text);
    setStatusText(text);
    setQuickActionsVisibility({ showRetry, showOpenLocation });
  };

  const syncSummaryExpandedState = () => {
    if (!el.panelSummary || !el.panel) return;
    el.panelSummary.setAttribute(
      "aria-expanded",
      el.panel.open ? "true" : "false",
    );
  };

  el.panel?.addEventListener("toggle", syncSummaryExpandedState);
  syncSummaryExpandedState();

  el.advanced?.addEventListener("toggle", () => {
    const expanded = el.advanced?.open ? "true" : "false";
    el.advancedToggle?.setAttribute("aria-expanded", expanded);
  });

  const updateStatusCards = (summary, overrides = {}, options = {}) => {
    if (!summary) {
      setSummaryState(
        el,
        options.customState || "error",
        options.customText || t("tools.error.getVersions"),
      );
      if (el.statusCardsEl) patchToolCards(el.statusCardsEl, []);
      return;
    }
    const cardItems = buildToolsCardItems(summary, overrides);
    if (el.statusCardsEl) patchToolCards(el.statusCardsEl, cardItems);

    const items = cardItems.map((item) => item.state);
    const derivedState = items.includes("update")
      ? "update"
      : items.every((x) => x === "ok")
        ? "ok"
        : "missing";

    const overallState = options.customState || derivedState;
    const summaryText =
      options.customText ||
      summary.text ||
      (overallState === "ok"
        ? t("tools.summary.readyText")
        : overallState === "update"
          ? t("tools.status.updatesFound")
          : t("tools.summary.problemText"));

    setSummaryState(el, overallState, summaryText);
  };

  const syncWizardVisibility = (missing) => {
    if (el.wizardEl) el.wizardEl.style.display = missing ? "" : "none";
    if (el.installBtn) el.installBtn.style.display = missing ? "" : "none";
    if (el.moreWrap) el.moreWrap.style.display = missing ? "none" : "";
    if (el.checkBtn) el.checkBtn.style.display = missing ? "none" : "";
    if (el.updateBtn && missing) el.updateBtn.style.display = "none";

    const locationEl = section.querySelector(".tools-location");
    if (locationEl && el.wizardLocationSlot && el.locationHost) {
      if (missing) el.wizardLocationSlot.appendChild(locationEl);
      else el.locationHost.appendChild(locationEl);
    }
  };

  const refreshLocationUI = async () => {
    try {
      const info = await window.electron?.tools?.getLocation?.();
      if (!info?.success) return;
      if (el.locInput) {
        el.locInput.value = info.path || "";
        el.locInput.setAttribute("title", info.path || "");
      }
      if (el.locReset) {
        el.locReset.disabled = !!info.isDefault;
        const pathSuffix = info.defaultPath ? `: ${info.defaultPath}` : "";
        const title = info.isDefault
          ? t("tools.location.defaultTitle", { path: pathSuffix })
          : t("tools.location.resetTitle", { path: pathSuffix });
        el.locReset.setAttribute("title", title);
      }
    } catch (error) {
      console.error("[toolsInfo] getLocation error:", error);
    }
  };

  const chooseDirDialog = async () => {
    try {
      const res = await window.electron.invoke("dialog:choose-tools-dir");
      if (res && res.filePaths && res.filePaths[0]) return res.filePaths[0];
      if (typeof res === "string") return res;
      if (res && res.canceled === false && res.paths && res.paths[0]) {
        return res.paths[0];
      }
    } catch {
      // noop
    }
    return null;
  };

  const runInstallAll = async ({
    statusText = t("tools.status.installing"),
  } = {}) => {
    if (isActionLocked("install-all")) return;
    if (!navigator.onLine) {
      setQuickState("offline", t("tools.status.noNetwork"), {
        showRetry: true,
        showOpenLocation: true,
      });
      return;
    }
    let dots;
    try {
      state.isInstalling = true;
      applyNetworkState(allButtons, state.isInstalling, state.isChecking);
      setQuickState("busy", statusText);
      const labelEl = el.installBtn?.querySelector("span") || el.checkLabel;
      if (labelEl) dots = startDotsAnimator(labelEl, statusText);
      await window.electron?.tools?.installAll?.();
      await window.electron?.invoke?.(
        "toast",
        t("tools.toast.installSuccess"),
        "success",
      );
      await ctx.refresh({ force: true, reason: "install" });
    } catch (error) {
      console.error("[toolsInfo] installAll failed:", error);
      setQuickState("error", t("tools.error.install"), {
        showRetry: true,
        showOpenLocation: true,
      });
      await window.electron?.invoke?.(
        "toast",
        t("tools.toast.installError"),
        "error",
      );
    } finally {
      state.isInstalling = false;
      applyNetworkState(allButtons, state.isInstalling, state.isChecking);
      try {
        dots?.stop?.();
      } catch {
        // noop
      }
    }
  };

  const checkUpdates = async () => {
    if (state.isChecking || isActionLocked("check-updates")) return;
    if (!navigator.onLine) {
      if (!navigator.onLine) setStatusText(t("tools.status.noNetwork"));
      setQuickState("offline", t("tools.status.noNetwork"), {
        showRetry: true,
        showOpenLocation: true,
      });
      return;
    }

    const cur =
      (await window.electron?.tools?.getVersions?.()) || state.versions;
    if (!cur) return;
    const versionsSignature = buildVersionsSignature(cur);
    const cachedUpdates = getCachedUpdates(versionsSignature);

    const summaryBase = summarizeToolsState(cur);
    updateStatusCards(
      summaryBase,
      {},
      {
        customState: "checking",
        customText: t("tools.status.checkingUpdates"),
      },
    );
    setQuickState("busy", t("tools.status.checkingUpdates"));

    const prevIconClass = el.checkIcon?.className;
    if (el.checkIcon) el.checkIcon.classList.add("fa-spin");

    let dots;
    try {
      state.isChecking = true;
      applyNetworkState(allButtons, state.isInstalling, state.isChecking);
      const labelEl = el.checkLabel || el.checkBtn?.querySelector("span");
      if (labelEl)
        dots = startDotsAnimator(labelEl, t("tools.status.checkingUpdates"));

      const upd =
        cachedUpdates ||
        (await window.electron?.tools?.checkUpdates?.({
          noCache: false,
          forceFetch: false,
          etag: updatesCheckCache.etag || undefined,
        }));
      if (!cachedUpdates) {
        setCachedUpdates(versionsSignature, upd);
      }

      const yCurUpd = normVer(upd?.ytDlp?.current || "");
      const fCurUpd = normVer(upd?.ffmpeg?.current || "");
      const dCurUpd = formatDenoVersion(upd?.deno?.current || "");
      const yLatN = normVer(upd?.ytDlp?.latest || "");
      const fLatN = normVer(upd?.ffmpeg?.latest || "");

      const yCurLocal = normVer(
        firstLine(cur?.ytDlp?.version || "").replace(/^v/i, ""),
      );
      const fCurLocal = normVer(
        firstLine(cur?.ffmpeg?.version || "")
          .replace(/^ffmpeg version\s*/i, "")
          .split(" ")[0],
      );

      const ytCur = yCurUpd || yCurLocal || "";
      const ffCur = fCurUpd || fCurLocal || "";
      const ytLatest = yLatN;
      const ffSkip = !!upd?.ffmpeg?.skipUpdates;
      const ffLatest = ffSkip ? ffCur : fLatN;

      let ytCmp = null;
      let ffCmp = null;
      if (ytCur && ytLatest) ytCmp = cmpYtDlp(ytLatest, ytCur);
      if (!ffSkip && ffCur && ffLatest) ffCmp = cmpFfSemver(ffLatest, ffCur);

      state.pendingUpdate = {
        yt: ytCmp === 1,
        ff: !ffSkip && ffCmp === 1,
      };

      const anyUpdate = state.pendingUpdate.yt || state.pendingUpdate.ff;
      const overrides = {
        yt: state.pendingUpdate.yt ? "update" : undefined,
        ff: state.pendingUpdate.ff ? "update" : undefined,
      };
      updateStatusCards(summaryBase, overrides, {
        customState: anyUpdate ? "update" : undefined,
        customText: anyUpdate
          ? t("tools.status.updatesFound")
          : t("tools.status.upToDate"),
      });
      setQuickState(
        anyUpdate ? "update" : "ok",
        anyUpdate ? t("tools.status.updatesFound") : t("tools.status.upToDate"),
        { showOpenLocation: true },
      );
      if (el.updateBtn) el.updateBtn.style.display = anyUpdate ? "" : "none";
      if (dCurUpd) setHintText(`${t("tools.label.deno")}: ${dCurUpd}`);
    } catch (error) {
      console.error("[toolsInfo] check updates failed:", error);
      updateStatusCards(
        summaryBase,
        {},
        {
          customState: "error",
          customText: t("tools.error.update"),
        },
      );
      setQuickState("error", t("tools.error.update"), {
        showRetry: true,
        showOpenLocation: true,
      });
      await window.electron?.invoke?.(
        "toast",
        t("tools.error.update"),
        "error",
      );
    } finally {
      state.isChecking = false;
      applyNetworkState(allButtons, state.isInstalling, state.isChecking);
      if (el.checkIcon && prevIconClass) el.checkIcon.className = prevIconClass;
      try {
        dots?.stop?.();
      } catch {
        // noop
      }
    }
  };

  const updateAvailableTools = async () => {
    if (isActionLocked("update-tools")) return;
    if (!navigator.onLine) {
      setQuickState("offline", t("tools.status.noNetwork"), {
        showRetry: true,
        showOpenLocation: true,
      });
      return;
    }

    try {
      state.isInstalling = true;
      applyNetworkState(allButtons, state.isInstalling, state.isChecking);
      setQuickState("busy", t("tools.status.installing"));
      if (state.pendingUpdate.yt) await window.electron?.tools?.updateYtDlp?.();
      if (state.pendingUpdate.ff)
        await window.electron?.tools?.updateFfmpeg?.();
      await ctx.refresh({ force: true, reason: "update" });
    } catch (error) {
      console.error("[toolsInfo] selective update failed:", error);
      setQuickState("error", t("tools.error.update"), {
        showRetry: true,
        showOpenLocation: true,
      });
      await window.electron?.invoke?.(
        "toast",
        t("tools.error.update"),
        "error",
      );
    } finally {
      state.isInstalling = false;
      applyNetworkState(allButtons, state.isInstalling, state.isChecking);
    }
  };

  const maybeConfirmForceInstall = async () => {
    if (typeof showConfirmationDialog !== "function") {
      await runInstallAll();
      return;
    }
    const confirmed = await showConfirmationDialog({
      title: t("tools.confirm.force.title"),
      subtitle: t("tools.confirm.force.subtitle"),
      message: t("tools.confirm.force.message"),
      confirmText: t("tools.confirm.force.confirm"),
      cancelText: t("tools.confirm.force.cancel"),
      tone: "danger",
    });
    if (confirmed) {
      await runInstallAll();
    }
  };

  el.installBtn?.addEventListener("click", () => {
    runInstallAll();
  });
  el.checkBtn?.addEventListener("click", () => {
    checkUpdates();
  });
  el.updateBtn?.addEventListener("click", () => {
    updateAvailableTools();
  });
  el.quickRetryBtn?.addEventListener("click", () => {
    if (isActionLocked("quick-retry")) return;
    ctx.refresh({ force: true, reason: "quick-retry" });
  });
  el.quickOpenLocationBtn?.addEventListener("click", async () => {
    if (isActionLocked("quick-open-location")) return;
    const r = await window.electron?.tools?.openLocation?.();
    if (!r?.success) {
      setQuickState("error", t("tools.location.openError"), {
        showRetry: true,
        showOpenLocation: true,
      });
      await window.electron?.invoke?.(
        "toast",
        t("tools.location.openError"),
        "error",
      );
    }
  });
  el.forceBtn?.addEventListener("click", () => {
    maybeConfirmForceInstall();
  });

  el.locChoose?.addEventListener("click", async () => {
    const dir = await chooseDirDialog();
    if (!dir) return;
    const r = await window.electron?.tools?.setLocation?.(dir);
    if (!r?.success) {
      setStatusText(t("tools.location.setError"));
      await window.electron?.invoke?.(
        "toast",
        t("tools.location.setError"),
        "error",
      );
      return;
    }
    setStatusText(t("tools.location.updated"));
    await ctx.refresh({ force: true, reason: "set-location" });
  });

  el.locOpen?.addEventListener("click", async () => {
    const r = await window.electron?.tools?.openLocation?.();
    if (!r?.success) {
      setQuickState("error", t("tools.location.openError"), {
        showRetry: true,
        showOpenLocation: true,
      });
      await window.electron?.invoke?.(
        "toast",
        t("tools.location.openError"),
        "error",
      );
    }
  });

  el.locReset?.addEventListener("click", async () => {
    const r = await window.electron?.tools?.resetLocation?.();
    if (!r?.success) {
      setStatusText(t("tools.location.resetError"));
      await window.electron?.invoke?.(
        "toast",
        t("tools.location.resetError"),
        "error",
      );
      return;
    }
    setStatusText(t("tools.location.resetSuccess"));
    await ctx.refresh({ force: true, reason: "reset-location" });
  });

  el.locMigrate?.addEventListener("click", async () => {
    try {
      const detect = await window.electron?.tools?.detectLegacy?.();
      if (!detect?.success) {
        setStatusText(t("tools.migrate.detectError"));
        await window.electron?.invoke?.(
          "toast",
          t("tools.migrate.detectError"),
          "error",
        );
        return;
      }
      if (!detect.found || !detect.found.length) {
        setStatusText(t("tools.migrate.none"));
        return;
      }
      let overwrite = false;
      if (typeof showConfirmationDialog === "function") {
        overwrite = !!(await showConfirmationDialog({
          title: t("tools.migrate.confirm.title"),
          subtitle: t("tools.migrate.confirm.subtitle"),
          message: t("tools.migrate.confirm.message"),
          confirmText: t("tools.migrate.confirm.confirm"),
          cancelText: t("tools.migrate.confirm.cancel"),
          tone: "danger",
        }));
      }
      const res = await window.electron?.tools?.migrateOld?.({ overwrite });
      if (!res?.success) {
        setStatusText(t("tools.migrate.error"));
        await window.electron?.invoke?.(
          "toast",
          t("tools.migrate.error"),
          "error",
        );
        return;
      }
      const copied = res.copied?.length || 0;
      const skipped = res.skipped?.length || 0;
      setStatusText(
        t("tools.migrate.success", {
          mode: overwrite
            ? t("tools.migrate.mode.overwrite")
            : t("tools.migrate.mode.keep"),
          copied,
          skipped,
        }),
      );
      await ctx.refresh({ force: true, reason: "migrate" });
    } catch (error) {
      console.error("[toolsInfo] migrateOld error:", error);
      setStatusText(t("tools.migrate.error"));
      await window.electron?.invoke?.(
        "toast",
        t("tools.migrate.error"),
        "error",
      );
    }
  });

  el.locInput?.addEventListener("dblclick", async () => {
    try {
      await navigator.clipboard.writeText(el.locInput.value || "");
      setStatusText(t("tools.location.copied"));
    } catch {
      // noop
    }
  });

  if (el.moreWrap && el.moreBtn && el.moreMenu) {
    window.__toolsInfoOverlayCleanup?.();
    const closeMenu = () => {
      if (!el.moreWrap.classList.contains("is-open")) return;
      el.moreWrap.classList.remove("is-open");
      el.moreBtn.setAttribute("aria-expanded", "false");
    };
    const toggleMenu = (ev) => {
      ev.stopPropagation();
      const willOpen = !el.moreWrap.classList.contains("is-open");
      closeDismissibleOverlays("tools-more-menu");
      el.moreWrap.classList.toggle("is-open", willOpen);
      el.moreBtn.setAttribute("aria-expanded", String(willOpen));
    };
    el.moreBtn.addEventListener("click", toggleMenu);
    window.__toolsInfoOverlayCleanup = registerDismissibleOverlay({
      id: "tools-more-menu",
      panel: el.moreMenu,
      isOpen: () => el.moreWrap.classList.contains("is-open"),
      close: closeMenu,
      isInsideEvent: (target) => el.moreWrap.contains(target),
    });
  }

  el.statusCardsEl?.addEventListener("click", (event) => {
    const trigger = event.target.closest?.(".tool-external-link");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    const url = TOOL_LINKS[trigger.dataset.tool];
    if (url) window.electron?.openExternal?.(url);
  });

  if (window.__toolsInfoNetHandlers) {
    window.removeEventListener("online", window.__toolsInfoNetHandlers.on);
    window.removeEventListener("offline", window.__toolsInfoNetHandlers.off);
  }
  window.__toolsInfoNetHandlers = {
    on: () => {
      applyNetworkState(allButtons, state.isInstalling, state.isChecking);
      if (el.statusEl?.textContent === t("tools.status.noNetwork")) {
        setQuickState("checking", t("tools.summary.checking"));
      }
      if (el.hintEl?.textContent === t("tools.status.noNetwork"))
        setHintText("");
    },
    off: () => {
      applyNetworkState(allButtons, state.isInstalling, state.isChecking);
      setQuickState("offline", t("tools.status.noNetwork"), {
        showRetry: true,
        showOpenLocation: true,
      });
      setHintText(t("tools.status.noNetwork"));
    },
  };
  window.addEventListener("online", window.__toolsInfoNetHandlers.on);
  window.addEventListener("offline", window.__toolsInfoNetHandlers.off);

  ctx.refresh = async ({ force = false } = {}) => {
    if (!force && Date.now() - state.lastRefreshedAt < 1200) return;

    const requestId = ++state.requestId;
    applyNetworkState(allButtons, state.isInstalling, state.isChecking);
    setQuickState("checking", t("tools.summary.checking"));

    try {
      const [versionsRes] = await Promise.all([
        window.electron?.tools?.getVersions?.(),
        refreshLocationUI(),
      ]);

      if (requestId !== state.requestId) return;

      if (!versionsRes) {
        updateStatusCards(null);
        setQuickState("error", t("tools.error.getVersions"), {
          showRetry: true,
          showOpenLocation: true,
        });
        return;
      }

      state.versions = versionsRes;
      state.pendingUpdate = { yt: false, ff: false };
      if (el.updateBtn) el.updateBtn.style.display = "none";

      const summary = summarizeToolsState(versionsRes);
      updateStatusCards(summary);

      const missing =
        !versionsRes?.ytDlp?.ok ||
        !versionsRes?.ffmpeg?.ok ||
        !versionsRes?.deno?.ok;
      syncWizardVisibility(missing);
      setHintText(missing ? t("tools.hint.missing") : "");
      setQuickState(
        missing ? "missing" : "ok",
        missing ? t("tools.summary.missing") : t("tools.summary.readyText"),
        { showOpenLocation: true },
      );

      emitToolsStatus(versionsRes);
      state.lastRefreshedAt = Date.now();
    } catch (error) {
      if (requestId !== state.requestId) return;
      console.error("[toolsInfo] refresh failed:", error);
      updateStatusCards(
        null,
        {},
        { customState: "error", customText: t("tools.error.getVersions") },
      );
      setHintText(t("tools.error.getVersions"));
      setQuickState("error", t("tools.error.getVersions"), {
        showRetry: true,
        showOpenLocation: true,
      });
      emitToolsStatus(null);
    } finally {
      if (requestId === state.requestId) {
        applyI18n(section);
        initTooltips();
      }
    }
  };

  section.__toolsInfoCtx = ctx;
  return ctx;
}

export async function refreshToolsInfoState(options = {}) {
  const section = document.getElementById("tools-info");
  if (!section) return;
  const ctx = section.__toolsInfoCtx || initContext(section);
  await ctx.refresh(options);
}

export async function renderToolsInfo(options = {}) {
  const section = document.getElementById("tools-info");
  if (!section) return;
  const ctx = section.__toolsInfoCtx || initContext(section);
  await ctx.refresh(options);
}

export function isToolsInfoStale(maxAgeMs = TOOLS_REFRESH_STALE_MS) {
  const section = document.getElementById("tools-info");
  const ts = section?.__toolsInfoCtx?.state?.lastRefreshedAt || 0;
  return Date.now() - ts > maxAgeMs;
}

export function __resetToolsInfoForTests() {
  updatesCheckCache.ts = 0;
  updatesCheckCache.versionsSignature = "";
  updatesCheckCache.payload = null;
  updatesCheckCache.etag = "";
}
