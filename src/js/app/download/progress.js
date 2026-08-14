const PROGRESS_PREFIX = "THUNDER_PROGRESS:";

function parseProgressNumber(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized === "NA" || normalized === "N/A") return null;
  const number = Number(normalized.replace(/%$/, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseDownloadProgress(line) {
  const raw = String(line || "").trim();
  const markerIndex = raw.indexOf(PROGRESS_PREFIX);
  if (markerIndex >= 0) {
    const [percent, downloaded, total, estimate, speed, eta] = raw
      .slice(markerIndex + PROGRESS_PREFIX.length)
      .split("|");
    const exactTotal = parseProgressNumber(total);
    const estimatedTotal = parseProgressNumber(estimate);
    return {
      progress: parseProgressNumber(percent) ?? 0,
      downloadedBytes: parseProgressNumber(downloaded),
      totalBytes: exactTotal ?? estimatedTotal,
      totalBytesApproximate: exactTotal === null && estimatedTotal !== null,
      speedBytesPerSec: parseProgressNumber(speed),
      etaSeconds: parseProgressNumber(eta),
    };
  }
  const legacy = raw.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  return legacy ? { progress: Number(legacy[1]) } : null;
}

function parseProgress(line) {
  return parseDownloadProgress(line)?.progress ?? null;
}

module.exports = { parseDownloadProgress, parseProgress };
