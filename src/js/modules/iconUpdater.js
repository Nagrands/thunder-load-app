// src/js/modules/iconUpdater.js

import { urlInput } from "./domElements.js";
import { updateButtonState } from "./state.js";

const DEFAULT_SERVICE = "default";
const SERVICE_ICONS = {
  default: ["fa-solid", "fa-globe"],
  youtube: ["fa-brands", "fa-youtube"],
  twitch: ["fa-brands", "fa-twitch"],
  vkvideo: ["fa-brands", "fa-vk"],
  coub: ["fa-solid", "fa-video"],
};

function parseUrl(value) {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return null;

  try {
    const parsedUrl = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue)
        ? trimmedValue
        : `https://${trimmedValue}`,
    );
    return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl : null;
  } catch {
    return null;
  }
}

function isDomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function detectUrlService(value) {
  const parsedUrl = parseUrl(value);
  if (!parsedUrl) return DEFAULT_SERVICE;

  const hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, "");
  const pathname = parsedUrl.pathname.toLowerCase();

  if (isDomain(hostname, "youtube.com") || isDomain(hostname, "youtu.be")) {
    return "youtube";
  }
  if (isDomain(hostname, "twitch.tv")) return "twitch";
  if (
    isDomain(hostname, "vkvideo.ru") ||
    (isDomain(hostname, "vk.com") && pathname.startsWith("/video"))
  ) {
    return "vkvideo";
  }
  if (isDomain(hostname, "coub.com")) return "coub";

  return DEFAULT_SERVICE;
}

function getIconMount() {
  return document.getElementById("icon-url-globe");
}

function updateIcon(url) {
  const icon = getIconMount();
  if (!icon) return;

  const service = detectUrlService(url);
  icon.className = `${SERVICE_ICONS[service].join(" ")} search-icon url-service-icon url-service-icon--${service}`;
  icon.dataset.service = service;
}

function initIconUpdater() {
  if (!urlInput) return;

  updateIcon(urlInput.value);
  const syncIcon = () => updateIcon(urlInput.value);
  urlInput.addEventListener("input", () => {
    syncIcon();
    updateButtonState();
  });
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") syncIcon();
  });
  document.getElementById("clear-url")?.addEventListener("click", () => {
    syncIcon();
  });
}

export { detectUrlService, updateIcon, initIconUpdater };
