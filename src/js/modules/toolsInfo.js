// src/js/modules/toolsInfo.js
import { initTooltips } from "./tooltipInitializer.js";
import { showConfirmationDialog } from "./modals.js";
import { applyI18n, t } from "./i18n.js";

/**
 * Модуль рендера секции «Инструменты» (yt-dlp, ffmpeg).
 * Отвечает за первичную разметку, проверку наличия/обновлений и установку/переустановку.
 * Требует `window.electron.tools.*` (preload‑bridge) и Bootstrap tooltips (initTooltips).
 *
 * Особенности:
 *  - Пошаговый сценарий: мастер установки при отсутствии и отдельные действия «Проверить» → «Обновить».
 *  - Не допускается даунгрейд ffmpeg (7.1 == 7.1.x) и yt‑dlp (сравнение по дате YYYY.MM.DD).
 *  - Сетевые состояния: кнопки отключаются, если нет сети или идёт операция.
 *
 * @module toolsInfo
 */

/**
 * Взять первую строку строки.
 * @param {string} [s=""]
 * @returns {string}
 */
function firstLine(s = "") {
  return s.split("\n")[0];
}

/**
 * Привести deno --version к компактному виду «deno X.Y.Z».
 * @param {string} [s=""]
 * @returns {string}
 */
function formatDenoVersion(s = "") {
  const line = firstLine(s).trim();
  if (!line) return "";
  const parts = line.split(/\s+/);
  if (parts.length >= 2 && parts[0].toLowerCase() === "deno") {
    return parts[1];
  }
  return line.replace(/^deno\s+/i, "").trim();
}

/**
 * Нормализовать строку версии: обрезать префикс `v`, трим, в нижний регистр.
 * Пустые/«—» → пустая строка.
 * @param {string} [v=""]
 * @returns {string}
 */
function normVer(v = "") {
  if (!v || v === "—") return "";
  return String(v).trim().replace(/^v/i, "").toLowerCase();
}

/**
 * Парсинг даты версии yt‑dlp вида YYYY.MM.DD
 * @param {string} v
 * @returns {[number,number,number]|null} [Y, M, D] или null
 */
