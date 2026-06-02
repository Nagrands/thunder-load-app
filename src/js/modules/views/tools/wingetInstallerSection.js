import {
  WINGET_PACKAGE_GROUPS,
  aggregateWingetPackageStatus,
  buildWingetScript,
  getAllBuiltInWingetPackageIds,
  getWingetPackageIdsFromSelection,
  getRenderableWingetPackageCategories,
  isValidWingetPackageId,
  parseCustomWingetPackageIds,
} from "./wingetPackages.js";
import {
  TOOLS_STORAGE_KEYS,
  readJsonStorage,
  writeJsonStorage,
} from "./storage.js";

const WINGET_LOG_MAX_ENTRIES = 400;
const WINGET_CUSTOM_STATUS_DEBOUNCE_MS = 600;

function renderWingetInstallerSection(t) {
  const savedState = readJsonStorage(
    TOOLS_STORAGE_KEYS.WINGET_INSTALLER_STATE,
    {
      openCategoryIds: null,
    },
  );
  const savedOpenCategoryIds = Array.isArray(savedState?.openCategoryIds)
    ? new Set(savedState.openCategoryIds)
    : null;
  const packageCategories = getRenderableWingetPackageCategories(t)
    .map((category) => {
      const groups = WINGET_PACKAGE_GROUPS.filter(
        (group) => group.category === category.id,
      );
      const packageItems = groups
        .map((group) => {
          const description =
            group.category === "browsers"
              ? ""
              : `<small class="winget-package-item__desc" data-i18n="${group.descriptionKey}">${t(group.descriptionKey)}</small>`;
          return `
          <label class="winget-package-item" for="winget-package-${group.id}">
            <input
              id="winget-package-${group.id}"
              type="checkbox"
              data-winget-package-group="${group.id}"
            />
            <span class="winget-package-item__icon" aria-hidden="true">
              <i class="${group.icon}"></i>
            </span>
            <span class="winget-package-item__content">
              <strong>${group.label}</strong>
              ${description}
              <span class="winget-package-item__meta">
                <span class="winget-status-pill is-unknown" data-winget-package-status="${group.id}" data-i18n="tools.winget.status.unknown">${t("tools.winget.status.unknown")}</span>
                <span class="winget-package-version" data-winget-package-version="${group.id}" data-i18n="tools.winget.version.empty">${t("tools.winget.version.empty")}</span>
                <span class="winget-package-latest hidden" data-winget-package-latest="${group.id}"></span>
              </span>
            </span>
          </label>
        `;
        })
        .join("");

      if (!packageItems) return "";
      const isOpen = savedOpenCategoryIds
        ? savedOpenCategoryIds.has(category.id)
        : true;
      return `
      <details class="winget-package-category" data-winget-category="${category.id}" ${isOpen ? "open" : ""}>
        <summary class="winget-package-category__header">
          <i class="${category.icon}" aria-hidden="true"></i>
          <h4 data-i18n="${category.titleKey}">${t(category.titleKey)}</h4>
          <span class="winget-category-count">${groups.length}</span>
          <i class="fa-solid fa-chevron-down winget-package-category__chevron" aria-hidden="true"></i>
        </summary>
        <div class="winget-package-grid">
          ${packageItems}
        </div>
      </details>
    `;
    })
    .join("");

  const scriptSteps = [
    "tools.winget.script.step.preflight",
    "tools.winget.script.step.action",
    "tools.winget.script.step.result",
  ]
    .map(
      (key) => `
        <li>
          <i class="fa-regular fa-circle-check" aria-hidden="true"></i>
          <span data-i18n="${key}">${t(key)}</span>
        </li>
      `,
    )
    .join("");

  return `
    <section class="tools-view hidden" data-tool-view="winget-installer" aria-label="${t("tools.nav.current.wingetInstaller")}">
      <article class="tools-card tools-detail-card winget-installer">
        <div class="tools-card__header winget-installer__header">
          <div>
            <h2 data-i18n="tools.winget.title">${t("tools.winget.title")}</h2>
            <p class="tools-card__hint" data-i18n="tools.winget.subtitle">${t("tools.winget.subtitle")}</p>
          </div>
          <span id="winget-platform-badge" class="winget-badge is-muted" data-i18n="tools.winget.platform.preview">${t("tools.winget.platform.preview")}</span>
        </div>

        <div id="winget-platform-banner" class="power-platform-banner hidden" role="status" aria-live="polite">
          <i class="fa-solid fa-circle-info"></i>
          <div class="power-platform-banner__content">
            <strong data-i18n="tools.winget.platform.title">${t("tools.winget.platform.title")}</strong>
            <span data-i18n="tools.winget.platform.body">${t("tools.winget.platform.body")}</span>
          </div>
        </div>

        <details id="winget-log-block" class="winget-log-block hidden" open>
          <summary>
            <span class="winget-log-title">
              <i class="fa-solid fa-terminal"></i>
              <span data-i18n="tools.winget.log.title">${t("tools.winget.log.title")}</span>
            </span>
            <span class="winget-log-actions">
              <button
                id="winget-copy-operation-log"
                type="button"
                class="small-button winget-icon-button"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                data-i18n-title="tools.winget.copyOperationLog"
                data-i18n-aria="tools.winget.copyOperationLog"
                title="${t("tools.winget.copyOperationLog")}"
                aria-label="${t("tools.winget.copyOperationLog")}"
              >
                <i class="fa-solid fa-clock-rotate-left"></i>
              </button>
              <button
                id="winget-copy-full-log"
                type="button"
                class="small-button winget-icon-button"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                data-i18n-title="tools.winget.copyFullLog"
                data-i18n-aria="tools.winget.copyFullLog"
                title="${t("tools.winget.copyFullLog")}"
                aria-label="${t("tools.winget.copyFullLog")}"
              >
                <i class="fa-solid fa-copy"></i>
              </button>
            </span>
          </summary>
          <div id="winget-live-log" class="winget-live-log" data-i18n="tools.winget.log.placeholder">${t("tools.winget.log.placeholder")}</div>
        </details>

        <div class="winget-installer__layout">
          <section class="winget-panel winget-panel--packages" aria-label="${t("tools.winget.packages.title")}">
            <div class="winget-panel__header">
              <h3 data-i18n="tools.winget.packages.title">${t("tools.winget.packages.title")}</h3>
              <div class="winget-panel__actions">
                <button
                  id="winget-select-all"
                  type="button"
                  class="small-button winget-icon-button"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-i18n-title="tools.winget.selectAll"
                  data-i18n-aria="tools.winget.selectAll"
                  title="${t("tools.winget.selectAll")}"
                  aria-label="${t("tools.winget.selectAll")}"
                >
                  <i class="fa-solid fa-square-check"></i>
                </button>
                <button
                  id="winget-clear-selection"
                  type="button"
                  class="small-button winget-icon-button"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-i18n-title="tools.winget.clearSelection"
                  data-i18n-aria="tools.winget.clearSelection"
                  title="${t("tools.winget.clearSelection")}"
                  aria-label="${t("tools.winget.clearSelection")}"
                >
                  <i class="fa-regular fa-square"></i>
                </button>
                <button
                  id="winget-check-status"
                  type="button"
                  class="small-button winget-icon-button"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-i18n-title="tools.winget.checkStatus"
                  data-i18n-aria="tools.winget.checkStatus"
                  title="${t("tools.winget.checkStatus")}"
                  aria-label="${t("tools.winget.checkStatus")}"
                >
                  <i class="fa-solid fa-rotate"></i>
                </button>
              </div>
            </div>
            <div class="winget-package-categories">
              ${packageCategories}
            </div>
            <label class="winget-custom-field" for="winget-custom-packages">
              <span data-i18n="tools.winget.custom.label">${t("tools.winget.custom.label")}</span>
              <textarea
                id="winget-custom-packages"
                class="wg-input"
                rows="3"
                data-i18n-placeholder="tools.winget.custom.placeholder"
                placeholder="${t("tools.winget.custom.placeholder")}"
              ></textarea>
              <small id="winget-custom-hint" class="muted" data-i18n="tools.winget.custom.hint">${t("tools.winget.custom.hint")}</small>
              <div id="winget-custom-status-list" class="winget-custom-status-list" aria-live="polite"></div>
            </label>
          </section>

          <section class="winget-panel winget-panel--script" aria-label="${t("tools.winget.script.title")}">
            <div class="winget-script-head">
              <div>
                <h3 data-i18n="tools.winget.script.title">${t("tools.winget.script.title")}</h3>
                <p class="muted" data-i18n="tools.winget.script.subtitle">${t("tools.winget.script.subtitle")}</p>
              </div>
              <div class="winget-script-head__actions">
                <button
                  id="winget-copy-script"
                  type="button"
                  class="small-button winget-icon-button"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-i18n-title="tools.winget.copyScript"
                  data-i18n-aria="tools.winget.copyScript"
                  title="${t("tools.winget.copyScript")}"
                  aria-label="${t("tools.winget.copyScript")}"
                >
                  <i class="fa-solid fa-copy"></i>
                </button>
              </div>
            </div>
            <div class="winget-script-toolbar">
              <div class="winget-mode-toggle" role="group" aria-label="${t("tools.winget.mode.aria")}">
                <button id="winget-mode-install" type="button" class="small-button is-active" data-winget-mode="install" data-i18n="tools.winget.mode.install">${t("tools.winget.mode.install")}</button>
                <button id="winget-mode-upgrade" type="button" class="small-button" data-winget-mode="upgrade" data-i18n="tools.winget.mode.upgrade">${t("tools.winget.mode.upgrade")}</button>
                <button id="winget-mode-uninstall" type="button" class="small-button" data-winget-mode="uninstall" data-i18n="tools.winget.mode.uninstall">${t("tools.winget.mode.uninstall")}</button>
              </div>
              <div class="winget-script-meta">
                <span id="winget-selected-count" class="winget-badge is-muted">${t("tools.winget.selectedCount", { count: 0 })}</span>
                <span class="winget-badge is-muted" data-i18n="tools.winget.script.preflight">${t("tools.winget.script.preflight")}</span>
                <span id="winget-script-action-label" class="winget-badge is-muted">${t("tools.winget.script.actionLabel", { mode: t("tools.winget.mode.install") })}</span>
              </div>
            </div>
            <ol class="winget-script-steps">
              ${scriptSteps}
            </ol>
            <pre id="winget-script-preview" class="winget-script-preview"></pre>
            <div class="winget-run-actions">
              <button id="winget-run-script" type="button" class="large-button">
                <i class="fa-brands fa-windows"></i>
                <span data-i18n="tools.winget.run">${t("tools.winget.run")}</span>
              </button>
              <button id="winget-cancel-run" type="button" class="small-button hidden">
                <i class="fa-solid fa-stop"></i>
                <span data-i18n="tools.winget.cancel">${t("tools.winget.cancel")}</span>
              </button>
            </div>
          </section>
        </div>
      </article>
    </section>
  `;
}

