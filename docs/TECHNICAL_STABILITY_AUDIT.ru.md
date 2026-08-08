# Технический аудит стабильности Thunder

Дата аудита: 8 августа 2026 года. Версия исходного состояния: Thunder 1.6.0.

## Методика

Проверена цепочка `renderer → preload → IPC → main → child process/network` для Downloader, Player, Media Library, Tools, Settings и Web Control. Для каждого долгоживущего ресурса определены владелец, точка создания, отмена и окончательное уничтожение. Гонки подтверждались чтением обеих сторон async-границы и регрессионным тестом до изменения поведения.

Холодный запуск измеряется встроенным `startupMetrics` по десяти запускам одной сборки на одном компьютере. Unit/integration-тесты не заменяют этот замер и packaged smoke на Windows/macOS; ручные результаты следует дописать перед релизом.

## Карта владения ресурсами

| Область | Ресурс | Единственный владелец | Создание | Завершение |
| --- | --- | --- | --- | --- |
| Main | IPC runtime | application runtime | после создания окна | tracked `dispose()` перед новым окном и при shutdown |
| Player | `PlaybackController` и две media layers | `NowPlayingView` | лениво при первом открытии Player | awaited `controller.dispose()` |
| Player | HLS server/session/FFmpeg | `NowPlayingHlsService` | для несовместимого или multitrack media | `closeSession()`/`dispose()`, затем supervisor fallback |
| Media Library | ffprobe/FFmpeg import tasks | main media service | на импорт/анализ | timeout, завершение операции или общий supervisor |
| Downloader | job token, HTTP и yt-dlp/FFmpeg | конкретный download job | после принятия `jobId` | cancel job, completion или shutdown |
| Tools | Converter/Inspector/Backup child process | конкретный tool request | после валидации payload | cancel/timeout/view disposal/shutdown |
| Tools UI | listeners/timers/IPC subscriptions | tool cleanup registry | при render вкладки | при `onHide`/повторном render |
| Settings | диагностические handlers | Settings runtime | один раз при renderer bootstrap | renderer runtime disposal |
| Web Control | HTTP server, SSE clients и pending IPC | `WebControlServer` | только при включённой настройке | сериализованный `stop()`/`dispose()` |
| Background | clipboard polling | `ClipboardMonitor` | только если настройка включена | toggle off или shutdown |

## Найденные первопричины и исправления

### Критический риск: повторная регистрация IPC

- **Причина:** `app.activate` мог повторно вызвать `main()`, а `setupIpcHandlers()` регистрировал глобальные `ipcMain.handle/on` без ownership и cleanup.
- **Проявление:** duplicate handler, старые замыкания на уничтоженное окно, двойные события.
- **Исправление:** регистраторы получают tracked IPC facade. Перед новым window runtime снимаются только принадлежащие ему handlers/listeners; Player services возвращают awaited disposer.
- **Доказательство:** `ipcRuntime.test.js`; повторный `dispose()` идемпотентен и не использует `removeAllListeners`.

### Высокий риск: Tray и window controls сохраняли первое окно

- **Причина:** application-owned Tray замыкался на первый `BrowserWindow`, а `window-minimize`/`window-close` регистрировались напрямую в `window.js` при каждом создании окна. Tray также добавлял отдельный `before-quit`.
- **Проявление:** после recreate команды Tray могли обращаться к уничтоженному окну, а глобальные IPC listeners накапливались.
- **Исправление:** Tray остаётся одним application resource, но разрешает актуальное окно при каждом действии; его dispose выполняет shutdown coordinator. Window control IPC перенесены в tracked registrar, мёртвый `download-finished` listener удалён.
- **Доказательство:** `window.trayRuntime.test.js` создаёт два окна, подтверждает один Tray/listener и действие только на втором окне; `uiSettingsIpcHandlers.test.js` проверяет централизованные window channels.

### Критический риск: конкурирующее завершение приложения

- **Причина:** main, Player HLS и сервисы независимо слушали `before-quit`; Web Control и HLS очищались fire-and-forget.
- **Исправление:** один `ShutdownCoordinator` переводит runtime `running → stopping → stopped`, ожидает IPC/Player, процессы, Web Control, clipboard, shortcuts и updater, затем повторяет quit один раз.
- **Доказательство:** `shutdownCoordinator.test.js` и `nowPlayingIpcHandlers.test.js`.

