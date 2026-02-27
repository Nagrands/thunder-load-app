# Test Check

## Run Meta
- App version:
- OS:
- Date:
- Tester:
- Scope: Smoke / Regression

## Status Legend
- `NOT_RUN` - не проверено
- `PASS` - работает по ожиданию
- `FAIL` - есть отклонение
- `BLOCKED` - проверка заблокирована

## Summary
- Total: 35
- PASS: 18
- FAIL: 0
- BLOCKED: 0
- NOT_RUN: 17
- Pass rate: 51.4%
- Build under test:
- Notes:

# Настройки

## Общие

### TC-SET-GEN-001 (P1)
- What: Настройки запуска
- Steps:
  1. Открыть настройки.
  2. Изменить параметры запуска.
  3. Перезапустить приложение.
- Expected: Параметры запуска применены и сохранены.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-SET-GEN-002 (P0)
- What: Закрытие приложения
- Steps:
  1. Изменить настройку, связанную с закрытием.
  2. Закрыть приложение разными способами (крестик, меню, трей).
- Expected: Поведение закрытия соответствует настройке.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-SET-GEN-003 (P1)
- What: Открытие вкладки при запуске
- Steps:
  1. Выбрать стартовую вкладку в настройках.
  2. Перезапустить приложение.
- Expected: При запуске открывается выбранная вкладка.
- Actual:
- Status: NOT_RUN
- Bug:

## Загрузчик

### TC-SET-DL-001 (P0)
- What: Инструменты
- Steps:
  1. Открыть настройки загрузчика.
  2. Проверить доступность и состояние инструментов.
- Expected: Состояние инструментов отображается корректно, действия доступны.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-SET-DL-002 (P1)
- What: Выбор качества загрузки
- Steps:
  1. Изменить настройки выбора качества.
  2. Запустить загрузку.
- Expected: Используется выбранная логика/параметры качества.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-SET-DL-003 (P0)
- What: Параллельный запуск
- Steps:
  1. Выставить лимит параллельных загрузок.
  2. Добавить несколько задач.
- Expected: Одновременно выполняется не больше заданного лимита.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-SET-DL-004 (P1)
- What: Поведение окна и завершения
- Steps:
  1. Изменить параметры поведения окна.
  2. Дождаться завершения загрузки.
- Expected: Окно ведет себя согласно настройкам.
- Actual:
- Status: NOT_RUN
- Bug:

## Tools

### TC-SET-TOOLS-001 (P1)
- What: Отключение вкладки
- Steps:
  1. Отключить вкладку Tools в настройках.
  2. Проверить навигацию.
- Expected: Вкладка Tools скрыта/недоступна.
- Actual:
- Status: PASS
- Bug:

### TC-SET-TOOLS-002 (P1)
- What: Авто-отправка при запуске приложения
- Steps:
  1. Включить авто-отправку.
  2. Перезапустить приложение.
- Expected: Авто-отправка срабатывает по настройке.
- Actual:
- Status: PASS
- Bug:

### TC-SET-TOOLS-003 (P1)
- What: Запомнить последний открытый инструмент
- Steps:
  1. Открыть инструмент в Tools.
  2. Перезапустить приложение/вкладку.
- Expected: Последний инструмент восстановлен.
- Actual:
- Status: PASS
- Bug:

### TC-SET-TOOLS-004 (P1)
- What: Авто-закрытие приложения
- Steps:
  1. Включить авто-закрытие.
  2. Выполнить сценарий, при котором оно должно сработать.
- Expected: Приложение закрывается по правилу настройки.
- Actual:
- Status: PASS
- Bug:

## Backup

### TC-SET-BKP-001 (P1)
- What: Отключение вкладки
- Steps:
  1. Отключить вкладку Backup.
  2. Проверить интерфейс после применения.
- Expected: Вкладка Backup скрыта/недоступна.
- Actual:
- Status: PASS
- Bug:

### TC-SET-BKP-002 (P2)
- What: Компактный список профилей
- Steps:
  1. Включить компактный режим.
  2. Проверить список профилей.
- Expected: Список отображается в компактном формате.
- Actual:
- Status: PASS
- Bug:

### TC-SET-BKP-003 (P2)
- What: Показать лог операций
- Steps:
  1. Включить показ лога.
  2. Выполнить операцию в Backup.
- Expected: Лог операций отображается корректно.
- Actual:
- Status: PASS
- Bug:

## Внешний вид

### TC-SET-UI-001 (P1)
- What: Язык
- Steps:
  1. Сменить язык интерфейса.
  2. Проверить основные экраны.
