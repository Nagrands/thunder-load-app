const HISTORY_COMMANDS = Object.freeze({
  "open-file": {
    contextId: "open-video",
    icon: "play",
    labelKey: "history.action.openFile",
    available: (entry, context) =>
      Boolean(entry?.filePath) &&
      context.fileExists !== false &&
      !entry?.isMissing,
  },
  "open-folder": {
    contextId: "open-folder",
    icon: "folder-open",
    labelKey: "history.action.openFolderShort",
    available: (entry, context) =>
      Boolean(entry?.filePath) &&
      context.fileExists !== false &&
      !entry?.isMissing,
  },
  "open-source": {
    contextId: "open-site",
    icon: "external-link",
    labelKey: "history.action.openSource",
    available: (entry) => Boolean(entry?.sourceUrl),
  },
  retry: {
    contextId: "retry-download",
    icon: "refresh-cw",
    labelKey: "history.action.retry",
    available: (entry) => Boolean(entry?.sourceUrl),
  },
  inspect: {
    icon: "activity",
    labelKey: "history.action.inspect",
    available: (entry, context) =>
      Boolean(entry?.filePath) &&
      context.fileExists !== false &&
      !entry?.isMissing,
  },
  "delete-entry": {
    contextId: "delete-entry",
    icon: "trash-2",
    labelKey: "history.action.deleteFromHistory",
    available: () => true,
  },
  "delete-file": {
    contextId: "delete-file",
    icon: "trash",
    labelKey: "history.action.deleteFile",
    available: (entry, context) =>
      Boolean(entry?.filePath) &&
      context.fileExists !== false &&
      !entry?.isMissing,
  },
});

const getHistoryCommand = (id) => HISTORY_COMMANDS[id] || null;

const getHistoryCommandByContextId = (contextId) =>
  Object.entries(HISTORY_COMMANDS).find(
    ([, command]) => command.contextId === contextId,
  )?.[0] || "";

const isHistoryCommandAvailable = (id, entry, context = {}) => {
  const command = getHistoryCommand(id);
  return Boolean(command?.available(entry, context));
};

export {
  getHistoryCommand,
  getHistoryCommandByContextId,
  HISTORY_COMMANDS,
  isHistoryCommandAvailable,
};
