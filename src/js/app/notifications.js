// notifications.js (src/js/app/notifications.js)

const { Notification, shell } = require("electron");
const path = require("path");
const { bringMainWindowToFront } = require("./windowActivation");

function formatDownloadErrorMessage(errorLike) {
  const message = String(errorLike?.message || errorLike || "").trim();
  if (!message) return "Ошибка при загрузке.";
  if (/ERR_YTDLP_NETWORK_TIMEOUT:/i.test(message)) {
    return "Не удалось связаться с YouTube. Проверьте подключение и повторите попытку.";
  }
  if (/ERR_YTDLP_AUTH_REQUIRED:/i.test(message)) {
    return "Видео требует авторизации. Добавьте cookies браузера и повторите попытку.";
  }
  if (/ERR_YTDLP_GEO_BLOCKED:/i.test(message)) {
    return "Видео недоступно в вашем регионе.";
  }
  if (/ERR_YTDLP_UNAVAILABLE:/i.test(message)) {
    return "Видео недоступно или было удалено.";
  }
  if (/YouTube temporarily rate-limited requests/i.test(message)) {
    return "YouTube временно ограничил запросы. Повторите попытку позже.";
  }
  return message.replace(/^ERR_YTDLP_[A-Z_]+:\s*/i, "").trim() || message;
}

function showTrayNotification(message) {
  const notification = new Notification({
    title: "Thunder Load",
    body: message,
    icon: path.join(__dirname, "../../../assets/icons/thunder-logo.png"),
  });
  notification.show();
}

function notifyDownloadError(error) {
  const notification = new Notification({
    title: "Ошибка загрузки",
    body: formatDownloadErrorMessage(error),
    icon: path.join(__dirname, "../../../assets/icons/info-error.png"),
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
    icon: path.join(__dirname, "../../../assets/icons/info-done.png"),
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
    bringMainWindowToFront(mainWindow);
  }
}

module.exports = {
  formatDownloadErrorMessage,
  showTrayNotification,
  notifyDownloadError,
  sendDownloadCompletionNotification,
};
