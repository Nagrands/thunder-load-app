# Thunder Load

Кросплатформний Electron-застосунок для завантаження медіа, ведення історії та
запуску прикладних інструментів.

## Завантаження

- Автоматичні релізи публікують Windows (NSIS) і macOS (DMG/ZIP для Intel та Apple Silicon) на сторінці [Releases](https://github.com/Nagrands/thunder-load-app/releases).
- Linux AppImage збирається командою `npm run build-linux`, але поки не входить до release workflow.
- Поточні збірки macOS і Windows не підписані.

## Можливості

- Завантаження відео й аудіо через `yt-dlp`, обробка через `ffmpeg`.
- Вибір відео, відео без аудіо, аудіодоріжки або MP3 перед запуском.
- Збережена черга, плейлисти, захист від дублів і до двох паралельних завантажень.
- Історія з пошуком, фільтрами, сортуванням, пагінацією та експортом CSV/JSON.
- Розділ `Products` для очищення, групування та перевірки товарних списків.
- Розділ `Інструменти`: WG Unlock, перевірка хешу, Media Inspector, сортувальник файлів, Backup, швидкі ярлики та WinGet Installer.
- Автооновлення застосунку й керування `yt-dlp`, `ffmpeg`, `ffprobe`, Deno.
- Російський та англійський інтерфейс, теми, гарячі клавіші й налаштування модулів.

## Документація

- [Посібник із застосунку англійською](APP.en.md)
- [Downloader](tab/Downloader_Tab.md)
- [Tools QA](tab/Tools_Platform_QA.md)

## Технології та скрипти

- Electron, Node.js, npm.
- Автокеровані бінарники: yt-dlp, ffmpeg, Deno.

| Команда                                     | Призначення                                     |
| ------------------------------------------- | ----------------------------------------------- |
| `npm start`                                 | Збирання генерованих файлів і запуск застосунку |
| `npm run dev`                               | Dev-режим з `--dev`                             |
| `npm run dev:watch`                         | Dev-режим + автозбирання whats-new              |
| `npm run build`                             | Збирання дистрибутива                           |
| `npm run build-mac` / `npm run build-linux` | Збирання під конкретну ОС                       |
| `npm test`                                  | Тести Jest                                      |
| `npm run check`                             | Лінт + тести                                    |
| `npm run css:build`                         | Збирання CSS зі SCSS                            |
| `npm run css:watch`                         | Автозбирання SCSS                               |
| `npm run templates:build`                   | Регенерація HTML із Nunjucks                    |
| `npm run templates:watch`                   | Автозбирання шаблонів при змінах                |
| `npm run whats-new:build`                   | Збирання релізних нотаток                       |
| `npm run whats-new:watch`                   | Автозбирання релізних нотаток                   |
| `npm run format`                            | Форматування Prettier                           |

## Конфігурація

- Налаштування, історія та кеш — у папці даних Electron:
  > macOS `~/Library/Application Support/Thunder Load`
  > Windows `%APPDATA%/Thunder Load`, Linux `~/.config/Thunder Load`.
- Папка завантажень обирається в Downloader, директорія інструментів — у Settings.
- Статус, оновлення, перевстановлення та міграція залежностей доступні в менеджері інструментів.
- На Linux `ffmpeg`/`ffprobe` можуть встановлюватися через системний package manager; сумісні бінарники також можуть використовуватися з `PATH`.
