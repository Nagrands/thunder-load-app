# Thunder

Кроссплатформенное Electron-приложение для скачивания и воспроизведения медиа,
ведения истории и запуска прикладных инструментов.

## Загрузка

- Автоматические релизы публикуют Windows NSIS и macOS DMG для Intel и Apple Silicon на странице [Releases](https://github.com/Nagrands/thunder-load-app/releases).
- Linux AppImage собирается командой `npm run build-linux`, но пока не входит в release workflow.
- Текущие сборки macOS и Windows не подписаны.
- Windows использует per-machine NSIS с elevation; macOS добавляет Thunder в
  «Открыть с помощью», не назначая его приложением по умолчанию автоматически.

## Возможности

- Загрузка видео и аудио через `yt-dlp`, обработка через `ffmpeg`.
- Выбор видео, видео без аудио, аудиодорожки или MP3 перед запуском.
- Сохраняемая очередь, плейлисты, защита от дублей и до двух параллельных загрузок.
- История с поиском, фильтрами, сортировкой, пагинацией, отменой удаления и экспортом CSV/JSON.
- Неблокирующий Плеер с локальными аудио/видео, медиатекой, плейлистами,
  временной очередью, M3U/M3U8, выбором качества YouTube и HLS/FFmpeg fallback.
- Системные media keys/metadata, macOS Dock Menu, ассоциации медиафайлов и
  запуск файлов из Finder/Explorer.
- Компактная Windows 11-style панель трея с системной темой, быстрыми действиями
  и полным управлением с клавиатуры.
- Раздел `Products` для очистки, группировки и проверки товарных списков.
- Раздел `Инструменты`: WG Unlock, проверка хеша, Media Inspector, сортировщик файлов, Backup и быстрые ярлыки.
- Автообновления приложения на Windows и управление `yt-dlp`, `ffmpeg`, `ffprobe`, Deno.
- Русский и английский интерфейс, темы, горячие клавиши и настройка модулей.

## Документация

- [Руководство по приложению](APP.ru.md)
- [Downloader](tab/Downloader_Tab.md)
- [Плеер](tab/Player_Tab.ru.md)
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
| `npm run typecheck:player`                  | Проверка типов модулей Плеера                  |
| `npm run check`                             | Линт + typecheck Плеера + тесты                |
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
  > Историческое имя папки сохраняется для совместимости настроек и истории.
- Папка загрузок выбирается в Загрузчике, директория инструментов — в Настройках.
- Статус, обновление, переустановка и миграция зависимостей доступны в менеджере инструментов.
- На Linux `ffmpeg`/`ffprobe` могут устанавливаться через системный package manager; совместимые бинарники также могут использоваться из `PATH`.

## Участие

PR и задачи приветствуются: [репозиторий](https://github.com/Nagrands/thunder-load-app).
