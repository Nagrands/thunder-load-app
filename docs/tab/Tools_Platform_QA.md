---
tags: [tools, qa, windows, macos, smoke, regression]
alias: Проверка Tools на Windows и macOS
---

# Проверка блока «Инструменты» на Windows и macOS

Этот документ нужен для ручного smoke/regression прогона вкладки `Tools` и блока `#tools-info` в `Settings -> Downloader`.

## Подготовка окружения

1. Использовать одинаковую версию сборки приложения на Windows 10/11 и macOS.
2. Запустить с чистым профилем (или очистить настройки `Tools`).
3. Проверить online и offline сценарии (временное отключение сети).

## Автоматически подтверждено

Покрытие платформенных веток подтверждено тестами:

- `src/js/modules/__tests__/toolsView.tools.test.js`
- `src/js/modules/__tests__/toolsInfo.test.js`
- `src/js/app/__tests__/ipcHandlers.toolsActions.test.js`

Проверенные контракты:

- `window.electron.getPlatformInfo()`
- `window.electron.tools.*`
- `tools:status` + UI состояния `#tools-info`

## Чек-лист ручной проверки

1. **Smoke вход в Tools**

- Открыть вкладку `Tools`.
- Проверить launcher, счетчик инструментов, переходы между инструментами.
- Ожидание на macOS: Windows-действия не выполняются; developer-preview доступен только после разблокировки developer tools.
- Ожидание на Windows: power-раздел активен, ярлыки создаются.

2. **Settings -> Downloader -> `#tools-info`**

- Проверить compact summary, badge, раскрытие `details`, quick actions.
- Ожидание: действия `Проверить обновления`, `Обновить`, `Папка`, `Дополнительно` работают без полного перерендеринга.

3. **Lifecycle зависимостей**

- Выполнить `Проверить обновления`.
- Если есть апдейты: выполнить `Обновить`.
- Если инструментов нет: выполнить `Скачать зависимости`.
- Проверить обновление статусов и версий.

4. **Папка инструментов (Location flow)**

- `Выбрать папку` -> `Открыть папку` -> `Сбросить` -> `Мигрировать` (если доступно).
- Проверить тосты/ошибки и фактическое открытие пути в системе.

5. **Hash tool**

- Выбрать файл, рассчитать хеш, проверить копирование.
- Сравнить два файла, проверить сценарий с expected hash.
- Убедиться, что во время вычисления блокируются повторные действия.

6. **File Sorter**

- Создать и изменить категории, проверить валидацию повторяющихся расширений и
  сброс стандартных правил.
- Выполнить обязательный предпросмотр, применить только часть выбранных операций
  и убедиться, что изменение настроек инвалидирует старый план.
- Проверить поиск, фильтры, выбор всех видимых строк, конфликты имен, экспорт,
  открытие папки и отмену последнего запуска.

7. **Power shortcuts**

- Windows: создать все доступные ярлыки, проверить наличие файлов на Desktop и корректный запуск.
- macOS: действия Windows не должны выполняться; должен быть корректный `unsupported/disabled`.

8. **Media Inspector**

- Выбрать видео или аудиофайл и выполнить анализ.
- Проверить контейнер, потоки, кодеки, предупреждения, копирование отчета и открытие папки.
- При недоступном `ffprobe` должен отображаться понятный dependency error.

9. **WG Unlock**

- Проверить загрузку текущей конфигурации, preview изменений и запуск поддерживаемого сценария.
- Убедиться, что платформенные команды и подсказки соответствуют текущей ОС.

10. **Backup**

- Создать профиль, выполнить префлайт и запустить резервное копирование.
- Проверить лог, открытие source/destination, фильтры, bulk actions и обработку ошибок.

11. **WinGet Installer**

- Windows: проверить статус пакетов, генерацию скрипта, запуск и остановку операции.
- macOS: должен отображаться preview без запуска Windows-команд.

12. **Регресс устойчивости**

- 5-10 раз открыть/закрыть `Settings` и `Tools`, переключать вкладки.
- Убедиться, что нет визуальных вспышек, утечек слушателей и повторной привязки обработчиков.

## Матрица фиксации результатов

Заполнить после ручного прогона.

| Feature                                       | Windows (actual) | Windows (status) | macOS (actual) | macOS (status) | Notes / screenshot |
| --------------------------------------------- | ---------------- | ---------------- | -------------- | -------------- | ------------------ |
| Tools launcher + счетчик                      |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| Tools navigation / back / shortcuts           |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| `#tools-info` compact summary + quick actions |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| Check updates / update / install flow         |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| Tools location flow                           |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| Hash tool                                     |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| Media Inspector                               |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| File Sorter preview / selected apply / undo   |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| WG Unlock                                     |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| Backup                                        |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| Power shortcuts (Windows-specific)            |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| WinGet Installer                              |                  | PASS/FAIL        |                | PASS/FAIL      |                    |
| Reopen stability (5-10 циклов)                |                  | PASS/FAIL        |                | PASS/FAIL      |                    |

## Критерии приемки

1. Инструменты открываются и основные сценарии работают на обеих ОС.
2. Windows-специфичные действия выполняются только на Windows.
3. На macOS нет ложной доступности Windows-функций.
4. `#tools-info` стабильно обновляет состояние без полного перерендеринга.
5. Нет платформенных регрессий для WG Unlock, hash, media inspector, sorter, Backup, WinGet, location и update сценариев.
