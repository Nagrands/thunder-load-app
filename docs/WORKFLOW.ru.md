# Рабочий процесс проекта Thunder

Короткий файл для понимания, что где находится, и какие действия обычно делают при разработке и выпуске.

## Что это за проект

Thunder — Electron‑приложение для загрузки и воспроизведения видео/аудио и
управления сопутствующими инструментами (yt‑dlp, ffmpeg, Deno).

## Методология изменений D.O.C.S.

- Все задачи выполняются по циклу `D.O.C.S.`: `Discover → Organize → Check → Share`.
- Подробный регламент: `docs/DOCS.ru.md`.
- Для любых пользовательских изменений обязательно обновлять `whats-new.md` и `whats-new.en.md`.

## Основные папки

- `src/` — исходники приложения (main/renderer, стили, шаблоны).
- `templates/` — Nunjucks‑шаблоны, из них собирается `src/index.html`.
- `assets/` — иконки, изображения, ресурсы.
- `docs/` — документация.
- `scripts/` — служебные скрипты для сборки.

## Где править UI

- HTML генерируется из `templates/` → итоговый файл `src/index.html`.
- Перед запуском/сборкой выполните `npm run templates:build`, иначе правки
  в шаблонах не попадут в `src/index.html`.

## Где править логику

- Main‑процесс: `src/js/app/`.
- Renderer‑процесс:
  - точка входа: `src/js/renderer.js` (только инициализация);
  - UI‑логика: `src/js/modules/`;
  - orchestration/bootstrap: `src/js/modules/app/`;
  - feature‑модули: `src/js/modules/features/` (например, `history`, `settings`);
  - совместимые фасады для старых импортов: `src/js/modules/history.js`, `src/js/modules/settings.js`;
  - общие модули: `src/js/modules/shared/` и legacy‑модули в `src/js/modules/`.
- IPC и preload: `src/js/app/ipcHandlers.js`, `src/js/ipc/channels.js`, `src/js/preload.js`.

### Где находится Плеер

- Renderer: `src/js/modules/nowPlaying/` — модель медиатеки, providers,
  playback controller, очередь, Media Session, контекстное меню и UI.
- Main: `src/js/app/nowPlaying*.js` — состояние v3, импорт, YouTube и HLS;
  `src/js/app/mediaOpenService.js` — файлы из ОС.
- Player IPC проходит по цепочке `channels.js` → `ipcHandlers.js` и
  `nowPlayingIpcHandlers.js` → whitelist/API в `preload.js`.
- Полная карта: `docs/tab/Player_Tab.ru.md`; platform smoke:
  `docs/tab/Player_Platform_QA.md`.

### Windows tray-панель

- `src/js/app/windowsTrayMenu.js` управляет отдельным frameless `BrowserWindow`,
  позиционированием, singleton lifecycle и нативным fallback.
- `templates/pages/windows-tray-menu.njk`,
  `src/scss/components/_windows-tray-menu.scss` и
  `src/js/modules/windowsTrayMenu.js` владеют разметкой, стилями и UI-логикой.
- IPC проходит через `windowsTrayMenuIpcHandlers.js`, централизованные каналы и
  минимальный sandboxed preload. Реальные пути renderer не получает.

## Быстрый старт разработки

1. `npm install`
2. `npm start`

## Шаблоны

- Один раз: `npm run templates:build`
- В режиме наблюдения: `npm run templates:watch`

## Стили

- Один раз: `npm run css:build`
- В режиме наблюдения: `npm run css:watch`

## Проверки и тесты

- `npm test` — unit‑тесты (Jest).
- `npm run lint` — базовый линт (ESLint).
- `npm run typecheck:player` — JavaScript typecheck Player/main media-модулей.
- `npm run check` — единая команда (lint + Player typecheck + Jest).
- Логи `console.log` подавляются в тестах через `src/js/tests/setupTests.js`.

## Сборка

- `npm run build` — сборка под текущую платформу.
- `npm run build-mac` / `npm run build-linux` — платформенные сборки.
- При изменении ассоциаций файлов или системной интеграции требуется packaged
  smoke на целевой ОС по `docs/tab/Player_Platform_QA.md`.
- Изменения tray-панели требуют packaged Windows smoke для светлой/тёмной темы,
  DPI, разных положений taskbar, нескольких мониторов, blur/Escape и клавиатуры.

## Что нового (WhatsNew)

- Источник истины — корневой `whats-new.md`.
- Приложение читает `whats-new.md` (и `whats-new.en.md`) напрямую из корня.
- Скрипт `npm run whats-new:build` генерирует только release notes в `build/`.
- Версия в Markdown должна совпадать с `package.json`.
- Окно «Что нового» автоматически показывается после обновления версии.
- Окно можно открыть вручную кликом по версии в интерфейсе.
- После показа версия считается просмотренной.

## Что важно помнить

- В проекте включены `contextIsolation` и `sandbox` — не ломайте модель безопасности.
- Не подключайте внешние CDN без сильной причины (в Electron это риск).

## Workflow улучшений

Используйте последовательность из `docs/IMPROVEMENTS_WORKFLOW.ru.md`.
