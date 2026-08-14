const URL_PATTERN = /(https?:\/\/[^\s'"<>]+)/gi;

function canonicalizeBatchUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "si",
      "spm",
      "fbclid",
      "gclid",
      "yclid",
      "mc_cid",
      "mc_eid",
      "feature",
    ];
    trackingParams.forEach((key) => url.searchParams.delete(key));
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") {
      const videoId = url.pathname.replace(/^\/+/, "");
      if (videoId) {
        url.hostname = "www.youtube.com";
        url.pathname = "/watch";
        url.searchParams.set("v", videoId);
      }
    }
    if (!/^t=/.test(url.hash.slice(1))) url.hash = "";
    url.username = "";
    url.password = "";
    if (/(^|\.)youtube\.com$/.test(url.hostname) && url.searchParams.has("v")) {
      url.searchParams.delete("list");
    }
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
}

function extractBatchUrls(text) {
  const source = String(text || "");
  const matches = source.match(URL_PATTERN) || [];
  if (matches.length) return matches.map((value) => value.replace(/[,;]+$/, ""));
  return source
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\//i.test(value));
}

function parseBatchText(
  text,
  { isValidUrl = () => true, isSupportedUrl = () => true } = {},
) {
  const seen = new Set();
  const result = { valid: [], duplicates: [], unsupported: [] };
  extractBatchUrls(text).forEach((rawUrl, index) => {
    const url = canonicalizeBatchUrl(rawUrl);
    const item = { id: `batch-${index}`, index: index + 1, rawUrl, url };
    if (!isValidUrl(url) || !isSupportedUrl(url)) {
      result.unsupported.push({
        ...item,
        available: false,
        title: rawUrl,
        reviewStatus: "unsupported",
      });
      return;
    }
    if (seen.has(url)) {
      result.duplicates.push({
        ...item,
        available: false,
        title: rawUrl,
        reviewStatus: "duplicate",
      });
      return;
    }
    seen.add(url);
    result.valid.push({
      ...item,
      available: true,
      title: url,
      reviewStatus: "valid",
    });
  });
  return result;
}

function normalizePlaylistItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const url = canonicalizeBatchUrl(item?.url || "");
      if (!url && item?.available !== false) return null;
      return {
        id: String(item?.id || `playlist-${index}`),
        index: Number(item?.index) || index + 1,
        url,
        title: String(item?.title || url),
        duration: Math.max(0, Number(item?.duration) || 0),
        thumbnail: String(item?.thumbnail || ""),
        uploader: String(item?.uploader || ""),
        available: item?.available !== false,
        reviewStatus: item?.available === false ? "unavailable" : "valid",
      };
    })
    .filter(Boolean);
}

export {
  canonicalizeBatchUrl,
  extractBatchUrls,
  normalizePlaylistItems,
  parseBatchText,
};