### Критический риск: повторный quit не завершал packaged macOS process

- **Сценарий воспроизведения:** запустить unsigned `mac-arm64/Thunder.app`, выбрать `Thunder → Quit Thunder`, дождаться `shutdown-task-completed` и проверить PID приложения.
- **Причина:** обработчик `BrowserWindow.close` повторно вызывал `app.quit()` при уже установленном `app.isQuitting`; повторный quit также начинался внутри незавершённого event-loop turn исходного `before-quit`.
- **Исправление:** при `app.isQuitting` окно закрывается без re-entrant `app.quit()`, а завершающий quit ставится через `setImmediate` после awaited cleanup.
- **Доказательство:** `window.trayRuntime.test.js` и packaged smoke: два ожидаемых `app-before-quit`, cleanup за 7 мс в idle-сценарии и полное исчезновение PID.

### Высокий риск: глобальный Downloader token

- **Причина:** параллельный download перезаписывал `activeDownloadToken`, а завершение одного job сбрасывало token другого.
- **Исправление:** глобальный fallback удалён. Отмена и shutdown получают точные tokens из `activeDownloads`/video-info registry.
- **Доказательство:** queue/cancel тесты и `ipcHandlers.toolsActions`.

### Высокий риск: неожидаемый Player teardown

- **Причина:** `PlaybackController.dispose()` запускал `releaseAllLayers()` через `void`, после чего view немедленно очищал providers.
- **Исправление:** dispose возвращает один Promise, гасит обе media layers и ожидает все `releasePlayback()` до очистки providers.
- **Доказательство:** stress-тест 100 быстрых переключений и блокирующий final release.

### Средний риск: повторная инициализация Downloader preview

- **Причина:** preview-модули запускались в renderer bootstrap и повторно в factory вкладки.
- **Исправление:** инициализация оставлена только владельцу DOM — factory вкладки Downloader.
- **Доказательство:** `bootstrapRenderer.test.js` проверяет отсутствие второго вызова.

### Высокий риск: Web Control pending work

- **Причина:** stop не отклонял pending renderer requests, SSE timers зависели от позднего `close`, start/stop/restart могли пересекаться.
- **Исправление:** lifecycle сериализован, pending requests получают `WEB_CONTROL_STOPPED`/`RENDERER_UNAVAILABLE`, SSE timers очищаются сразу, ошибки имеют correlation ID.
- **Доказательство:** `webControlServer.test.js` проверяет конкурентный start и остановку pending request.

### Высокий риск: Web Control обрывал штатный preview

- **Сценарий воспроизведения:** запросить форматы YouTube через packaged Web Control. Main ожидал renderer 8 секунд, тогда как два последовательных шага `get-video-info` завершались примерно за 15 секунд.
- **Причина:** общий `REQUEST_TIMEOUT_MS` применялся к быстрым snapshot/settings и к внешнему `preview:get`; после timeout main забывал request, но renderer-owned `yt-dlp` продолжал работу и отправлял поздний ответ.
- **Исправление:** для `preview:get` установлен ограниченный 45-секундный timeout. Timeout и stop отправляют `web:rendererCancel`; renderer отменяет соответствующий video-info job. Bridge повторно инициализируется идемпотентно и возвращает disposer.
- **Доказательство:** профильные server/bridge тесты подтверждают работу preview дольше 8 секунд и propagation отмены. В повторном packaged smoke тот же URL вернул полный список форматов примерно за 15 секунд.

### Высокий риск: Downloader перезаписывал одноимённый файл

- **Сценарий воспроизведения:** скачать тот же title в другом качестве в папку, где уже существует финальный файл.
- **Причина:** `safeMoveFile()` сначала безусловно удалял destination, затем переименовывал временный artifact.
- **Исправление:** финализация выбирает первое свободное имя `name (N).ext` и никогда не удаляет существующий destination. Правило применяется к combined/direct/audio/subtitle outputs.
- **Доказательство:** `download.selectFormats.test.js` сохраняет исходный и уже существующий `name (1)`, затем подтверждает перенос нового результата в `name (2)`.

### Системный риск: разрозненные процессы и журналы

