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

### Критический риск: конкурирующее завершение приложения

- **Причина:** main, Player HLS и сервисы независимо слушали `before-quit`; Web Control и HLS очищались fire-and-forget.
- **Исправление:** один `ShutdownCoordinator` переводит runtime `running → stopping → stopped`, ожидает IPC/Player, процессы, Web Control, clipboard, shortcuts и updater, затем повторяет quit один раз.
- **Доказательство:** `shutdownCoordinator.test.js` и `nowPlayingIpcHandlers.test.js`.

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

### Системный риск: разрозненные процессы и журналы

- **Причина:** Downloader, Converter, Backup, Media Library и Player использовали независимые `spawn/execFile`; stderr записывался как `error` даже при штатном прогрессе.
- **Исправление:** `ProcessSupervisor` регистрирует owner/tool/PID/correlation ID, поддерживает AbortSignal/timeout, `SIGTERM` и уничтожение дерева через `SIGKILL`. Сырой stderr yt-dlp/FFmpeg переведён на `debug`.
- **Доказательство:** `processSupervisor.test.js` и профильные Downloader/Player/Tools тесты.

## Логирование и приватность

Main-owned logger использует уровни `debug/info/warning/error` и scopes `Main`, `IPC`, `Downloader`, `Player`, `MediaLibrary`, `Tools`, `Settings`, `FFmpeg`, `yt-dlp`, `WebControl`. IPC фиксирует начало, завершение, duration и correlation ID без payload. По умолчанию записывается `info`; `debug` включается вручную в Settings.

Логи ограничены пятью файлами по 10 МБ. Перед записью и экспортом скрываются token/cookie/authorization/secret параметры. ZIP содержит только логи и manifest с версиями Thunder/Electron/Node/ОС; медиатека, cookies и настройки не добавляются.

## Платформенная проверка

- Профильные тесты выполняются на каждом этапе.
- Полный lint/typecheck/Jest и generated-artifact sync обязательны перед завершением задачи.
- Десять cold starts одной packaged-сборки требуют ручного замера; допустимая регрессия median critical time-to-ready — не более 10%.
- macOS packaged smoke должен проверить quit с активным Player/Downloader/Web Control и отсутствие дочерних процессов.
- Windows packaged smoke должен проверить tree termination yt-dlp/FFmpeg и повторное создание окна.

Ручные packaged-пункты являются release gate и не считаются выполненными только по результатам Jest.