function parseYtDlpVer(v) {
  v = normVer(v);
  const m = v.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/**
 * Сравнение дат версий yt‑dlp.
 * @param {string} latest
 * @param {string} current
 * @returns {1|0|-1|null} 1 если latest>current, 0 если равны, -1 если latest<current, null если нераспознано
 */
function cmpYtDlp(latest, current) {
  const L = parseYtDlpVer(latest),
    C = parseYtDlpVer(current);
  if (!L || !C) return null;
  for (let i = 0; i < 3; i++) {
    if (L[i] > C[i]) return 1;
    if (L[i] < C[i]) return -1;
  }
  return 0;
}

/**
 * Детальный парсинг semver (без пререлизов/метаданных): MAJOR.MINOR[.PATCH]
 * @param {string} v
 * @returns {{major:number,minor:number,patch:number|null,hadPatch:boolean}|null}
 */
function parseSemverDetailed(v) {
  v = normVer(v);
  v = v.split("-")[0].split("+")[0];
  const m = v.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return null;
  return {
    major: parseInt(m[1] || "0", 10),
    minor: parseInt(m[2] || "0", 10),
    patch: m[3] !== undefined ? parseInt(m[3], 10) : null,
    hadPatch: m[3] !== undefined,
  };
}

/**
 * Сравнение версий ffmpeg с правилом: если latest без PATCH (напр. 7.1),
 * то любая 7.1.x считается равной.
 * @param {string} latest
 * @param {string} current
 * @returns {1|0|-1|null}
 */
function cmpFfSemver(latest, current) {
  const L = parseSemverDetailed(latest);
  const C = parseSemverDetailed(current);
  if (!L || !C) return null;
  if (L.major === C.major && L.minor === C.minor && L.patch === null) {
    return 0; // 7.1 == 7.1.x
  }
  const lp = L.patch == null ? 0 : L.patch;
  const cp = C.patch == null ? 0 : C.patch;
  if (L.major !== C.major) return L.major > C.major ? 1 : -1;
  if (L.minor !== C.minor) return L.minor > C.minor ? 1 : -1;
  if (lp !== cp) return lp > cp ? 1 : -1;
  return 0;
}

/**
 * Унифицированная сводка состояния инструментов: наличие и строки версий.
 * Используется и в настройках, и в шапке Загрузчика.
 * @param {object} res результат tools.getVersions()
 * @returns {{state:'ok'|'error', hasAll:boolean, missing:string[], text:string, versions:{yt?:string, ff?:string, deno?:string}, details:Array<{id:'yt'|'ff'|'deno', label:string, ok:boolean, version:string|null, skip?:boolean}>}}
 */
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
    const text = t("tools.summary.ok");
    return { state: "ok", hasAll: true, missing, text, versions, details };
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

/**
 * Единый хелпер для переустановки всех инструментов (yt-dlp, ffmpeg, Deno).
 * Используется как в настройках, так и в шапке Загрузчика.
 * @param {object} options
 * @returns {Promise<any>}
 */
export async function installAllTools(options = {}) {
  if (!window.electron?.tools?.installAll) {
    throw new Error("installAll недоступен в этой сборке");
  }
  return window.electron.tools.installAll({
    force: true,
    ...options,
  });
}

/**
 * Запуск «аниматора точек» у кнопки (… → …)
 * @param {HTMLElement} labelEl
 * @param {string} base
 * @returns {{stop:() => void}}
 */
function startDotsAnimator(labelEl, base) {
  let dots = 0;
  const id = setInterval(() => {
    dots = (dots + 1) % 4;
    labelEl.textContent = base + ".".repeat(dots);
  }, 400);
  return { stop: () => clearInterval(id) };
}

/**
 * Применить доступность кнопок по сетевому состоянию/процессам
 * @param {HTMLButtonElement|null} primaryBtn
 * @param {HTMLButtonElement|null} forceBtn
 * @param {boolean} isInstalling
 * @param {boolean} isChecking
 */
function applyNetworkState(buttons = [], isInstalling, isChecking) {
  const offline = !navigator.onLine;
  buttons.forEach((btn) => {
    if (!btn) return;
    btn.disabled = offline || isInstalling || isChecking;
  });
}

const backgroundUpdateState = {
  inProgress: false,
  lastSignature: null,
  lastRun: 0,
};
const BACKGROUND_UPDATE_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Фоновая проверка обновлений инструментов без всплывающих уведомлений.
 * Запускается только когда оба инструмента установлены и вкладка настроек открыта.
 * @param {object} currentVersions
 */
async function triggerBackgroundToolsUpdateCheck(currentVersions) {
  if (backgroundUpdateState.inProgress) return;
  if (!navigator.onLine) return;
  if (
    !currentVersions?.ytDlp?.ok ||
    !currentVersions?.ffmpeg?.ok ||
    !currentVersions?.deno?.ok
  ) {
    return;
  }

  const now = Date.now();
  if (now - backgroundUpdateState.lastRun < BACKGROUND_UPDATE_COOLDOWN_MS) {
    return;
  }

  backgroundUpdateState.inProgress = true;
  backgroundUpdateState.lastRun = now;

  try {
    const updates = await window.electron?.tools?.checkUpdates?.({
      background: true,
      noCache: false,
    });
    if (!updates) return;

    const notices = [];
    const signatureParts = [];

    const ytLatest = normVer(updates?.ytDlp?.latest || "");
    const ytCurrent = normVer(
      updates?.ytDlp?.current ||
        updates?.ytDlp?.local ||
        firstLine(currentVersions?.ytDlp?.version || "").replace(/^v/i, ""),
    );
    if (ytLatest && ytCurrent && cmpYtDlp(ytLatest, ytCurrent) === 1) {
      notices.push(`yt-dlp ${updates.ytDlp.latest}`);
      signatureParts.push(`yt:${updates.ytDlp.latest}`);
    }

    const ffLatest = normVer(updates?.ffmpeg?.latest || "");
    const ffCurrent = normVer(
      updates?.ffmpeg?.current ||
        updates?.ffmpeg?.local ||
        firstLine(currentVersions?.ffmpeg?.version || "")
          .replace(/^ffmpeg version\s*/i, "")
          .split(" ")[0],
    );
    if (ffLatest && ffCurrent && cmpFfSemver(ffLatest, ffCurrent) === 1) {
      notices.push(`ffmpeg ${updates.ffmpeg.latest}`);
      signatureParts.push(`ff:${updates.ffmpeg.latest}`);
    }

    if (!notices.length) return;

    const signature = signatureParts.join("|");
    if (signature && backgroundUpdateState.lastSignature === signature) {
      return;
    }
    backgroundUpdateState.lastSignature = signature || null;

    // Тихий режим: не показываем тосты для фоновой проверки
  } catch (error) {
    console.warn("[toolsInfo] background update check failed:", error);
  } finally {
    backgroundUpdateState.inProgress = false;
  }
}

/**
 * Рендер секции «Инструменты» и навешивание обработчиков.
 * Делает безопасные IPC вызовы через preload‑bridge `window.electron.tools`.
 *
 * @returns {Promise<void>}
 */
const TOOL_LINKS = {
  yt: "https://github.com/yt-dlp/yt-dlp",
  ff: "https://ffmpeg.org",
  deno: "https://deno.com",
};

export async function renderToolsInfo() {
  const section = document.getElementById("tools-info");
  if (!section) return;

  // Базовая разметка (с блоком выбора папки инструментов)
  section.innerHTML = `
    <details class="tools-panel" id="tools-panel">
      <summary class="tools-panel__summary">
        <div class="tools-panel__summary-left">
          <span class="tools-panel__dot tools-panel__dot--neutral" id="tools-summary-dot" aria-hidden="true"></span>
          <div class="tools-panel__titles">
            <h2 data-i18n="tools.title">${t("tools.title")}</h2>
            <small id="tools-summary-status" class="muted" data-i18n="tools.summary.checking">
              ${t("tools.summary.checking")}
            </small>
          </div>
        </div>
        <div class="tools-panel__summary-right">
          <span class="tools-panel__badge tools-panel__badge--neutral" id="tools-summary-badge">
            ${t("tools.summary.checking")}
          </span>
          <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
        </div>
      </summary>

      <div class="tools-panel__body">
        <div
          class="tools-wizard"
          id="tools-wizard"
          role="region"
          aria-label="${t("tools.wizard.title")}"
          data-i18n-aria="tools.wizard.title"
        >
          <div class="tools-wizard__header">
            <h3 data-i18n="tools.wizard.title">${t("tools.wizard.title")}</h3>
          </div>
          <div class="tools-wizard__steps" id="tools-wizard-steps">
            <div class="tools-wizard__step">
              <div class="tools-wizard__step-index">1</div>
              <div class="tools-wizard__step-body">
                <h4 data-i18n="tools.wizard.step1.title">${t("tools.wizard.step1.title")}</h4>
                <p class="muted" data-i18n="tools.wizard.step1.desc">
                  ${t("tools.wizard.step1.desc")}
                </p>
                <div id="tools-wizard-location"></div>
              </div>
            </div>
            <div class="tools-wizard__step">
              <div class="tools-wizard__step-index">2</div>
              <div class="tools-wizard__step-body">
                <h4 data-i18n="tools.wizard.step2.title">${t("tools.wizard.step2.title")}</h4>
                <p class="muted" data-i18n="tools.wizard.step2.desc">
                  ${t("tools.wizard.step2.desc")}
                </p>
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
                <p class="muted" data-i18n="tools.wizard.step3.desc">
                  ${t("tools.wizard.step3.desc")}
                </p>
                <small id="tools-wizard-status" class="muted"></small>
              </div>
            </div>
          </div>
        </div>

        <div class="tools-status-cards" id="tools-status-cards" role="list"></div>

        <div id="tools-location-host">
          <div class="tools-location module">
            <label for="ti-tools-location-path">
              <i class="fa-solid fa-folder"></i>
              <span data-i18n="tools.location.title">${t("tools.location.title")}</span>
            </label>
            <div class="tools-location-row">
              <input id="ti-tools-location-path" type="text" readonly />
              <button
                id="ti-tools-location-choose"
                data-bs-toggle="tooltip"
                title="${t("tools.location.choose")}"
                data-i18n-title="tools.location.choose"
              >
                <i class="fa-solid fa-folder-open"></i>
              </button>
              <button
                id="ti-tools-location-open"
                data-bs-toggle="tooltip"
                title="${t("tools.location.open")}"
                data-i18n-title="tools.location.open"
              >
                <i class="fa-regular fa-folder-open"></i>
              </button>
              <button
                id="ti-tools-location-reset"
                data-bs-toggle="tooltip"
                title="${t("tools.location.reset")}"
                data-i18n-title="tools.location.reset"
              >
                <i class="fa-solid fa-rotate-left"></i>
              </button>
              <button
                id="ti-tools-location-migrate"
                data-bs-toggle="tooltip"
                title="${t("tools.location.migrate")}"
                data-i18n-title="tools.location.migrate"
              >
                <i class="fa-solid fa-database"></i>
              </button>
            </div>
          </div>
        </div>

        <small id="tools-hint" class="muted"></small>
        <small id="ti-tools-location-info" class="muted"></small>

        <div class="tools-footer">
          <small id="tools-status" class="muted"></small>
          <div class="tools-actions" id="tools-actions">
            <button
              id="tools-check-btn"
              type="button"
              title="${t("tools.button.check")}"
              data-i18n-title="tools.button.check"
            >
              <i class="fa-solid fa-rotate" id="tools-check-icon"></i>
              <span id="tools-check-label" data-i18n="tools.button.check">
                ${t("tools.button.check")}
              </span>
            </button>
            <button
              id="tools-update-btn"
              type="button"
              title="${t("tools.button.update")}"
              data-i18n-title="tools.button.update"
              style="display:none;"
            >
              <i class="fa-solid fa-download" id="tools-update-icon"></i>
              <span id="tools-update-label" data-i18n="tools.button.update">
                ${t("tools.button.update")}
              </span>
            </button>
          </div>
          <div id="tools-more" class="tools-more" style="display:none;">
            <button
              id="tools-more-btn"
              class="tools-more-btn"
              title="${t("tools.more")}"
              aria-label="${t("tools.more")}"
              data-i18n-title="tools.more"
              data-i18n-aria="tools.more"
            >
              <i class="fa-solid fa-ellipsis"></i>
            </button>
            <div
              id="tools-more-menu"
              class="tools-more-menu"
              role="menu"
              aria-label="${t("tools.moreMenu")}"
              data-i18n-aria="tools.moreMenu"
            >
              <button
                id="tools-force-btn"
                type="button"
                title="${t("tools.button.force")}"
                data-bs-toggle="tooltip"
                data-i18n-title="tools.button.force"
              >
                <i class="fa-solid fa-arrow-rotate-right"></i>
                <span data-i18n="tools.button.force">${t("tools.button.force")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </details>
  `;

  /** @type {HTMLButtonElement|null} */
  const checkBtn = document.getElementById("tools-check-btn");
  /** @type {HTMLElement|null} */
  const checkIcon = document.getElementById("tools-check-icon");
  /** @type {HTMLElement|null} */
  const checkLabel = document.getElementById("tools-check-label");
  /** @type {HTMLButtonElement|null} */
  const updateBtn = document.getElementById("tools-update-btn");
  /** @type {HTMLElement|null} */
  const updateLabel = document.getElementById("tools-update-label");
  /** @type {HTMLButtonElement|null} */
  const installBtn = document.getElementById("tools-install-btn");
  /** @type {HTMLDivElement|null} */
  const moreWrap = document.getElementById("tools-more");
  /** @type {HTMLButtonElement|null} */
  const moreBtn = document.getElementById("tools-more-btn");
  /** @type {HTMLElement|null} */
  const moreMenu = document.getElementById("tools-more-menu");
  /** @type {HTMLButtonElement|null} */
  const forceBtn = document.getElementById("tools-force-btn");
  /** @type {HTMLElement|null} */
  const hintEl = document.getElementById("tools-hint");
  /** @type {HTMLElement|null} */
  const statusEl = document.getElementById("tools-status");
  /** @type {HTMLElement|null} */
  const wizardEl = document.getElementById("tools-wizard");
  /** @type {HTMLElement|null} */
  const wizardStatusEl = document.getElementById("tools-wizard-status");
  /** @type {HTMLElement|null} */
  const wizardLocationSlot = document.getElementById("tools-wizard-location");
  /** @type {HTMLElement|null} */
  const locationHost = document.getElementById("tools-location-host");
  /** @type {HTMLElement|null} */
  const statusCardsEl = document.getElementById("tools-status-cards");
  /** @type {HTMLElement|null} */
  const summaryDotEl = document.getElementById("tools-summary-dot");
  /** @type {HTMLElement|null} */
  const summaryStatusEl = document.getElementById("tools-summary-status");
  /** @type {HTMLElement|null} */
  const summaryBadgeEl = document.getElementById("tools-summary-badge");

  const setSummaryState = (state = "neutral", text = "") => {
    const dotClass = ["tools-panel__dot", `tools-panel__dot--${state}`]
      .filter(Boolean)
      .join(" ");
    if (summaryDotEl) summaryDotEl.className = dotClass;
    if (summaryStatusEl) summaryStatusEl.textContent = text || "—";
    if (summaryBadgeEl) {
      summaryBadgeEl.className = `tools-panel__badge tools-panel__badge--${state}`;
      const badgeKey =
        state === "ok"
          ? "tools.summary.ok"
          : state === "update"
            ? "tools.summary.update"
            : state === "missing"
              ? "tools.summary.missing"
              : state === "checking"
                ? "tools.summary.checking"
                : state === "error"
                  ? "tools.summary.error"
                  : null;
      summaryBadgeEl.textContent = badgeKey ? t(badgeKey) : "—";
    }
  };

  const setStatusText = (text = "") => {
    if (statusEl) statusEl.textContent = text;
    if (wizardStatusEl) wizardStatusEl.textContent = text;
  };

  const setHintText = (text = "") => {
    if (hintEl) hintEl.textContent = text;
  };

  /**
   * Обновляет карточки статусов и сводку по инструментам.
   * @param {ReturnType<typeof summarizeToolsState>} summary
   * @param {Record<string, "update" | undefined>} overrides
   * @param {{customState?: "ok" | "update" | "missing" | "checking" | "error" | "neutral", customText?: string}} options
   */
  const updateStatusUI = (summary, overrides = {}, options = {}) => {
    if (!summary) {
      setSummaryState(
        options.customState || "error",
        options.customText || t("tools.error.getVersions"),
      );
      if (statusCardsEl) statusCardsEl.innerHTML = "";
      return;
    }

    const items = (summary.details || []).map((detail) => {
      let state = detail.ok ? "ok" : "missing";
      if (overrides[detail.id] === "update") state = "update";
      return {
        ...detail,
        state,
        version:
          detail.version || (detail.ok ? "—" : t("tools.version.missing")),
      };
    });

    const derivedState = items.some((it) => it.state === "update")
      ? "update"
      : items.every((it) => it.state === "ok")
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

    setSummaryState(overallState, summaryText);

    if (statusCardsEl) {
      statusCardsEl.innerHTML = items
        .map(
          ({ id, label, version, state }) => `
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
          </div>`,
        )
        .join("");
    }
  };

  setSummaryState("checking", t("tools.summary.checking"));

  /** @type {HTMLInputElement|null} */
  const locInput = document.getElementById("ti-tools-location-path");
  /** @type {HTMLButtonElement|null} */
  const locChoose = document.getElementById("ti-tools-location-choose");
  /** @type {HTMLButtonElement|null} */
  const locOpen = document.getElementById("ti-tools-location-open");
  /** @type {HTMLButtonElement|null} */
  const locReset = document.getElementById("ti-tools-location-reset");
  /** @type {HTMLButtonElement|null} */
  const locMigrate = document.getElementById("ti-tools-location-migrate");
  const toast = (msg, type = "info") =>
    window.electron?.invoke?.("toast", msg, type);
  // === Tools location wiring (inline UI in Tools section) ===
  async function refreshLocationUI() {
    try {
      const info = await window.electron?.tools?.getLocation?.();
      if (info?.success && locInput) {
        locInput.value = info.path || "";
        if (locReset) {
          locReset.disabled = !!info.isDefault;
          const pathSuffix = info.defaultPath ? `: ${info.defaultPath}` : "";
          const title = info.isDefault
            ? t("tools.location.defaultTitle", { path: pathSuffix })
            : t("tools.location.resetTitle", { path: pathSuffix });
          locReset.setAttribute("title", title);
        }
        if (locInput) locInput.setAttribute("title", info.path || "");
      }
    } catch (e) {
      console.error("[toolsInfo] getLocation error:", e);
    }
  }

  async function chooseDirDialog() {
    try {
      const res = await window.electron.invoke("dialog:choose-tools-dir");
      if (res && res.filePaths && res.filePaths[0]) return res.filePaths[0];
      if (typeof res === "string") return res;
      if (res && res.canceled === false && res.paths && res.paths[0])
        return res.paths[0];
    } catch {}
    return null;
  }

  locChoose?.addEventListener("click", async () => {
    const dir = await chooseDirDialog();
    if (!dir) return;
    try {
      const r = await window.electron?.tools?.setLocation?.(dir);
      if (!r?.success) {
        await toast(t("tools.location.setError"), "error");
        setStatusText(t("tools.location.setError"));
        return;
      }
      await refreshLocationUI();
      setStatusText(t("tools.location.updated"));
      await renderToolsInfo();
    } catch (e) {
      console.error("[toolsInfo] setLocation error:", e);
      await toast(t("tools.location.setError"), "error");
      setStatusText(t("tools.location.setError"));
    }
  });

  locOpen?.addEventListener("click", async () => {
    try {
      const r = await window.electron?.tools?.openLocation?.();
      if (!r?.success) {
        await toast(t("tools.location.openError"), "error");
        setStatusText(t("tools.location.openError"));
      }
    } catch (e) {
      console.error("[toolsInfo] openLocation error:", e);
      await toast(t("tools.location.openError"), "error");
      setStatusText(t("tools.location.openError"));
    }
  });

  locReset?.addEventListener("click", async () => {
    try {
      const r = await window.electron?.tools?.resetLocation?.();
      if (!r?.success) {
        await toast(t("tools.location.resetError"), "error");
        setStatusText(t("tools.location.resetError"));
        return;
      }
      await refreshLocationUI();
      setStatusText(t("tools.location.resetSuccess"));
      await renderToolsInfo();
    } catch (e) {
      console.error("[toolsInfo] resetLocation error:", e);
      await toast(t("tools.location.resetError"), "error");
      setStatusText(t("tools.location.resetError"));
    }
  });

  locMigrate?.addEventListener("click", async () => {
    try {
      const detect = await window.electron?.tools?.detectLegacy?.();
      if (!detect?.success) {
        await toast(t("tools.migrate.detectError"), "error");
        setStatusText(t("tools.migrate.detectError"));
        return;
      }
      if (!detect.found || !detect.found.length) {
        setStatusText(t("tools.migrate.none"));
        return;
      }
      let overwrite = false;
      try {
        if (typeof showConfirmationDialog === "function") {
          const confirmed = await showConfirmationDialog({
            title: t("tools.migrate.confirm.title"),
            subtitle: t("tools.migrate.confirm.subtitle"),
            message: t("tools.migrate.confirm.message"),
            confirmText: t("tools.migrate.confirm.confirm"),
            cancelText: t("tools.migrate.confirm.cancel"),
            tone: "danger",
          });
          overwrite = !!confirmed;
        }
      } catch {}
      const res = await window.electron?.tools?.migrateOld?.({
        overwrite,
      });
      if (res?.success) {
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
        await refreshLocationUI();
        // После успешной миграции перерисуем блок, чтобы обновились бейджи/статусы
        await renderToolsInfo();
      } else {
        await toast(t("tools.migrate.error"), "error");
        setStatusText(t("tools.migrate.error"));
      }
    } catch (e) {
      console.error("[toolsInfo] migrateOld error:", e);
      await toast(t("tools.migrate.error"), "error");
      setStatusText(t("tools.migrate.error"));
    }
  });

  // Копирование пути по двойному клику
  locInput?.addEventListener("dblclick", async () => {
    try {
      await navigator.clipboard.writeText(locInput.value || "");
      setStatusText(t("tools.location.copied"));
    } catch {
      console.warn("[toolsInfo] clipboard write failed");
    }
  });

  await refreshLocationUI();
  // === /Tools location wiring ===

  // --- Overflow menu: click to open/close ---
  if (moreWrap && moreBtn && moreMenu) {
    // reset state
    moreWrap.classList.remove("is-open");
    moreBtn.setAttribute("aria-expanded", "false");

    const closeMenu = () => {
      if (!moreWrap.classList.contains("is-open")) return;
      moreWrap.classList.remove("is-open");
      moreBtn.setAttribute("aria-expanded", "false");
    };

    const toggleMenu = (ev) => {
      ev.stopPropagation();
      const willOpen = !moreWrap.classList.contains("is-open");
      // Close any other open menus of the same type
      document.querySelectorAll(".tools-more.is-open").forEach((el) => {
        if (el !== moreWrap) el.classList.remove("is-open");
      });
      moreWrap.classList.toggle("is-open", willOpen);
      moreBtn.setAttribute("aria-expanded", String(willOpen));
    };

    moreBtn.addEventListener("click", toggleMenu);

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!moreWrap.classList.contains("is-open")) return;
      if (!moreWrap.contains(e.target)) closeMenu();
    });
    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  let isChecking = false;
  let isInstalling = false;
  let pendingUpdate = { yt: false, ff: false };

  const allButtons = [
    checkBtn,
    updateBtn,
    installBtn,
    forceBtn,
    locChoose,
    locOpen,
    locReset,
    locMigrate,
  ];

  const moveLocation = (toWizard) => {
    const locationEl = section.querySelector(".tools-location");
    if (!locationEl) return;
    if (toWizard && wizardLocationSlot) {
      wizardLocationSlot.appendChild(locationEl);
    } else if (!toWizard && locationHost) {
      locationHost.appendChild(locationEl);
    }
  };

  const syncWizardVisibility = (missing) => {
    if (wizardEl) wizardEl.style.display = missing ? "" : "none";
    if (checkBtn) checkBtn.style.display = missing ? "none" : "";
    if (updateBtn) updateBtn.style.display = "none";
    if (installBtn) installBtn.style.display = missing ? "" : "none";
    if (moreWrap) moreWrap.style.display = missing ? "none" : "";
    moveLocation(missing);
  };

  // init and subscribe to online/offline
  if (window.__toolsInfoNetHandlers) {
    window.removeEventListener("online", window.__toolsInfoNetHandlers.on);
    window.removeEventListener("offline", window.__toolsInfoNetHandlers.off);
  }
  window.__toolsInfoNetHandlers = {
    on: () => {
      applyNetworkState(allButtons, isInstalling, isChecking);
      if (statusEl?.textContent === t("tools.status.noNetwork")) {
        setStatusText("");
      }
      if (hintEl?.textContent === t("tools.status.noNetwork")) {
        setHintText("");
      }
    },
    off: () => {
      applyNetworkState(allButtons, isInstalling, isChecking);
      setStatusText(t("tools.status.noNetwork"));
      setHintText(t("tools.status.noNetwork"));
    },
  };
  window.addEventListener("online", window.__toolsInfoNetHandlers.on);
  window.addEventListener("offline", window.__toolsInfoNetHandlers.off);
  applyNetworkState(allButtons, isInstalling, isChecking);

  try {
    const res = await window.electron?.tools?.getVersions?.();

    if (!res) {
      console.error("No response from tools.getVersions");
      updateStatusUI(null);
      setStatusText(t("tools.error.getVersions"));
      return;
    }

    if (res.ytDlp?.error) {
      console.error("yt-dlp error:", res.ytDlp.error);
    }
    if (res.ffmpeg?.error) {
      console.error("ffmpeg error:", res.ffmpeg.error);
    }
    if (res.deno?.error) {
      console.error("deno error:", res.deno.error);
    }

    const summary = summarizeToolsState(res);
    updateStatusUI(summary);

    const missing = !res?.ytDlp?.ok || !res?.ffmpeg?.ok || !res?.deno?.ok;
    syncWizardVisibility(missing);

    setHintText(missing ? t("tools.hint.missing") : "");
    setStatusText(missing ? t("tools.summary.missing") : "");

    if (installBtn) {
      installBtn.onclick = async () => {
        if (!navigator.onLine) {
          setStatusText(t("tools.status.noNetwork"));
          return;
        }
        const labelEl = installBtn.querySelector("span");
        let dots;
        try {
          isInstalling = true;
          applyNetworkState(allButtons, isInstalling, isChecking);
          installBtn.setAttribute("aria-busy", "true");
          setStatusText(t("tools.status.installing"));
          if (labelEl)
            dots = startDotsAnimator(labelEl, t("tools.status.installing"));
          await window.electron?.tools?.installAll?.();
          await window.electron?.invoke?.(
            "toast",
            t("tools.toast.installSuccess"),
            "success",
          );
          await renderToolsInfo();
        } catch (e) {
          console.error("[toolsInfo] installAll failed:", e);
          setStatusText(t("tools.error.install"));
          await window.electron?.invoke?.(
            "toast",
            t("tools.toast.installError"),
            "error",
          );
        } finally {
          isInstalling = false;
          installBtn.removeAttribute("aria-busy");
          applyNetworkState(allButtons, isInstalling, isChecking);
          try {
            if (typeof dots?.stop === "function") dots.stop();
          } catch {}
        }
      };
    }

    const enableForceReinstall = () => {
      if (!forceBtn) return;
      if (moreWrap) moreWrap.style.display = "";
      forceBtn.onclick = () => {
        const run = async () => {
          if (!navigator.onLine) {
            setStatusText(t("tools.status.noNetwork"));
            return;
          }
          let dots;
          const labelEl = checkLabel || checkBtn?.querySelector("span");
          try {
            isInstalling = true;
            applyNetworkState(allButtons, isInstalling, isChecking);
            if (checkBtn) checkBtn.setAttribute("aria-busy", "true");
            if (labelEl)
              dots = startDotsAnimator(labelEl, t("tools.status.installing"));
            setStatusText(t("tools.status.installing"));
            await window.electron?.tools?.installAll?.();
            await window.electron?.invoke?.(
              "toast",
              t("tools.toast.installSuccess"),
              "success",
            );
            await renderToolsInfo();
          } catch (e) {
            console.error("[toolsInfo] force installAll failed:", e);
            setStatusText(t("tools.error.install"));
            await window.electron?.invoke?.(
              "toast",
              t("tools.toast.installError"),
              "error",
            );
          } finally {
            isInstalling = false;
            if (checkBtn) checkBtn.removeAttribute("aria-busy");
            applyNetworkState(allButtons, isInstalling, isChecking);
            try {
              if (typeof dots?.stop === "function") dots.stop();
            } catch {}
          }
        };

        if (typeof showConfirmationDialog === "function") {
          showConfirmationDialog({
            title: t("tools.confirm.force.title"),
            subtitle: t("tools.confirm.force.subtitle"),
            message: t("tools.confirm.force.message"),
            confirmText: t("tools.confirm.force.confirm"),
            cancelText: t("tools.confirm.force.cancel"),
            tone: "danger",
          }).then((confirmed) => {
            if (confirmed) run();
          });
        } else {
          run();
        }
      };
    };

    if (!missing) enableForceReinstall();

    if (checkBtn) {
      checkBtn.onclick = async () => {
        if (isChecking) return;
        if (!navigator.onLine) {
          setStatusText(t("tools.status.noNetwork"));
          return;
        }
        const cur = await window.electron?.tools?.getVersions?.();
        if (!cur?.ytDlp?.ok || !cur?.ffmpeg?.ok) {
          await renderToolsInfo();
          return;
        }
        const summaryBase = summarizeToolsState(cur || {});
        updateStatusUI(
          summaryBase,
          {},
          {
            customState: "checking",
            customText: t("tools.status.checkingUpdates"),
          },
        );
        setStatusText(t("tools.status.checkingUpdates"));

        const prevIconClass = checkIcon?.className;
        if (checkIcon) checkIcon.classList.add("fa-spin");
        const labelEl = checkLabel || checkBtn.querySelector("span");
        let dots;
        try {
          isChecking = true;
          applyNetworkState(allButtons, isInstalling, isChecking);
          checkBtn.setAttribute("aria-busy", "true");
          if (labelEl)
            dots = startDotsAnimator(
              labelEl,
              t("tools.status.checkingUpdates"),
            );

          const upd = await window.electron?.tools?.checkUpdates?.({
            noCache: true,
            forceFetch: true,
          });

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
          const dCurLocal = formatDenoVersion(cur?.deno?.version || "");

          const ytCur = yCurUpd || yCurLocal || "";
          const ffCur = fCurUpd || fCurLocal || "";
          const denoCur = dCurUpd || dCurLocal || "";
          const ytLatest = yLatN;
          const ffSkip = !!upd?.ffmpeg?.skipUpdates;
          const ffLatest = ffSkip ? ffCur : fLatN;

          let ytCmp = null,
            ffCmp = null;
          if (ytCur && ytLatest) ytCmp = cmpYtDlp(ytLatest, ytCur);
          if (!ffSkip && ffCur && ffLatest) {
            ffCmp = cmpFfSemver(ffLatest, ffCur);
          }

          pendingUpdate = {
            yt: ytCmp === 1,
            ff: !ffSkip && ffCmp === 1,
          };
          const anyUpdate = pendingUpdate.yt || pendingUpdate.ff;
          const overrides = {
            yt: pendingUpdate.yt ? "update" : undefined,
            ff: pendingUpdate.ff ? "update" : undefined,
          };
          updateStatusUI(summaryBase, overrides, {
            customState: anyUpdate ? "update" : undefined,
            customText: anyUpdate
              ? t("tools.status.updatesFound")
              : t("tools.status.upToDate"),
          });
          setStatusText(
            anyUpdate
              ? t("tools.status.updatesFound")
              : t("tools.status.upToDate"),
          );

          if (updateBtn) {
            updateBtn.style.display = anyUpdate ? "" : "none";
          }

          if (anyUpdate && updateBtn) {
            updateBtn.onclick = async () => {
              if (!navigator.onLine) {
                setStatusText(t("tools.status.noNetwork"));
                return;
              }
              let dots2;
              const updateLabelEl =
                updateLabel || updateBtn.querySelector("span");
              try {
                isInstalling = true;
                applyNetworkState(allButtons, isInstalling, isChecking);
                updateBtn.setAttribute("aria-busy", "true");
                setStatusText(t("tools.status.installing"));
                if (updateLabelEl)
                  dots2 = startDotsAnimator(
                    updateLabelEl,
                    t("tools.status.installing"),
                  );
                if (pendingUpdate.yt)
                  await window.electron?.tools?.updateYtDlp?.();
                if (pendingUpdate.ff)
                  await window.electron?.tools?.updateFfmpeg?.();
                await renderToolsInfo();
              } catch (e2) {
                console.error("[toolsInfo] selective update failed:", e2);
                setStatusText(t("tools.error.update"));
                await window.electron?.invoke?.(
                  "toast",
                  t("tools.error.update"),
                  "error",
                );
              } finally {
                isInstalling = false;
                updateBtn.removeAttribute("aria-busy");
                applyNetworkState(allButtons, isInstalling, isChecking);
                try {
                  if (typeof dots2?.stop === "function") dots2.stop();
                } catch {}
              }
            };
          }

          if (denoCur) {
            setHintText(`${t("tools.label.deno")}: ${denoCur}`);
          } else if (cur?.deno?.ok === false) {
            setHintText(t("tools.deno.missing"));
          }
        } catch (err) {
          console.error("[toolsInfo] check updates failed:", err);
          updateStatusUI(
            summaryBase,
            {},
            {
              customState: "error",
              customText: t("tools.error.update"),
            },
          );
          setStatusText(t("tools.error.update"));
          await window.electron?.invoke?.(
            "toast",
            t("tools.error.update"),
            "error",
          );
        } finally {
          isChecking = false;
          checkBtn.removeAttribute("aria-busy");
          applyNetworkState(allButtons, isInstalling, isChecking);
          if (checkIcon && prevIconClass) checkIcon.className = prevIconClass;
          try {
            if (typeof dots?.stop === "function") dots.stop();
          } catch {}
        }
      };
    }

    if (!missing) {
      triggerBackgroundToolsUpdateCheck(res);
    }
    emitToolsStatus(res);
  } catch (e) {
    setHintText(t("tools.error.getVersions"));
    updateStatusUI(
      null,
      {},
      { customState: "error", customText: t("tools.error.getVersions") },
    );
    console.error("[toolsInfo] getVersions failed:", e);
    emitToolsStatus(null);
  }

  try {
    section.querySelectorAll(".tool-external-link").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const tool = el.dataset.tool;
        const url = TOOL_LINKS[tool];

        if (url) {
          window.electron?.openExternal(url);
        }
      });
    });
    applyI18n(section);
    initTooltips();
  } catch (e) {
    console.warn("[toolsInfo] initTooltips skipped:", e);
  }
}