function formatLogEntry(entry) {
  const dt = new Date(entry.ts || Date.now());
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())} | ${(entry.level || "info").toUpperCase().padEnd(5, " ")} | ${entry.text || ""}`;
}

function initWingetInstallerSection({
  view,
  getEl,
  t,
  showToast,
  cleanup,
  platformInfo = {},
}) {
  const state = {
    autoStatusChecked: false,
    checking: false,
    entries: [],
    isWindows: !!platformInfo?.isWindows,
    lastOperationEntries: [],
    lastStatusItems: [],
    mode: "install",
    operationActive: false,
    runId: "",
    statusItems: new Map(),
    transientStatusItems: new Map(),
    running: false,
  };

  const controls = {
    checkboxes: () =>
      Array.from(view.querySelectorAll("[data-winget-package-group]")),
    customInput: () => getEl("winget-custom-packages", view),
    log: () => getEl("winget-live-log", view),
    preview: () => getEl("winget-script-preview", view),
    scriptActionLabel: () => getEl("winget-script-action-label", view),
    selectedCount: () => getEl("winget-selected-count", view),
    runBtn: () => getEl("winget-run-script", view),
    cancelBtn: () => getEl("winget-cancel-run", view),
    checkBtn: () => getEl("winget-check-status", view),
    logBlock: () => getEl("winget-log-block", view),
    customStatusList: () => getEl("winget-custom-status-list", view),
  };
  let customStatusTimer = null;

  const readSavedState = () =>
    readJsonStorage(TOOLS_STORAGE_KEYS.WINGET_INSTALLER_STATE, {
      customPackageIds: [],
      openCategoryIds: null,
      selectedGroupIds: [],
    });

  const getSelection = () => {
    const selectedGroupIds = controls
      .checkboxes()
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.dataset.wingetPackageGroup);
    const customPackageIds = parseCustomWingetPackageIds(
      controls.customInput()?.value || "",
    );
    const invalidPackageIds = customPackageIds.filter(
      (packageId) => !isValidWingetPackageId(packageId),
    );
    return {
      customPackageIds,
      invalidPackageIds,
      packageIds: getWingetPackageIdsFromSelection({
        selectedGroupIds,
        customPackageIds,
      }).filter(isValidWingetPackageId),
      selectedGroupIds,
    };
  };

  const getValidCustomPackageIds = () =>
    parseCustomWingetPackageIds(controls.customInput()?.value || "").filter(
      isValidWingetPackageId,
    );

  const getAllVisiblePackageIds = () =>
    getWingetPackageIdsFromSelection({
      customPackageIds: getValidCustomPackageIds(),
      selectedGroupIds: WINGET_PACKAGE_GROUPS.map((group) => group.id),
    });

  const saveSelection = () => {
    const selection = getSelection();
    const openCategoryIds = Array.from(
      view.querySelectorAll("[data-winget-category]"),
    )
      .filter((category) => category.open)
      .map((category) => category.dataset.wingetCategory);
    writeJsonStorage(TOOLS_STORAGE_KEYS.WINGET_INSTALLER_STATE, {
      customPackageIds: selection.customPackageIds,
      openCategoryIds,
      selectedGroupIds: selection.selectedGroupIds,
    });
  };

  const appendLog = (text, level = "info") => {
    const entry = { level, text: String(text || ""), ts: Date.now() };
    state.entries.push(entry);
    if (state.operationActive) {
      state.lastOperationEntries.push(entry);
    }
    if (state.entries.length > WINGET_LOG_MAX_ENTRIES) {
      state.entries = state.entries.slice(-WINGET_LOG_MAX_ENTRIES);
    }
    const logEl = controls.log();
    if (!logEl) return;
    logEl.replaceChildren();
    if (!state.entries.length) {
      logEl.textContent = t("tools.winget.log.placeholder");
      return;
    }
    state.entries.forEach((entry) => {
      const line = document.createElement("div");
      line.className = `winget-log-line is-${entry.level || "info"}`;
      const dt = new Date(entry.ts || Date.now());
      const pad = (value) => String(value).padStart(2, "0");
      const time = document.createElement("span");
      time.textContent = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
      const level = document.createElement("span");
      level.textContent = (entry.level || "info").toUpperCase();
      const message = document.createElement("span");
      message.textContent = entry.text || "";
      line.append(time, level, message);
      logEl.appendChild(line);
    });
    logEl.scrollTop = logEl.scrollHeight;
  };

  const revealLog = () => {
    const logBlock = controls.logBlock();
    logBlock?.classList.remove("hidden");
    if (logBlock) logBlock.open = true;
  };

  const updatePlatformUi = () => {
    const badge = getEl("winget-platform-badge", view);
    const banner = getEl("winget-platform-banner", view);
    if (state.isWindows) {
      if (badge) {
        badge.textContent = state.running
          ? t("tools.winget.platform.running")
          : state.checking
            ? t("tools.winget.platform.checking")
            : t("tools.winget.platform.ready");
        badge.className =
          state.running || state.checking
            ? "winget-badge is-running"
            : "winget-badge is-ready";
      }
      banner?.classList.add("hidden");
      return;
    }
    if (badge) {
      badge.textContent = t("tools.winget.platform.preview");
      badge.className = "winget-badge is-muted";
    }
    banner?.classList.remove("hidden");
  };

  const getModeLabel = (mode = state.mode) => {
    const key =
      mode === "upgrade"
        ? "tools.winget.mode.upgrade"
        : mode === "uninstall"
          ? "tools.winget.mode.uninstall"
          : "tools.winget.mode.install";
    return t(key);
  };

  const getTransientStatusForMode = (mode = state.mode) =>
    mode === "upgrade"
      ? "updating"
      : mode === "uninstall"
        ? "uninstalling"
        : "installing";

  const packageStatusKey = (packageId) => String(packageId || "").toLowerCase();

  const normalizeStatusItem = (item = {}) => ({
    availableVersion: String(item.availableVersion || ""),
    currentVersion: String(item.currentVersion || ""),
    packageId: String(item.packageId || ""),
    status: item.status || "unknown",
  });

  const getEffectiveStatusItem = (packageId) => {
    const key = packageStatusKey(packageId);
    return (
      state.transientStatusItems.get(key) ||
      state.statusItems.get(key) || {
        availableVersion: "",
        currentVersion: "",
        packageId,
        status: "unknown",
      }
    );
  };

  const setTransientStatuses = (packageIds = [], status) => {
    packageIds.filter(isValidWingetPackageId).forEach((packageId) => {
      state.transientStatusItems.set(packageStatusKey(packageId), {
        availableVersion: "",
        currentVersion: getEffectiveStatusItem(packageId).currentVersion || "",
        packageId,
        status,
      });
    });
    renderPackageStatuses();
  };

  const clearTransientStatuses = (packageIds = []) => {
    packageIds.forEach((packageId) => {
      state.transientStatusItems.delete(packageStatusKey(packageId));
    });
    renderPackageStatuses();
  };

  const mergeStatusItems = (items = []) => {
    (Array.isArray(items) ? items : []).forEach((item) => {
      const normalized = normalizeStatusItem(item);
      if (!isValidWingetPackageId(normalized.packageId)) return;
      state.statusItems.set(packageStatusKey(normalized.packageId), normalized);
    });
    state.lastStatusItems = Array.from(state.statusItems.values());
    renderPackageStatuses();
  };

  const renderStatusMeta = ({
    availableVersion = "",
    currentVersion = "",
    latestEl,
    status = "unknown",
    statusEl,
    versionEl,
  }) => {
    const formatVersionText = (key, version) => {
      const localized = t(key, { version });
      return localized.includes(version)
        ? localized
        : `${localized}: ${version}`;
    };
    if (statusEl) {
      statusEl.className = `winget-status-pill is-${status}`;
      statusEl.textContent = t(`tools.winget.status.${status}`);
    }
    if (versionEl) {
      versionEl.textContent = currentVersion
        ? formatVersionText("tools.winget.version.current", currentVersion)
        : t("tools.winget.version.empty");
    }
    if (latestEl) {
      latestEl.textContent = availableVersion
        ? formatVersionText("tools.winget.version.latest", availableVersion)
        : "";
      latestEl.classList.toggle("hidden", !availableVersion);
    }
  };

  const renderBuiltInPackageStatuses = () => {
    WINGET_PACKAGE_GROUPS.forEach((group) => {
      const items = group.packageIds.map(getEffectiveStatusItem);
      const aggregate = aggregateWingetPackageStatus(group.packageIds, items);
      renderStatusMeta({
        ...aggregate,
        latestEl: view.querySelector(
          `[data-winget-package-latest="${group.id}"]`,
        ),
        statusEl: view.querySelector(
          `[data-winget-package-status="${group.id}"]`,
        ),
        versionEl: view.querySelector(
          `[data-winget-package-version="${group.id}"]`,
        ),
      });
    });
  };

  const renderCustomPackageStatuses = () => {
    const list = controls.customStatusList();
    if (!list) return;
    const customPackageIds = parseCustomWingetPackageIds(
      controls.customInput()?.value || "",
    );
    const validPackageIds = customPackageIds.filter(isValidWingetPackageId);
    list.replaceChildren();
    validPackageIds.forEach((packageId) => {
      const item = getEffectiveStatusItem(packageId);
      const row = document.createElement("div");
      row.className = "winget-custom-status-row";

      const code = document.createElement("code");
      code.textContent = packageId;
      const statusEl = document.createElement("span");
      const versionEl = document.createElement("span");
      versionEl.className = "winget-package-version";
      const latestEl = document.createElement("span");
      latestEl.className = "winget-package-latest";

      renderStatusMeta({
        ...item,
        latestEl,
        statusEl,
        versionEl,
      });

      row.append(code, statusEl, versionEl, latestEl);
      list.appendChild(row);
    });
  };

  const renderPackageStatuses = () => {
    renderBuiltInPackageStatuses();
    renderCustomPackageStatuses();
  };

  const renderPreview = () => {
    const selection = getSelection();
    const packageIds = getRunnablePackageIds(selection.packageIds);
    const preview = controls.preview();
    if (preview) {
      preview.textContent = packageIds.length
        ? buildWingetScript(packageIds, state.mode)
        : t("tools.winget.script.empty");
    }
    const selectedCount = controls.selectedCount();
    if (selectedCount) {
      selectedCount.textContent = t("tools.winget.selectedCount", {
        count: packageIds.length,
      });
    }
    const scriptActionLabel = controls.scriptActionLabel();
    if (scriptActionLabel) {
      scriptActionLabel.textContent = t("tools.winget.script.actionLabel", {
        mode: getModeLabel(),
      });
    }
    const hasInvalid = selection.invalidPackageIds.length > 0;
    const hasPackages = packageIds.length > 0 && !hasInvalid;
    const customHint = getEl("winget-custom-hint", view);
    if (customHint) {
      customHint.textContent = hasInvalid
        ? t("tools.winget.custom.invalid", {
            ids: selection.invalidPackageIds.join(", "),
          })
        : t("tools.winget.custom.hint");
      customHint.classList.toggle("error", hasInvalid);
    }
    controls
      .runBtn()
      ?.toggleAttribute(
        "disabled",
        !hasPackages || !state.isWindows || state.running || state.checking,
      );
    controls
      .checkBtn()
      ?.toggleAttribute(
        "disabled",
        hasInvalid || !state.isWindows || state.running || state.checking,
      );
    saveSelection();
    renderCustomPackageStatuses();
  };

  const setMode = (mode) => {
    state.mode = ["install", "upgrade", "uninstall"].includes(mode)
      ? mode
      : "install";
    view.querySelectorAll("[data-winget-mode]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.wingetMode === state.mode,
      );
    });
    renderPreview();
  };

  const setRunning = (running) => {
    state.running = !!running;
    controls.cancelBtn()?.classList.toggle("hidden", !state.running);
    updatePlatformUi();
    renderPreview();
  };

  const setChecking = (checking) => {
    state.checking = !!checking;
    updatePlatformUi();
    renderPreview();
  };

  const getRunnablePackageIds = (packageIds = []) => packageIds;

  const renderStatuses = (items = []) => {
    mergeStatusItems(items);
    renderPreview();
  };

  const copyScript = async () => {
    const text = controls.preview()?.textContent || "";
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("tools.winget.toast.copied"), "success");
    } catch {
      showToast(t("tools.winget.toast.copyError"), "error");
    }
  };

  const copyLogEntries = async (entries = []) => {
    const text = entries.map(formatLogEntry).join("\n");
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("tools.winget.toast.logCopied"), "success");
    } catch {
      showToast(t("tools.winget.toast.copyError"), "error");
    }
  };

  const checkPackageStatus = async (
    packageIds = [],
    { silent = false } = {},
  ) => {
    const validPackageIds = packageIds.filter(isValidWingetPackageId);
    if (!validPackageIds.length || !state.isWindows || state.running) return;
    setTransientStatuses(validPackageIds, "checking");
    setChecking(true);
    if (!silent) appendLog(t("tools.winget.log.statusStart"));
    try {
      const result = await window.electron.tools.checkWingetStatus({
        packageIds: validPackageIds,
      });
      if (!result?.success) {
        if (!silent) {
          appendLog(
            result?.error || t("tools.winget.log.statusError"),
            "error",
          );
        }
        setTransientStatuses(validPackageIds, "error");
        return;
      }
      renderStatuses(result.items || []);
      clearTransientStatuses(validPackageIds);
      if (!silent) appendLog(t("tools.winget.log.statusDone"), "success");
    } catch (error) {
      setTransientStatuses(validPackageIds, "error");
      if (!silent) appendLog(error?.message || String(error), "error");
    } finally {
      setChecking(false);
    }
  };

  const checkStatus = async () => {
    const selection = getSelection();
    if (selection.invalidPackageIds.length) return;
    await checkPackageStatus(getAllVisiblePackageIds(), { silent: true });
  };

  const scheduleCustomStatusCheck = () => {
    if (customStatusTimer) clearTimeout(customStatusTimer);
    if (!state.isWindows || state.running || state.checking) return;
    const selection = getSelection();
    if (selection.invalidPackageIds.length) return;
    const customPackageIds = getValidCustomPackageIds();
    if (!customPackageIds.length) return;
    customStatusTimer = setTimeout(() => {
      checkPackageStatus(customPackageIds, { silent: true });
    }, WINGET_CUSTOM_STATUS_DEBOUNCE_MS);
  };

  const runInitialStatusCheck = () => {
    if (state.autoStatusChecked || !state.isWindows) return;
    state.autoStatusChecked = true;
    checkPackageStatus(getAllBuiltInWingetPackageIds(), { silent: true });
  };

  const runScript = async () => {
    const selection = getSelection();
    if (!selection.packageIds.length || selection.invalidPackageIds.length)
      return;
    state.runId = `winget-${Date.now()}`;
    const packageIds = getRunnablePackageIds(selection.packageIds);
    if (!packageIds.length) return;
    const runStatus = getTransientStatusForMode(state.mode);
    state.operationActive = true;
    state.lastOperationEntries = [];
    revealLog();
    appendLog(t("tools.winget.log.runStart", { mode: getModeLabel() }));
    setTransientStatuses(packageIds, runStatus);
    setRunning(true);
    try {
      const methods = {
        install: window.electron.tools.runWingetInstall,
        uninstall: window.electron.tools.runWingetUninstall,
        upgrade: window.electron.tools.runWingetUpdate,
      };
      const method = methods[state.mode] || methods.install;
      const result = await method({
        packageIds,
        runId: state.runId,
      });
      if (result?.success) {
        appendLog(t("tools.winget.log.runDone"), "success");
        clearTransientStatuses(packageIds);
        await checkPackageStatus(packageIds, { silent: true });
      } else {
        setTransientStatuses(packageIds, "error");
        appendLog(result?.error || t("tools.winget.log.runError"), "error");
      }
    } catch (error) {
      setTransientStatuses(packageIds, "error");
      appendLog(error?.message || String(error), "error");
    } finally {
      state.operationActive = false;
      setRunning(false);
      state.runId = "";
    }
  };

  const cancelRun = async () => {
    if (!state.runId) return;
    try {
      await window.electron.tools.cancelWingetRun({ runId: state.runId });
      appendLog(t("tools.winget.log.cancelled"), "warning");
    } catch (error) {
      appendLog(error?.message || String(error), "error");
    }
  };

  const applySavedState = () => {
    const saved = readSavedState();
    const selected = new Set(
      Array.isArray(saved?.selectedGroupIds) ? saved.selectedGroupIds : [],
    );
    controls.checkboxes().forEach((checkbox) => {
      checkbox.checked = selected.has(checkbox.dataset.wingetPackageGroup);
    });
    const customInput = controls.customInput();
    if (customInput && Array.isArray(saved?.customPackageIds)) {
      customInput.value = saved.customPackageIds.join("\n");
    }
  };

  const unsubscribeLog = window.electron?.on?.("tools:wingetLog", (entry) => {
    if (!entry || entry.runId !== state.runId) return;
    appendLog(entry.text, entry.level || "info");
  });
  cleanup.addCleanup(() => unsubscribeLog?.());
  cleanup.addCleanup(() => {
    if (customStatusTimer) clearTimeout(customStatusTimer);
  });

  const handleToolsViewChanged = (event) => {
    if (event?.detail?.toolView === "winget-installer") {
      runInitialStatusCheck();
    }
  };
  window.addEventListener("tools:view-changed", handleToolsViewChanged);
  cleanup.addCleanup(() => {
    window.removeEventListener("tools:view-changed", handleToolsViewChanged);
  });

  controls.checkboxes().forEach((checkbox) => {
    checkbox.addEventListener("change", renderPreview);
  });
  controls.customInput()?.addEventListener("input", () => {
    renderPreview();
    scheduleCustomStatusCheck();
  });
  getEl("winget-select-all", view)?.addEventListener("click", () => {
    controls.checkboxes().forEach((checkbox) => {
      checkbox.checked = true;
    });
    renderPreview();
  });
  getEl("winget-clear-selection", view)?.addEventListener("click", () => {
    controls.checkboxes().forEach((checkbox) => {
      checkbox.checked = false;
    });
    renderPreview();
  });
  getEl("winget-copy-script", view)?.addEventListener("click", copyScript);
  getEl("winget-copy-full-log", view)?.addEventListener("click", (event) => {
    event.preventDefault();
    copyLogEntries(state.entries);
  });
  getEl("winget-copy-operation-log", view)?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      copyLogEntries(state.lastOperationEntries);
    },
  );
  controls.checkBtn()?.addEventListener("click", checkStatus);
  controls.runBtn()?.addEventListener("click", runScript);
  controls.cancelBtn()?.addEventListener("click", cancelRun);
  view.querySelectorAll("[data-winget-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.wingetMode));
  });
  view.querySelectorAll("[data-winget-category]").forEach((category) => {
    category.addEventListener("toggle", saveSelection);
  });

  applySavedState();
  updatePlatformUi();
  renderPreview();
  renderPackageStatuses();
}

export { initWingetInstallerSection, renderWingetInstallerSection };
