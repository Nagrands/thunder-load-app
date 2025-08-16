// src/js/modules/validation.js

/**
 * Проверяет, является ли строка корректным URL с допустимым протоколом.
 * @param {string} string - Строка для проверки.
 * @returns {boolean} - Возвращает true, если строка является корректным URL с протоколом http или https.
 */
const isValidUrl = (string) => {
  try {
    const url = new URL(string);
    // Проверка на допустимые протоколы
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

/**
 * Список поддерживаемых доменов.
 */
const supportedDomains = [
  "youtube.com",
  "youtu.be",
  "twitch.tv",
  "coub.com",
  "vkvideo.ru",
  "dzen.ru",
];

/**
 * Проверяет, поддерживается ли домен в списке допустимых доменов.
 * @param {string} string - Строка URL для проверки.
 * @returns {boolean} - Возвращает true, если домен поддерживается.
 */
const isSupportedUrl = (string) => {
  try {
    const url = new URL(string);
    return supportedDomains.some((domain) => url.hostname.includes(domain));
  } catch {
    return false;
  }
};

export { isValidUrl, isSupportedUrl };
