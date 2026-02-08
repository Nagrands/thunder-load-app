const getCache = () => {
  if (!window.__videoInfoCache) {
    window.__videoInfoCache = new Map();
  }
  return window.__videoInfoCache;
};

const normalize = (value) => {
  try {
    const url = new URL(String(value).trim());
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
};

function setCachedVideoInfo(url, info) {
  if (!info || !url) return;
  const cache = getCache();
  const keyA = String(url || "");
  const keyB = normalize(url);
  const payload = {
    title: info.title || info.name || "",
    url: info.webpage_url || info.original_url || url,
  };
  if (keyA) cache.set(keyA, payload);
  if (keyB) cache.set(keyB, payload);
}

function getCachedVideoInfo(url) {
  if (!url) return null;
  const cache = getCache();
  const keyA = String(url || "");
  const keyB = normalize(url);
  return cache.get(keyA) || cache.get(keyB) || null;
}

export { getCachedVideoInfo, setCachedVideoInfo };
