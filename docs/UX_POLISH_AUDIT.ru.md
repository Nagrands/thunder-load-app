# Аудит UX-полировки Thunder

Дата прохода: 9 августа 2026 года. Исходная версия: Thunder 1.6.0, commit `0096078`.

## Единый контракт

Интерактивные поверхности используют состояния `Idle | Loading | Success | Warning | Error | Empty`. Общая модель содержит `kind`, локализованные title/message, progress, actions и `operationId`; контроллер синхронизирует `aria-busy`, `aria-live`, tone и структурный skeleton. Для существующей разметки предусмотрен лёгкий adapter, не меняющий бизнес-логику.

Determinate progress показывает реальное значение, этап и доступную ETA. Если значение неизвестно, используется indeterminate progress без фиктивных процентов. Spinner остаётся внутри локального действия, а skeleton — только для загрузки структуры.

## Карта поверхностей

| Поверхность | Раньше | Новый контракт и взаимодействие | Подтверждающий тест |
| --- | --- | --- | --- |
| Desktop foundation | Разрозненные status-блоки, toast и контекстные меню | Общий state controller, operation-aware notification, action menu, motion/focus tokens | `uiStateController.test.js`, `toast.test.js`, `actionMenu.test.js` |
| Downloader preview и очередь | Независимые строки статуса и отдельные удаления | Summary получает loading/success/warning/error/empty; удаление завершённых/ошибочных jobs и очистка неактивной очереди имеют единый Undo | `downloadManager.test.js`, профильные preview tests |
| History | Удаление записи требовало confirmation и сразу очищало preview | Metadata удаляется сразу; один Undo атомарно восстанавливает history, preview очищается после окна Undo | `contextMenu.test.js` |
| Player / Media Library | Свои loading/error состояния; обратимые удаления подтверждались | Loading/success/warning/error размечены общим adapter; track, playlist и library metadata получают snapshot-based Undo | `nowPlayingView.test.js`, `nowPlayingMediaLibraryModel.test.js` |
| Converter / Inspector / Sorter / Hash / Formatter | Несогласованные result/status элементы | Существующие сообщения сохранены, но получают общий state, live-region и busy contract | `toolsView.tools.test.js`, `productFormatterView.test.js` |
| Backup / dependency install / WireGuard / power actions | Собственные inline progress и опасные диалоги | Сохранены существующие содержательные состояния; filesystem/system операции остаются в danger policy, декоративные confirmation не добавлены | профильные Tools, Backup и power-action tests |
| Settings | Reset и import errors использовали нативные prompt/alert | Полный reset использует shared danger modal; import error — notification; обычные toggles не открывают modal | `settingsModal.test.js`, `settings.test.js`, `modals.confirmationHtml.test.js` |
| Web Control | Status tones были локальными, actions занимали строку, dirty close использовал native confirm | Независимый DOM adapter повторяет контракт; initial queue skeleton, touch/keyboard kebab menu, custom RU/EN dirty-choice modal | `webControlUi.test.js`, `webSettings.test.js` |
| Windows tray | Нативно ограниченная поверхность | Сохранены единые иконки, disabled/check/danger и keyboard focus; skeleton, custom tooltip и CSS motion намеренно не переносятся в нативное меню | `windowsTrayMenu.test.js`, `window.trayRuntime.test.js` |

## Confirmation и Undo policy

- Confirmation остаётся перед физическим удалением файла, изменением оригиналов, полным reset конфигурации и системной destructive-командой.
- Choice dialogs «один или все» и «плейлист или медиатека» сохранены как выбор результата, а не как ложное подтверждение.
- History, queue, playlist и Media Library metadata удаляются сразу. Undo хранит снимок persisted state и восстанавливает его атомарно.
- Отложенная очистка preview выполняется один раз после окна Undo; отмена очистки не оставляет второй timer.
- Массовое действие создаёт один агрегированный toast. Notification с одним operation ID обновляется на месте от loading до результата; одновременно видны не более пяти уведомлений.
- Inline feedback принадлежит текущей поверхности. Toast используется для фонового или межэкранного результата; существующая настройка системных уведомлений и проверка активности окна не обходятся новым UI foundation.

## Доступность и движение

- Hover продублирован `focus-visible`; disabled controls не получают интерактивный feedback.
- Action menu поддерживает кнопку «ещё», правый клик, клавиатуру, Escape и возврат фокуса владельцу.
- Ошибка получает `role=alert`/assertive live-region, остальные состояния — polite; loading выставляет `aria-busy=true`.
- Время переходов ограничено 120–250 мс. `prefers-reduced-motion` убирает перемещения, shimmer и декоративные анимации в Desktop и Web Control.
- Tooltips применяются к иконкам, сокращённому тексту и shortcut-подсказкам; основные статусы и названия остаются видимыми либо имеют `aria-label`.

## Проверка и release gates

Автоматически проверяются state transitions, Retry/stale guards в существующих контроллерах, Undo, keyboard menu, focus restoration, live-region и generated artifacts. Финальный проход включает профильные Jest suites, `test-check:sync`, `typecheck:player`, `pnpm run check`, builds Whats New/templates/CSS и `git diff --check`.

Ручная матрица RU/EN, light/dark, reduced motion, zoom/font size, compact window, Web Control desktop/mobile и packaged macOS/Windows остаётся release gate. Windows packaged smoke должен отдельно подтвердить tray/menu поведение на реальном DPI и с screen reader; результаты Jest не считаются заменой этой проверки.