- Expected: Язык переключается без артефактов.
- Actual:
- Status: PASS
- Bug:

### TC-SET-UI-002 (P1)
- What: Цветовая тема
- Steps:
  1. Переключить тему.
  2. Проверить элементы UI.
- Expected: Тема применяется ко всем основным элементам.
- Actual:
- Status: PASS
- Bug:

### TC-SET-UI-003 (P2)
- What: Размер текста
- Steps:
  1. Изменить размер текста.
  2. Проверить ключевые экраны.
- Expected: Размер текста меняется без поломки верстки.
- Actual:
- Status: PASS
- Bug:

### TC-SET-UI-004 (P2)
- What: Режим экономии эффектов
- Steps:
  1. Включить режим экономии эффектов.
  2. Проверить анимации/эффекты.
- Expected: Эффекты упрощены в соответствии с режимом.
- Actual:
- Status: PASS
- Bug:

## Другое

### TC-SET-MISC-001 (P1)
- What: Отключение горячих клавиш
- Steps:
  1. Отключить горячие клавиши.
  2. Проверить основные комбинации.
- Expected: Горячие клавиши не активируются.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-SET-MISC-002 (P2)
- What: Функции разработчика
- Steps:
  1. Включить функции разработчика.
  2. Проверить доступность соответствующих пунктов.
- Expected: Функции разработчика работают корректно.
- Actual:
- Status: PASS
- Bug:

### TC-SET-MISC-003 (P1)
- What: Настройки приложения
- Steps:
  1. Изменить набор общих настроек.
  2. Перезапустить приложение.
- Expected: Настройки сохраняются и применяются.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-SET-MISC-004 (P0)
- What: Сброс настроек приложения
- Steps:
  1. Изменить несколько настроек.
  2. Выполнить сброс.
  3. Перезапустить приложение.
- Expected: Настройки сброшены до значений по умолчанию.
- Actual:
- Status: NOT_RUN
- Bug:

# Вкладка Загрузчик

### TC-DL-001 (P1)
- What: Открытие «Последние видео»
- Steps:
  1. Перейти в Загрузчик.
  2. Нажать «Последние видео».
- Expected: Открывается список последних видео.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-DL-002 (P1)
- What: Открытие «Папки с видео»
- Steps:
  1. Перейти в Загрузчик.
  2. Нажать «Папка с видео».
- Expected: Открывается директория загрузок.
- Actual:
- Status: NOT_RUN
- Bug:

## История

### TC-DL-HIST-001 (P0)
- What: Очистить всю историю
- Steps:
  1. Открыть историю.
  2. Выполнить полную очистку.
- Expected: История очищается, UI обновляется корректно.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-DL-HIST-002 (P1)
- What: Сохранение выбранного фильтра после обновления/перезапуска
- Steps:
  1. Выбрать фильтры (источник, сортировка, тип).
  2. Обновить/перезапустить приложение.
- Expected: Выбранные фильтры сохраняются.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-DL-HIST-003 (P0)
- What: Удаление записи и файла через меню и отметка результата
- Steps:
  1. Открыть контекстное меню записи.
  2. Удалить запись/файл.
- Expected: Запись удалена, статус/отметка в UI корректны.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-DL-HIST-004 (P1)
- What: Открытие видео, папки, сайта через меню
- Steps:
  1. Открыть меню записи в истории.
  2. Запустить действия «Открыть видео/папку/сайт».
- Expected: Каждое действие открывает корректный ресурс.
- Actual:
- Status: NOT_RUN
- Bug:

### TC-DL-HIST-005 (P1)
- What: Поиск и сохранение после обновления/перезапуска
- Steps:
  1. Ввести запрос поиска.
  2. Обновить/перезапустить приложение.
- Expected: Поисковый запрос восстанавливается.
- Actual:
- Status: NOT_RUN
- Bug:

# Вкладка Tools

## Ярлыки питания

### TC-TOOLS-PWR-001 (P1)
- What: Создание и работа ярлыка «Перезагрузка»
- Steps:
  1. Создать ярлык.
  2. Проверить запуск действия.
- Expected: Ярлык создается и выполняет нужную команду.
- Actual:
- Status: PASS
- Bug:

### TC-TOOLS-PWR-002 (P1)
- What: Создание и работа ярлыка «BIOS/UEFI»
- Steps:
  1. Создать ярлык.
  2. Проверить запуск действия.
- Expected: Ярлык создается и выполняет нужную команду.
- Actual:
- Status: PASS
- Bug:

