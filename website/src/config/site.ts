export const SITE = {
  name: "Thunder",
  releaseName: "Thunder Spark",
  repository: "https://github.com/Nagrands/thunder-load-app",
  releasesApi: "https://api.github.com/repos/Nagrands/thunder-load-app/releases?per_page=50",
  pagesOrigin: "https://nagrands.github.io",
  pagesBase: "/thunder-load-app",
  author: "NGR Software",
  social: {
    github: "https://github.com/Nagrands/thunder-load-app",
    telegram: null
  }
} as const;

export const supportedServices = [
  { id: "youtube", name: "YouTube", mark: "YT" },
  { id: "twitch", name: "Twitch", mark: "TW" },
  { id: "vk", name: "VK Видео", mark: "VK" },
  { id: "coub", name: "Coub", mark: "CB" }
] as const;

export const platforms = [
  {
    id: "windows",
    name: "Windows",
    status: "supported",
    requirements: "Windows 10/11",
    architectures: ["x64"]
  },
  {
    id: "macos",
    name: "macOS",
    status: "supported",
    requirements: "macOS 12+",
    architectures: ["Apple silicon", "Intel"]
  },
  {
    id: "linux",
    name: "Linux",
    status: "planned",
    requirements: "AppImage",
    architectures: ["x64"]
  }
] as const;

export const mediaGallery = [
  {
    id: "downloader",
    image: "thunder-download.png",
    labels: { ru: "Загрузчик", en: "Downloader" }
  },
  {
    id: "tools",
    image: "thunder-tools.png",
    labels: { ru: "Инструменты", en: "Tools" }
  },
  {
    id: "player",
    image: "thunder-player.png",
    labels: { ru: "Плеер", en: "Player"}
  }
] as const;

export type Locale = "ru" | "en";
export type PlatformId = (typeof platforms)[number]["id"];
