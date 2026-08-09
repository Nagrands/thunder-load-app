import { JOB_STATUS } from "./model.js";
import {
  getActiveDownloadJobs,
  getFailedDownloadJobs,
  getPendingDownloadJobs,
} from "./store.js";

const getQueueCounts = (state) => ({
  active: getActiveDownloadJobs(state).length,
  pending: getPendingDownloadJobs(state).length,
  error: getFailedDownloadJobs(state).length,
});

const getClearableQueueStatuses = (filter) => {
  if (filter === "pending") return [JOB_STATUS.pending, JOB_STATUS.paused];
  if (filter === "error") return [JOB_STATUS.failed];
  if (filter === "active") return [];
  return [JOB_STATUS.pending, JOB_STATUS.paused, JOB_STATUS.failed];
};

export { getClearableQueueStatuses, getQueueCounts };
