const NETWORK_PROVIDER_ID = "network";

function createProviderError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeNetworkUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export class NetworkMediaProvider {
  constructor() {
    this.id = NETWORK_PROVIDER_ID;
  }

  async importSource() {
    throw createProviderError(
      "NETWORK_IMPORT_UNAVAILABLE",
      "Network media is imported through a playlist",
    );
  }

  restore(descriptor = {}) {
    const tracks = Array.isArray(descriptor)
      ? descriptor
      : descriptor.tracks || [];
    return tracks.filter((track) => normalizeNetworkUrl(track?.sourceRef));
  }

  async resolveTrack(track) {
    const src = normalizeNetworkUrl(track?.sourceRef);
    if (!src) {
      throw createProviderError(
        "INVALID_NETWORK_MEDIA_URL",
        "A valid HTTP(S) media URL is required",
      );
    }
    const isHls = /\.m3u8(?:$|[?#])/i.test(src);
    return {
      kind: isHls ? "hls" : "direct",
      src,
      mimeType: String(
        track?.mimeType ||
          (isHls ? "application/vnd.apple.mpegurl" : ""),
      ),
      posterUrl: String(track?.artworkUrl || ""),
    };
  }

  dispose() {}
}

export { normalizeNetworkUrl };
export default NetworkMediaProvider;
