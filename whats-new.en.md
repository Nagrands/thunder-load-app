<!-- version: 1.3.7 -->

### Interface

- **Redesigned the History filters block with a flat minimal style**: filter cards are now cleaner and more compact, a dedicated “Reset” action was added, and an active-filters counter now shows how many filters are currently applied.
- **Applied final polish to History filter dropdowns**: rows are slightly more compact, active selection is softer, and the menu separates better from list content.
- **Polished History filter dropdowns further**: improved alignment, clearer filter captions, a lighter selected-item state, and cleaner menu separation from the background.
- **Improved visual style of History filter dropdowns**: sort and filter menus are cleaner, the selected item is easier to recognize, and list navigation feels more consistent.
- **Redesigned the History controls block**: filters, search, and action buttons now use a cleaner compact layout, selected values are easier to scan, and filters stack more reliably on narrow screens.
- **Improved accessibility in the top bar and URL input block**: increased tap/click target sizes for primary actions, added clearer screen-reader labels, and improved keyboard-friendly button behavior.
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
- **Fixed full History-clear counter**: the notification now shows the correct number of removed entries even after list rerender timing differences.
- **Improved macOS window restore behavior**: both “Expand window after download” and “Expand window on URL copy” now reliably bring the app window to the foreground.
- **Fixed expanded History preview sizing across services**: images from Reddit, Twitch, and similar sources now fit inside the preview modal without stretching outside bounds.

### Downloader tab

- **Removed the progress bar from the URL field**: the input area is cleaner now, while active download progress is still shown in the action button and queue.

- **Changed the default parallel download limit**: on new installs, downloads now start one at a time by default for more predictable queue behavior.

- **Fixed queue “Pause” behavior**: when pressed during an active download, current downloads are now actually stopped, and new tasks stay paused until you press “Start”.

- **Updated queue collapse button placement**: the “Collapse/Expand” control is now in the actions row next to the pause button.

- **Updated queue button labels**: the start action is now labeled “Start”, and the pause button now uses icon-only style for a cleaner compact header.

- **Fixed the “Start queue” button state**: it now becomes active right after links are added to the queue and starts processing tasks as expected.

- **Added a warning before clearing the queue**: clicking the trash button now opens a confirmation dialog explaining that all queue entries will be removed.

- **The download queue block now auto-hides when empty**: if there are no active or added tasks, the queue panel no longer takes space and appears only when items exist.

- **Added collapse support for the download queue block**: you can now hide/show the queue list from the header, and the app remembers the state between launches.
- **Fixed the queue “Pause” button behavior**: it is now enabled only while an active download is running, and stays disabled when nothing is currently downloading.

- **Completely redesigned the “Download Queue” panel**: the queue now uses card-based items with clearer color-coded statuses, active/queued/done counters, and a more visible progress line for current downloads.
- **Added a dedicated queue “Pause” control**: you can pause automatic start of next tasks without interrupting already active downloads.
- **Improved queue item controls**: move/remove actions now appear on hover, failed tasks can be retried directly from the card, and an explicit empty-state view is shown when the queue has no tasks.

- **Simplified the action menu in Quality picker**: the split-button dropdown now keeps only “Add to queue”, so enqueueing the selected option is faster and less cluttered.
- **Refined the Quality picker visual design**: the options list is now more minimal and faster to scan, key details are easier to read, and advanced metrics remain available on expand.
- **Queue UI polish has been applied**: task statuses and control buttons are now easier to scan, and the queue block keeps a cleaner rhythm across window widths.
- **Download queue panel has been refined**: active, pending, and failed tasks are now easier to distinguish, and queue control buttons are clearer and better aligned in one compact block.
- **Quality picker is now clearer while loading formats**: the right side now shows a compact format-list placeholder, so the modal no longer looks empty while options are being fetched.
- **The Quality picker is now cleaner and easier to use**: the preview block is more compact, format-loading status is clearer, the footer now includes a direct “pick a format” hint, and hotkey hints were simplified to core actions.
- **Improved Quality picker layout on medium widths (about 620–900 px)**: the right panel is now denser and more consistent, with tighter spacing and a more stable format-list height.
- **The close button in the Quality picker is now more compact**: its size and spacing now match the style used in other app modals.
- **Fixed the close button in the Quality picker**: after formats finish loading, the close action now works reliably on click again.
- **Fixed Quality picker scrolling on long lists**: you can now scroll back to the top reliably and close the modal without getting stuck below.
- **Removed redundant helper text in the Quality picker**: the “Pick a format from the list above” line is no longer duplicated in the footer area.
- **Action clarity in Quality picker has been improved**: the disabled primary button now shows an explicit “Pick a format” hint, and footer hotkeys are grouped more cleanly next to action buttons.
- **Format list in Quality picker is now more compact**: cards, metrics, and tags use tighter spacing so more options fit on screen without hurting readability.
- **Quality picker is now easier on keyboard and narrow desktop windows**: the footer now uses a split action button with clear “Download” and “Add to queue” choices, keyboard flow for `Tab/Enter/Esc/↑/↓/A` is more predictable, and the layout stays usable around 620–900 px widths.
- **Multi-download in Downloader is now more capable**: active jobs now show per-link progress, failed downloads can be retried quickly, and the parallel limit is configurable in the Settings modal.
- **Queue throughput is now faster in Downloader**: you can now download up to two files at once, and pending tasks start automatically as slots become available.
- **Improved the Quality picker**: options now show structured details (resolution, FPS, codec, size, and container), and the selection block immediately previews the final output.
- **Improved the preview block in Quality picker**: added preview resolution, a source URL copy action, and a clear fallback state when the preview image is unavailable.
- **Added visible hotkey hints in Quality picker**: the modal footer now shows navigation/action keys, including a quick `A` shortcut to enqueue the selected quality.
- **Added mode-aware duplicate protection**: if a link already exists in history for the same mode (for example, video), it is skipped, while audio can still be downloaded separately for the same URL.
- **Improved History entries**: details now expand by clicking the row, primary actions are in main buttons, and long “Source”/“File” values are cleaner with quick copy buttons.
- **Refreshed Downloader action button visuals**: core buttons now use a cleaner glass style with clearer and more predictable hover/press states.
- **URL input in Downloader is now easier to use**: added clearer link validation with inline hints, improved button states, and better clear/paste behavior.
- **Aligned the URL field progress bar**: the download indicator now follows the field's inner contour and stays visually even across input states.
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
