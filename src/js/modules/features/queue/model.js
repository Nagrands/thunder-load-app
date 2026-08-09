const JOB_STATUS = Object.freeze({
  pending: "pending",
  running: "running",
  paused: "paused",
  failed: "failed",
  done: "done",
  cancelled: "cancelled",
});

const normalizeJobStage = (stage = "", status = JOB_STATUS.pending) => {
  const normalized = String(stage || "")
    .trim()
    .toLowerCase();
  if (normalized === "prepare" || normalized === "download") return normalized;
  if (normalized === "finalize" || normalized === "merge") return "finalize";
  if (status === JOB_STATUS.running) return "prepare";
  return "";
};

const getDownloadJobIdentity = (job = {}) =>
  job.jobId ||
  job.id ||
  job.signature ||
  `${job.url || ""}::${job.status || ""}`;

const getDownloadJobSignature = (job = {}) =>
  `${String(job.url || "").trim()}::${JSON.stringify(job.quality ?? null)}`;

const hasSameDownloadPayload = (left = {}, right = {}) =>
  String(left.url || "").trim() === String(right.url || "").trim() &&
  JSON.stringify(left.quality ?? null) ===
    JSON.stringify(right.quality ?? null);

const normalizeDownloadJob = (job = {}) => {
  const status = Object.values(JOB_STATUS).includes(job.status)
    ? job.status
    : JOB_STATUS.pending;
  const now = Date.now();
  return {
    id: job.id || job.jobId || "",
    jobId: job.jobId || job.id || "",
    url: String(job.url || "").trim(),
    title: String(job.title || ""),
    quality: job.quality,
    type: job.type || "",
    status,
    stage: normalizeJobStage(job.stage, status),
    progress: Number(job.progress) || 0,
    size: job.size ? String(job.size) : "",
    filePath: job.filePath ? String(job.filePath) : "",
    signature: job.signature || getDownloadJobSignature(job),
    reason: job.reason ? String(job.reason) : "",
    errorCode: job.errorCode ? String(job.errorCode) : "",
    retryable:
      typeof job.retryable === "boolean"
        ? job.retryable
        : status === JOB_STATUS.failed,
    failedAt: Number(job.failedAt) || 0,
    createdAt: Number(job.createdAt) || now,
    updatedAt: Number(job.updatedAt) || now,
  };
};

export {
  getDownloadJobIdentity,
  getDownloadJobSignature,
  hasSameDownloadPayload,
  JOB_STATUS,
  normalizeDownloadJob,
};
