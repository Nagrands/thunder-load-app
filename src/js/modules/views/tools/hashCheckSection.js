import { t } from "../../i18n.js";
import {
  acquireDocumentScrollLock,
  releaseDocumentScrollLock,
} from "../../scrollLockManager.js";

const HASH_HOWTO_SCROLL_LOCK_OWNER = "tools-howto-hash";
const HASH_ALGORITHMS = ["SHA-256", "SHA-1", "MD5"];
const HASH_HISTORY_STORAGE_KEY = "thunderLoad.hashCheck.history.v1";
const HASH_HISTORY_LIMIT = 6;

const getEl = (id, root = document) => root.querySelector(`#${id}`);

const escapeAttr = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const formatFileSize = (size) => {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 0)
    return t("hashCheck.fileSizeUnknown");
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  const formatted =
    value >= 10 || index === 0 || Number.isInteger(value)
      ? value.toFixed(0)
      : value.toFixed(1);
  return `${formatted} ${units[index]}`;
};

const getFileName = (filePath, fallbackKey) => {
  if (!filePath) return t(fallbackKey);
  const fileName = String(filePath).split(/[\\/]/).pop();
  return fileName || String(filePath);
};

const createAlgorithmOptions = () =>
  HASH_ALGORITHMS.map(
    (algorithm) => `
      <button
        type="button"
        class="hash-algorithm-option"
        role="option"
        data-hash-algorithm="${algorithm}"
        aria-selected="${algorithm === "SHA-256" ? "true" : "false"}"
      >
        <span>${algorithm}</span>
        <i class="fa-solid fa-check" aria-hidden="true"></i>
      </button>
    `,
  ).join("");

const renderFileRow = ({
  idSuffix = "",
  nameId,
  metaId,
  statusId,
  emptyKey,
  statusKey = "hashCheck.fileStatus.empty",
}) => `
  <div class="hash-file-row" data-hash-file-row="${idSuffix || "primary"}">
    <span class="hash-file-row__icon" aria-hidden="true">
      <i class="fa-regular fa-file-lines"></i>
    </span>
    <span class="hash-file-row__content">
      <span id="${nameId}" class="hash-file-pill muted" data-i18n="${emptyKey}">${t(emptyKey)}</span>
      <span id="${metaId}" class="hash-file-row__meta muted" data-i18n="hashCheck.fileSizeUnknown">${t("hashCheck.fileSizeUnknown")}</span>
    </span>
    <span id="${statusId}" class="hash-file-row__status muted" data-i18n="${statusKey}">
      <i class="fa-regular fa-circle" aria-hidden="true"></i>
      <span>${t(statusKey)}</span>
    </span>
  </div>
`;

