# Thunder Load

Кроссплатформенное Electron-приложение для скачивания медиа, ведения истории и
запуска прикладных инструментов.

## Загрузка

- Автоматические релизы публикуют Windows (NSIS) и macOS (DMG/ZIP для Intel и Apple Silicon) на странице [Releases](https://github.com/Nagrands/thunder-load-app/releases).
- Linux AppImage собирается командой `npm run build-linux`, но пока не входит в release workflow.
- Текущие сборки macOS и Windows не подписаны.

## Возможности

- Загрузка видео и аудио через `yt-dlp`, обработка через `ffmpeg`.
- Выбор видео, видео без аудио, аудиодорожки или MP3 перед запуском.
- Сохраняемая очередь, плейлисты, защита от дублей и до двух параллельных загрузок.
- История с поиском, фильтрами, сортировкой, пагинацией, отменой удаления и экспортом CSV/JSON.
- Раздел `Products` для очистки, группировки и проверки товарных списков.
- Раздел `Инструменты`: WG Unlock, проверка хеша, Media Inspector, сортировщик файлов, Backup, быстрые ярлыки и WinGet Installer.
- Автообновления приложения и управление `yt-dlp`, `ffmpeg`, `ffprobe`, Deno.
- Русский и английский интерфейс, темы, горячие клавиши и настройка модулей.

## Документация

- [Руководство по приложению](APP.ru.md)
- [Downloader](tab/Downloader_Tab.md)
- [Tools QA](tab/Tools_Platform_QA.md)

## Технологии и скрипты

- Electron, Node.js, npm.
- Авто-управляемые бинарники: yt-dlp, ffmpeg, Deno.

| Команда                                     | Назначение                                     |
| ------------------------------------------- | ---------------------------------------------- |
| `npm start`                                 | Сборка генерируемых файлов и запуск приложения |
| `npm run dev`                               | Dev-режим с `--dev`                            |
| `npm run dev:watch`                         | Dev-режим + автосборка whats-new               |
| `npm run build`                             | Сборка дистрибутива                            |
| `npm run build-mac` / `npm run build-linux` | Сборки под конкретную ОС                       |
| `npm test`                                  | Тесты Jest                                     |
| `npm run check`                             | Линт + тесты                                   |
| `npm run css:build`                         | Сборка CSS из SCSS                             |
| `npm run css:watch`                         | Автосборка SCSS                                |
| `npm run templates:build`                   | Регенерация HTML из Nunjucks                   |
| `npm run templates:watch`                   | Автосборка шаблонов при изменениях             |
| `npm run whats-new:build`                   | Сборка релизных заметок                        |
| `npm run whats-new:watch`                   | Автосборка релизных заметок                    |
| `npm run format`                            | Prettier форматирование                        |

## Конфигурация

- Настройки, история и кеш находятся в папке данных Electron:
  > macOS `~/Library/Application Support/Thunder Load`
  > Windows `%APPDATA%/Thunder Load`, Linux `~/.config/Thunder Load`.
- Папка загрузок выбирается в Загрузчике, директория инструментов — в Настройках.
- Статус, обновление, переустановка и миграция зависимостей доступны в менеджере инструментов.
- На Linux `ffmpeg`/`ffprobe` могут устанавливаться через системный package manager; совместимые бинарники также могут использоваться из `PATH`.

## Участие

PR и задачи приветствуются: [репозиторий](https://github.com/Nagrands/thunder-load-app).