### TC-TOOLS-PWR-003 (P1)
- What: Создание и работа ярлыка «Расширенная загрузка»
- Steps:
  1. Создать ярлык.
  2. Проверить запуск действия.
- Expected: Ярлык создается и выполняет нужную команду.
- Actual:
- Status: PASS
- Bug:

### TC-TOOLS-PWR-004 (P1)
- What: Создание и работа ярлыка «Выключение»
- Steps:
  1. Создать ярлык.
  2. Проверить запуск действия.
- Expected: Ярлык создается и выполняет нужную команду.
- Actual:
- Status: PASS
- Bug:

### TC-TOOLS-PWR-005 (P2)
- What: Создание и работа ярлыка «Диспетчер устройств»
- Steps:
  1. Создать ярлык.
  2. Проверить запуск действия.
- Expected: Ярлык создается и выполняет нужную команду.
- Actual:
- Status: PASS
- Bug:

### TC-TOOLS-PWR-006 (P2)
- What: Создание и работа ярлыка «Параметры сети»
- Steps:
  1. Создать ярлык.
  2. Проверить запуск действия.
- Expected: Ярлык создается и выполняет нужную команду.
- Actual:
- Status: PASS
- Bug:

## Автотесты (Jest)

- Автосборка списка: `npm run test-check:sync-tests`
- Найдено файлов: 25
- Найдено тест-кейсов (test/it): 194

<!-- AUTO-JEST-TESTS:START -->

### `src/js/app/__tests__/ipcHandlers.toolsActions.test.js` (19)
- [ ] hashPickFile returns selected path
- [ ] hashCalculate returns SHA-256 hash and match
- [ ] sorterPickFolder returns selected directory path
- [ ] sorterRun supports dry-run with category stats
- [ ] sorterRun moves files and generates unique names
- [ ] sorterRun returns error when log path points to a directory
- [ ] sorterOpenFolder opens selected directory
- [ ] sorterOpenFolder returns error for unknown path
- [ ] tools:setLocation migrates existing binaries from previous directory
- [ ] createWindowsRestartShortcut returns unsupported on non-windows
- [ ] createWindowsRestartShortcut sets icon fields on windows
- [ ] createWindowsShutdownShortcut returns unsupported on non-windows
- [ ] createWindowsShutdownShortcut sets icon fields on windows
- [ ] new windows shortcut handlers return unsupported on non-windows
- [ ] new windows shortcut handlers set icon fields on windows
- [ ] uefi shortcut uses firmware reboot command with fallback
- [ ] allows two parallel DOWNLOAD_VIDEO and rejects third
- [ ] rejects second DOWNLOAD_VIDEO when parallel limit is set to 1
- [ ] STOP_DOWNLOAD cancels all active tokens

### `src/js/app/__tests__/utils.test.js` (6)
- [ ] adds https:// when scheme is missing
- [ ] preserves existing scheme
- [ ] trims whitespace and surrounding quotes/brackets
- [ ] returns empty string for invalid input
- [ ] accepts http/https URLs
- [ ] rejects unsupported schemes and invalid strings

### `src/js/app/__tests__/whatsNewVersion.test.js` (2)
- [ ] matches package.json
- [ ] english whatsNew stays in sync when present

### `src/js/app/__tests__/window.trayMenu.test.js` (7)
- [ ] disables 'Последнее видео' when file is missing
- [ ] enables 'Последнее видео' and adds file name in label when file exists
- [ ] disables 'Папка загрузок' when download path is invalid
- [ ] settings menu item shows window and opens settings
- [ ] tray 'Открыть' restores minimized window and focuses it
- [ ] quit menu item sets isQuitting and calls app.quit
- [ ] tray and dock keep identical action order

### `src/js/app/__tests__/window.trayRuntime.test.js` (1)
- [ ] handles click/double-click/right-click and refresh events

### `src/js/app/__tests__/windowActivation.test.js` (2)
- [ ] activates and focuses window on macOS
- [ ] returns false for missing window

### `src/js/modules/__tests__/backupView.performance.test.js` (5)
- [ ] hints timer starts only when backup tab is active and pauses on tab switch
- [ ] renders downloader-like backup header and places hints in header right slot
- [ ] large backup list uses no-animation mode on rerenders
- [ ] list rerender does not mass-dispose tooltip instances
- [ ] virtualizes backup rows for large pages

### `src/js/modules/__tests__/contextMenu.test.js` (1)
- [ ] hides context menu immediately when delete confirmation opens

