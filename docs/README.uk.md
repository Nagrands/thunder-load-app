# Thunder Load

Сучасний кросплатформний застосунок на Electron для завантаження відео та аудіо.

## Завантаження

- Готові збірки для macOS, Windows, Linux — на сторінці [Releases](https://github.com/Nagrands/thunder-load-app/releases).
- Встановлення на macOS (див. нижче).

## Можливості

- Швидкі завантаження через **yt-dlp**; формати _MP4/WebM/MKV/MP3/AAC_ тощо.
- **Моніторинг буфера**, вибір якості/роздільності.
- **Історія завантажень**: пошук, фільтри за джерелом/якістю, пагінація, експорт CSV/JSON.
- **Вкладка Backup**: профілі з шляхами, тегами, фільтрами; масовий запуск/видалення.
- **Автооновлення** застосунку та залежностей (yt-dlp, ffmpeg, Deno).
- Підказки та **гарячі клавіші**.

## Технології та скрипти

- Electron, Node.js, npm.
- Автокеровані бінарники: yt-dlp, ffmpeg, Deno.

| Команда                                     | Призначення                                         |
| ------------------------------------------- | --------------------------------------------------- |
| `npm start`                                 | Запуск застосунку (збирання шаблонів перед стартом) |
| `npm run dev`                               | Dev-режим з `--dev`                                 |
| `npm run build`                             | Збирання дистрибутива                               |
| `npm run build-mac` / `npm run build-linux` | Збирання під конкретну ОС                           |
| `npm test`                                  | Тести Jest                                          |
| `npm run templates:build`                   | Регенерація HTML із Nunjucks                        |
| `npm run templates:watch`                   | Автозбирання шаблонів при змінах                    |
| `npm run format`                            | Форматування Prettier                               |

## Встановлення на macOS

Збірка **не нотаризована**. Якщо система пише, що застосунок пошкоджено:

1. Перемістіть `.app` у `/Applications`.
2. У терміналі виконайте:
   ```bash
   sudo xattr -dr com.apple.quarantine /Applications/Thunder\ Load.app
   ```
3. Відкрийте застосунок.

## Конфігурація

- Налаштування, історія та кеш — у папці даних Electron: macOS `~/Library/Application Support/Thunder Load`, Windows `%APPDATA%/Thunder Load`, Linux `~/.config/Thunder Load`.
- Шлях завантажень і директорію для інструментів можна змінити в Settings.
