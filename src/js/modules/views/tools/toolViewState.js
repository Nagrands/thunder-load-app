import {
  DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY,
  readDeveloperModeEnabled,
} from "../../developerMode.js";

function createToolViewState() {
  const state = {
    currentToolView: "launcher",
    toolsPlatformInfo: { isWindows: false, platform: "" },
    developerToolsUnlocked: false,
    isWindowsPlatform: false,
  };

  const readDeveloperToolsUnlocked = () => readDeveloperModeEnabled();

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
    if (toolView === "media-converter") return true;
    if (toolView === "backup") return true;
    return (
      toolView === "launcher" ||
      toolView === "wg" ||
      toolView === "hash" ||
      toolView === "downloader-tools"
    );
  };

  const resolveInitialToolView = () => "launcher";

  const setCurrentToolView = (nextView) => {
    state.currentToolView = String(nextView || "launcher");
    return state.currentToolView;
  };

  const persistCurrentToolView = () => {};

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