### `src/js/modules/__tests__/downloaderToolsStatus.test.js` (4)
- [ ] shows ready state when yt-dlp/ffmpeg/Deno present
- [ ] shows error state when tools missing
- [ ] reinstall triggers installAll and refresh
- [ ] close hides container until settings shows it

### `src/js/modules/__tests__/downloaderView.test.js` (1)
- [ ] builds tools-like hero without breadcrumbs

### `src/js/modules/__tests__/downloadManager.test.js` (17)
- [ ] loadQueueFromStorage filters invalid entries and exact duplicates
- [ ] persistQueue stores the queue in localStorage
- [ ] adds to queue without starting download when enqueueOnly is true
- [ ] does not enqueue URL that already exists in history
- [ ] allows enqueue when URL exists in history but requested mode differs
- [ ] does not pass remembered quality label when audio profile is selected
- [ ] allows same URL with different quality labels in queue
- [ ] blocks duplicate queue item with same URL and same quality
- [ ] supports moving queue item up/down from queue controls
- [ ] applies full-limit status class when queue reaches max size
- [ ] renders active downloads with status chip and separate active counter
- [ ] renders failed items and retries failed task by action button
- [ ] adds and removes is-active on progress container around download
- [ ] keeps completed progress briefly before reset
- [ ] queues new task when parallel pool is full
- [ ] starts download immediately when one slot is still free
- [ ] starts next pending task when one active download completes

### `src/js/modules/__tests__/downloadProgress.test.js` (3)
- [ ] supports legacy numeric progress payload
- [ ] aggregates object payload progress for two active jobs
- [ ] resets tracking when download state transitions to idle

### `src/js/modules/__tests__/downloadQualityModal.test.js` (11)
- [ ] closes modal when close button is clicked
- [ ] downloads preview image from quality modal
- [ ] copies source url from quality modal
- [ ] shows fallback when preview thumbnail is missing
- [ ] renders quality metrics collapsed by default
- [ ] expands metrics only for selected card toggle
- [ ] collapses metrics again when toggle is clicked second time
- [ ] does not change selected option or trigger confirm on metrics toggle
- [ ] resolves preview resolution from thumbnails metadata
- [ ] enqueues selected option on A hotkey
- [ ] hides selection/actions and disables enqueue while formats are loading

### `src/js/modules/__tests__/firstRunModal.test.js` (2)
- [ ] shows modal on first run and applies selections
- [ ] does not show modal when already completed

### `src/js/modules/__tests__/historyActions.test.js` (1)
- [ ] refresh button updates search query and pulls history

### `src/js/modules/__tests__/historyView.test.js` (8)
- [ ] applies density class and active button
- [ ] groups entries by date with labels
- [ ] moves secondary actions into menu
- [ ] toggles control-deck more menu and closes on escape
- [ ] enables virtualized rendering for large history pages
- [ ] keeps full render for small history pages
- [ ] toggles details when clicking history row body
- [ ] renders copy controls for source and file detail rows

### `src/js/modules/__tests__/network.test.js` (3)
- [ ] shows error toast on offline event
- [ ] shows success toast on online event
- [ ] does not require network indicator DOM nodes

### `src/js/modules/__tests__/settings.test.js` (18)
- [ ] shows badge and marks button disabled when disabled = true
- [ ] hides badge and removes disabled class when disabled = false
- [ ] silently ignores unknown module keys
- [ ] shows badge as off when stored flag is true
- [ ] is disabled by default and persists checkbox changes
- [ ] syncs label and calls setLanguage on click
- [ ] initializes remember mode from storage and updates summary
- [ ] switches to audio on click and persists value
- [ ] supports keyboard selection and restores state on open-settings
- [ ] activates developer tools with correct secret word
- [ ] does not activate developer tools with invalid secret
- [ ] disables developer tools on second click when already enabled
- [ ] migrates legacy value 3 to 2 and reflects segment state
- [ ] writes 1/2 and dispatches download:parallel-limit-changed on segment click
- [ ] syncs checkbox with storage and dispatches tools:visibility
- [ ] opens and closes tools modal from downloader settings card
- [ ] collectCurrentConfig does not expose appearance.showNetworkStatus
- [ ] applyConfig clears legacy topbarNetworkStatusVisible key

### `src/js/modules/__tests__/settingsModal.test.js` (4)
- [ ] opens and closes mobile sections panel via toggle
- [ ] closes mobile panel and updates active label after tab click
- [ ] restores label from saved lastSettingsTab on init
- [ ] openSettings resets mobile panel state and syncs label

