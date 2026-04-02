# Playlist Refactor Roadmap

## Цель

Перевести скачивание плейлистов во вкладке `Загрузчик` из текущей схемы "preview -> массив URL -> обычная очередь" в явную batch-модель, где плейлист является отдельной сущностью с собственным состоянием, прогрессом и операциями управления.

## Текущее состояние

Сейчас плейлист:

1. Определяется на этапе preview через `get-video-info`.
2. Разворачивается в массив `entries`.
3. Теряет собственную идентичность после `queue:addMany`.
4. Скачивается как набор независимых item-job.

Ограничения текущего подхода:

- нет отдельной playlist-сущности в состоянии приложения;
- нет playlist-level progress;
- нет batch retry/resume/pause;
- качество для `Добавить все` выбирается неявно;
- восстановление после рестарта работает только на уровне обычной очереди;
- orchestration размазан между preview, renderer-state и single-item download flow.

## Целевая архитектура

Рефакторинг делится на 5 слоёв:

1. Domain/state model
2. Renderer UI
3. Renderer application state
4. IPC contract
5. Main-process orchestration + persistence

Принцип: существующий single-item download pipeline сохраняется как низкоуровневый worker, а playlist orchestration выносится в отдельный слой.

## Layer 1. Domain / State Model

### Новые сущности

`PlaylistBatch`

- `id`
- `sourceUrl`
- `title`
- `totalCount`
- `totalDuration`
- `qualityPreset`
- `status`
- `createdAt`
- `updatedAt`

`PlaylistItemJob`

- `id`
- `batchId`
- `itemUrl`
- `itemTitle`
- `playlistIndex`
- `duration`
- `thumbnail`
- `status`
- `progress`
- `errorCode`
- `errorMessage`

### Нормализация статусов

Batch statuses:

- `draft`
- `queued`
- `running`
- `paused`
- `completed`
- `partial`
- `failed`
- `cancelled`

Item statuses:

- `pending`
- `running`
- `done`
- `failed`
- `skipped`
- `cancelled`

### Что это решает

- плейлист перестаёт исчезать после preview;
- очередь получает связь между item-job и исходным batch;
- появляется нормальная база для aggregate progress и batch actions.

## Layer 2. Renderer UI

### Цель

Убрать playlist-specific логику из общего URL input flow и разнести ответственность по модулям.

### Предлагаемые модули

Новые:

- `src/js/modules/playlistPreview.js`
- `src/js/modules/playlistQueueView.js`
- `src/js/modules/playlistActions.js`

Сохраняемые с упрощением ответственности:

- `src/js/modules/urlInputHandler.js`
- `src/js/modules/downloadManager.js`

### Что должно остаться в `urlInputHandler.js`

- ввод URL;
- debounce;
- базовая валидация;
- вызов preview API;
- передача результата в playlist preview module.

### Что нужно вынести из `urlInputHandler.js`

- рендер playlist actions;
- playlist-specific CTA;
- рендер первых N элементов плейлиста;
- confirm flow для batch enqueue;
- playlist selection UI.

### Целевой UX

После preview плейлиста пользователь должен явно выбрать одно из действий:

- `Скачать текущий`
- `Добавить весь плейлист`
- `Выбрать элементы`

При `Добавить весь плейлист` UI должен:

1. показать summary плейлиста;
2. предложить выбрать quality preset один раз;
3. создать batch вместо простого `queue:addMany`.

## Layer 3. Renderer Application State

### Цель

Разделить single-item queue state и playlist batch state.

### Новые модули

- `src/js/modules/playlistStore.js`
- `src/js/modules/playlistSelectors.js`

### Хранимые данные

- `downloadJobs`
- `playlistBatches`
- `playlistBatchItems`
- `activeBatchId` при необходимости

### Что убрать

- зависимость playlist flow от `CustomEvent("queue:addMany")`;
- скрытое применение `lastChosenQuality` как основного источника качества для batch.

### Что должны давать селекторы

- `getBatchProgress(batchId)`
- `getBatchPendingCount(batchId)`
- `getBatchFailedCount(batchId)`
- `getBatchCompletedCount(batchId)`
- `getBatchDisplayTitle(batchId)`

### Результат

Renderer начинает понимать не только item queue, но и сам batch как первичную сущность интерфейса.

## Layer 4. IPC Contract

### Цель

Добавить отдельный playlist API вместо неявной сборки логики из `get-video-info` и `download-video`.

