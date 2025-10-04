// notifications.js (src/js/app/notifications.js)

const { Notification } = require("electron");
const path = require("path");

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
    body: `Ошибка при загрузке: ${error.message}`,
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
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

module.exports = {
  showTrayNotification,
  notifyDownloadError,
  sendDownloadCompletionNotification,
};
