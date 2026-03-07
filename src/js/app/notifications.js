// notifications.js (src/js/app/notifications.js)

const { Notification, shell } = require("electron");
const path = require("path");
const { bringMainWindowToFront } = require("./windowActivation");

function classifyDownloadError(errorLike) {
  const rawMessage = String(errorLike?.message || errorLike || "").trim();
  if (!rawMessage) {
    return {
      code: null,
      message: "Ошибка при загрузке.",
      retryAfterMinutes: null,
      rawMessage,
    };
  }

  if (/ERR_YTDLP_NETWORK_TIMEOUT:/i.test(rawMessage)) {
    return {
      code: "NETWORK_TIMEOUT",
      message:
        "Не удалось связаться с YouTube. Проверьте подключение и повторите попытку.",
      retryAfterMinutes: null,
      rawMessage,
    };
  }
  if (/ERR_YTDLP_AUTH_REQUIRED:/i.test(rawMessage)) {
    return {
      code: "AUTH_REQUIRED",
      message:
        "Видео требует авторизации. Добавьте cookies браузера и повторите попытку.",
      retryAfterMinutes: null,
      rawMessage,
    };
  }
  if (/ERR_YTDLP_GEO_BLOCKED:/i.test(rawMessage)) {
    return {
      code: "GEO_BLOCKED",
      message: "Видео недоступно в вашем регионе.",
      retryAfterMinutes: null,
      rawMessage,
    };
  }
  if (/ERR_YTDLP_UNAVAILABLE:/i.test(rawMessage)) {
    return {
      code: "UNAVAILABLE",
      message: "Видео недоступно или было удалено.",
      retryAfterMinutes: null,
      rawMessage,
    };
  }
  if (/YouTube temporarily rate-limited requests/i.test(rawMessage)) {
    const rateLimitMatch = rawMessage.match(/about\s+(\d+)\s+minute/i);
    const retryAfterMinutes = rateLimitMatch
      ? Number(rateLimitMatch[1]) || null
      : null;
    return {
      code: "YOUTUBE_RATE_LIMIT",
      message: retryAfterMinutes
        ? `YouTube временно ограничил запросы. Попробуйте снова примерно через ${retryAfterMinutes} мин.`
        : "YouTube временно ограничил запросы. Повторите попытку позже.",
      retryAfterMinutes,
      rawMessage,
    };
  }

  return {
    code: null,
    message:
      rawMessage.replace(/^ERR_YTDLP_[A-Z_]+:\s*/i, "").trim() || rawMessage,
    retryAfterMinutes: null,
    rawMessage,
  };
}

function formatDownloadErrorMessage(errorLike) {
  return classifyDownloadError(errorLike).message;
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
  classifyDownloadError,
  formatDownloadErrorMessage,
  showTrayNotification,
  notifyDownloadError,
  sendDownloadCompletionNotification,
};
