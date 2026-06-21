# План оптимизации запуска Thunder Load

## Цель

Уменьшить время до первого готового UI без изменения основных пользовательских сценариев: загрузка, история, инструменты, обновления и настройки должны оставаться предсказуемыми.

## Этап 1. Измерения и безопасные отложенные задачи

Статус: выполнено.

- Добавить точечные startup-измерения в main process: загрузка тяжелых модулей, создание окна, регистрация IPC, updater, глобальные shortcuts.
- Отложить автоматическую проверку обновлений до готовности окна и короткой паузы после первого показа.
- Сохранить ручную проверку обновлений через настройки без задержки.
- Обновить release notes и покрыть изменение updater тестом.

## Этап 2. История вне критического пути

Статус: выполнено.

- Разделить старт истории на легкий shell и фоновую загрузку записей.
- Объединить первичное чтение истории и счетчик загрузок в один IPC-ответ.
- Удалить debug-логи рендера истории.
- Обновить тесты истории и bootstrap renderer.

## Этап 3. Lazy imports renderer-вкладок

Статус: выполнено.

- Убрать статические импорты тяжелых Tools/Products view из `registerTabs`.
- Вынести чтение default tab в маленький settings-store модуль.
- Загружать тяжелые views только при первом открытии вкладки.
- Обновить тесты tab system/registerTabs.

## Этап 4. Доступность инструментов без ранних spawn

Статус: выполнено.

- Разделить быстрый availability-check и получение версий бинарников.
- Добавить `tools:getAvailability` для startup preflight без запуска `yt-dlp`, `ffmpeg`, `deno`.
- Оставить `tools:getVersions` для footer/tools UI, где нужны версии и проверка обновлений.
- Обновить tests для tools availability, IPC и downloader availability.

## Этап 5. Разделение main-process IPC

- Разнести `ipcHandlers.js` на core/download/tools/backup/update/history modules.
- Перенести тяжелые зависимости в lazy factories внутри feature handlers.
- Привести WG Unlock к регистрации через общий IPC entry.
- Обновить IPC tests по группам.

## Этап 6. Tray, menu и legacy startup cleanup

- Вынести tray/menu из `window.js` в отдельные app-модули.
- Отложить refresh tray/dock menu до готовности окна.
- Убрать обычный startup-path для legacy localStorage migration.
- Свести clipboard-логику к одному источнику в main process.
