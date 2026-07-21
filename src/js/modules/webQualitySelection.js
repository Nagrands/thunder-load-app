function normalizeWebQualitySelection(value) {
  if (!value || typeof value !== "object") return null;
  const allowedTypes = new Set(["audio-only", "muxed", "pair", "video-only"]);
  const type = String(value.type || "");
  const videoFormatId = value.videoFormatId
    ? String(value.videoFormatId).trim()
    : null;
  const audioFormatId = value.audioFormatId
    ? String(value.audioFormatId).trim()
    : null;
  const validIds = [videoFormatId, audioFormatId].every(
    (id) => id === null || /^[A-Za-z0-9._-]{1,128}$/.test(id),
  );
  const validCombination =
    (type === "audio-only" && !videoFormatId && audioFormatId) ||
    ((type === "muxed" || type === "video-only") &&
      videoFormatId &&
      !audioFormatId) ||
    (type === "pair" && videoFormatId && audioFormatId);
  if (!allowedTypes.has(type) || !validIds || !validCombination) {
    throw new Error("Invalid web quality selection");
  }
  return {
    type,
    label: String(value.label || "").slice(0, 160),
    videoFormatId,
    audioFormatId,
    videoExt: value.videoExt ? String(value.videoExt).slice(0, 12) : null,
    audioExt: value.audioExt ? String(value.audioExt).slice(0, 12) : null,
    resolution: String(value.resolution || "").slice(0, 40),
    fps: Number(value.fps) || null,
    isMuxed: Boolean(value.isMuxed),
  };
}

export { normalizeWebQualitySelection };
