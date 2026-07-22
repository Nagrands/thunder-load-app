# Иконки Thunder

Краткая карта структуры `assets/icons` и правила именования ассетов.

## Структура

- `assets/icons/app` — основные иконки приложения для README, сборки и системных поверхностей.
- `assets/icons/platform/macos` — macOS-специфичные ассеты приложения (`.icns`, `.iconset`).
- `assets/icons/tray` — иконки для tray и связанных состояний.
- `assets/icons/notifications` — иконки системных уведомлений.
- `assets/icons/menu` — растровые иконки действий в menu/tray menu.
- `assets/icons/social` — SVG-иконки внешних платформ и сервисов.

## Именование

- Основные иконки приложения:
  `assets/icons/app/app-icon.png`, `assets/icons/app/app-icon.ico`
- Исходный 1024×1024 RGBA master основного значка:
  `assets/icons/app/app-icon-master.png`. Генератор не перезаписывает master и
  использует его только для создания platform/app производных.
- Иконка сборки macOS:
  `assets/icons/platform/macos/app-icon.icns`
- Производные размеры:
  `app-icon-256.png`, `app-icon-512.png`
- Иконки tray:
  - macOS Template Images: `trayTemplate.png`, `trayActiveTemplate.png`,
    `trayPausedTemplate.png`, `trayErrorTemplate.png`, `trayOfflineTemplate.png`
    и соответствующие `@2x`/размерные варианты;
  - Windows multi-size ICO: `tray.ico`, `tray-active.ico`, `tray-paused.ico`,
    `tray-error.ico`, `tray-offline.ico`.
- Иконки уведомлений:
  `info-done.png`, `info-error.png`
- Иконки tray menu:
  `video.png`, `open-folder.png`, `settings.png`, `logout.png`
- Fluent SVG кастомной Windows tray-панели встроены в её Nunjucks-разметку,
  используют `currentColor` и не зависят от CDN. Растровые PNG сохраняются для
  нативного fallback-меню.

## Правила

- Имена должны отражать назначение ассета, а не историческое происхождение.
- Платформенные файлы складываются в `platform/<platform>`.
- Если ассет используется только в одном сценарии, называйте его по сценарию:
  `tray-*`, `menu-*`, `notification-*` либо устоявшимся коротким именем внутри своей папки.
- Для новых системных иконок сначала обновляйте [src/js/app/iconPaths.js](../src/js/app/iconPaths.js), а уже потом подключайте их в `window.js`, `notifications.js`, `autoUpdater.js` или другие модули.
- App, platform, menu, notification и tray-иконки генерируются через
  [scripts/generate_brand_icons.py](../scripts/generate_brand_icons.py) из
  общей геометрии Thunder и палитры `assets/brand/tokens/thunder.tokens.json`.
- macOS tray-иконки должны оставаться монохромными Template Images с прозрачным
  фоном. Windows tray-иконки содержат отдельно отрисованные кадры 16, 20, 24,
  и 32 px. Исходники находятся в `assets/icons/tray/windows`, а ICO
  пересобираются командой `npm run tray-icons:build`.
- Не смешивайте брендовые app icons, menu assets и social SVG в одной плоской папке.
- Логотипы сторонних платформ в `assets/icons/social` не являются производными
  Thunder brand kit и не должны изменяться генератором.

## Текущие точки использования

- `package.json` — app icons для Windows, Linux, macOS build targets.
- `src/js/app/window.js` — app icon, tray icon, tray menu icons.
- `src/windows-tray-menu.html` и `src/js/modules/windowsTrayMenu.js` — Fluent
  actions кастомной Windows tray-панели.
- `src/js/app/notifications.js` — иконки уведомлений.
- `src/js/app/autoUpdater.js` — иконка уведомлений автообновления.
- `src/js/app/ipcHandlers.js` — Windows shortcut icon fallback.
