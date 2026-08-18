# Thunder

Кросплатформний Electron-застосунок для завантаження й відтворення медіа,
ведення історії та запуску прикладних інструментів.

## Завантаження

- Останній інсталятор Windows або macOS доступний в офіційному [центрі завантаження Thunder](https://nagrands.github.io/thunder-load-app/en/download/).
- Автоматичні релізи публікують Windows NSIS і macOS DMG для Intel та Apple Silicon на сторінці [Releases](https://github.com/Nagrands/thunder-load-app/releases).
- Linux AppImage збирається командою `pnpm run build-linux`, але поки не входить до release workflow.
- Поточні збірки macOS і Windows не підписані.
- Windows використовує per-machine NSIS з elevation; macOS додає Thunder до
  Open With, не призначаючи його застосунком за замовчуванням автоматично.

## Можливості

- Завантаження відео й аудіо через `yt-dlp`, обробка через `ffmpeg`.
- Вибір відео, відео без аудіо, аудіодоріжки або MP3 перед запуском.
- Збережена черга, плейлисти, захист від дублів і до двох паралельних завантажень.
- Історія з пошуком, фільтрами, сортуванням, пагінацією та експортом CSV/JSON.
- Неблокувальний Player з локальними аудіо/відео, медіатекою, плейлистами,
  тимчасовою чергою, M3U/M3U8, вибором якості YouTube і HLS/FFmpeg fallback.
- Системні media keys/metadata, меню Dock macOS, асоціації медіафайлів і
  відкриття файлів із Finder/Explorer.
- Компактна Windows 11-style панель трея із системною темою, швидкими діями та
  повним керуванням із клавіатури.
- Розділ `Products` для очищення, групування та перевірки товарних списків.
- Розділ `Інструменти`: WG Unlock, перевірка хешу, Media Inspector, сортувальник файлів, Backup і швидкі ярлики.
- Автооновлення застосунку й керування `yt-dlp`, `ffmpeg`, `ffprobe`, Deno.
- Російський та англійський інтерфейс, теми, гарячі клавіші й налаштування модулів.

## Документація

- [Посібник із застосунку англійською](APP.en.md)
- [Downloader](tab/Downloader_Tab.md)
- [Player guide](tab/Player_Tab.en.md)
- [Tools QA](tab/Tools_Platform_QA.md)

## Технології та скрипти

- Electron, Node.js, pnpm.
- Автокеровані бінарники: yt-dlp, ffmpeg, Deno.

| Команда                                     | Призначення                                     |
| ------------------------------------------- | ----------------------------------------------- |
| `pnpm start`                                 | Збирання генерованих файлів і запуск застосунку |
| `pnpm run dev`                               | Dev-режим з `--dev`                             |
| `pnpm run dev:watch`                         | Dev-режим + автозбирання whats-new              |
| `pnpm run build`                             | Збирання дистрибутива                           |
| `pnpm run build-mac` / `pnpm run build-linux` | Збирання під конкретну ОС                       |
| `pnpm test`                                  | Тести Jest                                      |
| `pnpm run typecheck:player`                  | Перевірка типів модулів Player                  |
| `pnpm run check`                             | Лінт + typecheck Player + тести                 |
| `pnpm run css:build`                         | Збирання CSS зі SCSS                            |
| `pnpm run css:watch`                         | Автозбирання SCSS                               |
| `pnpm run templates:build`                   | Регенерація HTML із Nunjucks                    |
| `pnpm run templates:watch`                   | Автозбирання шаблонів при змінах                |
| `pnpm run whats-new:build`                   | Збирання релізних нотаток                       |
| `pnpm run whats-new:watch`                   | Автозбирання релізних нотаток                   |
| `pnpm run format`                            | Форматування Prettier                           |

## Конфігурація

- Налаштування, історія та кеш — у папці даних Electron:
  > macOS `~/Library/Application Support/Thunder Load`
  > Windows `%APPDATA%/Thunder Load`, Linux `~/.config/Thunder Load`.
  > Історична назва теки зберігається для сумісності налаштувань та історії.
- Папка завантажень обирається в Downloader, директорія інструментів — у Settings.
- Статус, оновлення, перевстановлення та міграція залежностей доступні в менеджері інструментів.
- На Linux `ffmpeg`/`ffprobe` можуть встановлюватися через системний package manager; сумісні бінарники також можуть використовуватися з `PATH`.
