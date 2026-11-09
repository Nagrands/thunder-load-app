export const QUALITY_PROFILE_KEY = "downloadQualityProfile";
export const QUALITY_PROFILE_DEFAULT = "remember"; // remember | best | audio

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
    showToolsStatus: true,
  },
  appearance: {
    theme: "system",
    fontSize: "16",
    lowEffects: false,
  },
  shortcuts: {
    disableGlobalShortcuts: false,
    assignments: null,
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
