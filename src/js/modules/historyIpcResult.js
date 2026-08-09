// src/js/modules/historyIpcResult.js

function createHistoryIpcError(result, fallbackMessage) {
  const error = new Error(result?.error || fallbackMessage);
  if (result?.warning) error.code = result.warning;
  if (result?.backupPath) error.backupPath = result.backupPath;
  return error;
}

function unwrapHistoryEntries(result) {
  if (Array.isArray(result)) return result;
  if (result?.success === false) {
    throw createHistoryIpcError(result, "History load failed");
  }
  if (result?.success === true && Array.isArray(result.entries)) {
    return result.entries;
  }
  throw createHistoryIpcError(result, "Invalid history load response");
}

function assertHistorySaveResult(result) {
  if (result?.success === false) {
    throw createHistoryIpcError(result, "History save failed");
  }
  return result;
}

export { assertHistorySaveResult, unwrapHistoryEntries };