- **Причина:** Downloader, Converter, Backup, Media Library и Player использовали независимые `spawn/execFile`; stderr записывался как `error` даже при штатном прогрессе.
- **Исправление:** `ProcessSupervisor` регистрирует owner/tool/PID/correlation ID, поддерживает AbortSignal/timeout, `SIGTERM` и уничтожение дерева через `SIGKILL`. Сырой stderr yt-dlp/FFmpeg переведён на `debug`.
- **Доказательство:** `processSupervisor.test.js` и профильные Downloader/Player/Tools тесты.

### Средний риск: фоновые проверки Tools на каждом запуске

- **Причина:** Downloader footer после локального `tools:getVersions` автоматически запускал полный `tools:checkUpdates`, повторно вызывая yt-dlp/FFmpeg/Deno и сетевые проверки без открытия Tools.
- **Исправление:** footer ограничен локальной проверкой доступности; сетевые update checks выполняются только в явно открытом представлении Tools.
- **Доказательство:** `downloaderToolsStatus.test.js` проверяет отсутствие `tools:checkUpdates` при инициализации.

## Логирование и приватность

Main-owned logger использует уровни `debug/info/warning/error` и scopes `Main`, `IPC`, `Downloader`, `Player`, `MediaLibrary`, `Tools`, `Settings`, `FFmpeg`, `yt-dlp`, `WebControl`. IPC фиксирует начало, завершение, duration и correlation ID без payload. По умолчанию записывается `info`; `debug` включается вручную в Settings.

Логи ограничены пятью файлами по 10 МБ. Перед записью и экспортом скрываются token/cookie/authorization/secret параметры. ZIP содержит только логи и manifest с версиями Thunder/Electron/Node/ОС; медиатека, cookies и настройки не добавляются.

Renderer Settings/Downloader/Web Control ошибки проходят через безопасный preload diagnostics API. Разрознённые `console.*` в проверенных main/Settings/Player/Downloader/Web Control путях удалены; сохранён только аварийный stderr fallback внутри самого logger на случай отказа ротации файла.

## Платформенная проверка

- Профильные тесты выполняются на каждом этапе.
- Полный lint/typecheck/Jest и generated-artifact sync обязательны перед завершением задачи.
- Свежая unsigned `mac-arm64` сборка успешно создана через `electron-builder --dir`; ICNS проверен packaged-валидатором.
- Выполнено десять последовательных запусков финальной сборки: median `main window created and IPC ready` — 213,8 мс, median `renderer finished load` — 416,55 мс. Относительно десяти прогонов непосредственно до удаления фонового update-check это +0,7% и −1,3% соответственно, то есть регрессии critical time-to-ready нет. В журнале до всей стабилизации нет десяти однородных baseline-запусков, поэтому сравнение со старой архитектурой не заявляется.
- macOS packaged smoke подтвердил idle quit и quit при активном Player/HLS. Playback-owned FFmpeg завершён контролируемым fallback `SIGKILL`; полный shutdown занял 1,527 с, оставшихся Thunder/yt-dlp/FFmpeg/ffprobe процессов нет.
- Отдельный macOS packaged smoke подтвердил цикл close → activate → recreate: после закрытия окна application process остался жив, повторная активация создала рабочее окно, а финальный quit выполнил единственную последовательность coordinator cleanup за 7 мс. После выхода не осталось Thunder/yt-dlp/FFmpeg/ffprobe процессов; packaged ICNS повторно прошёл валидатор.
- macOS Web Control packaged smoke подтвердил `/downloader`, `/settings`, status/state/settings API, SSE `ready/state`, 15-секундный preview и реальный запуск Downloader. При quit активный Downloader-owned `yt-dlp` получил `SIGTERM`, Web Control остановился, весь shutdown занял 577 мс; оставшихся Thunder/yt-dlp/FFmpeg/ffprobe процессов нет.
- После smoke Web Control выключен, download path, очередь и история возвращены к исходному состоянию, тестовая временная папка удалена. Пользовательский файл, затронутый найденной collision-проблемой, восстановлен до исходного размера 160 307 238 байт.
- Windows packaged smoke должен проверить tree termination yt-dlp/FFmpeg и повторное создание окна.

Ручные packaged-пункты являются release gate и не считаются выполненными только по результатам Jest.
