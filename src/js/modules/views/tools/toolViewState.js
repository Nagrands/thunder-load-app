import {
  TOOLS_STORAGE_KEYS,
  readBooleanStorage,
  readStorageValue,
  writeStorageValue,
} from "./storage.js";

const DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY = "__thunder_dev_tools_unlocked__";
const BACKUP_DISABLED_STORAGE_KEY = "backupDisabled";

function createToolViewState() {
  const state = {
    currentToolView: "launcher",
    toolsPlatformInfo: { isWindows: false, platform: "" },
    developerToolsUnlocked: false,
    isWindowsPlatform: false,
  };

  const readDeveloperToolsUnlocked = () => {
    try {
      return window[DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY] === true;
    } catch {
      return false;
    }
  };

  const setPlatformInfo = (info = {}) => {
    state.toolsPlatformInfo = {
      isWindows: !!info?.isWindows,
      platform: String(info?.platform || ""),
    };
    state.isWindowsPlatform = !!state.toolsPlatformInfo.isWindows;
    state.developerToolsUnlocked = readDeveloperToolsUnlocked();
    return state.toolsPlatformInfo;
  };

  const setDeveloperToolsUnlocked = (enabled) => {
    state.developerToolsUnlocked = !!enabled;
    try {
      window[DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY] = state.developerToolsUnlocked;
    } catch {}
    return state.developerToolsUnlocked;
  };

  const isPowerToolSupportedPlatform = (info = state.toolsPlatformInfo) => {
    const platform = String(info?.platform || "");
    return !!info?.isWindows || platform === "darwin";
  };

  const isPowerToolAvailable = (info = state.toolsPlatformInfo) => {
    const platform = String(info?.platform || "");
    if (info?.isWindows) return true;
    if (platform === "darwin") return state.developerToolsUnlocked;
    return false;
  };

  const isToolAvailable = (toolView, info = state.toolsPlatformInfo) => {
    if (toolView === "power") return isPowerToolAvailable(info);
    if (toolView === "sorter") return true;
    if (toolView === "media-inspector") return true;
    if (toolView === "backup") {
      return !readBooleanStorage(BACKUP_DISABLED_STORAGE_KEY, false);
    }
    return toolView === "launcher" || toolView === "wg" || toolView === "hash";
  };

  const readLastToolView = () =>
    readStorageValue(TOOLS_STORAGE_KEYS.LAST_TOOL_VIEW, "launcher") ||
    "launcher";

  const shouldRememberLastToolView = () =>
    readBooleanStorage(TOOLS_STORAGE_KEYS.REMEMBER_LAST_VIEW, false);

  const resolveInitialToolView = () => {
    if (!shouldRememberLastToolView()) return "launcher";
    const remembered = readLastToolView();
    return isToolAvailable(remembered) ? remembered : "launcher";
  };

  const setCurrentToolView = (nextView) => {
    state.currentToolView = String(nextView || "launcher");
    return state.currentToolView;
  };

  const persistCurrentToolView = (nextView) => {
    if (!shouldRememberLastToolView()) return;
    writeStorageValue(TOOLS_STORAGE_KEYS.LAST_TOOL_VIEW, nextView);
  };

  return {
    get currentToolView() {
      return state.currentToolView;
    },
    get developerToolsUnlocked() {
      return state.developerToolsUnlocked;
    },
    get isWindowsPlatform() {
      return state.isWindowsPlatform;
    },
    get toolsPlatformInfo() {
      return state.toolsPlatformInfo;
    },
    isPowerToolAvailable,
    isPowerToolSupportedPlatform,
    isToolAvailable,
    persistCurrentToolView,
    readDeveloperToolsUnlocked,
    resolveInitialToolView,
    setCurrentToolView,
    setDeveloperToolsUnlocked,
    setPlatformInfo,
  };
}

export { createToolViewState };
