// utils.js (src/js/app/utils.js)

/**
 * Нормализует ввод пользователя в URL, добавляя https:// при отсутствии схемы
 * и удаляя обрамляющие пробелы/скобки.
 * @param {string} raw
 * @returns {string} нормализованный URL или пустая строка
 */
function normalizeUrl(raw) {
  if (typeof raw !== "string") return "";
  let candidate = raw.trim();
  if (!candidate) return "";

  candidate = candidate.replace(/^[<>"']+/, "").replace(/[<>"']+$/, "");

  if (!/^[a-zA-Z][\w+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  return candidate;
}

function isValidUrl(string) {
  if (typeof string !== "string") return false;
  const candidate = string.trim();
  if (!candidate) return false;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSupportedUrl(string) {
  return isValidUrl(string);
}

module.exports = {
  isValidUrl,
  isSupportedUrl,
  normalizeUrl,
};
