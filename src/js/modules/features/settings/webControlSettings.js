import { t } from "../../i18n.js";
import { onOpenSettings } from "./openSettingsBus.js";

const CONTROLLERS = new WeakMap();

function getElements() {
  const toggle = document.getElementById("settings-web-control-toggle");
  const urlInput = document.getElementById("settings-web-control-url");
  const lanUrlInput = document.getElementById("settings-web-control-lan-url");
  const statusEl = document.getElementById("settings-web-control-status");
  const openBtn = document.getElementById("settings-web-control-open");
  const restartBtn = document.getElementById("settings-web-control-restart");
  const copyLanBtn = document.getElementById("settings-web-control-copy-lan");
  if (
    !toggle ||
    !urlInput ||
    !lanUrlInput ||
    !statusEl ||
    !openBtn ||
    !restartBtn ||
    !copyLanBtn
  ) {
    return null;
  }

  return {
    toggle,
    urlInput,
    lanUrlInput,
    statusEl,
    openBtn,
    restartBtn,
    copyLanBtn,
  };
}

function getStatusKey({ enabled, running }) {
  if (running) return "settings.web.status.on";
  return enabled ? "settings.web.status.starting" : "settings.web.status.off";
}

function renderWebControlStatus(elements, status = {}) {
  const enabled = status.enabled === true;
  const running = status.running === true;
  const lanUrl = Array.isArray(status.lanUrls) ? status.lanUrls[0] || "" : "";
  elements.toggle.checked = enabled;
  elements.urlInput.value = status.localUrl || status.url || "";
  elements.lanUrlInput.value = lanUrl;
  elements.openBtn.disabled = !running || !elements.urlInput.value;
  elements.restartBtn.disabled = !enabled;
  elements.copyLanBtn.disabled = !running || !lanUrl;
  const key = getStatusKey({ enabled, running });
  elements.statusEl
    .closest(".settings-web-control-panel__status-row")
    ?.classList.toggle("is-running", running);
  elements.statusEl.setAttribute("data-i18n", key);
  elements.statusEl.textContent = t(key, { port: status.port || "" });
}

function createWebControlController(elements) {
  const abortController = new AbortController();
  let operationVersion = 0;

  const render = (status) => {
    renderWebControlStatus(elements, status);
  };

  const runLatest = async (operation) => {
    const version = ++operationVersion;
    const result = await operation();
    if (version === operationVersion && result?.success) {
      render(result.status);
    }
    return result;
  };

  const refresh = async () => {
    try {
      await runLatest(() => window.electron.invoke("web:getStatus"));
    } catch (error) {
      console.error("[settings] web status failed:", error);
    }
  };

  elements.toggle.addEventListener(
    "change",
    async () => {
      elements.toggle.disabled = true;
      render({ enabled: elements.toggle.checked, running: false });
      try {
        await runLatest(() =>
          window.electron.invoke("web:setEnabled", elements.toggle.checked),
        );
      } catch (error) {
        console.error("[settings] web toggle failed:", error);
      } finally {
        elements.toggle.disabled = false;
      }
    },
    { signal: abortController.signal },
  );

  elements.openBtn.addEventListener(
    "click",
    async () => {
      try {
        await runLatest(() => window.electron.invoke("web:open"));
      } catch (error) {
        console.error("[settings] web open failed:", error);
      }
    },
    { signal: abortController.signal },
  );

  elements.copyLanBtn.addEventListener(
    "click",
    async () => {
      const value = elements.lanUrlInput.value.trim();
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        await window.electron.invoke(
          "toast",
          t("settings.web.copyLanDone"),
          "success",
        );
      } catch (error) {
        console.error("[settings] web LAN copy failed:", error);
      }
    },
    { signal: abortController.signal },
  );

  elements.restartBtn.addEventListener(
    "click",
    async () => {
      elements.restartBtn.disabled = true;
      try {
        await runLatest(() => window.electron.invoke("web:restart"));
      } catch (error) {
        console.error("[settings] web restart failed:", error);
      } finally {
        elements.restartBtn.disabled = false;
      }
    },
    { signal: abortController.signal },
  );

  return {
    refresh,
    destroy: () => abortController.abort(),
  };
}

function initWebControlSettings() {
  const elements = getElements();
  if (!elements) return null;

  const existingController = CONTROLLERS.get(elements.toggle);
  existingController?.destroy();

  const controller = createWebControlController(elements);
  CONTROLLERS.set(elements.toggle, controller);
  onOpenSettings("web-control", controller.refresh);
  controller.refresh();
  return controller;
}

export { initWebControlSettings, renderWebControlStatus };
