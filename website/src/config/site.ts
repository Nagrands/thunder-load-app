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
  { id: "youtube", name: "YouTube", url: "https://www.youtube.com/" },
  { id: "twitch", name: "Twitch", url: "https://www.twitch.tv/" },
  { id: "vk", name: "VK Видео", url: "https://vkvideo.ru/" },
  { id: "coub", name: "Coub", url: "https://coub.com/" },
  { id: "tiktok", name: "TikTok", url: "https://www.tiktok.com/" },
  { id: "vimeo", name: "Vimeo", url: "https://vimeo.com/" },
  { id: "soundcloud", name: "SoundCloud", url: "https://soundcloud.com/" },
  { id: "dailymotion", name: "Dailymotion", url: "https://www.dailymotion.com/" }
] as const;

export const platforms = [
  {
    id: "windows",
    name: "Windows",
    requirements: "Windows 10/11",
    architectures: ["x64"]
  },
  {
    id: "macos",
    name: "macOS",
    requirements: "macOS 12+",
    architectures: ["Apple silicon", "Intel"]
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
