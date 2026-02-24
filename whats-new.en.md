<!-- version: 1.3.7 -->

### Interface

- **Completely redesigned the History control block**: search, sorting, delete actions, and filters are now organized into a clearer two-level Control Deck with larger controls.
- **Moved secondary History actions into a single “More” menu**: export, restore, list density, and expand/collapse details are now grouped in one compact dropdown.
- **Changed where History previews are stored**: thumbnails are now saved in the app settings folder, so they are less likely to disappear when the system temp folder is cleaned.
- **Improved top menu tab buttons**: tabs now use a cleaner segmented style, balanced spacing, and a calmer active state.
- **Removed the “Network status” indicator from the top bar**: the related toggle was also removed from “Appearance” settings to keep the interface simpler.
- **Made tray menu updates more stable**: menu items now react faster to changes in download path and download status.
- **Fixed repeated Settings-open event bindings**: the extra-listener warning no longer appears after opening Settings multiple times.
- **Updated the Settings menu interface**: sections are now more compact and easier to navigate in a dense system-style layout.
- **Improved readability in Settings**: clearer block titles and tighter spacing make common toggles faster to find.
- **Updated tab backgrounds across the app**: all sections now use a single shared background for a more unified look.
- **Optimized tooltips across the app**: tooltips now initialize lazily and are reused instead of being constantly recreated during rerenders, reducing unnecessary UI load.
- **Improved popup menu behavior**: added a shared overlay manager so menus and context panels close centrally without duplicate handlers.
- **Fixed History context menu behavior**: when confirming deletion of a record or file, the right-click menu now closes immediately and no longer overlaps the confirmation dialog.
- **Added Undo for full History clear**: clearing all history now shows the same timed Undo window used for selected-entry deletion.
- **Fixed expanded History preview sizing across services**: images from Reddit, Twitch, and similar sources now fit inside the preview modal without stretching outside bounds.

### Downloader tab

- **Multi-download in Downloader is now more capable**: active jobs now show per-link progress, failed downloads can be retried quickly, and the parallel limit is configurable in the Settings modal.
- **Queue throughput is now faster in Downloader**: you can now download up to two files at once, and pending tasks start automatically as slots become available.
- **Improved the Quality picker**: options now show structured details (resolution, FPS, codec, size, and container), and the selection block immediately previews the final output.
- **Improved the preview block in Quality picker**: added preview resolution, a source URL copy action, and a clear fallback state when the preview image is unavailable.
- **Added visible hotkey hints in Quality picker**: the modal footer now shows navigation/action keys, including a quick `A` shortcut to enqueue the selected quality.
- **Added mode-aware duplicate protection**: if a link already exists in history for the same mode (for example, video), it is skipped, while audio can still be downloaded separately for the same URL.
- **Improved History entries**: details now expand by clicking the row, primary actions are in main buttons, and long “Source”/“File” values are cleaner with quick copy buttons.
- **Refreshed Downloader action button visuals**: core buttons now use a cleaner glass style with clearer and more predictable hover/press states.
- **URL input in Downloader is now easier to use**: added clearer link validation with inline hints, improved button states, and better clear/paste behavior.
- **Queue management is now cleaner and more compact**: added item priorities (move up/down), improved duplicate detection by URL + selected quality, and refreshed queue visuals.
- **Added History list virtualization**: on large pages, only visible entries are rendered, making scrolling and history interactions smoother with lower system load.
- **Improved History virtualization accuracy**: item heights are now auto-calibrated from real rendered size, making scrolling more stable across different density modes and expanded details.

### Tools tab

- **Fixed tools-folder switching on macOS**: when you select a new tools directory, Thunder Load now migrates detected binaries (`yt-dlp`, `ffmpeg`, `ffprobe`, `deno`) so downloads keep working without manual reinstall.
- **Fixed install progress visibility in Tools**: after clicking “Download”, the install button now clearly shows that dependency download is in progress.
- **Fixed downloads when using a custom Tools folder**: after changing the Tools directory, dependency checks now use the selected path, so video/audio downloads start correctly.
- **Moved Tools controls in Settings into a separate modal**: in the Downloader section, tools checks and folder management now open in a dedicated window.
- **Added automatic tools fallback at download time**: if the selected folder lacks working `yt-dlp/ffmpeg/ffprobe`, downloads now use valid binaries from the default tools folder automatically.
- **Fixed `Requested format is not available` download failures**: when a saved quality profile contains stale format IDs, the app now auto-selects a valid format for the current video instead of failing.
- **Added** the **Tools** tab: quick actions in one place (WG Unlock, hash check, system tools).
- **Added** file hash verification (MD5, SHA-1, SHA-256, SHA-512) with expected-value comparison.
