# Thunder Load

Современное кроссплатформенное приложение на Electron для скачивания видео и аудио.

## Загрузка

- Готовые сборки для macOS, Windows — на вкладке [Releases](https://github.com/Nagrands/thunder-load-app/releases).
- Установка на macOS (см. ниже).

## Возможности

- Быстрые **загрузки** через **yt-dlp**; форматы _MP4/WebM/MKV/MP3/AAC_ и др.
- **Мониторинг буфера обмена**, выбор качества/разрешения.
- **История загрузок**: поиск, фильтры по источнику/качеству, пагинация, экспорт CSV/JSON.
- Вкладка **Backup**: профили с путями, тегами, фильтрами; массовый запуск/удаление.
- **Автообновления** приложения и зависимостей (yt-dlp, ffmpeg, Deno).
- Подсказки и **горячие клавиши**.

## Технологии и скрипты

- Electron, Node.js, npm.
- Авто-управляемые бинарники: yt-dlp, ffmpeg, Deno.

| Команда                                     | Назначение                                        |
| ------------------------------------------- | ------------------------------------------------- |
| `npm start`                                 | Запуск приложения (сборка шаблонов перед стартом) |
| `npm run dev`                               | Dev-режим с `--dev`                               |
| `npm run build`                             | Сборка дистрибутива                               |
| `npm run build-mac` / `npm run build-linux` | Сборки под конкретную ОС                          |
| `npm test`                                  | Тесты Jest                                        |
| `npm run templates:build`                   | Регенерация HTML из Nunjucks                      |
| `npm run templates:watch`                   | Автосборка шаблонов при изменениях                |
| `npm run format`                            | Prettier форматирование                           |

## Установка на macOS

Сборка **не нотарифицирована**. Если система пишет, что приложение повреждено:

1. Переместите `.app` в `/Applications`.
2. В терминале выполните:
   ```bash
   sudo xattr -dr com.apple.quarantine /Applications/Thunder\ Load.app
   ```
3. Откройте приложение.

## Конфигурация

- Настройки, история и кеш — в папке данных Electron:
  > macOS `~/Library/Application Support/Thunder Load`
  > Windows `%APPDATA%/Thunder Load`, Linux `~/.config/Thunder Load`.
- Путь загрузок и директория для инструментов настраиваются.

## Участие

PR и задачи приветствуются: [репозиторий](https://github.com/Nagrands/thunder-load-app).
