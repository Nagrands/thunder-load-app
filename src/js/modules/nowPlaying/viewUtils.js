export function formatPlaybackTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatMediaSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const amount = bytes / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
}

export function formatMediaResolution(mediaInfo = {}) {
  const height = Math.max(0, Number(mediaInfo.height) || 0);
  const width = Math.max(0, Number(mediaInfo.width) || 0);
  if (!height && !width) return "";
  if (height >= 2160) return "4K";
  if (height >= 1440) return "1440p";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height) return `${Math.round(height)}p`;
  return `${Math.round(width)}px`;
}

export function formatMediaDimensions(mediaInfo = {}) {
  const width = Math.max(0, Math.round(Number(mediaInfo.width) || 0));
  const height = Math.max(0, Math.round(Number(mediaInfo.height) || 0));
  if (width && height) return `${width} × ${height}`;
  if (width) return `${width} px`;
  if (height) return `${height} px`;
  return "";
}

export function formatMediaCodec(value) {
  const codec = String(value || "").trim().toLowerCase();
  const labels = {
    aac: "AAC",
    av1: "AV1",
    avc1: "H.264",
    h264: "H.264",
    hevc: "HEVC",
    h265: "HEVC",
    mp3: "MP3",
    opus: "Opus",
    vp9: "VP9",
  };
  return labels[codec] || codec.toUpperCase();
}

export function unwrapNowPlayingState(result) {
  if (result?.success === false) {
    throw new Error(result.error?.message || "Unable to restore music library");
  }
  return result?.data ?? result ?? {};
}

export function setPressedState(button, pressed) {
  button?.classList.toggle("is-active", pressed);
  button?.setAttribute("aria-pressed", String(pressed));
}
