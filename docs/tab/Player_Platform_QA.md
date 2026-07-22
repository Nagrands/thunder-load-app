---
tags: [player, qa, windows, macos, hls, associations]
alias: Проверка Плеера на Windows и macOS
---

# Проверка Плеера на Windows и macOS

Ручная packaged smoke/regression матрица для системных функций, которые нельзя
полностью подтвердить в Jest или dev-режиме Electron.

## Подготовка

1. Использовать одну версию приложения на Windows 10/11, macOS x64 и macOS
   arm64.
2. Проверить чистый профиль и профиль, обновлённый с состоянием Плеера v1/v2.
3. Убедиться, что `yt-dlp`, `ffmpeg` и `ffprobe` доступны через менеджер
   инструментов.
4. Подготовить MP3, FLAC, MP4, MKV, WebM, AVI, MPEG, M3U/M3U8 и YouTube-видео с
   несколькими качествами.
5. Для метрик использовать одинаковые файлы и продолжительность прогона.

## Автоматические проверки

Перед ручным QA должны пройти:

```bash
npm run css:build
npm run whats-new:build
npm run check
```

Основное покрытие находится в тестах `nowPlaying*`, `mediaOpenService`,
`playerPackaging`, preload и window Dock Menu. Автотесты подтверждают схемы,
IPC whitelist, миграцию, очередь, repeat/volume, quality DTO, HLS lifecycle,
Media Session contracts и package configuration, но не системный UI ОС.

## Общая матрица

| Сценарий                             | macOS x64 | macOS arm64 | Windows 10/11 |
| ------------------------------------ | --------- | ----------- | ------------- |
| Пустая медиатека и CRUD плейлистов   | [ ]       | [ ]         | [ ]           |
| Direct MP3/FLAC/MP4/WebM             | [ ]       | [ ]         | [ ]           |
| HLS YouTube Auto/Best/Audio/exact    | [ ]       | [ ]         | [ ]           |
| AVI/MPEG FFmpeg fallback             | [ ]       | [ ]         | [ ]           |
| M3U local/HTTP/HLS                   | [ ]       | [ ]         | [ ]           |
| Background/minimized playback        | [ ]       | [ ]         | [ ]           |
| Media keys: Play/Pause/Next/Previous | [ ]       | [ ]         | [ ]           |
| System metadata/artwork              | [ ]       | [ ]         | [ ]           |
| Seek from system UI                  | [ ]       | [ ]         | [ ]           |
| Cold open from OS                    | [ ]       | [ ]         | [ ]           |
| Warm open/second instance            | [ ]       | [ ]         | [ ]           |
| File association/Open With           | [ ]       | [ ]         | [ ]           |
| HLS cleanup after switch/exit        | [ ]       | [ ]         | [ ]           |

## macOS

### Now Playing Center и media keys

- Запустить аудио, поставить на паузу и продолжить аппаратной клавишей.
- Проверить название, исполнителя, альбом, обложку, duration и position.
- Выполнить Previous, Next и Seek из Control Center/Now Playing Center.
- Свернуть окно и повторить команды.
- Остановить очередь: системная карточка должна очиститься.

### Dock Menu

- Открыть меню Dock при playback и pause.
- Проверить текущий трек, Play/Pause, Previous и Next.
- После Stop/конца очереди media-блок должен исчезнуть.

### Open With

- Проверить MP3, FLAC, MP4, MKV, AVI, M3U и M3U8.
- Thunder должен присутствовать в «Открыть с помощью», не становясь приложением
  по умолчанию без выбора пользователя.
- При холодном и тёплом старте первый файл должен запуститься, остальные —
  попасть в «Далее».

## Windows

### Installer и ассоциации

- Установить NSIS package с elevation (`perMachine: true`).
- Проверить AUMID `com.thunderload.app` и запись Thunder в выборе приложений по
  умолчанию.
- Выбрать Thunder для тестового формата и проверить cold/warm launch.
- Удалить приложение и проверить очистку installer-регистрации.

### SMTC и media keys

- Проверить title, artist, album и artwork в System Media Transport Controls.
- Выполнить Play, Pause, Previous и Next аппаратными клавишами и из SMTC.
- Проверить паузу и background/minimized playback.
- После Stop/конца очереди системная сессия должна очиститься.

## Direct/HLS и качество

1. Воспроизвести Chromium-совместимый локальный файл напрямую.
2. Добавить YouTube-видео и проверить `Auto`, `Best`, `Audio` и конкретные
   разрешения.
3. Убедиться, что выбранный exact format используется после перезапуска.
4. Смоделировать исчезнувший формат: ожидается
   `YOUTUBE_QUALITY_UNAVAILABLE`, а не silent fallback.
5. Проверить adaptive video+audio, stream-copy H.264/AAC и transcode другого
   кодека.
6. Проверить AVI/MPEG fallback и перемотку дальше первых сегментов.
7. Быстро переключать `A → B → A` и выполнить retry с `forceRefresh`.

## Производительность и очистка

- Зафиксировать CPU/GPU/RAM в idle, playback direct, HLS stream-copy и HLS
  transcode.
- Убедиться, что progress UI обновляется плавно без полного rerender списка.
- Проверить отсутствие повторной загрузки при reuse media layer.
- После смены трека и выхода проверить завершение FFmpeg-процессов.
- Проверить удаление каталога сессии, TTL/LRU и лимит HLS-кэша 2 ГБ.

## Отчёт

Для каждого окружения зафиксировать:

- ОС, архитектуру и версию package;
- подпись/notarization status;
- версии Electron, yt-dlp и FFmpeg;
- пройденные сценарии и логи ошибок;
- CPU/GPU/RAM для direct и HLS;
- оставшиеся платформенные ограничения.

Unsigned package подходит для внутреннего smoke-теста, но не подтверждает
Gatekeeper/SmartScreen, production signing, notarization или поведение
автообновления.
