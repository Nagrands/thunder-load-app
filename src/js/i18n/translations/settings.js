export const settingsTranslations = {
  ru: {
    "settings.tabs.general": "Общие",
    "settings.tabs.downloader": "Загрузчик",
    "settings.tabs.wg": "Инструменты",
    "settings.tabs.backup": "Инструмент Backup",
    "settings.tabs.appearance": "Внешний вид",
    "settings.tabs.about": "О приложении",
    "settings.tabs.other": "Другое",
    "settings.sections.menu": "Разделы",
    "settings.sections.toggle": "Показать разделы настроек",
    "settings.tab.enabled": "Вкл",
    "settings.tab.disabled": "Выкл",
    "settings.startup.title": "Настройки запуска",
    "settings.startup.hint":
      "Настройте параметры запуска для удобного использования.",
    "settings.startup.autolaunch":
      "<strong>Автоматически запускать</strong> при старте системы",
    "settings.startup.minimize":
      "<strong>Сворачивать</strong> приложение при запуске",
    "settings.startup.openTab": "При запуске открывать",
    "settings.startup.openTabHint":
      "Выберите вкладку, которая будет открываться по умолчанию при запуске приложения.",
    "settings.close.title": "Закрытие приложения",
    "settings.close.hint":
      "Выберите, как приложение должно вести себя при закрытии.",
    "settings.close.toTray": "<strong>Сворачивать</strong> в трей",
    "settings.close.notify": "<strong>Уведомление</strong> о сворачивании",
    "settings.close.exit": "<strong>Выйти</strong> из приложения",
    "settings.downloader.title": "Вкладка «Загрузчик»",
    "settings.downloader.profile.open": "При открытии",
    "settings.downloader.profile.title": "Выбор качества загрузки",
    "settings.downloader.profile.default": "по умолчанию",
    "settings.downloader.profile.segment.aria":
      "Выбор профиля качества загрузки",
    "settings.downloader.profile.segment.remember": "Последний",
    "settings.downloader.profile.segment.audio": "Аудио",
    "settings.downloader.profile.summary.remember.title": "Последний выбор",
    "settings.downloader.profile.summary.remember.hint":
      "Повторяет прошлый тип потока.",
    "settings.downloader.profile.summary.audio.title": "Только аудио",
    "settings.downloader.profile.summary.audio.hint":
      "Сразу показывает звуковые форматы.",
    "settings.downloader.profile.remember.title": "Последний выбор",
    "settings.downloader.profile.remember.desc":
      "Откроет тот же тип потока, что и в прошлый раз.",
    "settings.downloader.profile.audio.title": "Аудио",
    "settings.downloader.profile.audio.desc":
      "Открывает только звуковые дорожки без видео.",
    "settings.downloader.parallel.title": "Одновременные загрузки",
    "settings.downloader.parallel.hint":
      "2 быстрее, но выше нагрузка на систему.",
    "settings.downloader.parallel.option1": "1",
    "settings.downloader.parallel.option2": "2",
    "settings.downloader.parallel.aria": "Выбор лимита одновременных загрузок",
    "settings.downloader.parallel.saved":
      "Лимит одновременных загрузок: {count}",
    "settings.downloader.layout.hint":
      "Основные параметры загрузки и поведения окна.",
    "settings.downloader.group.parallel": "Параллельность и запуск",
    "settings.downloader.group.behavior": "Поведение окна и завершения",
    "settings.downloader.advanced.title": "Дополнительно: доступ к YouTube",
    "settings.downloader.advanced.hint":
      "Cookies для роликов, требующих вход или проверку.",
    "settings.downloader.expandAfter":
      "Разворачивать окно <strong>по окончанию загрузки</strong>",
    "settings.downloader.expandOnCopy":
      "Разворачивать окно <strong>при копировании URL</strong>",
    "settings.downloader.autoQualityModal":
      "Автоматически открывать <strong>выбор качества</strong> после вставки URL",
    "settings.downloader.disableComplete":
      "Отключить <strong>окно открытия файла</strong> после завершения загрузки",
    "settings.downloader.toolsStatus": "Показывать статус инструментов",
    "settings.web.title": "Веб-интерфейс",
    "settings.web.hint":
      "Управление загрузчиком из браузера на этом компьютере.",
    "settings.web.enable":
      "Включить <strong>локальный веб-интерфейс</strong>",
    "settings.web.url": "Адрес на этом компьютере",
    "settings.web.lanUrl": "Адрес для телефона",
    "settings.web.open": "Открыть веб-интерфейс",
    "settings.web.restart": "Перезапустить веб-интерфейс",
    "settings.web.copyLan": "Копировать адрес для телефона",
    "settings.web.copyLanDone": "Адрес для телефона скопирован",
    "settings.web.lanWarning":
      "При включении любое устройство в вашей локальной сети сможет управлять загрузчиком.",
    "settings.web.status.off": "Выключено",
    "settings.web.status.starting": "Запускается",
    "settings.web.status.on": "Работает на порту {port}",
    "settings.downloader.cookies.title": "YouTube cookies",
    "settings.downloader.cookies.mode": "Режим cookies",
    "settings.downloader.cookies.mode.off": "Выкл.",
    "settings.downloader.cookies.mode.browser": "Из браузера",
    "settings.downloader.cookies.mode.file": "Файл cookies.txt",
    "settings.downloader.cookies.browser": "Браузер",
    "settings.downloader.cookies.file": "Файл cookies.txt",
    "settings.downloader.cookies.file.pick": "Выбрать файл",
    "settings.downloader.cookies.file.empty": "Файл не выбран",
    "settings.downloader.cookies.hint":
      "Помогает пройти проверку YouTube через cookies браузера или Netscape cookies.txt. Для импорта из браузера может потребоваться закрыть браузер или выдать доступ macOS.",
    "settings.downloader.cookies.saved": "Настройки cookies сохранены",
    "settings.downloader.cookies.saveError":
      "Не удалось сохранить настройки cookies: {message}",
    "settings.downloader.cookies.file.error":
      "Не удалось выбрать файл cookies: {message}",
    "settings.disableTab": "Отключить вкладку",
    "settings.wg.title": "Вкладка «Инструменты»",
    "settings.wg.disable.hint":
      "Скрывает вкладку Инструменты и отключает её запуск. При отключении связанные параметры становятся недоступны.",
    "settings.wg.autosend": "Авто‑отправка при запуске приложения",
    "settings.wg.rememberLastTool": "Запоминать последний открытый инструмент",
    "settings.wg.rememberLastTool.hint":
      "При следующем открытии вкладки Инструменты сразу показывает инструмент, который был открыт последним.",
    "settings.backup.title": "Инструмент Backup в Инструментах",
    "settings.backup.disable.hint":
      "Управление отображением профилей и журнала инструмента Backup в разделе Инструменты.",
    "settings.backup.compact.hint":
      "Переключает отображение профилей между подробным и компактным режимом.",
    "settings.backup.compact": "Компактный список профилей",
    "settings.backup.log.hint":
      "Скрыть или показать блок с логом операций резервного копирования.",
    "settings.backup.log": "Показывать лог операций",
    "settings.appearance.title": "Внешний вид приложения",
    "settings.appearance.theme": "Цветовая тема",
    "settings.appearance.theme.system": "Системная",
    "settings.appearance.theme.dark": "Темная",
    "settings.appearance.theme.midnight": "Полночь",
    "settings.appearance.theme.emerald": "Изумруд",
    "settings.appearance.theme.sunset": "Закат",
    "settings.appearance.theme.violet": "Виолет",
    "settings.appearance.interfaceHint":
      "Язык интерфейса и базовая читаемость.",
    "settings.appearance.themeHint":
      "Выбор темы и снижение визуальной нагрузки.",
    "settings.appearance.theme.reset": "Сбросить тему по умолчанию",
    "settings.appearance.fontSize": "Размер текста",
    "settings.appearance.fontSize.reset": "Сбросить размер шрифта по умолчанию",
    "settings.appearance.lowEffects.hint":
      "Отключает анимации и эффекты размытия",
    "settings.appearance.lowEffects":
      "Режим <strong>экономии эффектов</strong>",
    "settings.about.title": "О приложении",
    "settings.about.hint":
      "Краткая информация о Thunder, версии приложения и его runtime.",
    "settings.about.productTitle": "Thunder",
    "settings.about.productHint":
      "Desktop-приложение на Electron для загрузки медиа и встроенных инструментов.",
    "settings.about.appVersion": "Версия приложения",
    "settings.about.electronVersion": "Версия Electron",
    "settings.about.chromeVersion": "Версия Chrome",
    "settings.about.nodeVersion": "Версия Node",
    "settings.about.actionsTitle": "Действия",
    "settings.about.actionsHint":
      "Быстрые действия для просмотра изменений, копирования сведений и проверки обновлений.",
    "settings.about.whatsNew": "Что нового",
    "settings.about.copyInfo": "Скопировать информацию",
    "settings.about.checkUpdates": "Проверить обновления",
    "settings.about.copySuccess":
      "Информация о приложении скопирована в буфер обмена",
    "settings.about.copyError":
      "Не удалось скопировать информацию о приложении",
    "settings.about.updatesError": "Не удалось запустить проверку обновлений",
    "settings.other.title": "Другие настройки",
    "settings.other.hint":
      "Дополнительные параметры для детальной настройки поведения приложения.",
    "settings.developer.title": "Для разработчика",
    "settings.developer.hint":
      "Введите секретное слово, чтобы активировать скрытые функции.",
    "settings.developer.secret.label": "Секретное слово",
    "settings.developer.secret.placeholder": "Введите слово",
    "settings.developer.activate": "Активировать",
    "settings.developer.deactivate": "Отключить",
    "settings.developer.status.disabled": "Функции разработчика выключены",
    "settings.developer.status.enabled": "Функции разработчика активированы",
    "settings.developer.unlock.success": "Режим разработчика включён",
    "settings.developer.lock.success": "Режим разработчика отключён",
    "settings.developer.unlock.error": "Неверное секретное слово",
    "settings.other.disableHotkeys":
      "Отключить <strong>специальные</strong> (горячие) клавиши",
    "settings.other.appConfig": "Настройки приложения",
    "settings.other.export": "Сохранить",
    "settings.other.import": "Загрузить",
    "settings.other.openFolder": "Папка настроек",
    "settings.other.resetTitle": "Сброс настроек",
    "settings.other.reset": "Настройки по умолчанию",
    "settings.other.firstRun": "Первичная настройка",
    "settings.tab.enabled.aria": "Вкладка включена",
    "settings.tab.disabled.aria": "Вкладка отключена",
    "settings.qualityProfile.saved": "Профиль качества сохранён.",
    "settings.fontSize.set":
      "<strong>Размер шрифта</strong> установлен на <strong>{size}px</strong>",
    "settings.fontSize.reset":
      "<strong>Размер шрифта</strong> сброшен на <strong>{size}px</strong>",
    "settings.theme.set": "Выбрана тема: <strong>{theme}</strong>",
    "settings.theme.reset":
      "<strong>Тема</strong> сброшена на <strong>{theme}</strong>",
    "settings.module.wg.disabled":
      "Вкладка <strong>Инструменты</strong> отключена",
    "settings.module.wg.enabled":
      "Вкладка <strong>Инструменты</strong> включена",
    "settings.module.backup.disabled":
      "Инструмент <strong>Backup</strong> отключен",
    "settings.module.backup.enabled":
      "Инструмент <strong>Backup</strong> включен",
    "settings.wg.disable.note":
      "Применяется сразу. Можно включить обратно в любое время.",
    "settings.downloadCompleteModal.disabled":
      "Модальное окно после загрузки <strong>отключено</strong>",
    "settings.downloadCompleteModal.enabled":
      "Модальное окно после загрузки <strong>включено</strong>",
    "settings.config.export.success": "Файл конфигурации успешно сохранён",
    "settings.config.export.hint":
      "Вы можете загрузить файл на другом устройстве",
    "settings.config.import.more": "… и ещё {count} изменений",
    "settings.config.import.confirm":
      "Будут применены {count} изменений. Создать резервную копию текущей конфигурации и продолжить?",
    "settings.config.import.success": "Конфигурация успешно импортирована",
    "settings.config.import.error": "Ошибка импорта: {error}",
    "settings.reset.confirm": "Вы уверены, что хотите сбросить все настройки?",
    "settings.reset.error":
      "Не удалось сбросить настройки. Проверьте консоль для подробностей.",
    "settings.reset.success": "Настройки сброшены на значения по умолчанию",
  },
  en: {
    "settings.tabs.general": "General",
    "settings.tabs.downloader": "Downloader",
    "settings.tabs.wg": "Tools",
    "settings.tabs.backup": "Backup tool",
    "settings.tabs.appearance": "Appearance",
    "settings.tabs.about": "About app",
    "settings.tabs.other": "Other",
    "settings.sections.menu": "Sections",
    "settings.sections.toggle": "Show settings sections",
    "settings.tab.enabled": "On",
    "settings.tab.disabled": "Off",
    "settings.startup.title": "Startup settings",
    "settings.startup.hint": "Configure startup behavior for convenience.",
    "settings.startup.autolaunch":
      "<strong>Launch automatically</strong> at system startup",
    "settings.startup.minimize": "<strong>Minimize</strong> the app on launch",
    "settings.startup.openTab": "Open on startup",
    "settings.startup.openTabHint":
      "Select the tab that opens by default on app launch.",
    "settings.close.title": "App closing behavior",
    "settings.close.hint": "Choose how the app behaves when closing.",
    "settings.close.toTray": "<strong>Minimize</strong> to tray",
    "settings.close.notify": "<strong>Notify</strong> on minimize",
    "settings.close.exit": "<strong>Exit</strong> the app",
    "settings.downloader.title": "Tab “Downloader”",
    "settings.downloader.profile.open": "On open",
    "settings.downloader.profile.title": "Download quality selection",
    "settings.downloader.profile.default": "default",
    "settings.downloader.profile.segment.aria":
      "Select download quality profile",
    "settings.downloader.profile.segment.remember": "Last",
    "settings.downloader.profile.segment.audio": "Audio",
    "settings.downloader.profile.summary.remember.title": "Last choice",
    "settings.downloader.profile.summary.remember.hint":
      "Reuses the previous stream type.",
    "settings.downloader.profile.summary.audio.title": "Audio only",
    "settings.downloader.profile.summary.audio.hint":
      "Opens audio formats immediately.",
    "settings.downloader.profile.remember.title": "Last choice",
    "settings.downloader.profile.remember.desc":
      "Opens the same stream type as last time.",
    "settings.downloader.profile.audio.title": "Audio",
    "settings.downloader.profile.audio.desc":
      "Opens audio-only streams without video.",
    "settings.downloader.parallel.title": "Parallel downloads",
    "settings.downloader.parallel.hint":
      "2 is faster, but uses more system resources.",
    "settings.downloader.parallel.option1": "1",
    "settings.downloader.parallel.option2": "2",
    "settings.downloader.parallel.aria": "Select the parallel downloads limit",
    "settings.downloader.parallel.saved": "Parallel download limit: {count}",
    "settings.downloader.layout.hint":
      "Core download options and window behavior settings.",
    "settings.downloader.group.parallel": "Parallelism and startup",
    "settings.downloader.group.behavior": "Window and completion behavior",
    "settings.downloader.advanced.title": "Advanced: YouTube access",
    "settings.downloader.advanced.hint":
      "Cookies for videos that require sign-in or verification.",
    "settings.downloader.expandAfter":
      "Expand the window <strong>after download</strong>",
    "settings.downloader.expandOnCopy":
      "Expand the window <strong>on URL copy</strong>",
    "settings.downloader.autoQualityModal":
      "Automatically open <strong>quality selection</strong> after pasting a URL",
    "settings.downloader.disableComplete":
      "Disable <strong>file open dialog</strong> after download",
    "settings.downloader.toolsStatus": "Show tools status",
    "settings.web.title": "Web interface",
    "settings.web.hint":
      "Control the downloader from a browser on this computer.",
    "settings.web.enable": "Enable <strong>local web interface</strong>",
    "settings.web.url": "Address on this computer",
    "settings.web.lanUrl": "Phone address",
    "settings.web.open": "Open web interface",
    "settings.web.restart": "Restart web interface",
    "settings.web.copyLan": "Copy phone address",
    "settings.web.copyLanDone": "Phone address copied",
    "settings.web.lanWarning":
      "When enabled, any device on your local network can control the downloader.",
    "settings.web.status.off": "Off",
    "settings.web.status.starting": "Starting",
    "settings.web.status.on": "Running on port {port}",
    "settings.downloader.cookies.title": "YouTube cookies",
    "settings.downloader.cookies.mode": "Cookies mode",
    "settings.downloader.cookies.mode.off": "Off",
    "settings.downloader.cookies.mode.browser": "From browser",
    "settings.downloader.cookies.mode.file": "cookies.txt file",
    "settings.downloader.cookies.browser": "Browser",
    "settings.downloader.cookies.file": "cookies.txt file",
    "settings.downloader.cookies.file.pick": "Choose file",
    "settings.downloader.cookies.file.empty": "No file selected",
    "settings.downloader.cookies.hint":
      "Helps pass YouTube checks through browser cookies or a Netscape cookies.txt file. Browser import may require closing the browser or granting macOS access.",
    "settings.downloader.cookies.saved": "Cookies settings saved",
    "settings.downloader.cookies.saveError":
      "Unable to save cookies settings: {message}",
    "settings.downloader.cookies.file.error":
      "Unable to choose cookies file: {message}",
    "settings.disableTab": "Disable tab",
    "settings.wg.title": "Tab “Tools”",
    "settings.wg.disable.hint":
      "Hides the Tools tab and disables its startup flow. Related options become unavailable while it is disabled.",
    "settings.wg.autosend": "Auto-send on app startup",
    "settings.wg.rememberLastTool": "Remember last opened tool",
    "settings.wg.rememberLastTool.hint":
      "When enabled, the Tools tab reopens with the tool you used last time.",
    "settings.backup.title": "Backup tool inside Tools",
    "settings.backup.disable.hint":
      "Controls profile display and the operations log for the Backup tool inside Tools.",
    "settings.backup.compact.hint":
      "Switches profile display between detailed and compact mode.",
    "settings.backup.compact": "Compact profile list",
    "settings.backup.log.hint": "Hide or show the backup operations log block.",
    "settings.backup.log": "Show operations log",
    "settings.appearance.title": "App appearance",
    "settings.appearance.theme": "Color theme",
    "settings.appearance.theme.system": "System",
    "settings.appearance.theme.dark": "Dark",
    "settings.appearance.theme.midnight": "Midnight",
    "settings.appearance.theme.emerald": "Emerald",
    "settings.appearance.theme.sunset": "Sunset",
    "settings.appearance.theme.violet": "Violet",
    "settings.appearance.interfaceHint":
      "Interface language and baseline readability.",
    "settings.appearance.themeHint": "Theme choice and reduced visual load.",
    "settings.appearance.theme.reset": "Reset theme to default",
    "settings.appearance.fontSize": "Text size",
    "settings.appearance.fontSize.reset": "Reset font size to default",
    "settings.appearance.lowEffects.hint":
      "Disables animations and blur effects",
    "settings.appearance.lowEffects": "<strong>Low‑effects</strong> mode",
    "settings.about.title": "About app",
    "settings.about.hint":
      "Brief information about Thunder, the app version, and its runtime.",
    "settings.about.productTitle": "Thunder",
    "settings.about.productHint":
      "An Electron desktop app for media downloads and built-in utilities.",
    "settings.about.appVersion": "App version",
    "settings.about.electronVersion": "Electron version",
    "settings.about.chromeVersion": "Chrome version",
    "settings.about.nodeVersion": "Node version",
    "settings.about.actionsTitle": "Actions",
    "settings.about.actionsHint":
      "Quick actions to review changes, copy app details, and check for updates.",
    "settings.about.whatsNew": "What's new",
    "settings.about.copyInfo": "Copy app info",
    "settings.about.checkUpdates": "Check for updates",
    "settings.about.copySuccess": "App information copied to clipboard",
    "settings.about.copyError": "Failed to copy app information",
    "settings.about.updatesError": "Failed to start update check",
    "settings.other.title": "Other settings",
    "settings.other.hint":
      "Additional parameters for fine‑tuning app behavior.",
    "settings.developer.title": "Developer",
    "settings.developer.hint": "Unlock hidden functions.",
    "settings.developer.secret.label": "Secret word",
    "settings.developer.secret.placeholder": "Enter word",
    "settings.developer.activate": "Unlock",
    "settings.developer.deactivate": "Disable",
    "settings.developer.status.disabled": "Developer functions are disabled",
    "settings.developer.status.enabled": "Developer functions are enabled",
    "settings.developer.unlock.success": "Developer mode enabled",
    "settings.developer.lock.success": "Developer mode disabled",
    "settings.developer.unlock.error": "Invalid secret word",
    "settings.other.disableHotkeys":
      "Disable <strong>special</strong> (hot) keys",
    "settings.other.appConfig": "App settings",
    "settings.other.export": "Save",
    "settings.other.import": "Load",
    "settings.other.openFolder": "Settings folder",
    "settings.other.resetTitle": "Reset settings",
    "settings.other.reset": "Defaults",
    "settings.other.firstRun": "First-run setup",
    "settings.tab.enabled.aria": "Tab enabled",
    "settings.tab.disabled.aria": "Tab disabled",
    "settings.qualityProfile.saved": "Quality profile saved.",
    "settings.fontSize.set":
      "<strong>Font size</strong> set to <strong>{size}px</strong>",
    "settings.fontSize.reset":
      "<strong>Font size</strong> reset to <strong>{size}px</strong>",
    "settings.theme.set": "Theme selected: <strong>{theme}</strong>",
    "settings.theme.reset":
      "<strong>Theme</strong> reset to <strong>{theme}</strong>",
    "settings.module.wg.disabled": "Tab <strong>Tools</strong> disabled",
    "settings.module.wg.enabled": "Tab <strong>Tools</strong> enabled",
    "settings.module.backup.disabled": "Backup <strong>tool</strong> disabled",
    "settings.module.backup.enabled": "Backup <strong>tool</strong> enabled",
    "settings.wg.disable.note":
      "Applies immediately. You can re‑enable it anytime.",
    "settings.downloadCompleteModal.disabled":
      "Post‑download modal is <strong>disabled</strong>",
    "settings.downloadCompleteModal.enabled":
      "Post‑download modal is <strong>enabled</strong>",
    "settings.config.export.success": "Configuration file saved successfully",
    "settings.config.export.hint": "You can import the file on another device",
    "settings.config.import.more": "… and {count} more changes",
    "settings.config.import.confirm":
      "{count} changes will be applied. Create a backup of the current configuration and continue?",
    "settings.config.import.success": "Configuration imported successfully",
    "settings.config.import.error": "Import error: {error}",
    "settings.reset.confirm": "Are you sure you want to reset all settings?",
    "settings.reset.error":
      "Failed to reset settings. Check the console for details.",
    "settings.reset.success": "Settings reset to defaults",
  },
};
