import {
  assertHistorySaveResult,
  unwrapHistoryEntries,
} from "../../historyIpcResult.js";

const loadHistorySnapshot = async () => window.electron.invoke("load-history");

const loadHistoryEntries = async () =>
  unwrapHistoryEntries(await loadHistorySnapshot());

const saveHistoryEntries = async (entries) =>
  assertHistorySaveResult(
    await window.electron.invoke("save-history", entries),
  );

const inspectHistoryFiles = async (filePaths) =>
  window.electron.invoke("history:inspect-files", filePaths);

export {
  assertHistorySaveResult,
  inspectHistoryFiles,
  loadHistoryEntries,
  loadHistorySnapshot,
  saveHistoryEntries,
  unwrapHistoryEntries,
};