### `src/js/modules/__tests__/toolsInfo.test.js` (14)
- [ ] renders dynamic tools UI with ti- prefixed ids
- [ ] shows tools version summary when all tools exist
- [ ] install button downloads when tools are missing
- [ ] shows install progress text on install button while downloading tools
- [ ] check button reveals update flow when updates are available
- [ ] force reinstall from overflow menu triggers installAll
- [ ] updates summary after successful install
- [ ] migrate button respects overwrite confirmation
- [ ] does not recreate root DOM on repeated refresh
- [ ] keeps single-bound handlers across multiple refreshes
- [ ] ignores stale refresh response and keeps latest state
- [ ] reuses existing tool card nodes on refresh (partial update)
- [ ] uses cached checkUpdates result within TTL
- [ ] shows explicit offline summary state and quick actions

### `src/js/modules/__tests__/toolsView.tools.test.js` (48)
- [ ] opens launcher by default and keeps power tool unavailable on macos
- [ ] renders combined header with breadcrumbs and tools section header
- [ ] shows total tools counter for macos
- [ ] does not render launcher hotkey labels
- [ ] renders available and unavailable sections on windows
- [ ] opens launcher by default even if last tool is stored
- [ ] restores last hash view when remember setting is enabled
- [ ] falls back to launcher when last view power is unavailable
- [ ] falls back to launcher when last view sorter is remembered
- [ ] keeps File Sorter in unavailable section and prevents opening it
- [ ] unlocks File Sorter when developer mode is enabled
- [ ] does not render converter placeholder card
- [ ] opens WG view from launcher and shows back button
- [ ] back button returns to launcher
- [ ] breadcrumbs stay visible and return to launcher
- [ ] escape in tool view returns to launcher
- [ ] Esc key variant in tool view returns to launcher
- [ ] launcher arrow navigation moves focus to next tool
- [ ] launcher arrow navigation supports reverse wrap
- [ ] does not switch tools with Alt+2
- [ ] does not switch tools with Alt+1 while typing in hash input
- [ ] hash how-to modal opens and can navigate slides
- [ ] hash how-to modal closes by Escape and returns focus
- [ ] hash how-to modal closes on overlay click
- [ ] wg how-to modal opens and can navigate slides
- [ ] wg how-to modal closes by Escape and returns focus
- [ ] wg how-to modal closes on overlay click
- [ ] power how-to modal opens and can navigate slides
- [ ] power how-to modal closes by Escape and returns focus
- [ ] power how-to modal closes on overlay click
- [ ] renders WG quick hierarchy with primary and secondary actions
- [ ] keeps WG advanced collapsed by default
- [ ] toggles WG advanced panel and persists state
- [ ] does not send WG request on Enter inside hash input
- [ ] sends WG request on Enter inside WG form
- [ ] keeps hash copy disabled in idle state
- [ ] enables hash copy and copies actual hash after verify
- [ ] compares two selected files by hash
- [ ] clears second file selection and falls back to single-file verify
- [ ] normalizes expected hash before single-file verification
- [ ] when expected hash is set, compares expected against both files
- [ ] locks hash controls while hash is calculating
- [ ] shows power tool on macos in developer mode but keeps windows actions disabled
- [ ] hides power tool on linux
- [ ] falls back to launcher when last view power is remembered on macos without developer mode
- [ ] asks confirmation before restart shortcut IPC call
- [ ] does not call shutdown IPC when confirmation is cancelled
- [ ] creates UEFI shortcut on windows

### `src/js/modules/__tests__/topBarResponsive.test.js` (4)
- [ ] opens and closes overflow by toggle
- [ ] closes overflow on Escape
- [ ] clicking proxy item triggers target click
- [ ] sets --topbar-current-height CSS variable

### `src/js/modules/__tests__/urlInputHandler.test.js` (8)
- [ ] does not show inline error while typing before blur/enter
- [ ] shows inline error on blur for invalid URL
- [ ] shows error and does not trigger download on Enter with invalid URL
- [ ] hides error and invalid style when URL becomes valid
- [ ] normalizes URL on blur, paste, drop and Enter
- [ ] does not request preview for invalid URL and keeps preview hidden
- [ ] Escape clears input, preview and inline error
- [ ] keeps current paste/clear visibility behavior

### `src/js/modules/__tests__/whatsNewModal.test.js` (3)
- [ ] keeps allowed tags
- [ ] removes script tags
- [ ] strips javascript: href

### `src/js/scripts/__tests__/download.selectFormats.test.js` (2)
- [ ] falls back by quality label when stored format IDs are unavailable
- [ ] falls back to audio-only when object has stale audio format ID

<!-- AUTO-JEST-TESTS:END -->