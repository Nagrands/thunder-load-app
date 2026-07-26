export const QUALITY_PROFILE_KEY = "downloadQualityProfile";
export const QUALITY_PROFILE_DEFAULT = "remember"; // remember | best | audio
export const DEFAULT_PLAYER_SETTINGS = Object.freeze({
  sidebarPinned: false,
  backgroundPlayback: true,
  shuffle: false,
  repeat: "off",
  volume: 1,
  muted: false,
});

export const DEFAULT_CONFIG = {
  general: {
    autoLaunch: false,
    minimizeOnLaunch: false,
    minimizeInsteadOfClose: false,
    minimizeToTray: false,
    closeNotification: true,
    firstRunCompleted: false,
  },
  window: {
    defaultTab: "download",
    expandWindowOnDownloadComplete: false,
    openOnCopyUrl: false,
    disableCompleteModal: true,
    downloadQualityProfile: QUALITY_PROFILE_DEFAULT,
    autoOpenQualityModal: true,
    showToolsStatus: true,
  },
  appearance: {
    theme: "system",
    fontSize: "16",
    lowEffects: false,
  },
  player: { ...DEFAULT_PLAYER_SETTINGS },
  shortcuts: {
    disableGlobalShortcuts: false,
    assignments: null,
  },
  modules: {
    wgUnlockDisabled: true,
    backupDisabled: false,
  },
  backup: {
    viewMode: "full",
    logVisible: true,
  },
  wg: {
    autosend: false,
    rememberLastTool: false,
  },
  tools: {
    resetLocation: false,
    locationPath: null,
  },
  ytDlp: {
    cookies: {
      mode: "off",
      browser: "chrome",
      filePath: "",
    },
  },
};
