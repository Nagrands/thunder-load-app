# Иконки Thunder Load

Краткая карта структуры `assets/icons` и правила именования ассетов.

## Структура

- `assets/icons/app` — основные иконки приложения для README, сборки и системных поверхностей.
- `assets/icons/platform/macos` — macOS-специфичные ассеты приложения (`.icns`, `.iconset`).
- `assets/icons/tray` — иконки для tray и связанных состояний.
- `assets/icons/notifications` — иконки системных уведомлений.
- `assets/icons/menu` — растровые иконки действий в menu/tray menu.
- `assets/icons/social` — SVG-иконки внешних платформ и сервисов.

## Именование

- Основная иконка приложения:
  `app-icon.png`, `app-icon.ico`, `app-icon.icns`
- Производные размеры:
  `app-icon-256.png`, `app-icon-512.png`
- Иконки tray:
  `tray-icon-windows.png`, `tray-icon-macos-template.png`, `tray-loading.png`
- Иконки уведомлений:
  `info-done.png`, `info-error.png`

## Правила

- Имена должны отражать назначение ассета, а не историческое происхождение.
- Платформенные файлы складываются в `platform/<platform>`.
- Если ассет используется только в одном сценарии, называйте его по сценарию:
  `tray-*`, `menu-*`, `notification-*` либо устоявшимся коротким именем внутри своей папки.
- Для новых системных иконок сначала обновляйте [src/js/app/iconPaths.js](../src/js/app/iconPaths.js), а уже потом подключайте их в `window.js`, `notifications.js`, `autoUpdater.js` или другие модули.
- При изменении брендовых иконок пересобирайте производные файлы через [scripts/generate_brand_icons.py](../scripts/generate_brand_icons.py).
- Не смешивайте брендовые app icons, menu assets и social SVG в одной плоской папке.

## Текущие точки использования

- `package.json` — app icons для Windows, Linux, macOS build targets.
- `src/js/app/window.js` — app icon, tray icon, tray menu icons.
- `src/js/app/notifications.js` — иконки уведомлений.
- `src/js/app/autoUpdater.js` — иконка уведомлений автообновления.
- `src/js/app/ipcHandlers.js` — Windows shortcut icon fallback.
