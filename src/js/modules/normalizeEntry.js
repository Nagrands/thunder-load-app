// src/js/modules/normalizeEntry.js

export async function normalizeEntry(entry) {
  const normalized = {
    id: entry.id || "",
    fileName: entry.fileName || "",
    filePath: entry.filePath || "",
    sourceUrl: entry.sourceUrl || "",
    quality: entry.quality || "",
    iconUrl: entry.iconUrl || "",
    thumbnail: entry.thumbnail || "",
    dateText: entry.dateTime || entry.dateText || "неизвестно",
    timestamp: "",
    formattedSize: "",
    isMissing: false,
  };

  // Try to derive a YouTube thumbnail for old records (if not audio-only)
  try {
    const isAudio = /audio/i.test(normalized.quality || "");
    if (!normalized.thumbnail && normalized.sourceUrl && !isAudio) {
      const u = new URL(normalized.sourceUrl);
      const h = (u.hostname || "").replace(/^www\./, '').toLowerCase();
      const isYt = /youtube\.com|youtu\.be/.test(h);
      if (isYt) {
        let id = '';
        if (h.includes('youtu.be')) {
          id = (u.pathname || '').split('/').filter(Boolean)[0] || '';
        } else if (u.searchParams.has('v')) {
          id = u.searchParams.get('v') || '';
        } else if ((u.pathname || '').includes('/embed/')) {
          id = (u.pathname.split('/embed/')[1] || '').split('/')[0] || '';
        } else if ((u.pathname || '').includes('/shorts/')) {
          id = (u.pathname.split('/shorts/')[1] || '').split('/')[0] || '';
        }
        if (id) normalized.thumbnail = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
      }
    }
  } catch (_) {}

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