export const renderHashCheckSection = () => `
  <section class="tools-view hidden" data-tool-view="hash" aria-label="${t("tools.nav.current.hash")}">
    <article class="tools-card tools-detail-card hash-tool-card">
      <div class="tools-card__header hash-header">
        <div class="hash-header__main">
          <span class="hash-header__mark" aria-hidden="true">
            <i class="fa-solid fa-fingerprint"></i>
          </span>
          <div class="hash-header__copy">
            <h2 data-i18n="hashCheck.title">${t("hashCheck.title")}</h2>
            <p class="tools-card__hint" data-i18n="hashCheck.subtitle">${t("hashCheck.subtitle")}</p>
          </div>
        </div>
        <div class="hash-header__actions">
          <button
            id="hash-open-howto"
            type="button"
            class="small-button hash-howto-open hash-icon-button"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            data-i18n-title="hashCheck.howto.open"
            data-i18n-aria="hashCheck.howto.open"
            title="${t("hashCheck.howto.open")}"
            aria-label="${t("hashCheck.howto.open")}"
          >
            <i class="fa-regular fa-circle-question"></i>
          </button>
        </div>
      </div>

      <div class="hash-shell">
        <div class="hash-workbench">
          <section class="hash-stage hash-stage--source" aria-labelledby="hash-source-title">
            <div class="hash-stage__header">
              <span class="hash-stage__step"><i class="fa-solid fa-file-shield" aria-hidden="true"></i></span>
              <div class="hash-stage__copy">
                <h3 id="hash-source-title" data-i18n="hashCheck.stage.source">${t("hashCheck.stage.source")}</h3>
                <p class="muted" data-i18n="hashCheck.stage.sourceHint">${t("hashCheck.stage.sourceHint")}</p>
              </div>
            </div>
            <div
              id="hash-drop-zone"
              class="hash-drop-zone"
              role="button"
              tabindex="0"
              aria-describedby="hash-drop-hint hash-drop-target"
            >
              <div class="hash-drop-zone__icon" aria-hidden="true">
                <i class="fa-solid fa-file-arrow-up"></i>
              </div>
              <div class="hash-drop-zone__body">
                <strong id="hash-drop-title" class="hash-drop-zone__title" data-i18n="hashCheck.dropTitle">${t("hashCheck.dropTitle")}</strong>
                <span id="hash-drop-hint" class="hash-drop-zone__hint muted" data-i18n="hashCheck.dropHintInitial">${t("hashCheck.dropHintInitial")}</span>
              </div>
              <span id="hash-drop-target" class="hash-drop-zone__target muted" data-i18n="hashCheck.dropTargetFirst">${t("hashCheck.dropTargetFirst")}</span>
            </div>
            <div class="hash-file-grid">
              <article class="hash-file-card hash-file-card--primary">
                <div class="hash-file-card__top">
                  <span class="muted hash-file-label" data-i18n="hashCheck.primaryFile">${t("hashCheck.primaryFile")}</span>
                  <button id="hash-pick-file" type="button" class="small-button hash-select-file-btn">
                    <i class="fa-regular fa-folder-open"></i>
                    <span data-i18n="hashCheck.pickFile">${t("hashCheck.pickFile")}</span>
                  </button>
                </div>
                <div class="hash-file-card__body">
                  ${renderFileRow({
                    nameId: "hash-file-name",
                    metaId: "hash-file-size",
                    statusId: "hash-file-status",
                    emptyKey: "hashCheck.noFile",
                  })}
                </div>
              </article>
              <div class="hash-compare-column">
                <div class="hash-compare-summary">
                  <div class="hash-compare-summary__copy">
                    <span class="muted hash-file-label" data-i18n="hashCheck.compareTitle">${t("hashCheck.compareTitle")}</span>
                    <p class="muted hash-file-card__hint" data-i18n="hashCheck.compareHint">${t("hashCheck.compareHint")}</p>
                  </div>
                  <button
                    id="hash-toggle-compare"
                    type="button"
                    class="small-button hash-compare-toggle"
                    aria-expanded="false"
                    aria-controls="hash-compare-panel"
                  >
                    <i class="fa-solid fa-plus"></i>
                    <span id="hash-toggle-compare-label" data-i18n="hashCheck.compareToggle.open">${t("hashCheck.compareToggle.open")}</span>
                  </button>
                </div>
                <div id="hash-compare-panel" class="hash-compare-panel hidden" aria-hidden="true">
                  <article class="hash-file-card hash-file-card--secondary">
                    <div class="hash-file-card__top">
                      <span class="muted hash-file-label" data-i18n="hashCheck.compareFile">${t("hashCheck.compareFile")}</span>
                      <div class="hash-actions-inline">
                        <button id="hash-pick-file-2" type="button" class="small-button hash-select-file-btn">
                          <i class="fa-regular fa-folder-open"></i>
                          <span data-i18n="hashCheck.pickFileSecond">${t("hashCheck.pickFileSecond")}</span>
                        </button>
                        <button
                          id="hash-clear-file-2"
                          type="button"
                          class="small-button hash-clear-btn hash-icon-button"
                          data-bs-toggle="tooltip"
                          data-bs-placement="top"
                          data-i18n-title="hashCheck.clearSecond"
                          data-i18n-aria="hashCheck.clearSecond"
                          title="${t("hashCheck.clearSecond")}"
                          aria-label="${t("hashCheck.clearSecond")}"
                          disabled
                        >
                          <i class="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    </div>
                    <div class="hash-file-card__body">
                      ${renderFileRow({
                        idSuffix: "secondary",
                        nameId: "hash-file-name-2",
                        metaId: "hash-file-size-2",
                        statusId: "hash-file-status-2",
                        emptyKey: "hashCheck.noFileSecond",
                      })}
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside class="hash-sidebar" aria-label="${escapeAttr(t("hashCheck.stage.options"))}">
          <section class="hash-stage hash-stage--options" aria-labelledby="hash-options-title">
            <div class="hash-stage__header">
              <span class="hash-stage__step"><i class="fa-solid fa-sliders" aria-hidden="true"></i></span>
              <div class="hash-stage__copy">
                <h3 id="hash-options-title" data-i18n="hashCheck.stage.options">${t("hashCheck.stage.options")}</h3>
                <p class="muted" data-i18n="hashCheck.stage.optionsHint">${t("hashCheck.stage.optionsHint")}</p>
              </div>
            </div>
            <div class="hash-check-grid">
              <div class="hash-row hash-row--top">
                <div class="hash-algorithm-wrap">
                  <label for="hash-algorithm" class="muted" data-i18n="hashCheck.algorithm">${t("hashCheck.algorithm")}</label>
                  <div class="hash-algorithm-select" data-hash-algorithm-select>
                    <button
                      id="hash-algorithm-toggle"
                      type="button"
                      class="hash-algorithm-trigger"
                      aria-haspopup="listbox"
                      aria-expanded="false"
                      aria-controls="hash-algorithm-menu"
                    >
                      <span id="hash-algorithm-label">SHA-256</span>
                      <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <select id="hash-algorithm" class="wg-input hash-native-select" aria-hidden="true" tabindex="-1">
                      <option value="SHA-256" selected>SHA-256</option>
                      <option value="SHA-1">SHA-1</option>
                      <option value="MD5">MD5</option>
                    </select>
                    <div id="hash-algorithm-menu" class="hash-algorithm-menu hidden" role="listbox" aria-label="${escapeAttr(t("hashCheck.algorithm"))}">
                      ${createAlgorithmOptions()}
                    </div>
                  </div>
                </div>
                <div class="hash-expected-wrap">
                  <label for="hash-expected" class="muted" data-i18n="hashCheck.expected">${t("hashCheck.expected")}</label>
                  <input
                    id="hash-expected"
                    type="text"
                    class="wg-input"
                    data-i18n-placeholder="hashCheck.expectedPlaceholder"
                    placeholder="${t("hashCheck.expectedPlaceholder")}"
                  />
                </div>
              </div>
              <div class="hash-row hash-row--bottom">
                <span class="muted hash-expected-hint" data-i18n="hashCheck.expectedHint">${t("hashCheck.expectedHint")}</span>
                <div class="hash-config-actions">
                  <button id="hash-clear-all" type="button" class="small-button hash-clear-all-btn btn-ghost" disabled>
                    <i class="fa-solid fa-rotate-left"></i>
                    <span data-i18n="hashCheck.clearAll">${t("hashCheck.clearAll")}</span>
                  </button>
                  <button id="hash-run" type="button" class="large-button hash-run-btn" disabled>
                    <i class="fa-solid fa-shield-halved"></i>
                    <span data-i18n="hashCheck.run">${t("hashCheck.run")}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div id="hash-result-panel" class="hash-result-panel is-idle">
            <div class="hash-result-panel__top">
              <div class="hash-result-panel__headline">
                <span class="hash-result-panel__eyebrow" data-i18n="hashCheck.resultTitle">${t("hashCheck.resultTitle")}</span>
                <div id="hash-result" class="quick-action-result muted" data-i18n="hashCheck.resultIdle">${t("hashCheck.resultIdle")}</div>
              </div>
              <span id="hash-status-badge" class="hash-status-badge muted" data-i18n="hashCheck.status.idle">${t("hashCheck.status.idle")}</span>
            </div>
            <div class="hash-result-stack">
              <div id="hash-progress" class="hash-progress hidden" aria-hidden="true">
                <div class="hash-progress__meta">
                  <span id="hash-progress-label" class="muted" data-i18n="hashCheck.progress.idle">${t("hashCheck.progress.idle")}</span>
                  <span id="hash-progress-percent" class="muted">0%</span>
                </div>
                <div class="hash-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                  <span id="hash-progress-bar" class="hash-progress__bar" style="width: 0%"></span>
                </div>
              </div>
              <div class="hash-actual-box">
                <div class="hash-actual-box__top">
                  <span id="hash-actual-label" class="muted">${t("hashCheck.actualLabelWithAlgorithm", { algorithm: "SHA-256" })}</span>
                  <div class="hash-copy-wrap">
                    <span id="hash-copy-feedback-1" class="hash-copy-feedback muted" aria-live="polite"></span>
                    <button
                      id="hash-copy-actual-1"
                      type="button"
                      class="small-button hash-copy-btn hash-icon-button"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      data-i18n-title="hashCheck.copyActual"
                      data-i18n-aria="hashCheck.copyActual"
                      title="${t("hashCheck.copyActual")}"
                      aria-label="${t("hashCheck.copyActual")}"
                      disabled
                    >
                      <i class="fa-regular fa-copy"></i>
                    </button>
                  </div>
                </div>
                <code id="hash-actual-value">-</code>
              </div>
              <div id="hash-actual-box-2" class="hash-actual-box hidden">
                <div class="hash-actual-box__top">
                  <span id="hash-actual-label-2" class="muted">${t("hashCheck.secondActualLabelWithAlgorithm", { algorithm: "SHA-256" })}</span>
                  <div class="hash-copy-wrap">
                    <span id="hash-copy-feedback-2" class="hash-copy-feedback muted" aria-live="polite"></span>
                    <button
                      id="hash-copy-actual-2"
                      type="button"
                      class="small-button hash-copy-btn hash-icon-button"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      data-i18n-title="hashCheck.copyActualSecond"
                      data-i18n-aria="hashCheck.copyActualSecond"
                      title="${t("hashCheck.copyActualSecond")}"
                      aria-label="${t("hashCheck.copyActualSecond")}"
                      disabled
                    >
                      <i class="fa-regular fa-copy"></i>
                    </button>
                  </div>
                </div>
                <code id="hash-actual-value-2">-</code>
              </div>
              <div id="hash-compare-details" class="hash-compare-details hidden">
                <div class="hash-compare-row">
                  <span class="hash-compare-row__label muted" data-i18n="hashCheck.primaryFile">${t("hashCheck.primaryFile")}</span>
                  <span id="hash-compare-name-1" class="muted">${t("hashCheck.file1")}</span>
                  <span id="hash-compare-state-1" class="hash-compare-state muted">-</span>
                </div>
                <div class="hash-compare-row">
                  <span class="hash-compare-row__label muted" data-i18n="hashCheck.compareFile">${t("hashCheck.compareFile")}</span>
                  <span id="hash-compare-name-2" class="muted">${t("hashCheck.file2")}</span>
                  <span id="hash-compare-state-2" class="hash-compare-state muted">-</span>
                </div>
              </div>
            </div>
          </div>

          <section class="hash-history-panel" aria-labelledby="hash-history-title">
            <div class="hash-history-panel__top">
              <div class="hash-history-panel__copy">
                <h3 id="hash-history-title" data-i18n="hashCheck.history.title">${t("hashCheck.history.title")}</h3>
                <p class="muted" data-i18n="hashCheck.history.hint">${t("hashCheck.history.hint")}</p>
              </div>
              <button id="hash-history-clear" type="button" class="small-button hash-history-clear" disabled>
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                <span data-i18n="hashCheck.history.clear">${t("hashCheck.history.clear")}</span>
              </button>
            </div>
            <div id="hash-history-list" class="hash-history-list" role="list">
              <p class="hash-history-empty muted" data-i18n="hashCheck.history.empty">${t("hashCheck.history.empty")}</p>
            </div>
          </section>
        </aside>
      </div>

      <div id="hash-howto-modal" class="hash-howto-overlay hidden" aria-hidden="true">
        <div id="hash-howto-dialog" class="hash-howto-dialog" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="hash-howto-title">
          <div class="hash-howto-header">
            <h3 id="hash-howto-title" data-i18n="hashCheck.howto.title">${t("hashCheck.howto.title")}</h3>
            <button id="hash-howto-close" type="button" class="small-button hash-icon-button" data-i18n-aria="hashCheck.howto.close" aria-label="${t("hashCheck.howto.close")}">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div id="hash-howto-step" class="hash-howto-step muted"></div>
          <div class="hash-howto-viewport">
            <div id="hash-howto-track" class="hash-howto-track">
              <article class="hash-howto-slide" data-howto-slide="0">
                <div class="hash-howto-slide__icon"><i class="fa-regular fa-file"></i></div>
                <h4 data-i18n="hashCheck.howto.slide1.title">${t("hashCheck.howto.slide1.title")}</h4>
                <p data-i18n="hashCheck.howto.slide1.desc">${t("hashCheck.howto.slide1.desc")}</p>
              </article>
              <article class="hash-howto-slide" data-howto-slide="1">
                <div class="hash-howto-slide__icon"><i class="fa-solid fa-hashtag"></i></div>
                <h4 data-i18n="hashCheck.howto.slide2.title">${t("hashCheck.howto.slide2.title")}</h4>
                <p data-i18n="hashCheck.howto.slide2.desc">${t("hashCheck.howto.slide2.desc")}</p>
              </article>
              <article class="hash-howto-slide" data-howto-slide="2">
                <div class="hash-howto-slide__icon"><i class="fa-solid fa-scale-balanced"></i></div>
                <h4 data-i18n="hashCheck.howto.slide3.title">${t("hashCheck.howto.slide3.title")}</h4>
                <p data-i18n="hashCheck.howto.slide3.desc">${t("hashCheck.howto.slide3.desc")}</p>
              </article>
              <article class="hash-howto-slide" data-howto-slide="3">
                <div class="hash-howto-slide__icon"><i class="fa-regular fa-copy"></i></div>
                <h4 data-i18n="hashCheck.howto.slide4.title">${t("hashCheck.howto.slide4.title")}</h4>
                <p data-i18n="hashCheck.howto.slide4.desc">${t("hashCheck.howto.slide4.desc")}</p>
              </article>
            </div>
          </div>
          <div id="hash-howto-dots" class="hash-howto-dots" role="tablist" data-i18n-aria="hashCheck.howto.title" aria-label="${t("hashCheck.howto.title")}">
            <button type="button" class="hash-howto-dot" data-index="0" aria-label="${t("hashCheck.howto.step", { current: 1, total: 4 })}"></button>
            <button type="button" class="hash-howto-dot" data-index="1" aria-label="${t("hashCheck.howto.step", { current: 2, total: 4 })}"></button>
            <button type="button" class="hash-howto-dot" data-index="2" aria-label="${t("hashCheck.howto.step", { current: 3, total: 4 })}"></button>
            <button type="button" class="hash-howto-dot" data-index="3" aria-label="${t("hashCheck.howto.step", { current: 4, total: 4 })}"></button>
          </div>
          <div class="hash-howto-actions">
            <button id="hash-howto-prev" type="button" class="small-button">
              <i class="fa-solid fa-arrow-left"></i>
              <span data-i18n="hashCheck.howto.prev">${t("hashCheck.howto.prev")}</span>
            </button>
            <button id="hash-howto-next" type="button" class="small-button">
              <span data-i18n="hashCheck.howto.next">${t("hashCheck.howto.next")}</span>
              <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    </article>
  </section>
`;

