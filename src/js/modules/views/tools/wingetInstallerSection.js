import {
  WINGET_PACKAGE_GROUPS,
  buildWingetScript,
  getWingetPackageIdsFromSelection,
  isValidWingetPackageId,
  parseCustomWingetPackageIds,
} from "./wingetPackages.js";
import {
  TOOLS_STORAGE_KEYS,
  readJsonStorage,
  writeJsonStorage,
} from "./storage.js";

const WINGET_LOG_MAX_ENTRIES = 400;

function renderWingetInstallerSection(t) {
  const packageItems = WINGET_PACKAGE_GROUPS.map(
    (group) => `
      <label class="winget-package-item" for="winget-package-${group.id}">
        <input
          id="winget-package-${group.id}"
          type="checkbox"
          data-winget-package-group="${group.id}"
        />
        <span>
          <strong>${group.label}</strong>
          <small>${group.packageIds.join(", ")}</small>
        </span>
      </label>
    `,
  ).join("");

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

        <div class="winget-installer__layout">
          <section class="winget-panel winget-panel--packages" aria-label="${t("tools.winget.packages.title")}">
            <div class="winget-panel__header">
              <h3 data-i18n="tools.winget.packages.title">${t("tools.winget.packages.title")}</h3>
              <div class="winget-panel__actions">
                <button id="winget-select-all" type="button" class="small-button" data-i18n="tools.winget.selectAll">${t("tools.winget.selectAll")}</button>
                <button id="winget-clear-selection" type="button" class="small-button" data-i18n="tools.winget.clearSelection">${t("tools.winget.clearSelection")}</button>
              </div>
            </div>
            <div class="winget-package-grid">
              ${packageItems}
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
            </label>
          </section>

          <section class="winget-panel winget-panel--script" aria-label="${t("tools.winget.script.title")}">
            <div class="winget-panel__header">
              <h3 data-i18n="tools.winget.script.title">${t("tools.winget.script.title")}</h3>
              <div class="winget-panel__actions">
                <button
                  id="winget-copy-script"
                  type="button"
                  class="small-button"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-i18n-title="tools.winget.copyScript"
                  data-i18n-aria="tools.winget.copyScript"
                  title="${t("tools.winget.copyScript")}"
                  aria-label="${t("tools.winget.copyScript")}"
                >
                  <i class="fa-solid fa-copy"></i>
                </button>
                <button id="winget-mode-install" type="button" class="small-button is-active" data-winget-mode="install" data-i18n="tools.winget.mode.install">${t("tools.winget.mode.install")}</button>
                <button id="winget-mode-upgrade" type="button" class="small-button" data-winget-mode="upgrade" data-i18n="tools.winget.mode.upgrade">${t("tools.winget.mode.upgrade")}</button>
              </div>
            </div>
            <pre id="winget-script-preview" class="winget-script-preview"></pre>
            <div class="winget-run-actions">
              <button id="winget-check-status" type="button" class="large-button secondary">
                <i class="fa-solid fa-magnifying-glass"></i>
                <span data-i18n="tools.winget.checkStatus">${t("tools.winget.checkStatus")}</span>
              </button>
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

        <section class="winget-status-panel" aria-label="${t("tools.winget.status.title")}">
          <div class="winget-panel__header">
            <h3 data-i18n="tools.winget.status.title">${t("tools.winget.status.title")}</h3>
            <span id="winget-status-summary" class="muted" data-i18n="tools.winget.status.empty">${t("tools.winget.status.empty")}</span>
          </div>
          <div class="winget-status-table-wrap">
            <table class="winget-status-table">
              <thead>
                <tr>
                  <th data-i18n="tools.winget.status.package">${t("tools.winget.status.package")}</th>
                  <th data-i18n="tools.winget.status.state">${t("tools.winget.status.state")}</th>
                  <th data-i18n="tools.winget.status.current">${t("tools.winget.status.current")}</th>
                  <th data-i18n="tools.winget.status.latest">${t("tools.winget.status.latest")}</th>
                </tr>
              </thead>
              <tbody id="winget-status-body">
                <tr>
                  <td colspan="4" class="muted" data-i18n="tools.winget.status.empty">${t("tools.winget.status.empty")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <details class="winget-log-block" open>
          <summary>
            <i class="fa-solid fa-terminal"></i>
            <span data-i18n="tools.winget.log.title">${t("tools.winget.log.title")}</span>
          </summary>
          <pre id="winget-live-log" class="winget-live-log" data-i18n="tools.winget.log.placeholder">${t("tools.winget.log.placeholder")}</pre>
        </details>
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
    entries: [],
    isWindows: !!platformInfo?.isWindows,
    mode: "install",
    runId: "",
    running: false,
  };

  const controls = {
    checkboxes: () =>
      Array.from(view.querySelectorAll("[data-winget-package-group]")),
    customInput: () => getEl("winget-custom-packages", view),
    log: () => getEl("winget-live-log", view),
    preview: () => getEl("winget-script-preview", view),
    runBtn: () => getEl("winget-run-script", view),
    cancelBtn: () => getEl("winget-cancel-run", view),
    checkBtn: () => getEl("winget-check-status", view),
    statusBody: () => getEl("winget-status-body", view),
    statusSummary: () => getEl("winget-status-summary", view),
  };

  const readSavedState = () =>
    readJsonStorage(TOOLS_STORAGE_KEYS.WINGET_INSTALLER_STATE, {
      customPackageIds: [],
      selectedGroupIds: WINGET_PACKAGE_GROUPS.map((group) => group.id),
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

  const saveSelection = () => {
    const selection = getSelection();
    writeJsonStorage(TOOLS_STORAGE_KEYS.WINGET_INSTALLER_STATE, {
      customPackageIds: selection.customPackageIds,
      selectedGroupIds: selection.selectedGroupIds,
    });
  };

  const appendLog = (text, level = "info") => {
    state.entries.push({ level, text: String(text || ""), ts: Date.now() });
    if (state.entries.length > WINGET_LOG_MAX_ENTRIES) {
      state.entries = state.entries.slice(-WINGET_LOG_MAX_ENTRIES);
    }
    const logEl = controls.log();
    if (!logEl) return;
    logEl.textContent = state.entries.length
      ? state.entries.map(formatLogEntry).join("\n")
      : t("tools.winget.log.placeholder");
    logEl.scrollTop = logEl.scrollHeight;
  };

  const updatePlatformUi = () => {
    const badge = getEl("winget-platform-badge", view);
    const banner = getEl("winget-platform-banner", view);
    if (state.isWindows) {
      if (badge) {
        badge.textContent = t("tools.winget.platform.ready");
        badge.className = "winget-badge is-ready";
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

  const renderPreview = () => {
    const selection = getSelection();
    const preview = controls.preview();
    if (preview) {
      preview.textContent = selection.packageIds.length
        ? buildWingetScript(selection.packageIds, state.mode)
        : t("tools.winget.script.empty");
    }
    const hasInvalid = selection.invalidPackageIds.length > 0;
    const hasPackages = selection.packageIds.length > 0 && !hasInvalid;
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
        !hasPackages || !state.isWindows || state.running,
      );
    controls
      .checkBtn()
      ?.toggleAttribute(
        "disabled",
        !hasPackages || !state.isWindows || state.running,
      );
    saveSelection();
  };

  const setMode = (mode) => {
    state.mode = mode === "upgrade" ? "upgrade" : "install";
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
    controls
      .runBtn()
      ?.toggleAttribute("disabled", state.running || !state.isWindows);
    controls
      .checkBtn()
      ?.toggleAttribute("disabled", state.running || !state.isWindows);
    controls.cancelBtn()?.classList.toggle("hidden", !state.running);
  };

  const renderStatuses = (items = []) => {
    const body = controls.statusBody();
    if (!body) return;
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="4" class="muted">${t("tools.winget.status.empty")}</td></tr>`;
      const summary = controls.statusSummary();
      if (summary) summary.textContent = t("tools.winget.status.empty");
      return;
    }
    body.innerHTML = items
      .map((item) => {
        const statusKey = `tools.winget.status.${item.status || "unknown"}`;
        return `
          <tr>
            <td><code>${item.packageId || ""}</code></td>
            <td><span class="winget-status-pill is-${item.status || "unknown"}">${t(statusKey)}</span></td>
            <td>${item.currentVersion || "-"}</td>
            <td>${item.availableVersion || "-"}</td>
          </tr>
        `;
      })
      .join("");
    const updateCount = items.filter(
      (item) => item.status === "updateAvailable",
    ).length;
    const summary = controls.statusSummary();
    if (summary) {
      summary.textContent = updateCount
        ? t("tools.winget.status.updates", { count: updateCount })
        : t("tools.winget.status.checked", { count: items.length });
    }
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

  const checkStatus = async () => {
    const selection = getSelection();
    if (!selection.packageIds.length || selection.invalidPackageIds.length)
      return;
    appendLog(t("tools.winget.log.statusStart"));
    try {
      const result = await window.electron.tools.checkWingetStatus({
        packageIds: selection.packageIds,
      });
      if (!result?.success) {
        appendLog(result?.error || t("tools.winget.log.statusError"), "error");
        return;
      }
      renderStatuses(result.items || []);
      appendLog(t("tools.winget.log.statusDone"));
    } catch (error) {
      appendLog(error?.message || String(error), "error");
    }
  };

  const runScript = async () => {
    const selection = getSelection();
    if (!selection.packageIds.length || selection.invalidPackageIds.length)
      return;
    state.runId = `winget-${Date.now()}`;
    appendLog(t("tools.winget.log.runStart", { mode: state.mode }));
    setRunning(true);
    try {
      const method =
        state.mode === "upgrade"
          ? window.electron.tools.runWingetUpdate
          : window.electron.tools.runWingetInstall;
      const result = await method({
        packageIds: selection.packageIds,
        runId: state.runId,
      });
      if (result?.success) {
        appendLog(t("tools.winget.log.runDone"));
        await checkStatus();
      } else {
        appendLog(result?.error || t("tools.winget.log.runError"), "error");
      }
    } catch (error) {
      appendLog(error?.message || String(error), "error");
    } finally {
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
      Array.isArray(saved?.selectedGroupIds)
        ? saved.selectedGroupIds
        : WINGET_PACKAGE_GROUPS.map((group) => group.id),
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

  controls.checkboxes().forEach((checkbox) => {
    checkbox.addEventListener("change", renderPreview);
  });
  controls.customInput()?.addEventListener("input", renderPreview);
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
  controls.checkBtn()?.addEventListener("click", checkStatus);
  controls.runBtn()?.addEventListener("click", runScript);
  controls.cancelBtn()?.addEventListener("click", cancelRun);
  view.querySelectorAll("[data-winget-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.wingetMode));
  });

  applySavedState();
  updatePlatformUi();
  renderPreview();
  renderStatuses();
}

export { initWingetInstallerSection, renderWingetInstallerSection };
