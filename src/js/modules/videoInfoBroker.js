import { getCachedVideoInfo, setCachedVideoInfo } from "./videoInfoCache.js";

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const LIVE_TTL_MS = 60 * 1000;

const getState = () => {
  if (!window.__videoInfoBrokerState) {
    window.__videoInfoBrokerState = {
      previewCache: new Map(),
      previewInFlight: new Map(),
      infoInFlight: new Map(),
    };
  }
  return window.__videoInfoBrokerState;
};

const normalize = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
};

const getInvoke = () =>
  window?.electron?.ipcRenderer?.invoke || window?.electron?.invoke || null;

const getTtl = (info) =>
  info?.is_live || info?.live_status ? LIVE_TTL_MS : DEFAULT_TTL_MS;

const isFresh = (entry) => Boolean(entry && Date.now() - entry.createdAt < entry.ttl);

const hasFormats = (info) => Array.isArray(info?.formats) && info.formats.length > 0;

const toPreviewInfo = (info) => {
  if (!info) return info;
  return {
    ...info,
    formats: [],
    entries: Array.isArray(info.entries)
      ? info.entries.map((entry) => ({
          ...entry,
          formats: [],
        }))
      : info.entries,
  };
};

const storePreview = (key, info) => {
  if (!key || !info?.success) return;
  const state = getState();
  state.previewCache.set(key, {
    info: toPreviewInfo(info),
    createdAt: Date.now(),
    ttl: getTtl(info),
  });
};

function getVideoPreview(url, options = {}) {
  const key = normalize(url);
  if (!key) return Promise.resolve(null);
  const { force = false } = options;
  const state = getState();

  if (!force) {
    const fullCached = getCachedVideoInfo(key);
    if (fullCached?.success) {
      return toPreviewInfo(fullCached);
    }
    const cachedPreview = state.previewCache.get(key);
    if (isFresh(cachedPreview)) {
      return cachedPreview.info;
    }
    if (state.infoInFlight.has(key)) {
      return state.infoInFlight.get(key).then(toPreviewInfo);
    }
    if (state.previewInFlight.has(key)) {
      return state.previewInFlight.get(key);
    }
  }

  const invoke = getInvoke();
  if (typeof invoke !== "function") {
    return Promise.resolve(null);
  }

  const request = Promise.resolve(invoke("get-video-preview", key));
  request
    .then((info) => {
      if (info?.success) {
        storePreview(key, info);
      }
    })
    .catch(() => {})
    .finally(() => {
      state.previewInFlight.delete(key);
    });

  state.previewInFlight.set(key, request);
  return request;
}

function getVideoInfo(url, options = {}) {
  const key = normalize(url);
  if (!key) return Promise.resolve(null);
  const { force = false } = options;
  const state = getState();

  if (!force) {
    const cached = getCachedVideoInfo(key);
    if (cached?.success && hasFormats(cached)) {
      return Promise.resolve(cached);
    }
    if (state.infoInFlight.has(key)) {
      return state.infoInFlight.get(key);
    }
  }

  const invoke = getInvoke();
  if (typeof invoke !== "function") {
    return Promise.resolve(null);
  }

  const request = Promise.resolve(invoke("get-video-info", key));
  request
    .then((info) => {
      if (info?.success) {
        setCachedVideoInfo(key, info);
        storePreview(key, info);
      }
    })
    .catch(() => {})
    .finally(() => {
      state.infoInFlight.delete(key);
    });

  state.infoInFlight.set(key, request);
  return request;
}

function clearVideoInfoBrokerCache(url = "") {
  const state = getState();
  if (!url) {
    state.previewCache.clear();
    state.previewInFlight.clear();
    state.infoInFlight.clear();
    return;
  }
  const key = normalize(url);
  state.previewCache.delete(key);
  state.previewInFlight.delete(key);
  state.infoInFlight.delete(key);
}

export { clearVideoInfoBrokerCache, getVideoInfo, getVideoPreview };