export const initHashCheckSection = ({ view, cleanup }) => {
  const hashPickFileBtn = getEl("hash-pick-file", view);
  const hashPickFileSecondBtn = getEl("hash-pick-file-2", view);
  const hashClearFileSecondBtn = getEl("hash-clear-file-2", view);
  const hashClearAllBtn = getEl("hash-clear-all", view);
  const hashRunBtn = getEl("hash-run", view);
  const hashFileNameEl = getEl("hash-file-name", view);
  const hashFileNameSecondEl = getEl("hash-file-name-2", view);
  const hashFileSizeEl = getEl("hash-file-size", view);
  const hashFileSizeSecondEl = getEl("hash-file-size-2", view);
  const hashFileStatusEl = getEl("hash-file-status", view);
  const hashFileStatusSecondEl = getEl("hash-file-status-2", view);
  const hashAlgorithmEl = getEl("hash-algorithm", view);
  const hashExpectedEl = getEl("hash-expected", view);
  const hashResultEl = getEl("hash-result", view);
  const hashResultPanelEl = getEl("hash-result-panel", view);
  const hashStatusBadgeEl = getEl("hash-status-badge", view);
  const hashCompareToggleBtn = getEl("hash-toggle-compare", view);
  const hashCompareToggleLabelEl = getEl("hash-toggle-compare-label", view);
  const hashComparePanelEl = getEl("hash-compare-panel", view);
  const hashActualLabelEl = getEl("hash-actual-label", view);
  const hashActualLabelSecondEl = getEl("hash-actual-label-2", view);
  const hashActualValueEl = getEl("hash-actual-value", view);
  const hashActualBoxSecondEl = getEl("hash-actual-box-2", view);
  const hashActualValueSecondEl = getEl("hash-actual-value-2", view);
  const hashCompareDetailsEl = getEl("hash-compare-details", view);
  const hashCompareNameFirstEl = getEl("hash-compare-name-1", view);
  const hashCompareNameSecondEl = getEl("hash-compare-name-2", view);
  const hashCompareStateFirstEl = getEl("hash-compare-state-1", view);
  const hashCompareStateSecondEl = getEl("hash-compare-state-2", view);
  const hashCopyActualFirstBtn = getEl("hash-copy-actual-1", view);
  const hashCopyActualSecondBtn = getEl("hash-copy-actual-2", view);
  const hashCopyFeedbackFirstEl = getEl("hash-copy-feedback-1", view);
  const hashCopyFeedbackSecondEl = getEl("hash-copy-feedback-2", view);
  const hashProgressEl = getEl("hash-progress", view);
  const hashProgressLabelEl = getEl("hash-progress-label", view);
  const hashProgressPercentEl = getEl("hash-progress-percent", view);
  const hashProgressTrackEl = hashProgressEl?.querySelector(
    ".hash-progress__track",
  );
  const hashProgressBarEl = getEl("hash-progress-bar", view);
  const hashHistoryClearBtn = getEl("hash-history-clear", view);
  const hashHistoryListEl = getEl("hash-history-list", view);
  const hashDropZoneEl = getEl("hash-drop-zone", view);
  const hashDropTitleEl = getEl("hash-drop-title", view);
  const hashDropHintEl = getEl("hash-drop-hint", view);
  const hashDropTargetEl = getEl("hash-drop-target", view);
  const algorithmToggle = getEl("hash-algorithm-toggle", view);
  const algorithmLabel = getEl("hash-algorithm-label", view);
  const algorithmMenu = getEl("hash-algorithm-menu", view);
  const algorithmOptions = Array.from(
    algorithmMenu?.querySelectorAll(".hash-algorithm-option") || [],
  );
  const hashOpenHowtoBtn = getEl("hash-open-howto", view);
  const hashHowtoModalEl = getEl("hash-howto-modal", view);
  const hashHowtoDialogEl = getEl("hash-howto-dialog", view);
  const hashHowtoTrackEl = getEl("hash-howto-track", view);
  const hashHowtoStepEl = getEl("hash-howto-step", view);
  const hashHowtoCloseBtn = getEl("hash-howto-close", view);
  const hashHowtoPrevBtn = getEl("hash-howto-prev", view);
  const hashHowtoNextBtn = getEl("hash-howto-next", view);
  const hashHowtoDotsEl = getEl("hash-howto-dots", view);
  const hashHowtoDots = Array.from(
    hashHowtoDotsEl?.querySelectorAll(".hash-howto-dot") || [],
  );
  let hashSelectedFile = "";
  let hashSelectedFileSecond = "";
  let firstFileInfo = null;
  let secondFileInfo = null;
  let hashActualValueFirst = "";
  let hashActualValueSecond = "";
  let hashBusy = false;
  let hashDropDepth = 0;
  let hashCompareExpanded = false;
  let hashComparePinnedByUser = false;
  let hashHowtoIndex = 0;
  let hashHowtoReturnFocusEl = null;
  let hashCopyFeedbackTimerFirst = null;
  let hashCopyFeedbackTimerSecond = null;
  let hashHistoryCopyFeedbackTimer = null;
  let activeHashRequestId = "";
  let hashProgressResetTimer = null;
  let unsubscribeHashProgress = null;
  let inspectToken = 0;

  cleanup.addCleanup(() => {
    releaseDocumentScrollLock(HASH_HOWTO_SCROLL_LOCK_OWNER);
    if (typeof unsubscribeHashProgress === "function")
      unsubscribeHashProgress();
    hashCopyFeedbackTimerFirst = cleanup.clearTimeout(
      hashCopyFeedbackTimerFirst,
    );
    hashCopyFeedbackTimerSecond = cleanup.clearTimeout(
      hashCopyFeedbackTimerSecond,
    );
    hashHistoryCopyFeedbackTimer = cleanup.clearTimeout(
      hashHistoryCopyFeedbackTimer,
    );
    hashProgressResetTimer = cleanup.clearTimeout(hashProgressResetTimer);
  });

  const readHashHistory = () => {
    try {
      const parsed = JSON.parse(
        window.localStorage?.getItem(HASH_HISTORY_STORAGE_KEY) || "[]",
      );
      return Array.isArray(parsed) ? parsed.slice(0, HASH_HISTORY_LIMIT) : [];
    } catch {
      return [];
    }
  };

  const writeHashHistory = (items) => {
    try {
      window.localStorage?.setItem(
        HASH_HISTORY_STORAGE_KEY,
        JSON.stringify(items.slice(0, HASH_HISTORY_LIMIT)),
      );
    } catch {}
  };

  const getHistoryStatusKey = (status) => {
    if (status === "match") return "hashCheck.history.match";
    if (status === "mismatch") return "hashCheck.history.mismatch";
    return "hashCheck.history.calculated";
  };

  const renderHashHistory = () => {
    if (!hashHistoryListEl) return;
    const items = readHashHistory();
    if (hashHistoryClearBtn) hashHistoryClearBtn.disabled = !items.length;
    if (!items.length) {
      hashHistoryListEl.innerHTML = `<p class="hash-history-empty muted" data-i18n="hashCheck.history.empty">${t("hashCheck.history.empty")}</p>`;
      return;
    }
    hashHistoryListEl.innerHTML = items
      .map((item) => {
        const isCompare = !!item.secondFilePath;
        const expectedLabel = item.expectedHash
          ? `<span>${t("hashCheck.history.expected")}</span>`
          : "";
        return `
          <article class="hash-history-item" role="listitem" data-hash-history-id="${escapeAttr(item.id)}">
            <div class="hash-history-item__main">
              <div class="hash-history-item__title">
                <span>${escapeAttr(item.fileName || t("hashCheck.noFile"))}</span>
                <strong class="${escapeAttr(item.statusTone || "muted")}">${t(getHistoryStatusKey(item.status))}</strong>
              </div>
              <div class="hash-history-item__meta muted">
                <span>${escapeAttr(item.algorithm || "SHA-256")}</span>
                ${isCompare ? `<span>${t("hashCheck.history.compare")}</span>` : ""}
                ${expectedLabel}
              </div>
              <code>${escapeAttr(item.actualHash || "-")}</code>
            </div>
            <div class="hash-history-item__actions">
              <button type="button" class="small-button hash-icon-button" data-hash-history-restore="${escapeAttr(item.id)}" aria-label="${escapeAttr(t("hashCheck.history.restore"))}" title="${escapeAttr(t("hashCheck.history.restore"))}">
                <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
              </button>
              <button type="button" class="small-button hash-icon-button" data-hash-history-copy="${escapeAttr(item.id)}" aria-label="${escapeAttr(t("hashCheck.history.copy"))}" title="${escapeAttr(t("hashCheck.history.copy"))}">
                <i class="fa-regular fa-copy" aria-hidden="true"></i>
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  };

  const addHashHistoryEntry = ({
    algorithm,
    expectedHash = "",
    actualHash = "",
    actualHashSecond = "",
    status = "calculated",
    statusTone = "muted",
  }) => {
    if (!hashSelectedFile || !actualHash) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      algorithm,
      filePath: hashSelectedFile,
      fileName: getFileName(hashSelectedFile, "hashCheck.noFile"),
      secondFilePath: hashSelectedFileSecond,
      secondFileName: hashSelectedFileSecond
        ? getFileName(hashSelectedFileSecond, "hashCheck.noFileSecond")
        : "",
      expectedHash,
      actualHash,
      actualHashSecond,
      status,
      statusTone,
    };
    const items = readHashHistory().filter(
      (item) =>
        item.filePath !== entry.filePath ||
        item.secondFilePath !== entry.secondFilePath ||
        item.algorithm !== entry.algorithm ||
        item.expectedHash !== entry.expectedHash,
    );
    writeHashHistory([entry, ...items]);
    renderHashHistory();
  };

  const updateHashProgress = ({
    visible = false,
    percent = 0,
    fileName = "",
  } = {}) => {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    hashProgressEl?.classList.toggle("hidden", !visible);
    hashProgressEl?.setAttribute("aria-hidden", visible ? "false" : "true");
    if (hashProgressLabelEl) {
      hashProgressLabelEl.textContent = visible
        ? t("hashCheck.progress.file", {
            fileName: fileName || t("hashCheck.noFile"),
          })
        : t("hashCheck.progress.idle");
    }
    if (hashProgressPercentEl)
      hashProgressPercentEl.textContent = `${safePercent}%`;
    if (hashProgressBarEl) hashProgressBarEl.style.width = `${safePercent}%`;
    if (hashProgressTrackEl)
      hashProgressTrackEl.setAttribute("aria-valuenow", String(safePercent));
  };

  const finishHashProgress = () => {
    updateHashProgress({
      visible: true,
      percent: 100,
      fileName: getFileName(hashSelectedFile, "hashCheck.noFile"),
    });
    hashProgressResetTimer = cleanup.clearTimeout(hashProgressResetTimer);
    hashProgressResetTimer = cleanup.setTimeout(() => {
      if (!hashBusy) updateHashProgress({ visible: false, percent: 0 });
    }, 900);
  };

  unsubscribeHashProgress =
    window.electron?.tools?.onHashProgress?.((progress = {}) => {
      if (!activeHashRequestId || progress.requestId !== activeHashRequestId)
        return;
      const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
      updateHashProgress({
        visible: true,
        percent,
        fileName: getFileName(progress.filePath, "hashCheck.noFile"),
      });
    }) || null;

  const setFileStatus = (
    element,
    key,
    tone = "muted",
    icon = "fa-regular fa-circle",
  ) => {
    if (!element) return;
    element.className = `hash-file-row__status ${tone}`;
    element.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span>${t(key)}</span>`;
  };

  const setHashFileRow = (
    nameEl,
    sizeEl,
    statusEl,
    filePath,
    info,
    emptyKey,
  ) => {
    if (!nameEl) return;
    if (!filePath) {
      nameEl.textContent = t(emptyKey);
      nameEl.title = "";
      if (sizeEl) sizeEl.textContent = t("hashCheck.fileSizeUnknown");
      setFileStatus(statusEl, "hashCheck.fileStatus.empty");
      return;
    }
    nameEl.textContent = info?.fileName || getFileName(filePath, emptyKey);
    nameEl.title = filePath;
    if (sizeEl) sizeEl.textContent = formatFileSize(info?.size);
    setFileStatus(
      statusEl,
      info?.readable === false
        ? "hashCheck.fileStatus.unreadable"
        : "hashCheck.fileStatus.ready",
      info?.readable === false ? "warning" : "success",
      info?.readable === false
        ? "fa-solid fa-triangle-exclamation"
        : "fa-solid fa-circle-check",
    );
  };

  const inspectFile = async (filePath) => {
    if (!filePath) return null;
    try {
      const res = await window.electron?.tools?.inspectHashFile?.({ filePath });
      if (res?.success) return res;
    } catch {}
    return {
      success: false,
      filePath,
      fileName: getFileName(filePath, "hashCheck.noFile"),
      size: null,
      readable: true,
    };
  };

  const syncHashUtilityButtons = () => {
    const hasSelection =
      !!hashSelectedFile ||
      !!hashSelectedFileSecond ||
      !!String(hashExpectedEl?.value || "").trim();
    if (hashClearAllBtn) hashClearAllBtn.disabled = hashBusy || !hasSelection;
    if (hashRunBtn) hashRunBtn.disabled = hashBusy || !hashSelectedFile;
  };

  const syncSecondFileControls = () => {
    if (hashClearFileSecondBtn) {
      hashClearFileSecondBtn.disabled = hashBusy || !hashSelectedFileSecond;
    }
  };

  const syncHashComparePanel = () => {
    hashComparePanelEl?.classList.toggle("hidden", !hashCompareExpanded);
    hashComparePanelEl?.setAttribute(
      "aria-hidden",
      hashCompareExpanded ? "false" : "true",
    );
    if (hashCompareToggleBtn) {
      hashCompareToggleBtn.setAttribute(
        "aria-expanded",
        hashCompareExpanded ? "true" : "false",
      );
      hashCompareToggleBtn.classList.toggle(
        "is-active",
        hashCompareExpanded || !!hashSelectedFileSecond,
      );
      hashCompareToggleBtn.disabled = hashBusy;
      const icon = hashCompareToggleBtn.querySelector("i");
      if (icon) {
        icon.className =
          hashCompareExpanded || hashSelectedFileSecond
            ? "fa-solid fa-code-compare"
            : "fa-solid fa-plus";
      }
    }
    if (hashCompareToggleLabelEl) {
      hashCompareToggleLabelEl.textContent = t(
        hashCompareExpanded
          ? "hashCheck.compareToggle.close"
          : "hashCheck.compareToggle.open",
      );
    }
  };

  const setHashCompareOpen = (open, { manual = false } = {}) => {
    hashCompareExpanded = !!open;
    if (manual) hashComparePinnedByUser = !!open;
    if (hashSelectedFileSecond) hashCompareExpanded = true;
    syncHashComparePanel();
  };

  const closeAlgorithmMenu = () => {
    algorithmMenu?.classList.add("hidden");
    algorithmToggle?.setAttribute("aria-expanded", "false");
  };

  const selectAlgorithm = (algorithm) => {
    if (!HASH_ALGORITHMS.includes(algorithm) || !hashAlgorithmEl) return;
    hashAlgorithmEl.value = algorithm;
    if (algorithmLabel) algorithmLabel.textContent = algorithm;
    algorithmOptions.forEach((option) => {
      option.setAttribute(
        "aria-selected",
        option.dataset.hashAlgorithm === algorithm ? "true" : "false",
      );
    });
    hashAlgorithmEl.dispatchEvent(new Event("change", { bubbles: true }));
    closeAlgorithmMenu();
  };

  const updateHashDropZone = () => {
    if (!hashDropZoneEl) return;
    const hasFirstFile = !!hashSelectedFile;
    const hasSecondFile = !!hashSelectedFileSecond;
    let hintKey = "hashCheck.dropHintInitial";
    let targetKey = "hashCheck.dropTargetFirst";
    if (hashBusy) {
      hintKey = "hashCheck.dropHintBusy";
      targetKey = hasSecondFile
        ? "hashCheck.dropTargetReplaceSecond"
        : hasFirstFile
          ? hashCompareExpanded
            ? "hashCheck.dropTargetSecond"
            : "hashCheck.dropTargetCompare"
          : "hashCheck.dropTargetFirst";
    } else if (hasSecondFile) {
      hintKey = "hashCheck.dropHintReplaceSecond";
      targetKey = "hashCheck.dropTargetReplaceSecond";
    } else if (hasFirstFile) {
      hintKey = hashCompareExpanded
        ? "hashCheck.dropHintSecond"
        : "hashCheck.dropHintCompare";
      targetKey = hashCompareExpanded
        ? "hashCheck.dropTargetSecond"
        : "hashCheck.dropTargetCompare";
    }
    hashDropZoneEl.classList.toggle("is-busy", hashBusy);
    hashDropZoneEl.setAttribute("aria-disabled", hashBusy ? "true" : "false");
    if (hashDropTitleEl) hashDropTitleEl.textContent = t("hashCheck.dropTitle");
    if (hashDropHintEl) hashDropHintEl.textContent = t(hintKey);
    if (hashDropTargetEl) hashDropTargetEl.textContent = t(targetKey);
  };

  const setHashBusy = (busy) => {
    hashBusy = !!busy;
    [
      hashPickFileBtn,
      hashPickFileSecondBtn,
      hashAlgorithmEl,
      hashExpectedEl,
    ].forEach((element) => {
      if (element) element.disabled = hashBusy;
    });
    if (hashRunBtn) {
      hashRunBtn.classList.toggle("is-loading", hashBusy);
      hashRunBtn.disabled = hashBusy || !hashSelectedFile;
    }
    if (algorithmToggle) algorithmToggle.disabled = hashBusy;
    hashResultPanelEl?.setAttribute("aria-busy", hashBusy ? "true" : "false");
    syncSecondFileControls();
    syncHashUtilityButtons();
    syncHashComparePanel();
    updateHashDropZone();
  };

  const setHashUiState = ({
    tone = "muted",
    statusKey = "hashCheck.status.idle",
    message = "",
    messageKey = "hashCheck.resultIdle",
    actualHash = "",
    actualHashSecond = "",
    canCopyFirst = false,
    canCopySecond = false,
    showCompareDetails = false,
    compareStateFirstKey = "",
    compareStateSecondKey = "",
    compareStateFirstTone = "muted",
    compareStateSecondTone = "muted",
    compareNameFirst = "",
    compareNameSecond = "",
  } = {}) => {
    hashActualValueFirst = actualHash || "";
    hashActualValueSecond = actualHashSecond || "";
    const statusTone =
      tone === "error"
        ? "error"
        : tone === "success"
          ? "success"
          : tone === "warning"
            ? "warning"
            : "muted";
    if (hashStatusBadgeEl) {
      hashStatusBadgeEl.textContent = t(statusKey);
      hashStatusBadgeEl.className = `hash-status-badge ${statusTone}`;
    }
    if (hashResultPanelEl) {
      hashResultPanelEl.classList.remove(
        "is-idle",
        "is-calculating",
        "is-success",
        "is-warning",
        "is-error",
      );
      hashResultPanelEl.classList.add(
        statusTone === "success"
          ? "is-success"
          : statusTone === "warning"
            ? "is-warning"
            : statusTone === "error"
              ? "is-error"
              : statusKey === "hashCheck.status.calculating"
                ? "is-calculating"
                : "is-idle",
      );
    }
    if (hashResultEl) {
      hashResultEl.textContent = message || t(messageKey);
      hashResultEl.className = `quick-action-result ${statusTone}`;
    }
    if (hashActualValueEl)
      hashActualValueEl.textContent = hashActualValueFirst || "-";
    if (hashActualValueSecondEl) {
      hashActualValueSecondEl.textContent = hashActualValueSecond || "-";
    }
    hashActualBoxSecondEl?.classList.toggle("hidden", !hashActualValueSecond);
    if (hashCopyActualFirstBtn) hashCopyActualFirstBtn.disabled = !canCopyFirst;
    if (hashCopyActualSecondBtn)
      hashCopyActualSecondBtn.disabled = !canCopySecond;
    hashCompareDetailsEl?.classList.toggle("hidden", !showCompareDetails);
    const setCompareState = (element, key, stateTone) => {
      if (!element) return;
      const safeTone = ["success", "warning", "error", "muted"].includes(
        stateTone,
      )
        ? stateTone
        : "muted";
      element.textContent = key ? t(key) : "-";
      element.className = `hash-compare-state ${safeTone}`;
    };
    setCompareState(
      hashCompareStateFirstEl,
      compareStateFirstKey,
      compareStateFirstTone,
    );
    setCompareState(
      hashCompareStateSecondEl,
      compareStateSecondKey,
      compareStateSecondTone,
    );
    if (hashCompareNameFirstEl) {
      hashCompareNameFirstEl.textContent =
        compareNameFirst || t("hashCheck.file1");
    }
    if (hashCompareNameSecondEl) {
      hashCompareNameSecondEl.textContent =
        compareNameSecond || t("hashCheck.file2");
    }
    syncHashUtilityButtons();
  };

  const resetHashResultState = () =>
    setHashUiState({
      tone: "muted",
      statusKey: "hashCheck.status.idle",
      messageKey: "hashCheck.resultIdle",
      canCopyFirst: false,
      canCopySecond: false,
      showCompareDetails: false,
    });

  const applyHashFileSelection = async ({
    firstFilePath = hashSelectedFile,
    secondFilePath = hashSelectedFileSecond,
    autoOpenCompare = false,
  } = {}) => {
    const token = (inspectToken += 1);
    hashSelectedFile = firstFilePath || "";
    hashSelectedFileSecond = secondFilePath || "";
    firstFileInfo = hashSelectedFile
      ? {
          fileName: getFileName(hashSelectedFile, "hashCheck.noFile"),
          size: null,
          readable: true,
        }
      : null;
    secondFileInfo = hashSelectedFileSecond
      ? {
          fileName: getFileName(
            hashSelectedFileSecond,
            "hashCheck.noFileSecond",
          ),
          size: null,
          readable: true,
        }
      : null;
    setHashFileRow(
      hashFileNameEl,
      hashFileSizeEl,
      hashFileStatusEl,
      hashSelectedFile,
      firstFileInfo,
      "hashCheck.noFile",
    );
    setHashFileRow(
      hashFileNameSecondEl,
      hashFileSizeSecondEl,
      hashFileStatusSecondEl,
      hashSelectedFileSecond,
      secondFileInfo,
      "hashCheck.noFileSecond",
    );
    if (hashSelectedFileSecond) hashCompareExpanded = true;
    else if (!hashComparePinnedByUser && autoOpenCompare !== true)
      hashCompareExpanded = false;
    else if (autoOpenCompare) hashCompareExpanded = true;
    syncSecondFileControls();
    syncHashUtilityButtons();
    syncHashComparePanel();
    updateHashDropZone();
    resetHashResultState();
    const [firstInfo, secondInfo] = await Promise.all([
      inspectFile(hashSelectedFile),
      inspectFile(hashSelectedFileSecond),
    ]);
    if (token !== inspectToken) return;
    firstFileInfo = firstInfo;
    secondFileInfo = secondInfo;
    setHashFileRow(
      hashFileNameEl,
      hashFileSizeEl,
      hashFileStatusEl,
      hashSelectedFile,
      firstFileInfo,
      "hashCheck.noFile",
    );
    setHashFileRow(
      hashFileNameSecondEl,
      hashFileSizeSecondEl,
      hashFileStatusSecondEl,
      hashSelectedFileSecond,
      secondFileInfo,
      "hashCheck.noFileSecond",
    );
  };

  const resetHashSelections = () => {
    hashComparePinnedByUser = false;
    if (hashExpectedEl) hashExpectedEl.value = "";
    applyHashFileSelection({ firstFilePath: "", secondFilePath: "" });
    setHashCompareOpen(false);
    setHashActualLabels();
    syncHashUtilityButtons();
  };

  const normalizeDroppedFilePath = (rawPath = "") => {
    const value = String(rawPath || "").trim();
    if (!value) return "";
    if (/^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value)) return value;
    if (/^\/\/[^/]/.test(value))
      return `\\\\${value.slice(2).replace(/\//g, "\\")}`;
    const windowsDriveMatch = value.match(/^\/([a-zA-Z]:[\\/].*)$/);
    return windowsDriveMatch ? windowsDriveMatch[1] : value;
  };

  const getDroppedFilePath = (entry) => {
    if (typeof entry?.getAsFile === "function") {
      const viaFile = window.electron?.tools?.getDroppedFilePath?.(
        entry.getAsFile(),
      );
      if (typeof viaFile === "string" && viaFile.trim()) return viaFile;
    }
    const viaBridge = window.electron?.tools?.getDroppedFilePath?.(entry);
    if (typeof viaBridge === "string" && viaBridge.trim()) return viaBridge;
    if (entry && typeof entry.path === "string" && entry.path.trim())
      return entry.path;
    if (typeof entry?.getAsFile === "function") {
      const file = entry.getAsFile();
      if (file && typeof file.path === "string" && file.path.trim())
        return file.path;
    }
    return "";
  };

  const parseDroppedUriList = (rawValue = "") =>
    String(rawValue || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        if (
          /^[a-zA-Z]:[\\/]/.test(line) ||
          /^\\\\/.test(line) ||
          /^\/\/[^/]/.test(line)
        ) {
          return normalizeDroppedFilePath(line);
        }
        if (!/^file:\/\//i.test(line)) return "";
        try {
          const parsed = new URL(line);
          const host = parsed.hostname || "";
          const decodedPath = decodeURIComponent(parsed.pathname || "");
          if (host && host !== "localhost") {
            return normalizeDroppedFilePath(
              `\\\\${host}${decodedPath.replace(/\//g, "\\")}`,
            );
          }
          return normalizeDroppedFilePath(decodedPath);
        } catch {
          return "";
        }
      })
      .filter(Boolean);

  const getHashDropFilePaths = (event) => {
    const dataTransfer = event?.dataTransfer;
    const collected = [
      ...Array.from(dataTransfer?.files || []).map((file) =>
        getDroppedFilePath(file),
      ),
      ...Array.from(dataTransfer?.items || []).map((item) =>
        getDroppedFilePath(item),
      ),
      ...parseDroppedUriList(dataTransfer?.getData?.("text/uri-list")),
      ...parseDroppedUriList(dataTransfer?.getData?.("text/plain")),
      ...parseDroppedUriList(dataTransfer?.getData?.("text")),
    ].filter(Boolean);
    return Array.from(new Set(collected));
  };

  const handleHashDrop = (event) => {
    if (hashBusy) return;
    const filePaths = getHashDropFilePaths(event);
    if (!filePaths.length) {
      setHashUiState({
        tone: "error",
        statusKey: "hashCheck.status.error",
        messageKey: "hashCheck.dropError",
      });
      return;
    }
    if (filePaths.length >= 2) {
      applyHashFileSelection({
        firstFilePath: filePaths[0],
        secondFilePath: filePaths[1],
        autoOpenCompare: true,
      });
      return;
    }
    if (!hashSelectedFile) {
      applyHashFileSelection({ firstFilePath: filePaths[0] });
      return;
    }
    applyHashFileSelection({
      firstFilePath: hashSelectedFile,
      secondFilePath: filePaths[0],
      autoOpenCompare: true,
    });
  };

  const normalizeHashValue = (value) =>
    String(value || "")
      .replace(/\s+/g, "")
      .toLowerCase();

  const setHashActualLabels = (
    algorithm = hashAlgorithmEl?.value || "SHA-256",
  ) => {
    if (hashActualLabelEl) {
      hashActualLabelEl.textContent = t("hashCheck.actualLabelWithAlgorithm", {
        algorithm,
      });
    }
    if (hashActualLabelSecondEl) {
      hashActualLabelSecondEl.textContent = t(
        "hashCheck.secondActualLabelWithAlgorithm",
        { algorithm },
      );
    }
  };

  const pickHashFile = async (target = "first") => {
    if (hashBusy) return;
    const res = await window.electron?.tools?.pickFileForHash?.();
    if (!res?.success || !res.filePath) {
      if (!res?.canceled) {
        setHashUiState({
          tone: "error",
          statusKey: "hashCheck.status.error",
          message: res?.error || t("hashCheck.pickError"),
        });
      }
      return;
    }
    if (target === "second") {
      applyHashFileSelection({
        firstFilePath: hashSelectedFile,
        secondFilePath: res.filePath,
        autoOpenCompare: true,
      });
      return;
    }
    applyHashFileSelection({
      firstFilePath: res.filePath,
      secondFilePath: hashSelectedFileSecond,
    });
  };

  const pickNextHashFileFromDropZone = () => {
    if (hashBusy) return;
    pickHashFile(hashSelectedFile ? "second" : "first");
  };

  const runHashVerification = async () => {
    if (hashBusy) return;
    closeAlgorithmMenu();
    if (!hashSelectedFile) {
      setHashUiState({
        tone: "error",
        statusKey: "hashCheck.status.error",
        messageKey: "hashCheck.needFile",
      });
      return;
    }
    setHashUiState({
      tone: "muted",
      statusKey: "hashCheck.status.calculating",
      messageKey: "hashCheck.calculating",
    });
    activeHashRequestId = `hash-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    updateHashProgress({
      visible: true,
      percent: 0,
      fileName: getFileName(hashSelectedFile, "hashCheck.noFile"),
    });
    setHashBusy(true);
    let hashProgressReachedResult = false;
    try {
      const algorithm = hashAlgorithmEl?.value || "SHA-256";
      setHashActualLabels(algorithm);
      const expectedHash = normalizeHashValue(hashExpectedEl?.value || "");
      const hasSecondFile = !!hashSelectedFileSecond;
      const res = await window.electron?.tools?.calculateHash?.({
        filePath: hashSelectedFile,
        algorithm,
        expectedHash: hasSecondFile ? "" : expectedHash,
        requestId: activeHashRequestId,
      });
      if (!res?.success) {
        setHashUiState({
          tone: "error",
          statusKey: "hashCheck.status.error",
          message: res?.error || t("hashCheck.error"),
        });
        return;
      }
      if (hasSecondFile) {
        activeHashRequestId = `hash-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        updateHashProgress({
          visible: true,
          percent: 0,
          fileName: getFileName(
            hashSelectedFileSecond,
            "hashCheck.noFileSecond",
          ),
        });
        const resSecond = await window.electron?.tools?.calculateHash?.({
          filePath: hashSelectedFileSecond,
          algorithm,
          expectedHash: "",
          requestId: activeHashRequestId,
        });
        if (!resSecond?.success) {
          setHashUiState({
            tone: "error",
            statusKey: "hashCheck.status.error",
            message: resSecond?.error || t("hashCheck.error"),
            actualHash: res.actualHash || "",
            canCopyFirst: !!res.actualHash,
          });
          return;
        }
        const firstHash = String(res.actualHash || "").trim();
        const secondHash = String(resSecond.actualHash || "").trim();
        const firstHashNormalized = normalizeHashValue(firstHash);
        const secondHashNormalized = normalizeHashValue(secondHash);
        const firstMatchesExpected = expectedHash
          ? firstHashNormalized === expectedHash
          : false;
        const secondMatchesExpected = expectedHash
          ? secondHashNormalized === expectedHash
          : false;
        if (expectedHash) {
          const anyExpectedMatch =
            firstMatchesExpected || secondMatchesExpected;
          addHashHistoryEntry({
            algorithm,
            expectedHash,
            actualHash: firstHash,
            actualHashSecond: secondHash,
            status: anyExpectedMatch ? "match" : "mismatch",
            statusTone: anyExpectedMatch ? "success" : "warning",
          });
          hashProgressReachedResult = true;
          setHashUiState({
            tone: anyExpectedMatch ? "success" : "warning",
            statusKey: anyExpectedMatch
              ? "hashCheck.status.match"
              : "hashCheck.status.mismatch",
            messageKey: "hashCheck.expectedCompared",
            actualHash: firstHash,
            actualHashSecond: secondHash,
            canCopyFirst: !!firstHash,
            canCopySecond: !!secondHash,
            showCompareDetails: true,
            compareStateFirstKey: firstMatchesExpected
              ? "hashCheck.compareState.match"
              : "hashCheck.compareState.mismatch",
            compareStateSecondKey: secondMatchesExpected
              ? "hashCheck.compareState.match"
              : "hashCheck.compareState.mismatch",
            compareStateFirstTone: firstMatchesExpected ? "success" : "warning",
            compareStateSecondTone: secondMatchesExpected
              ? "success"
              : "warning",
            compareNameFirst: getFileName(hashSelectedFile, "hashCheck.file1"),
            compareNameSecond: getFileName(
              hashSelectedFileSecond,
              "hashCheck.file2",
            ),
          });
          return;
        }
        const matches =
          firstHashNormalized && secondHashNormalized
            ? firstHashNormalized === secondHashNormalized
            : false;
        addHashHistoryEntry({
          algorithm,
          expectedHash,
          actualHash: firstHash,
          actualHashSecond: secondHash,
          status: matches ? "match" : "mismatch",
          statusTone: matches ? "success" : "warning",
        });
        hashProgressReachedResult = true;
        setHashUiState({
          tone: matches ? "success" : "warning",
          statusKey: matches
            ? "hashCheck.status.match"
            : "hashCheck.status.mismatch",
          messageKey: "hashCheck.filesCompared",
          actualHash: firstHash,
          actualHashSecond: secondHash,
          canCopyFirst: !!firstHash,
          canCopySecond: !!secondHash,
          showCompareDetails: true,
          compareStateFirstKey: matches
            ? "hashCheck.compareState.match"
            : "hashCheck.compareState.mismatch",
          compareStateSecondKey: matches
            ? "hashCheck.compareState.match"
            : "hashCheck.compareState.mismatch",
          compareStateFirstTone: matches ? "success" : "warning",
          compareStateSecondTone: matches ? "success" : "warning",
          compareNameFirst: getFileName(hashSelectedFile, "hashCheck.file1"),
          compareNameSecond: getFileName(
            hashSelectedFileSecond,
            "hashCheck.file2",
          ),
        });
        return;
      }
      if (expectedHash && res.matches === true) {
        addHashHistoryEntry({
          algorithm,
          expectedHash,
          actualHash: res.actualHash || "",
          status: "match",
          statusTone: "success",
        });
        hashProgressReachedResult = true;
        setHashUiState({
          tone: "success",
          statusKey: "hashCheck.status.match",
          messageKey: "hashCheck.match",
          actualHash: res.actualHash || "",
          canCopyFirst: !!res.actualHash,
        });
        return;
      }
      if (expectedHash && res.matches === false) {
        addHashHistoryEntry({
          algorithm,
          expectedHash,
          actualHash: res.actualHash || "",
          status: "mismatch",
          statusTone: "warning",
        });
        hashProgressReachedResult = true;
        setHashUiState({
          tone: "warning",
          statusKey: "hashCheck.status.mismatch",
          messageKey: "hashCheck.mismatch",
          actualHash: res.actualHash || "",
          canCopyFirst: !!res.actualHash,
        });
        return;
      }
      addHashHistoryEntry({
        algorithm,
        actualHash: res.actualHash || "",
        status: "calculated",
        statusTone: "muted",
      });
      hashProgressReachedResult = true;
      setHashUiState({
        tone: "muted",
        statusKey: "hashCheck.status.calculated",
        messageKey: "hashCheck.calculated",
        actualHash: res.actualHash || "",
        canCopyFirst: !!res.actualHash,
      });
    } catch (error) {
      setHashUiState({
        tone: "error",
        statusKey: "hashCheck.status.error",
        message: error?.message || t("hashCheck.error"),
      });
    } finally {
      activeHashRequestId = "";
      if (hashProgressReachedResult) finishHashProgress();
      else updateHashProgress({ visible: false, percent: 0 });
      setHashBusy(false);
    }
  };

  const setCopyFeedback = (element, key = "") => {
    if (element) element.textContent = key ? t(key) : "";
  };

  const attachHashCopyHandler = (button, getValue, feedbackEl, timerKey) => {
    button?.addEventListener("click", async () => {
      const value = getValue();
      if (!value || hashBusy) return;
      if (timerKey === "first" && hashCopyFeedbackTimerFirst) {
        hashCopyFeedbackTimerFirst = cleanup.clearTimeout(
          hashCopyFeedbackTimerFirst,
        );
      }
      if (timerKey === "second" && hashCopyFeedbackTimerSecond) {
        hashCopyFeedbackTimerSecond = cleanup.clearTimeout(
          hashCopyFeedbackTimerSecond,
        );
      }
      try {
        await navigator.clipboard?.writeText?.(value);
        const icon = button.querySelector("i");
        if (icon) icon.className = "fa-solid fa-check";
        setCopyFeedback(feedbackEl, "hashCheck.copySuccess");
      } catch {
        if (hashResultEl) {
          hashResultEl.textContent = t("hashCheck.copyError");
          hashResultEl.className = "quick-action-result error";
        }
        setCopyFeedback(feedbackEl, "hashCheck.copyError");
      } finally {
        const resetTimer = cleanup.setTimeout(() => {
          const icon = button.querySelector("i");
          if (icon) icon.className = "fa-regular fa-copy";
          setCopyFeedback(feedbackEl);
        }, 1500);
        if (timerKey === "first") hashCopyFeedbackTimerFirst = resetTimer;
        if (timerKey === "second") hashCopyFeedbackTimerSecond = resetTimer;
      }
    });
  };

  const updateHashHowtoUi = () => {
    if (!hashHowtoTrackEl) return;
    hashHowtoTrackEl.style.transform = `translateX(-${hashHowtoIndex * 100}%)`;
    if (hashHowtoStepEl) {
      hashHowtoStepEl.textContent = t("hashCheck.howto.step", {
        current: hashHowtoIndex + 1,
        total: 4,
      });
    }
    if (hashHowtoPrevBtn) hashHowtoPrevBtn.disabled = hashHowtoIndex <= 0;
    if (hashHowtoNextBtn) hashHowtoNextBtn.disabled = hashHowtoIndex >= 3;
    hashHowtoDots.forEach((dot, idx) => {
      const isActive = idx === hashHowtoIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
  };

  const setHashHowtoSlide = (index) => {
    hashHowtoIndex = Math.max(0, Math.min(Number(index) || 0, 3));
    updateHashHowtoUi();
  };

  const openHashHowtoModal = () => {
    if (!hashHowtoModalEl || !hashHowtoDialogEl) return;
    hashHowtoReturnFocusEl = document.activeElement;
    acquireDocumentScrollLock(HASH_HOWTO_SCROLL_LOCK_OWNER);
    hashHowtoModalEl.classList.remove("hidden");
    hashHowtoModalEl.setAttribute("aria-hidden", "false");
    hashHowtoDialogEl.setAttribute("aria-hidden", "false");
    setHashHowtoSlide(0);
    cleanup.setTimeout(() => hashHowtoCloseBtn?.focus(), 0);
  };

  const closeHashHowtoModal = ({ returnFocus = true } = {}) => {
    if (!hashHowtoModalEl || !hashHowtoDialogEl) return;
    hashHowtoModalEl.classList.add("hidden");
    hashHowtoModalEl.setAttribute("aria-hidden", "true");
    hashHowtoDialogEl.setAttribute("aria-hidden", "true");
    releaseDocumentScrollLock(HASH_HOWTO_SCROLL_LOCK_OWNER);
    if (returnFocus) {
      if (hashHowtoReturnFocusEl?.focus) hashHowtoReturnFocusEl.focus();
      else hashOpenHowtoBtn?.focus();
    }
  };

  algorithmToggle?.addEventListener("click", () => {
    if (hashBusy) return;
    const willOpen = algorithmMenu?.classList.contains("hidden");
    algorithmMenu?.classList.toggle("hidden", !willOpen);
    algorithmToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
  algorithmOptions.forEach((option) => {
    option.addEventListener("click", () =>
      selectAlgorithm(option.dataset.hashAlgorithm || "SHA-256"),
    );
  });
  const handleDocumentClick = (event) => {
    if (!event.target?.closest?.("[data-hash-algorithm-select]")) {
      closeAlgorithmMenu();
    }
  };
  document.addEventListener("click", handleDocumentClick);
  cleanup.addCleanup(() =>
    document.removeEventListener("click", handleDocumentClick),
  );
  hashPickFileBtn?.addEventListener("click", () => pickHashFile("first"));
  hashPickFileSecondBtn?.addEventListener("click", () =>
    pickHashFile("second"),
  );
  hashClearFileSecondBtn?.addEventListener("click", () => {
    if (hashBusy || !hashSelectedFileSecond) return;
    applyHashFileSelection({
      firstFilePath: hashSelectedFile,
      secondFilePath: "",
    });
  });
  hashClearAllBtn?.addEventListener("click", () => {
    if (!hashBusy) resetHashSelections();
  });
  hashCompareToggleBtn?.addEventListener("click", () => {
    if (hashBusy) return;
    setHashCompareOpen(!hashCompareExpanded, { manual: true });
    updateHashDropZone();
  });
  hashDropZoneEl?.addEventListener("keydown", (event) => {
    if (hashBusy || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    pickNextHashFileFromDropZone();
  });
  hashDropZoneEl?.addEventListener("click", () => {
    pickNextHashFileFromDropZone();
  });
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    hashDropZoneEl?.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
  hashDropZoneEl?.addEventListener("dragenter", () => {
    if (hashBusy) return;
    hashDropDepth += 1;
    hashDropZoneEl.classList.add("is-drag-over");
  });
  hashDropZoneEl?.addEventListener("dragover", () => {
    if (!hashBusy) hashDropZoneEl.classList.add("is-drag-over");
  });
  hashDropZoneEl?.addEventListener("dragleave", () => {
    if (hashBusy) return;
    hashDropDepth = Math.max(0, hashDropDepth - 1);
    if (hashDropDepth === 0) hashDropZoneEl.classList.remove("is-drag-over");
  });
  hashDropZoneEl?.addEventListener("drop", (event) => {
    hashDropDepth = 0;
    hashDropZoneEl?.classList.remove("is-drag-over");
    handleHashDrop(event);
  });
  hashRunBtn?.addEventListener("click", () => runHashVerification());
  hashHistoryClearBtn?.addEventListener("click", () => {
    if (hashBusy) return;
    writeHashHistory([]);
    renderHashHistory();
  });
  hashHistoryListEl?.addEventListener("click", async (event) => {
    const restoreButton = event.target?.closest?.(
      "[data-hash-history-restore]",
    );
    const copyButton = event.target?.closest?.("[data-hash-history-copy]");
    if (!restoreButton && !copyButton) return;
    const id =
      restoreButton?.dataset.hashHistoryRestore ||
      copyButton?.dataset.hashHistoryCopy ||
      "";
    const item = readHashHistory().find((entry) => entry.id === id);
    if (!item) return;
    if (restoreButton) {
      if (hashBusy) return;
      selectAlgorithm(item.algorithm || "SHA-256");
      if (hashExpectedEl) {
        hashExpectedEl.value = item.expectedHash || "";
        hashExpectedEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      applyHashFileSelection({
        firstFilePath: item.filePath || "",
        secondFilePath: item.secondFilePath || "",
        autoOpenCompare: !!item.secondFilePath,
      });
      return;
    }
    if (copyButton && item.actualHash) {
      try {
        await navigator.clipboard?.writeText?.(item.actualHash);
        const icon = copyButton.querySelector("i");
        if (icon) icon.className = "fa-solid fa-check";
        hashHistoryCopyFeedbackTimer = cleanup.clearTimeout(
          hashHistoryCopyFeedbackTimer,
        );
        hashHistoryCopyFeedbackTimer = cleanup.setTimeout(() => {
          if (icon) icon.className = "fa-regular fa-copy";
        }, 1200);
      } catch {}
    }
  });
  attachHashCopyHandler(
    hashCopyActualFirstBtn,
    () => hashActualValueFirst,
    hashCopyFeedbackFirstEl,
    "first",
  );
  attachHashCopyHandler(
    hashCopyActualSecondBtn,
    () => hashActualValueSecond,
    hashCopyFeedbackSecondEl,
    "second",
  );
  hashAlgorithmEl?.addEventListener("change", () => setHashActualLabels());
  hashExpectedEl?.addEventListener("input", () => syncHashUtilityButtons());
  hashOpenHowtoBtn?.addEventListener("click", () => openHashHowtoModal());
  hashHowtoCloseBtn?.addEventListener("click", () => closeHashHowtoModal());
  hashHowtoPrevBtn?.addEventListener("click", () =>
    setHashHowtoSlide(hashHowtoIndex - 1),
  );
  hashHowtoNextBtn?.addEventListener("click", () =>
    setHashHowtoSlide(hashHowtoIndex + 1),
  );
  hashHowtoDots.forEach((dot) => {
    dot.addEventListener("click", () =>
      setHashHowtoSlide(Number(dot.dataset.index || "0")),
    );
  });
  hashHowtoModalEl?.addEventListener("mousedown", (event) => {
    if (event.target === hashHowtoModalEl) closeHashHowtoModal();
  });
  view.addEventListener("keydown", (event) => {
    if (hashHowtoModalEl?.classList.contains("hidden")) return;
    const key = String(event.key || "");
    if (key === "Escape" || key === "Esc") {
      event.preventDefault();
      closeHashHowtoModal();
      return;
    }
    if (key === "ArrowLeft") {
      event.preventDefault();
      setHashHowtoSlide(hashHowtoIndex - 1);
      return;
    }
    if (key === "ArrowRight") {
      event.preventDefault();
      setHashHowtoSlide(hashHowtoIndex + 1);
    }
  });

  resetHashResultState();
  setHashActualLabels();
  renderHashHistory();
  updateHashProgress({ visible: false, percent: 0 });
  syncHashComparePanel();
  setHashBusy(false);
  syncSecondFileControls();
  syncHashUtilityButtons();
  updateHashDropZone();
  updateHashHowtoUi();
};
