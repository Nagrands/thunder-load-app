const TAB_MODE_MAP = {
  download: "downloader",
  wireguard: "tools",
  backup: "backup",
};

const TOOL_MODE_MAP = {
  launcher: "tools",
  wg: "tools",
  hash: "tools",
  "media-inspector": "tools",
  power: "tools",
  sorter: "tools",
  backup: "backup",
};

function setBodyDataset(key, value) {
  if (!document.body) return;
  if (!value) {
    delete document.body.dataset[key];
    return;
  }
  document.body.dataset[key] = value;
}

function setPageMode(mode) {
  setBodyDataset("pageMode", mode || "downloader");
}

function setModalMode(mode) {
  setBodyDataset("modalMode", mode || "");
}

function handleTabsActivated(event) {
  const id = String(event?.detail?.id || "").trim();
  setPageMode(TAB_MODE_MAP[id] || "downloader");
}

function handleToolViewChanged(event) {
  const toolView = String(event?.detail?.toolView || "").trim();
  if (!toolView) return;
  setPageMode(TOOL_MODE_MAP[toolView] || "tools");
}

export function initPageBackgroundMode() {
  setPageMode(document.body?.dataset?.pageMode || "downloader");

  window.addEventListener("tabs:activated", handleTabsActivated);
  window.addEventListener("tools:view-changed", handleToolViewChanged);
  window.addEventListener("settings:opened", () => setModalMode("settings"));
  window.addEventListener("settings:closed", () => setModalMode(""));
}