### Новые IPC-каналы

Добавить в:

- `src/js/ipc/channels.js`
- `src/js/preload.js`
- `src/js/app/ipcHandlers.js`

Каналы:

- `playlist:inspect`
- `playlist:createBatch`
- `playlist:getBatches`
- `playlist:getBatch`
- `playlist:pauseBatch`
- `playlist:resumeBatch`
- `playlist:retryBatchFailed`
- `playlist:removeBatch`

### Базовые payload/contracts

`playlist:inspect(url)`:

- возвращает metadata preview;
- возвращает normalized entries;
- возвращает playlist-level summary.

`playlist:createBatch(payload)`:

- `sourceUrl`
- `qualityPreset`
- `selectedItems`
- `playlistMetadata`

`playlist:getBatch(batchId)`:

- batch metadata;
- item list;
- aggregate progress;
- batch status.

### Требования

- все payload валидируются в main-process;
- ошибки возвращаются структурированно;
- renderer не работает напрямую с `ipcRenderer`;
- вся playlist-логика использует только `window.electron.invoke(...)`.

## Layer 5. Main-Process Orchestration

### Цель

Перенести orchestration playlist batch в main-process и оставить renderer только UI-слоем.

### Новый модуль

- `src/js/app/playlistManager.js`

### Ответственность `playlistManager`

- создание batch;
- хранение batch state;
- запуск item-job в рамках лимита параллельности;
- обновление статусов item и batch;
- вычисление aggregate progress;
- pause/resume/retry/remove;
- восстановление после перезапуска.

### Взаимодействие с текущим download flow

Существующий pipeline сохраняется:

- `downloadMedia(...)` в `src/js/scripts/download.js` остаётся item-level worker;
- `download-video` можно оставить low-level API;
- `playlistManager` использует single-item worker многократно, но сам решает, когда и какие item-job запускать.

### Ключевая граница ответственности

- `playlistManager` отвечает за orchestration;
- `downloadMedia` отвечает за скачивание одного item;
- renderer отвечает за отображение и действия пользователя.

## Persistence

### Проблема

Сейчас playlist-контекст теряется, потому что очередь в основном хранится как список обычных item-записей.

### Целевое хранение

Хранить playlist batch state в main-process.

Варианты:

- `playlist_batches.json` + `playlist_items.json`
- один нормализованный store-файл

### Что нужно сохранять

- metadata batch;
- item list;
- statuses;
- quality preset;
- timestamps;
- last error per item;
- batch progress snapshot.

### Восстановление на старте

- `queued` восстанавливать как `queued`;
- `running` переводить в `pending` или `interrupted`;
- `failed` сохранять как есть;
- `completed` сохранять как архив или историю batch.

## Интеграция с очередью

### Рекомендуемый подход

Оставить одну execution queue, но два уровня представления:

- execution level: item jobs;
- UX level: playlist batches + standalone downloads.

### Правило

- standalone URL создаёт обычный item-job без `batchId`;
- playlist создаёт `PlaylistBatch` + набор `PlaylistItemJob` с `batchId`.

Это позволяет переиспользовать текущий download pipeline и не дублировать низкоуровневую логику скачивания.

## Roadmap по этапам

### Phase 1. Введение playlist-модели без переноса orchestration

Цель:

- перестать терять playlist identity;
- минимально изменить текущий flow.

Задачи:

- ввести `PlaylistBatch` и `PlaylistItemJob`;
- добавить `playlist:inspect`;
- заменить прямой `queue:addMany` на `playlist:createBatch` в renderer;
- хранить `batchId` у item-job;
- показывать grouping в UI.

Изменяемые файлы:

- `src/js/modules/urlInputHandler.js`
- `src/js/modules/downloadManager.js`
- `src/js/ipc/channels.js`
- `src/js/preload.js`
- `src/js/app/ipcHandlers.js`

Риски:

- конфликт с текущей очередью;
- дублирование batch/item state;
- переходный период с legacy queue persistence.

Результат:

- плейлист уже отображается как группа, даже если execution пока ещё частично управляется старым кодом.

### Phase 2. Renderer batch UI и явный quality flow

Цель:

- сделать UX плейлистов предсказуемым.

Задачи:

- добавить `playlistPreview.js`;
- добавить confirm flow для batch enqueue;
- убрать скрытую зависимость от `lastChosenQuality`;
- добавить отображение `playlistCount`, `done/failed/pending`, `playlistIndex`.

