// src/js/modules/validation.js

/**
 * Нормализует пользовательский ввод: обрезает пробелы/скобки и добавляет https:// при отсутствии схемы.
 * @param {string} raw
 * @returns {string}
 */
const normalizeUrlInput = (raw) => {
  if (typeof raw !== "string") return "";
  let candidate = raw.trim();
  if (!candidate) return "";
  candidate = candidate.replace(/^[<>"']+/, "").replace(/[<>"']+$/, "");
  if (!/^[a-zA-Z][\w+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  return candidate;
};

/**
 * Проверяет, является ли строка корректным URL с допустимым протоколом.
 * @param {string} string - Строка для проверки.
 * @returns {boolean} - true, если строка корректна и использует http/https.
 */
const isValidUrl = (string) => {
  if (typeof string !== "string") return false;
  const candidate = string.trim();
  if (!candidate) return false;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

/**
 * yt-dlp сам определяет поддержку, поэтому пропускаем все корректные URL.
 * @param {string} string - Строка URL для проверки.
 * @returns {boolean}
 */
const isSupportedUrl = (string) => isValidUrl(string);

export { isValidUrl, isSupportedUrl, normalizeUrlInput };
