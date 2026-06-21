function normalizeDefaultTabId(tabId) {
  return tabId === "backup" ? "wireguard" : tabId;
}

const getDefaultTab = () => window.electron.invoke("get-default-tab");
const setDefaultTab = (tabId) =>
  window.electron.invoke("set-default-tab", normalizeDefaultTabId(tabId));

export { getDefaultTab, normalizeDefaultTabId, setDefaultTab };
