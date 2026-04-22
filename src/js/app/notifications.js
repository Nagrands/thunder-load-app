// notifications.js (src/js/app/notifications.js)

const { Notification, shell } = require("electron");
const { expandMainWindowForToggle } = require("./windowActivation");
const { resolveIconPathFromAppDir } = require("./iconPaths");
const {
  classifyDownloadError,
} = require("../shared/downloadErrorClassifier.shared.js");

function formatMissingDownloadToolsMessage({ hasYtDlp, hasFfmpeg }) {
  if (!hasYtDlp && !hasFfmpeg) {
    return "Не найдены yt-dlp и ffmpeg. Откройте Настройки → Загрузчик → Инструменты и нажмите «Скачать зависимости».";
  }
  if (!hasYtDlp) {
    return "Не найден yt-dlp. Откройте Настройки → Загрузчик → Инструменты и нажмите «Скачать зависимости».";
  }
  if (!hasFfmpeg) {
    return "Не найден ffmpeg. Откройте Настройки → Загрузчик → Инструменты и нажмите «Скачать зависимости».";
  }
  return "";
}

function formatDownloadErrorMessage(errorLike) {
  return classifyDownloadError(errorLike).message;
}

function showTrayNotification(message) {
  const notification = new Notification({
    title: "Thunder Load",
    body: message,
    icon: resolveIconPathFromAppDir("APP_ICON_256"),
  });
  notification.show();
}

function notifyDownloadError(error) {
  const notification = new Notification({
    title: "Ошибка загрузки",
    body: formatDownloadErrorMessage(error),
    icon: resolveIconPathFromAppDir("NOTIFICATION_ERROR"),
  });
  notification.show();
}

function sendDownloadCompletionNotification(
  title,
  filePath,
  store,
  mainWindow,
) {
  const notification = new Notification({
    title: "Загрузка завершена",
    body: `Файл "${title}" успешно загружен.`,
    silent: false,
    icon: resolveIconPathFromAppDir("NOTIFICATION_SUCCESS"),
  });

  notification.on("click", () => {
    shell.openPath(filePath);
  });

  notification.show();

  store.set("lastDownloadedFile", filePath);
  mainWindow.webContents.send("download-complete", { title, filePath });

  const expandWindowOnDownloadComplete = store.get(
    "expandWindowOnDownloadComplete",
    false,
  );
  if (expandWindowOnDownloadComplete) {
    expandMainWindowForToggle(mainWindow);
  }
}

module.exports = {
  classifyDownloadError,
  formatMissingDownloadToolsMessage,
  formatDownloadErrorMessage,
  showTrayNotification,
  notifyDownloadError,
  sendDownloadCompletionNotification,
};
