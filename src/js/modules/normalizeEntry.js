// src/js/modules/normalizeEntry.js

export async function normalizeEntry(entry) {
  const normalized = {
    id: entry.id || "",
    fileName: entry.fileName || "",
    filePath: entry.filePath || "",
    sourceUrl: entry.sourceUrl || "",
    quality: entry.quality || "",
    iconUrl: entry.iconUrl || "",
    dateText: entry.dateTime || entry.dateText || "неизвестно",
    timestamp: "",
    formattedSize: "",
    isMissing: false,
  };

  // Дата → timestamp
  const match = normalized.dateText.match(
    /^(\d{2})\.(\d{2})\.(\d{4}), (\d{2}):(\d{2}):(\d{2})$/,
  );
  if (match) {
    const [, d, m, y, h, min, s] = match;
    const dt = new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
    if (!isNaN(dt.getTime())) {
      normalized.timestamp = dt.toISOString();
    }
  }

  // Размер файла и проверка наличия
  try {
    const exists = await window.electron.invoke(
      "check-file-exists",
      normalized.filePath,
    );
    if (exists) {
      const size = await window.electron.invoke(
        "get-file-size",
        normalized.filePath,
      );
      if (!isNaN(size)) {
        normalized.formattedSize = `${(size / 1024 / 1024).toFixed(1)} MB`;
      }
    } else {
      normalized.isMissing = true;
    }
  } catch (e) {
    console.warn("Ошибка получения размера файла:", e);
  }

  return normalized;
}