Изменяемые файлы:

- `src/js/modules/urlInputHandler.js`
- `src/js/modules/downloadQualityModal.js`
- `src/js/modules/playlistPreview.js`
- `src/js/modules/playlistQueueView.js`

Риски:

- UX-регрессии в single-item flow;
- смешение batch quality и per-item quality.

Результат:

- пользователь всегда явно понимает, какое качество применяется ко всему плейлисту.

### Phase 3. Перенос orchestration в main-process

Цель:

- сделать main-process единственным источником истины для playlist batch.

Задачи:

- создать `src/js/app/playlistManager.js`;
- вынести batch scheduling из renderer;
- добавить batch pause/resume/retry/remove;
- передавать progress/state updates в renderer через IPC.

Изменяемые файлы:

- `src/js/app/playlistManager.js`
- `src/js/app/ipcHandlers.js`
- `src/js/modules/playlistStore.js`
- `src/js/modules/playlistQueueView.js`

Риски:

- сложность синхронизации progress;
- race conditions при cancel/retry;
- миграция текущих queue jobs.

Результат:

- orchestration надёжнее, batch state переживает UI-перерисовки и меньше зависит от localStorage.

### Phase 4. Persistence и recovery

Цель:

- восстановление playlist batch после рестарта.

Задачи:

- реализовать batch persistence в main-process;
- восстановление batch/item state при старте приложения;
- определить политику для interrupted jobs;
- синхронизировать восстановленное состояние с renderer.

Изменяемые файлы:

- `src/js/app/playlistManager.js`
- `src/js/app/ipcHandlers.js`
- новый persistence helper в `src/js/app`

Риски:

- несовместимость со старым форматом очереди;
- некорректное восстановление running-state;
- дубликаты item-job после crash/restart.

Результат:

- пользователь видит не просто "остатки очереди", а полноценное восстановление состояния плейлиста.

### Phase 5. Advanced playlist UX

Цель:

- сделать playlist workflow полноценным, а не компромиссным.

Задачи:

- выбор отдельных элементов;
- range selection;
- retry failed in batch;
- skip already downloaded;
- фильтры по длительности/типу;
- preview первых N элементов с metadata.

Изменяемые файлы:

- `src/js/modules/playlistPreview.js`
- `src/js/modules/playlistQueueView.js`
- `src/js/modules/playlistActions.js`

Риски:

- рост сложности UI;
- перегрузка интерфейса;
- необходимость дополнительных тестов на accessibility и keyboard flow.

Результат:

- playlist становится полноценным user workflow с управлением на уровне batch.

## Минимальный практический вариант

Если нужен pragmatic path с минимальной стоимостью, стоит ограничить первый релиз такими изменениями:

1. Ввести `playlist:createBatch`.
2. Добавить `batchId` у queue items.
3. Группировать item-job по batch в UI.
4. Убрать implicit quality через `lastChosenQuality`.
5. Не трогать пока `downloadMedia(...)`.

Это даст большую часть UX-пользы без полной перестройки execution layer.

## Основные файлы-кандидаты на изменение

Существующие:

- `src/js/modules/urlInputHandler.js`
- `src/js/modules/downloadManager.js`
- `src/js/modules/downloadJobs.js`
- `src/js/modules/downloadQualityModal.js`
- `src/js/app/ipcHandlers.js`
- `src/js/preload.js`
- `src/js/ipc/channels.js`
- `src/js/scripts/download.js`

Новые:

- `src/js/app/playlistManager.js`
- `src/js/modules/playlistPreview.js`
- `src/js/modules/playlistStore.js`
- `src/js/modules/playlistSelectors.js`
- `src/js/modules/playlistQueueView.js`
- `src/js/modules/playlistActions.js`

## Критерии готовности

Можно считать рефакторинг успешным, если выполняются условия:

- плейлист хранится как batch-сущность;
- item-job не теряют связь с batch;
- качество для batch задаётся явно;
- batch progress виден в UI;
- retry/pause/resume работают на уровне batch;
- состояние batch восстанавливается после рестарта;
- single-item download flow не деградирует.

## Рекомендация по запуску работ

Оптимальный порядок реализации:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5

Не рекомендуется начинать сразу с persistence или advanced UX, пока playlist не стал явной доменной сущностью и пока orchestration не вынесен из renderer.
