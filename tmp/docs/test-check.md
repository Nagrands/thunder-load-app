## Автотесты (Jest)

- Автосборка списка: `npm run test-check:sync-tests`
- Найдено файлов: 131
- Найдено тест-кейсов (test/it): 1125

<!-- AUTO-JEST-TESTS:START -->

### `src/js/__tests__/preload.fullscreen.test.js` (2)
- [ ] exposes whitelisted fullscreen invokes
- [ ] unwraps native fullscreen events to a boolean and unsubscribes

### `src/js/__tests__/preload.nowPlaying.test.js` (1)
- [ ] exposes typed wrappers for all Now Playing invokes

### `src/js/app/__tests__/appPreferencesIpcHandlers.test.js` (8)
- [ ] registers preference channels
- [ ] reads and writes simple store flags
- [ ] open-on-copy toggles clipboard monitor
- [ ] global shortcut toggle unregisters or restores shortcuts
- [ ] minimize instead of close updates tray notification
- [ ] system notification shows native notification when supported
- [ ] auto launch writes Windows shortcut and sends toast
- [ ] auto launch status returns false off Windows

### `src/js/app/__tests__/appUpdateIpcHandlers.test.js` (5)
- [ ] registers app update channels
- [ ] triggers manual update check without awaiting updater result
- [ ] triggers update download
- [ ] triggers restart and install
- [ ] does not await updater promises

### `src/js/app/__tests__/autoUpdater.test.js` (6)
- [ ] setupAutoUpdater registers events without checking immediately
- [ ] scheduleAutoUpdateCheck checks after ready-to-show and delay
- [ ] scheduleAutoUpdateCheck falls back when ready-to-show does not fire
- [ ] scheduleAutoUpdateCheck skips destroyed windows
- [ ] scheduleAutoUpdateCheck skips missing windows
- [ ] disables setup and scheduled checks on macOS

### `src/js/app/__tests__/backupIpcHandlers.test.js` (3)
- [ ] registers backup channels without loading backupManager
- [ ] loads backupManager only when a backup action runs
- [ ] toggles reload blocking without loading backupManager

### `src/js/app/__tests__/backupManager.test.js` (2)
- [ ] returns true for Compress-Archive module autoload failure
- [ ] returns false for unrelated powershell error

### `src/js/app/__tests__/brandAssets.test.js` (4)
- [ ] runtime icon paths resolve from Electron app.getAppPath
- [ ] app and platform outputs contain the required sizes
- [ ] menu and notification assets keep their runtime dimensions
- [ ] the complete SVG kit is valid and uses the shared palette

### `src/js/app/__tests__/clipboardMonitor.test.js` (3)
- [ ] expands window for valid supported URLs
- [ ] does not start when open-on-copy is disabled
- [ ] does not expand window for invalid or unsupported URLs

### `src/js/app/__tests__/downloaderBackgroundPreview.test.js` (8)
- [ ] selects a moderate playable YouTube mp4/webm source
- [ ] returns null for live YouTube videos
- [ ] returns null for video-less or unsupported YouTube formats
- [ ] accepts youtube googlevideo formats when container is inferred from url mime
- [ ] returns null for non-YouTube URLs
- [ ] selects a moderate playable YouTube audio-video live preview source
- [ ] returns null for live, audio-less, manifest-based, or non-YouTube live preview candidates
- [ ] keeps background and live preview selection independent

### `src/js/app/__tests__/fileShellIpcHandlers.test.js` (7)
- [ ] registers file and shell channels
- [ ] opens config folder and creates wireguard config
- [ ] checks file existence and size
- [ ] deletes files through trashItem
- [ ] falls back to unlink when trashItem fails
- [ ] opens external links through both external channels
- [ ] opens downloaded file locations and last video

### `src/js/app/__tests__/fullscreenIpcHandlers.test.js` (6)
- [ ] registers get/set handlers and native window listeners
- [ ] gets and sets fullscreen state with structured responses
- [ ] rejects non-boolean set payloads without changing the window
- [ ] returns structured errors when Electron fullscreen APIs fail
- [ ] propagates native enter and leave events to the renderer
- [ ] does not send native events to destroyed web contents

### `src/js/app/__tests__/historyIpcHandlers.test.js` (5)
- [ ] registers history channels
- [ ] load-history creates an empty file when missing
- [ ] save-history writes entries and emits count
- [ ] get-download-count reads history length
- [ ] clear-history clears history and preview cache

### `src/js/app/__tests__/historyPreviewIpcHandlers.test.js` (5)
- [ ] registers preview cache channels
- [ ] cache-history-preview saves data URL preview with safe file name
- [ ] cache-history-preview rejects missing URL
- [ ] delete-history-preview removes only files inside preview cache
- [ ] ensurePreviewCacheDir creates preview cache directory

### `src/js/app/__tests__/ipcHandlers.toolsActions.test.js` (85)
- [ ] set-open-on-copy-url-status toggles clipboard monitor and persists state
- [ ] hashPickFile returns selected path
- [ ] mediaInspectorPickFile returns selected path
- [ ] converterPickFile and converterPickFolder return selected paths
- [ ] converterConvert validates payload and missing files
- [ ] converterConvert returns missingDependency when ffmpeg is absent
- [ ] converterConvert builds ffmpeg args and emits progress
- [ ] converterConvert builds audio extraction args and avoids overwrite
- [ ] converterCancel stops the active conversion process
- [ ] set-download-path removes resume state from previous downloads folder
- [ ] select-download-folder removes resume state from previous downloads folder
- [ ] set-download-path keeps resume state when downloads folder is unchanged
- [ ] set-download-path keeps resume state while downloads are active
- [ ] set-download-path succeeds when resume state cleanup fails
- [ ] open-config-folder opens settings directory without selecting file
- [ ] check-app-updates triggers a manual updater check
- [ ] mediaInspectorAnalyze returns structured report for a local file
- [ ] mediaInspectorAnalyze returns missingDependency when ffprobe is absent
- [ ] mediaInspectorAnalyze uses ffprobe from PATH when local tool is absent
- [ ] mediaInspectorAnalyze installs ffmpeg tools when ffprobe is missing
- [ ] mediaInspectorAnalyze returns fileNotFound for a missing file
- [ ] delete-file uses shell.trashItem when available
- [ ] delete-file falls back to unlink when trashItem fails
- [ ] delete-file allows names containing double dots
- [ ] get-video-info rejects incomplete host before yt-dlp call
- [ ] get-video-preview returns metadata without formats
- [ ] cancel-video-info-request stops active preview token
- [ ] get-video-info includes backgroundPreview for playable YouTube sources
- [ ] get-video-info keeps youtube backgroundPreview when container is inferred from url mime
- [ ] get-video-info keeps livePreview null for non-YouTube URLs
- [ ] get-video-info maps auth errors to AUTH_REQUIRED
- [ ] get-video-info maps geo errors to GEO_BLOCKED
- [ ] get-video-info maps unavailable errors to UNAVAILABLE
- [ ] get-video-info maps network timeouts to NETWORK_TIMEOUT
- [ ] get-video-info maps unsupported URLs to UNSUPPORTED_URL
- [ ] get-video-info maps not found errors to NOT_FOUND
- [ ] get-video-info maps exec failures to EXEC_FAILED
- [ ] get-video-info maps private content errors to PRIVATE_CONTENT
- [ ] get-video-info maps captcha errors to CAPTCHA_REQUIRED
- [ ] get-video-info maps disk errors to DISK_FULL
- [ ] get-video-info maps permission errors to PERMISSION_DENIED
- [ ] get-video-info maps rate limits with retryAfterMinutes
- [ ] tools:updateYtDlp keeps current binary if temp install fails
- [ ] tools:updateYtDlp swaps in temp binary after successful install
- [ ] hashCalculate returns SHA-256 hash and match
- [ ] hashCalculate emits progress events when requestId is provided
- [ ] hashInspectFile returns readable file metadata
- [ ] sorterPickFolder returns selected directory path
- [ ] previewSorterPlan uses custom rules with a locked Other fallback
- [ ] previewSorterPlan rejects extensions assigned to multiple rules
- [ ] previewSorterPlan keeps operation IDs stable
- [ ] applySorterPlan applies selected operations only
- [ ] applySorterPlan rejects a source changed after preview
- [ ] previewSorterPlan respects recursive and ignore behavior
- [ ] replace apply backs up target and undo restores both files
- [ ] a new apply clears the previous undo run
- [ ] undo keeps conflicting entries available for retry
- [ ] sorterOpenFolder opens selected directory
- [ ] sorterOpenFolder returns error for unknown path
- [ ] sorterExport writes result file via save dialog
- [ ] tools:setLocation migrates existing binaries from previous directory
- [ ] createWindowsRestartShortcut returns unsupported on non-windows
- [ ] createWindowsRestartShortcut sets icon fields on windows
- [ ] createWindowsShutdownShortcut returns unsupported on non-windows
- [ ] createWindowsShutdownShortcut sets icon fields on windows
- [ ] new windows shortcut handlers return unsupported on non-windows
- [ ] new windows shortcut handlers set icon fields on windows
- [ ] uefi shortcut uses firmware reboot command with fallback
- [ ] keeps only safe subtitle fields and drops unsafe languages
- [ ] tools:getAvailability returns fast tools status without version checks
- [ ] allows two parallel DOWNLOAD_VIDEO and rejects third
- [ ] DOWNLOAD_VIDEO blocks reload while a download is active and restores it afterwards
- [ ] rejects second DOWNLOAD_VIDEO when parallel limit is set to 1
- [ ] returns default yt-dlp cookies settings
- [ ] normalizes and stores yt-dlp cookies settings
- [ ] rejects invalid yt-dlp cookies file path
- [ ] select-ytdlp-cookies-file returns selected file or cancel
- [ ] DOWNLOAD_VIDEO shows warning when yt-dlp and ffmpeg are missing
- [ ] DOWNLOAD_VIDEO shows warning when only ffmpeg is missing
- [ ] DOWNLOAD_VIDEO returns structured classified error for known download failures
- [ ] DOWNLOAD_VIDEO does not emit duplicate renderer toast for classified failures
- [ ] CANCEL_DOWNLOAD_JOB cancels only the targeted active job
- [ ] CANCEL_DOWNLOAD_JOB is idempotent for an unknown job
- [ ] CANCEL_DOWNLOAD_JOB returns a structured cancellation error
- [ ] STOP_DOWNLOAD still cancels all active tokens

### `src/js/app/__tests__/mediaOpenService.test.js` (4)
- [ ] normalizes only supported media and playlist paths
- [ ] queues startup files until the renderer is ready
- [ ] deduplicates Windows paths case-insensitively
- [ ] captures macOS open-file events before window creation

### `src/js/app/__tests__/notifications.test.js` (10)
- [ ] classifies rate-limited downloader errors with retry delay
- [ ] marks auth-required downloader errors as non-retryable
- [ ] formats downloader auth errors into user-friendly text
- [ ] formats downloader network timeouts into user-friendly text
- [ ] formats downloader rate-limited errors with retry hint
- [ ] formats disk-full errors into user-friendly text
- [ ] formats missing tools message when both dependencies are unavailable
- [ ] formats missing tools message when yt-dlp is unavailable
- [ ] expands window on download complete when toggle is enabled
- [ ] does not expand window on download complete when toggle is disabled

### `src/js/app/__tests__/nowPlayingHlsService.test.js` (3)
- [ ] accepts only one or two resolved HTTP inputs
- [ ] maps adaptive video and audio and uses copy for compatible codecs
- [ ] serves tokenized manifests on loopback and cleans the session

### `src/js/app/__tests__/nowPlayingIpcHandlers.test.js` (17)
- [ ] registers all Player channels
- [ ] imports files, removes duplicates, and persists the queue
- [ ] adds imported media to the active custom playlist
- [ ] links an existing catalog item into the active custom playlist
- [ ] imports a folder recursively and returns cancellation safely
- [ ] sanitizes persisted state without rescanning every local file
- [ ] defaults legacy and invalid Now Playing preferences safely
- [ ] recovers from a malformed V2 catalog without throwing
- [ ] migrates the V1 queue into the V2 media library
- [ ] sanitizes playlists and removes dangling and duplicate track references
- [ ] imports one YouTube video, deduplicates it and persists no playback URL
- [ ] rejects YouTube playlists before invoking yt-dlp
- [ ] resolves a fresh muxed YouTube stream through a loopback HLS session
- [ ] deduplicates parallel YouTube resolves for the same quality
- [ ] analyzes YouTube formats and preserves an exact quality selector
- [ ] forces a fresh YouTube stream only for an explicit retry
- [ ] rejects an oversized state with a structured error

### `src/js/app/__tests__/nowPlayingLibrary.test.js` (9)
- [ ] recursively scans media while skipping hidden and symlink folders
- [ ] imports supported absolute files with fallback metadata
- [ ] supports AVI and MPEG files for the playback fallback
- [ ] parses local M3U entries with safe relative and network media
- [ ] enforces playlist byte and entry limits
- [ ] uses ffprobe metadata and extracts embedded artwork best-effort
- [ ] refreshes missing file availability without rejecting the track
- [ ] normalizes equivalent source paths for deduplication
- [ ] does not traverse a selected symlink directory

### `src/js/app/__tests__/nowPlayingState.test.js` (3)
- [ ] migrates V2 state to V3 while preserving playlist selection
- [ ] migrates legacy V1 tracks into the media library
- [ ] sanitizes YouTube quality selections and network tracks

### `src/js/app/__tests__/playerPackaging.test.js` (2)
- [ ] registers the requested media associations
- [ ] uses the per-machine NSIS mode required for associations

### `src/js/app/__tests__/runtimeTools.test.js` (2)
- [ ] falls back from preferred yt-dlp path to default path when preferred is not executable
- [ ] blocks Python-backed yt-dlp launchers on macOS

### `src/js/app/__tests__/shortcutIpcHandlers.test.js` (1)
- [ ] registers get, set, replace and reset and broadcasts successful changes

### `src/js/app/__tests__/shortcutService.test.js` (9)
- [ ] exposes 16 unique actions with platform defaults
- [ ] normalizes aliases and rejects unsafe combinations
- [ ] fills new actions and migrates legacy site shortcuts once
- [ ] reports conflicts and swaps assignments atomically
- [ ] replace ignores unknown ids, fills missing ids and reset restores defaults
- [ ] rolls global registrations back if the OS rejects a new accelerator
- [ ] registers owned callbacks and independently suppresses reload
- [ ] disable flag removes only service-owned shortcuts
- [ ] restores the disable flag when re-enabling registrations fails

### `src/js/app/__tests__/toolsHashIpcHandlers.test.js` (6)
- [ ] registers hash channels
- [ ] hashPickFile returns selected path
- [ ] hashInspectFile returns readable file metadata
- [ ] hashCalculate returns SHA-256 hash and match
- [ ] hashCalculate emits start and done progress events
- [ ] hashCalculate rejects unsupported algorithm

### `src/js/app/__tests__/toolsLocationIpcHandlers.test.js` (4)
- [ ] registers tools location channels
- [ ] returns current tools location
- [ ] migrates existing binaries when tools location changes
- [ ] opens native tools directory picker

### `src/js/app/__tests__/toolsVersions.test.js` (4)
- [ ] reads yt-dlp version from stdout
- [ ] returns availability without spawning binaries
- [ ] falls back to stderr output for yt-dlp version
- [ ] does not spawn Python-backed yt-dlp on macOS

### `src/js/app/__tests__/toolsVersionsIpcHandlers.test.js` (8)
- [ ] registers tools version channels
- [ ] returns versions from getToolsVersions
- [ ] returns availability without version checks
- [ ] marks ffmpeg updates skipped on macOS
- [ ] does not mark ffmpeg updates skipped outside macOS
- [ ] handles macOS payloads without ffmpeg
- [ ] returns versions fallback on error
- [ ] returns availability fallback on error

### `src/js/app/__tests__/trayIconController.test.js` (4)
- [ ] loads platform state resource and deduplicates updates
- [ ] marks every macOS state image as a template
- [ ] keeps the current image when a resource is missing
- [ ] rejects invalid states without throwing

### `src/js/app/__tests__/uiSettingsIpcHandlers.test.js` (6)
- [ ] registers ui settings channels
- [ ] reads and writes default tab
- [ ] reads and writes theme
- [ ] reads and writes font size
- [ ] returns platform info
- [ ] forwards toast events to renderer

### `src/js/app/__tests__/updateDevIpcHandlers.test.js` (5)
- [ ] registers update dev channels
- [ ] sends update open flyover events
- [ ] normalizes progress percent
- [ ] sends downloaded and error events
- [ ] returns false when sending fails

### `src/js/app/__tests__/userDataPath.test.js` (2)
- [ ] creates and sets the legacy Thunder Load userData path
- [ ] returns null when the legacy path cannot be configured

### `src/js/app/__tests__/utils.test.js` (6)
- [ ] adds https:// when scheme is missing
- [ ] preserves existing scheme
- [ ] trims whitespace and surrounding quotes/brackets
- [ ] returns empty string for invalid input
- [ ] accepts http/https URLs
- [ ] rejects unsupported schemes and invalid strings

### `src/js/app/__tests__/webControlServer.test.js` (5)
- [ ] is disabled by default and binds to LAN when enabled
- [ ] allows API requests without a token in LAN mode
- [ ] forwards API actions to the renderer bridge
- [ ] normalizes one URL and requests its preview from the renderer
- [ ] forwards a partial settings patch and returns the canonical snapshot

### `src/js/app/__tests__/wgUnlockIpcHandlers.test.js` (6)
- [ ] registers WG channels
- [ ] creates and opens WireGuard config file
- [ ] opens Windows network settings
- [ ] opens modern macOS network settings
- [ ] exports WireGuard log to selected file
- [ ] replies with export cancellation

### `src/js/app/__tests__/whatsNewIpcHandlers.test.js` (5)
- [ ] registers whats-new channels without rendering markdown
- [ ] returns localized release notes from markdown
- [ ] falls back to default release notes and app version
- [ ] returns empty release notes on read errors
- [ ] dispatches pending whats-new and acknowledges versions

### `src/js/app/__tests__/whatsNewVersion.test.js` (2)
- [ ] matches package.json
- [ ] english whatsNew stays in sync when present

### `src/js/app/__tests__/window.trayMenu.test.js` (8)
- [ ] disables 'Последнее видео' when file is missing
- [ ] enables 'Последнее видео' and adds file name in label when file exists
- [ ] disables 'Папка загрузок' when download path is invalid
- [ ] settings menu item shows window and opens settings
- [ ] tray 'Открыть' restores minimized window and focuses it
- [ ] quit menu item sets isQuitting and calls app.quit
- [ ] dock exposes the current track and transport commands
- [ ] tray and dock keep identical action order

### `src/js/app/__tests__/window.trayRuntime.test.js` (4)
- [ ] handles click/double-click/right-click and refresh events on windows tray
- [ ] creates a template tray image on macOS
- [ ] window-close IPC respects minimize-to-tray behavior on Windows
- [ ] warns and keeps window open when closing during active download

### `src/js/app/__tests__/windowActivation.test.js` (6)
- [ ] activates and focuses window on macOS
- [ ] returns false for missing window
- [ ] focuses visible non-maximized window on Windows without maximizing
- [ ] restores and focuses minimized window on Windows without maximizing
- [ ] shows and focuses hidden window on Windows
- [ ] keeps non-Windows behavior unchanged

### `src/js/app/__tests__/windowsTrayMenu.test.js` (6)
- [ ] positions the panel above a bottom taskbar and clamps it to work area
- [ ] positions the panel below a top taskbar
- [ ] keeps the panel inside a negative-coordinate secondary display
- [ ] reuses one popup and toggles it on repeated right clicks
- [ ] returns safe state and rejects unavailable or unknown actions
- [ ] returns false so the native menu can be used when HTML fails

### `src/js/app/__tests__/windowsTrayMenuIpcHandlers.test.js` (1)
- [ ] validates the sender and delegates safe requests

### `src/js/app/__tests__/windowsTrayMenuPreload.test.js` (1)
- [ ] exposes only the dedicated tray API

### `src/js/modules/__tests__/accessibleDropdown.test.js` (2)
- [ ] adds listbox semantics and opens from the keyboard
- [ ] supports arrow navigation, selection and Escape

### `src/js/modules/__tests__/backupView.performance.test.js` (7)
- [ ] does not start backup hints timers on tab activation
- [ ] renders compact backup toolbar without hints block
- [ ] uses localized backup toolbar strings in initial markup
- [ ] large backup list uses no-animation mode on rerenders
- [ ] list rerender does not mass-dispose tooltip instances
- [ ] virtualizes backup rows for large pages
- [ ] renders delete confirmation markup without treating profile name as HTML

### `src/js/modules/__tests__/bootstrapRenderer.test.js` (1)
- [ ] marks body ready after critical init and defers non-critical modules

### `src/js/modules/__tests__/clipboardHandler.test.js` (3)
- [ ] does not auto-paste focused clipboard URL when open-on-copy is disabled
- [ ] auto-pastes focused clipboard URL when open-on-copy is enabled
- [ ] does not auto-paste focused clipboard URL when yt-dlp is unavailable

### `src/js/modules/__tests__/compactDownloaderQuality.test.js` (5)
- [ ] persists compact view mode and applies shell classes
- [ ] initializes the visible mode label from saved compact mode
- [ ] builds video and audio selectors from preview formats
- [ ] keeps subtitles out of compact quality controls
- [ ] hides quality selectors again when preview formats are missing

### `src/js/modules/__tests__/contextMenu.test.js` (9)
- [ ] opens and focuses first enabled menu item
- [ ] supports ArrowUp/ArrowDown/Home/End keyboard navigation
- [ ] runs action on Enter
- [ ] closes menu on Escape
- [ ] does not execute disabled menu item
- [ ] hides context menu immediately when delete confirmation opens
- [ ] retry scrolls to URL input and focuses it
- [ ] uses html-enabled toast after entry deletion
- [ ] deletes history entry when stored id is a string

### `src/js/modules/__tests__/developerModeFooter.test.js` (2)
- [ ] keeps app footer visible in developer mode
- [ ] keeps app footer visible when developer mode is disabled

### `src/js/modules/__tests__/developerModeTopBar.test.js` (2)
- [ ] hides configured topbar buttons in developer mode
- [ ] restores topbar buttons when developer mode is disabled

### `src/js/modules/__tests__/downloadActions.test.js` (4)
- [ ] shows warning when current download folder cannot be resolved
- [ ] shows warning when last downloaded file path is missing
- [ ] shows warning when folder selection is canceled
- [ ] shows localized toast when downloads folder changes

### `src/js/modules/__tests__/downloadCompleteHandler.test.js` (2)
- [ ] does not open completion modal when setting is disabled
- [ ] opens completion modal when setting is enabled

### `src/js/modules/__tests__/downloaderAvailability.test.js` (3)
- [ ] disables URL controls when yt-dlp is missing
- [ ] enables URL input controls when yt-dlp is available
- [ ] updates availability from tools:status events

### `src/js/modules/__tests__/downloaderBackgroundPreview.test.js` (6)
- [ ] fades in the background video after media becomes ready
- [ ] pauses when document becomes hidden and resumes on focus
- [ ] pauses background preview while live preview is open and resumes after close
- [ ] crossfades to the second buffer when source changes
- [ ] preserves playback position when recovering the same page with a new source
- [ ] dispatches a single recovery event on playback error

### `src/js/modules/__tests__/downloaderLivePreview.test.js` (8)
- [ ] opens player and starts playback with sound from explicit event
- [ ] hides and clears player on close
- [ ] closes modal on Escape and returns focus to opener
- [ ] keeps keyboard tab focus inside the modal
- [ ] closes modal when backdrop is clicked
- [ ] pauses live preview when window becomes hidden
- [ ] dispatches one-shot retry event before closing on repeated playback errors
- [ ] restores playback position when reopened for the same page

### `src/js/modules/__tests__/downloadErrorClassifier.shared.test.js` (4)
- [ ] classifies auth-required errors consistently
- [ ] classifies network timeout with neutral default message
- [ ] classifies unsupported, not found, exec failed and rate limit errors
- [ ] classifies private content, captcha, disk full and permission errors

### `src/js/modules/__tests__/downloadErrorUi.test.js` (5)
- [ ] formats rate limit toast with minutes
- [ ] formats queue reason via shared metadata
- [ ] formats known toast keys for all focused downloader codes
- [ ] formats queue and history labels for all focused downloader codes
- [ ] keeps retryable flags and unknown fallback stable

### `src/js/modules/__tests__/downloaderToolsStatus.test.js` (8)
- [ ] shows ready state when yt-dlp/ffmpeg/Deno present
- [ ] shows install action when tools are missing
- [ ] shows bridge missing state when tools bridge is unavailable
- [ ] install action triggers installAll and refresh
- [ ] shows update action when updates are available and runs selective updates
- [ ] keeps CTA hidden when tools are installed and up to date
- [ ] shows error state when update check fails without breaking footer CTA
- [ ] settings visibility event hides container until re-enabled

### `src/js/modules/__tests__/downloaderView.test.js` (1)
- [ ] builds full-width hero with separate meta row and preserved ids

### `src/js/modules/__tests__/downloadJobs.test.js` (2)
- [ ] keeps legacy collections in sync with the job store
- [ ] replaces and clears jobs by status without touching other groups

### `src/js/modules/__tests__/downloadManager.test.js` (77)
- [ ] loadQueueFromStorage filters invalid entries and exact duplicates
- [ ] classifies subtitle-only payloads and gives them a distinct queue signature
- [ ] persistQueue stores the queue in localStorage
- [ ] removes queue key from localStorage when queue becomes empty
- [ ] refreshes and persists pending queue title after restore
- [ ] warms full video info on download button intent and throttles repeats
- [ ] does not warm video info when download button is disabled
- [ ] warms full formats before starting a queued task
- [ ] does not warm full formats for simple queued preset labels
- [ ] adds to queue without starting download when enqueueOnly is true
- [ ] does not request formats when adding a URL to the queue
- [ ] does not enqueue URL that already exists in history when the file is still on disk
- [ ] allows enqueue when URL exists in history but the downloaded file was removed
- [ ] keeps URL when quality modal is cancelled
- [ ] uses compact quality payload without opening modal in compact mode
- [ ] keeps auto-open modal behavior when compact mode forces the quality modal
- [ ] allows enqueue when URL exists in history but requested mode differs
- [ ] passes forceAudioOnly to quality modal for audio-only flow
- [ ] does not pass remembered quality label when audio profile is selected
- [ ] allows overriding the quality profile with the best preset
- [ ] passes cached preview info to the quality modal
- [ ] shows current active job stage and progress in summary
- [ ] renders stage, eta and audio badge for active queue items
- [ ] renders explicit reason and retry state chips for failed jobs
- [ ] shows retry-all bulk action when failed jobs exist
- [ ] retry all repeats only retryable failed jobs
- [ ] removes completed jobs via row action
- [ ] allows same URL with different quality labels in queue
- [ ] blocks duplicate queue item with same URL and same quality
- [ ] supports moving queue item up/down from queue controls
- [ ] supports dragging pending queue items by the grip handle
- [ ] removes the intended pending job when state changes before click
- [ ] renders 200 queued items when queue reaches max size
- [ ] renders active downloads with status chip and separate active counter
- [ ] renders queue list with list/listitem roles and pending aria label
- [ ] renders failed items and retries failed task by action button
- [ ] disables individual retry for non-retryable failed jobs
- [ ] toggles queue list visibility and persists collapsed state
- [ ] removes collapsed key when queue is expanded back
- [ ] disables pause only when queue has no active and no pending items
- [ ] disables start button while there is an active download
- [ ] pause suppresses auto-pump without stopping active jobs and resume continues the queue
- [ ] restores paused queue state from local storage
- [ ] hides queue block when there are no queue items
- [ ] adds and removes is-active on progress container around download
- [ ] keeps completed progress briefly before reset
- [ ] shows dedicated toast for yt-dlp network timeout
- [ ] shows dedicated toast for auth-required videos
- [ ] handles structured DOWNLOAD_VIDEO failures without relying on thrown Error
- [ ] treats renderer-side history bookkeeping failures as non-fatal after file is downloaded
- [ ] moves successful downloads out of running state immediately after completion
- [ ] queues new task when parallel pool is full
- [ ] asks before manual queue start and keeps parallel start when user chooses all
- [ ] starts only one queued item when user chooses single manual start
- [ ] starts a single queued item without asking for start mode
- [ ] starts download immediately when one slot is still free
- [ ] starts next pending task when one active download completes
- [ ] starts an extra pending task when parallel limit increases
- [ ] waits for active jobs to drain after parallel limit decreases
- [ ] uses one toast for parallel downloads and closes after the last active job
- [ ] updates one toast for single and parallel progress stages
- [ ] shows success only after every download in the session succeeds
- [ ] keeps the same toast during queue handoff
- [ ] does not reopen a manually dismissed toast until the next session
- [ ] allows final success after the loading toast was manually dismissed
- [ ] closes the toast when active jobs are reset by pause or cancel
- [ ] stores the completed file path in job state
- [ ] hides empty counters and queue controls according to visible jobs
- [ ] opens and reveals a completed file from accessible actions
- [ ] shows localized toast errors when completed file IPC fails
- [ ] opens the intended completed job when state changes before click
- [ ] persists a successful download as a done job
- [ ] restores completed jobs during initialization
- [ ] syncs completed storage after removing completed jobs
- [ ] clears completed storage when clearing the whole queue
- [ ] opens and reveals a restored completed job
- [ ] filters complete status groups without changing queue counters

### `src/js/modules/__tests__/downloadProgress.test.js` (5)
- [ ] supports legacy numeric progress payload
- [ ] aggregates object payload progress for two active jobs
- [ ] resets tracking when download state transitions to idle
- [ ] shows current stage in button text for a single active job
- [ ] keeps queue count in downloader tab accessibility while progress is active

### `src/js/modules/__tests__/downloadQualityModal.test.js` (29)
- [ ] closes modal when close button is clicked
- [ ] uses cached formats without requesting video info again
- [ ] does not remove another modal body lock when quality modal closes
- [ ] downloads preview image from quality modal
- [ ] shows specific auth-required error in quality modal
- [ ] logs unexpected quality fetch failures as warnings
- [ ] copies current file information from quality modal
- [ ] copies title from the title copy button
- [ ] shows fallback when preview thumbnail is missing
- [ ] renders quality metrics collapsed by default
- [ ] expands metrics only for selected card toggle
- [ ] collapses metrics again when toggle is clicked second time
- [ ] does not change selected option or trigger confirm on metrics toggle
- [ ] resolves preview resolution from thumbnails metadata
- [ ] enqueues selected option on A hotkey
- [ ] runs enqueue action from visible secondary button
- [ ] keeps enqueue action accessible when shown as icon button
- [ ] confirms download on Enter hotkey
- [ ] confirms enqueue on Enter hotkey when modal is opened in queue mode
- [ ] opens audio preset and keeps Enter as normal confirm for forceAudioOnly flow
- [ ] adds an MP3 option in the audio tab and returns an mp3 audio payload
- [ ] keeps forceAudioOnly priority over remembered video label
- [ ] syncs tab ARIA state and tabpanel label on tab switch
- [ ] keeps options ARIA roles and active descendant in sync
- [ ] derives cover overlay genre from title metadata
- [ ] hides cover overlay genre when title has no reliable genre fragment
- [ ] hides selection/actions and disables split actions while formats are loading
- [ ] builds subtitle tab options and prefers manual Russian subtitles
- [ ] keeps mixed-case subtitle language codes in payloads

### `src/js/modules/__tests__/downloadQualityProfileSettings.test.js` (6)
- [ ] initializes remember mode from storage and updates summary
- [ ] falls back to remember for invalid stored values
- [ ] switches to audio on click and persists value
- [ ] supports keyboard preview, commit, and open-settings refresh
- [ ] reinitializes without duplicating DOM listeners
- [ ] does not fail without DOM or electron invoke

### `src/js/modules/__tests__/downloadQueueFilter.test.js` (3)
- [ ] restores only supported persisted filters
- [ ] persists selection and invokes the render callback once
- [ ] resets a selected status filter when that status count becomes zero

### `src/js/modules/__tests__/downloadQueuePersistence.test.js` (12)
- [ ] loads, normalizes, sorts, and filters persisted jobs
- [ ] uses createdAt when updatedAt is absent or invalid
- [ ] returns an empty list when storage access fails
- [ ] uses window.localStorage by default
- [ ] stores only normalized done jobs with non-empty URL and path
- [ ] keeps the newest job when signature, jobId, or id is duplicated
- [ ] retains the 30 newest unique jobs
- [ ] keeps valid jobs without an identity
- [ ] returns an empty list when setItem fails
- [ ] returns an empty list when removeItem fails
- [ ] ignores fields outside the completed job schema
- [ ] uses window.localStorage by default

### `src/js/modules/__tests__/downloadTabUi.test.js` (2)
- [ ] keeps queue count in aria label when progress is not active
- [ ] combines queue count and progress in aria label

### `src/js/modules/__tests__/electronEvents.test.js` (2)
- [ ] forwards toast options to showToast
- [ ] updates about settings version fields

### `src/js/modules/__tests__/filterAndSortHistory.test.js` (2)
- [ ] keeps source filter before history hydration
- [ ] clears stale source filter after history hydration

### `src/js/modules/__tests__/firstRunModal.test.js` (3)
- [ ] shows wizard on first run, preserves selections, and applies them
- [ ] treats Backup as a tool inside Tools in the summary
- [ ] does not show modal when already completed

### `src/js/modules/__tests__/footerStatusBar.test.js` (12)
- [ ] loads and renders global footer state in top mode
- [ ] moves group-menu into footer when sentinel leaves top viewport
- [ ] moves group-menu back to top bar when returning to top
- [ ] updates the active section when tab changes
- [ ] uses the localized Now Playing label
- [ ] hides footer tools block when settings toggle broadcasts hidden state
- [ ] opens settings from the footer action
- [ ] renders history action before settings in the footer
- [ ] keeps footer meta label as tab
- [ ] scrolls smoothly to top from footer action
- [ ] keeps footer controller stable when IntersectionObserver is unavailable
- [ ] does not switch modes while sentinel stays inside hysteresis band

### `src/js/modules/__tests__/historyActions.test.js` (6)
- [ ] refresh button updates search query and pulls history
- [ ] clear history dialog clears all entries when all mode is selected
- [ ] clear history dialog removes only failed and missing entries in problem mode
- [ ] clear history problem mode does not mutate history when no problem entries exist
- [ ] clear history undo restores removed problem entries
- [ ] clear history problem mode cleans previews only for removed entries

### `src/js/modules/__tests__/historyView.test.js` (31)
- [ ] applies density class and active button
- [ ] updates header icon and total files size summary
- [ ] does not load history during shell initialization
- [ ] initial state load uses cached stats instead of count IPC
- [ ] reuses in-flight history load when panel opens during hydration
- [ ] renders compact pagination controls with page-size options
- [ ] hides pagination for empty history
- [ ] keeps pagination disabled states in sync with current page
- [ ] groups entries by date with labels
- [ ] moves secondary actions into menu
- [ ] opens inline media inspector inside a history card and toggles it closed
- [ ] opens inline media inspector inside row details and keeps only one open
- [ ] renders compact row badge line with source and size
- [ ] renders failed history entry with failure badge and disabled file actions
- [ ] renders explicit error history entry with error highlight
- [ ] retry from row menu scrolls to URL input and focuses it
- [ ] toggles control-deck more menu and closes on escape
- [ ] animates download history panel when footer button toggles it
- [ ] updates active filters badge and resets filters to defaults
- [ ] renders unified search+filters card with required controls
- [ ] enables virtualized rendering for large history pages
- [ ] keeps full render for small history pages
- [ ] toggles details when clicking history row body
- [ ] keeps toggle-all details chevron state in sync
- [ ] renders source and file detail action controls
- [ ] renders redesigned details structure including ordered fields
- [ ] renders placeholder details preview when thumbnail is unavailable
- [ ] opens downloaded file from details preview play button
- [ ] toggles select all / unselect all for a date group
- [ ] renders deleted badge and disables open actions for deleted entry
- [ ] collapses and expands filters with persisted state

### `src/js/modules/__tests__/hotkeys.backupTransfer.test.js` (1)
- [ ] routes Ctrl+3 and Meta+3 to the Tools backup entry point

### `src/js/modules/__tests__/i18n.test.js` (2)
- [ ] keeps translations accessible after split
- [ ] t and applyI18n work with merged translation sections

### `src/js/modules/__tests__/iconUpdater.test.js` (3)
- [ ] updates the existing icon immediately while typing and restores globe on clear
- [ ] uses the current input value during initialization
- [ ] restores the globe after programmatic clear actions

### `src/js/modules/__tests__/mainViewHeader.template.test.js` (1)
- [ ] keeps downloader mode switch in the URL helper row

### `src/js/modules/__tests__/mediaSessionManager.test.js` (11)
- [ ] publishes metadata, provider artwork and position state
- [ ] uses the packaged 512px app icon when artwork is missing
- [ ] routes transport and seek actions to the playback controller
- [ ] updates position immediately after a system seek
- [ ] updates position immediately after a controller seek
- [ ] throttles ordinary playing progress to one update per second
- [ ] updates immediately on track and playback state changes
- [ ] does not publish invalid duration and clamps snapshot position
- [ ] continues registering actions when one action is unsupported
- [ ] isolates Media Session errors and unavailable APIs
- [ ] clears stopped sessions and unregisters every action on dispose

### `src/js/modules/__tests__/modalHandlers.test.js` (1)
- [ ] opens the shortcuts settings section from the top bar

### `src/js/modules/__tests__/modalManager.test.js` (3)
- [ ] closes settings through its lifecycle handler
- [ ] registers and controls feature-owned dialogs
- [ ] opens feature dialogs without making the document inert when requested

### `src/js/modules/__tests__/modals.confirmationHtml.test.js` (4)
- [ ] sanitizes HTML when allowHtml=true
- [ ] falls back to text when DOMPurify is missing
- [ ] returns custom confirm, cancel, and close results
- [ ] renders choices and returns selected value on confirm

### `src/js/modules/__tests__/network.test.js` (3)
- [ ] shows error toast on offline event
- [ ] shows success toast on online event
- [ ] does not require network indicator DOM nodes

### `src/js/modules/__tests__/nowPlayingContextMenu.test.js` (3)
- [ ] hides local-only actions for remote tracks and restores focus
- [ ] dispatches the selected action with track context
- [ ] disables playback and file actions for a missing local track

### `src/js/modules/__tests__/nowPlayingImmersiveControllers.test.js` (3)
- [ ] reveals sidebar and topbar on hover/focus with delayed hide
- [ ] keeps a pinned sidebar visible across pointer leave and restores it
- [ ] syncs fullscreen state and removes external listeners on dispose

### `src/js/modules/__tests__/nowPlayingMediaLibraryModel.test.js` (7)
- [ ] migrates the V1 queue into the virtual media library
- [ ] sanitizes broken playlist references and falls back to the library
- [ ] deduplicates local paths and YouTube videos by canonical video id
- [ ] supports playlist CRUD, ordering and catalog deletion
- [ ] returns defensive state copies
- [ ] migrates V2 metadata and keeps the active network playlist
- [ ] returns defensive copies of quality selections

### `src/js/modules/__tests__/nowPlayingNetworkProvider.test.js` (2)
- [ ] accepts credential-free HTTP(S) URLs
- [ ] marks HLS manifests for the HLS playback adapter

### `src/js/modules/__tests__/nowPlayingPlaybackController.test.js` (16)
- [ ] selects a track, swaps the reusable media layer and starts playback
- [ ] supports previous, next, shuffle and repeat modes
- [ ] persists selectedTrackId and settings but not playback position
- [ ] restores a V2 active playlist without taking ownership of library CRUD
- [ ] updates its queue from a library model state
- [ ] pauses while hidden and resumes only when it was playing
- [ ] does not auto-resume after an explicit pause while suspended
- [ ] keeps the media session active on pause and reactivates it on play
- [ ] stops playback, resets progress and cancels a pending track load
- [ ] marks explicit seeks for immediate external position updates
- [ ] ends the session at the natural end of the final track
- [ ] ends the session for an empty queue and active media errors
- [ ] ends playback state when disposed
- [ ] keeps unavailable tracks selected and exposes a recoverable error
- [ ] shows a distinct loading state and pauses the old track while resolving
- [ ] requests a forced refresh only when retrying playback

### `src/js/modules/__tests__/nowPlayingProviders.test.js` (10)
- [ ] normalizes metadata and deduplicates local paths
- [ ] normalizes extended video formats and V3 metadata
- [ ] merges structured import results without replacing the queue
- [ ] resolves local files into playback DTOs and rejects missing tracks
- [ ] routes AVI/MPEG through the protected local HLS session
- [ ] registry validates and routes provider calls
- [ ] canonicalizes and imports a single YouTube video
- [ ] rejects YouTube playlist URLs and invalid hosts
- [ ] restores canonical YouTube tracks and resolves fresh playback URLs
- [ ] surfaces structured YouTube resolve errors

### `src/js/modules/__tests__/nowPlayingTransientQueue.test.js` (2)
- [ ] keeps insertion order and supports reorder, removal and filtering
- [ ] never exposes mutable internal items

### `src/js/modules/__tests__/nowPlayingView.test.js` (22)
- [ ] renders an accessible player and restores selectedTrackId
- [ ] opens a non-blocking media library empty state
- [ ] updates the brand label from playback state
- [ ] adjusts volume with the mouse wheel and shows the percentage
- [ ] syncs fullscreen controls, Escape and tab hide with preload state
- [ ] refreshes dynamic playback and fullscreen labels after language changes
- [ ] shows only the matching audio ambient or video layer
- [ ] shows YouTube preparation without a false playing indicator
- [ ] loads restored media silently and attempts playback on first show
- [ ] syncs system media commands with playback while the view is active
- [ ] restores and persists background playback and sidebar pin preferences
- [ ] hands artwork and metadata off together after the new cover loads
- [ ] hides missing sidebar artwork and unknown artist metadata
- [ ] hides broken artwork while preserving real album metadata
- [ ] exposes reduced-motion state and commits track visuals immediately
- [ ] imports files, selects the first new track and persists the queue
- [ ] autohides controls only while playing and locks them on interaction
- [ ] supports row keyboard selection, removal and queue clearing
- [ ] renders the V2 media library, playlists and persistent mini-player
- [ ] switches playlists from the library and sidebar without autoplay
- [ ] creates a playlist with the accessible library dialog
- [ ] imports a single YouTube video from the library dialog

### `src/js/modules/__tests__/pageBackgroundMode.test.js` (3)
- [ ] defaults to downloader mode and reacts to tab changes
- [ ] switches to backup mode for the backup tool view and returns to tools
- [ ] tracks settings modal mode without losing current page mode

### `src/js/modules/__tests__/powerShortcuts.test.js` (3)
- [ ] defines complete action config for every power shortcut
- [ ] maps action states to unified tones
- [ ] enables actions only when tool is visible on windows and not busy

### `src/js/modules/__tests__/productFormatterDictionary.test.js` (4)
- [ ] parses valid rules and keeps the last duplicate key
- [ ] inspects invalid, duplicate, no-op, and override rules
- [ ] removes only invalid dictionary lines
- [ ] parses structured alias, normalize, and token rules

### `src/js/modules/__tests__/productFormatterView.test.js` (45)
- [ ] renders the upgraded workspace with utility actions and empty result state
- [ ] formats into a single preview flow with summary at the end and enables the compact result controls
- [ ] appends the greens summary block when the optional toggle is enabled
- [ ] reformats the preview immediately when toggles change after formatting
- [ ] omits summary from the preview flow when the checkbox is disabled and copies raw output
- [ ] supports demo, paste and clear actions with coherent status and reset state
- [ ] marks the result as stale after editing the source and clears it on rerun
- [ ] auto-reformats the result on source edits when auto refresh is enabled
- [ ] auto-reformats after dictionary edits when auto refresh is enabled
- [ ] does not keep the stale banner after rerender when source and dictionary did not change
- [ ] clears stale status text after rerender when result is no longer dirty
- [ ] supports empty-state quick actions for paste and demo
- [ ] surfaces clipboard errors through the inline status channel
- [ ] copies an individual section from its local action
- [ ] renders diagnostics and highlights uncertain normalized lines
- [ ] keeps normalization collapsed by default and expands on click
- [ ] allows dismissing warnings from the diagnostics panel
- [ ] supports collapsible sections without a separate normalization stats block
- [ ] supports result actions from the compact overflow menu
- [ ] blocks stale apply-to-input actions and disables the result menu
- [ ] closes the result menu on escape and outside click
- [ ] filters diagnostics by category
- [ ] applies normalized text back to the input
- [ ] applies a normalized diff row back to the input
- [ ] applies the selected duplicated diff row back to the matching source line
- [ ] filters the result preview by search query
- [ ] copies only the currently visible lines from a filtered section
- [ ] keeps normalization expanded while search only refreshes the preview
- [ ] reveals source lines in the input from diagnostics actions
- [ ] reveals the exact duplicated source line from diagnostics actions
- [ ] supports custom dev dictionary and shows comparison after a rerun
- [ ] keeps diagnostics visible when only the comparison panel has changes
- [ ] uses the latest formatted result as the comparison baseline for toggle reruns
- [ ] shows dictionary validation when malformed rules are entered
- [ ] shows duplicate keys and built-in overrides in dictionary meta
- [ ] keeps dictionary preview tied to the active textarea line
- [ ] shows duplicate and built-in override hints for the active dictionary line
- [ ] shows structured rule types and token rule details in dictionary preview
- [ ] shows read-only dictionary suggestions after formatting typo-corrected entries
- [ ] jumps from dictionary summary chips to the first problem line
- [ ] shows override chips without marking the dictionary textarea invalid
- [ ] cleans only invalid dictionary lines from the panel
- [ ] toggles the dictionary as a sidebar and closes it via the close button
- [ ] preserves formatted result while the result pane is hidden by the dictionary
- [ ] resets comparison history after paste and demo actions

### `src/js/modules/__tests__/productListFormatter.test.js` (28)
- [ ] formats the prompt sample and appends the summary
- [ ] normalizes decimal commas, grams, and unit names in sections
- [ ] applies shop-specific rules, dedupes entries, and excludes greenery from summary
- [ ] merges cherry variants and sums weights
- [ ] parseProductList returns structured sections and raw text without summary when disabled
- [ ] appends a greens summary block when the optional toggle is enabled
- [ ] returns diagnostics for ambiguous units, duplicates, typo fixes, and ignored store quantities
- [ ] does not drop greenery bunch quantities in sections or store rules
- [ ] does not warn for lines that are already in valid normalized form
- [ ] applies custom replacement rules and exposes normalization stats
- [ ] builds grouped sections and broader produce replacements from noisy source lists
- [ ] normalizes noisy mixed procurement lists into stable sections and aliases
- [ ] normalizes fused section titles and missing chili or egg aliases
- [ ] keeps address-like lines from swallowing the next section and ignores bare salad leaf lines
- [ ] normalizes plural produce, golden apples, color abbreviations, and colon decimals
- [ ] preserves uppercase vitamin heading and converts post-quantity tails into qualifiers
- [ ] does not mistake lower-case greenery aliases for section headings
- [ ] normalizes unicode punctuation, bullets, and noisy quantity markers
- [ ] resolves contextual aliases, reordered product names, and spaced decimals
- [ ] folds simirenko typo family into one canonical apple and keeps typo diagnostics
- [ ] does not fuzzy-match when two custom candidates are equally close
- [ ] applies dev normalize and token rules before fuzzy fallback
- [ ] splits predictable slash-delimited clipboard lines without creating false headings
- [ ] keeps uncertain handling for ambiguous entries after symbol normalization
- [ ] matches the grouped section fixture
- [ ] matches the heading-free greens fixture
- [ ] matches the noisy clipboard fixture
- [ ] applies new produce aliases and keeps size notes only in summary

### `src/js/modules/__tests__/registerTabs.backupTransfer.test.js` (8)
- [ ] registers Download, Tools, Products, and Now Playing tabs
- [ ] redirects legacy backup default tab to Tools entry point
- [ ] ignores the removed Downloader developer preference
- [ ] shows history button only for the Downloader tab callbacks
- [ ] initializes downloader preview modules when Download tab renderer runs
- [ ] loads Tools view only when Tools tab renderer runs
- [ ] loads Products view only when Products tab renderer runs
- [ ] keeps Now Playing mounted and forwards tab lifecycle hooks

### `src/js/modules/__tests__/scrollbarVisibility.test.js` (1)
- [ ] shows scrollbars during wheel activity and hides them after idle

### `src/js/modules/__tests__/scrollLockManager.test.js` (5)
- [ ] keeps body lock until the last owner releases it
- [ ] does not break on repeated acquire for the same owner
- [ ] supports body and document locks independently
- [ ] repair and clear keep DOM synchronized with owner state
- [ ] supports overlay-only owners without forcing body scroll lock

### `src/js/modules/__tests__/scrollLockRepair.test.js` (5)
- [ ] removes stale body scroll lock on refocus when no modal is open
- [ ] keeps body scroll lock when a lock owner is still active
- [ ] clears stale document overflow lock when no overlay is visible
- [ ] keeps document overflow lock while a lock owner is still active
- [ ] clears all scroll locks when tools view is hidden

### `src/js/modules/__tests__/settings.template.test.js` (16)
- [ ] includes Thunder Spark brand lockup in the footer
- [ ] keeps queue filters in the queue header pills
- [ ] keeps preview live player trigger on the thumbnail
- [ ] keeps Backup controls inside Tools and removes separate sidebar tab
- [ ] includes the emerald theme in settings and first-run templates
- [ ] uses compact appearance panel and preserves control ids
- [ ] uses accessible tabs and appearance listboxes
- [ ] embeds the shortcut editor in Settings and removes its legacy modal
- [ ] localizes every shortcut catalog action in Russian and English
- [ ] moves downloader tools block out of downloader settings
- [ ] uses compact icon tabs with tooltip titles in the download quality modal
- [ ] moves about app information into the general settings tab
- [ ] includes auto quality modal toggle in downloader settings
- [ ] includes yt-dlp cookies controls in downloader settings
- [ ] includes localized web control settings
- [ ] builds the standalone notifications lab page

### `src/js/modules/__tests__/settings.test.js` (37)
- [ ] shows badge and marks button disabled when disabled = true
- [ ] hides badge and removes disabled class when disabled = false
- [ ] sets accessibility attrs for wg sidebar badge
- [ ] updates backup status card without requiring a sidebar tab
- [ ] silently ignores unknown module keys
- [ ] shows badge as off when stored flag is true
- [ ] is disabled by default and persists checkbox changes
- [ ] renders status and wires web-control IPC actions
- [ ] reads and applies backup toggles inside wgunlock-settings
- [ ] syncs label and calls setLanguage on click
- [ ] initializes remember mode from storage and updates summary
- [ ] switches to audio on click and persists value
- [ ] supports keyboard selection and restores state on open-settings
- [ ] activates developer tools with correct secret word
- [ ] restores persisted developer state on init
- [ ] does not activate developer tools with invalid secret
- [ ] disables developer tools on second click when already enabled
- [ ] migrates legacy value 3 to 2 and reflects segment state
- [ ] writes 1/2 and dispatches download:parallel-limit-changed on segment click
- [ ] loads cookies settings and toggles browser/file rows
- [ ] saves mode changes
- [ ] saves mode changes from the custom dropdown option
- [ ] selects a cookies file and saves file mode
- [ ] syncs checkbox with storage and dispatches tools:visibility
- [ ] defaults to enabled and stores disabled state
- [ ] applies initial states and persists changes for downloader behavior switches
- [ ] does not render embedded tools info when downloader settings tab is active
- [ ] collectCurrentConfig does not expose appearance.showNetworkStatus
- [ ] does not export the removed Downloader developer preference
- [ ] exports yt-dlp cookies settings
- [ ] exports effective shortcut assignments
- [ ] applyConfig clears legacy topbarNetworkStatusVisible key
- [ ] ignores legacy Downloader config and removes its storage key
- [ ] applies yt-dlp cookies settings
- [ ] replaces shortcut assignments from a current config
- [ ] resets shortcuts when importing a legacy config without assignments
- [ ] disables global shortcuts before applying assignments

### `src/js/modules/__tests__/settings.toastHtml.test.js` (2)
- [ ] uses showToast allowHtml for font size toasts
- [ ] uses showToast allowHtml for theme toasts

### `src/js/modules/__tests__/settingsModal.test.js` (17)
- [ ] opens and closes mobile sections panel via toggle
- [ ] closes mobile panel and updates active label after tab click
- [ ] supports arrow, Home and End keyboard navigation between tabs
- [ ] restores label from saved lastSettingsTab on init
- [ ] migrates removed about tab from saved lastSettingsTab to general
- [ ] openSettings resets mobile panel state and syncs label
- [ ] closeSettings removes modal scroll lock
- [ ] Escape closes settings through the modal lifecycle
- [ ] Escape inside an open dropdown is left to the dropdown handler
- [ ] external theme updates synchronize aria-selected
- [ ] modal manager close request uses closeSettings cleanup
- [ ] closeSettings suppresses settings trigger tooltip while focus is restored
- [ ] opens first-run modal from settings without reload
- [ ] populates about section details on init
- [ ] copies app info from about section
- [ ] starts update check from about section and closes settings
- [ ] opens whats new from about section via existing version trigger

### `src/js/modules/__tests__/settingsStore.theme.test.js` (3)
- [ ] propagates set-theme IPC errors when Electron is available
- [ ] propagates structured set-theme failures without changing local state
- [ ] still applies the theme when Electron is unavailable

### `src/js/modules/__tests__/shortcutEditor.test.js` (4)
- [ ] renders catalog metadata and filters actions
- [ ] records a shortcut immediately and Escape cancels recording
- [ ] offers an atomic swap after a conflict
- [ ] requires inline confirmation before reset

### `src/js/modules/__tests__/state.test.js` (2)
- [ ] keeps download actions disabled when downloader is unavailable
- [ ] marks history as not hydrated by default

### `src/js/modules/__tests__/tabSystem.test.js` (6)
- [ ] does not append a tab wrapper into itself when re-rendering an emptied tab
- [ ] keeps the latest tab visible after rapid hotkey-style switching
- [ ] keeps generated tabs and panels accessible
- [ ] keeps Downloader available when legacy developer preference exists
- [ ] keeps products tab hidden until developer mode is enabled
- [ ] falls back from products tab when developer mode is disabled

### `src/js/modules/__tests__/themeManager.test.js` (1)
- [ ] falls back from removed light theme to dark

### `src/js/modules/__tests__/toast.test.js` (8)
- [ ] keeps the legacy positional API and renders compact toast metadata
- [ ] supports object options without breaking existing callers
- [ ] renders allowed html tags when allowHtml=true
- [ ] sanitizes dangerous html and strips scripts/events
- [ ] falls back to plain text if DOMPurify is unavailable
- [ ] closes from the icon button and Escape
- [ ] limits visible toasts to five
- [ ] returns a loading toast controller that updates and closes

### `src/js/modules/__tests__/tools.cleanupRegistry.test.js` (2)
- [ ] removes window listeners and pending timers on dispose
- [ ] clears intervals through the registry

### `src/js/modules/__tests__/tools.toolViewState.test.js` (6)
- [ ] resolves remembered tool only when it is available
- [ ] resolves remembered backup tool and falls back when disabled
- [ ] tracks developer unlock state for macOS power tools
- [ ] reads persisted developer unlock state from storage
- [ ] remembers media-inspector as a valid last tool view
- [ ] remembers downloader tools as a valid last tool view

### `src/js/modules/__tests__/toolsEntranceAnimation.test.js` (8)
- [ ] prepares visible headers and cards in DOM order
- [ ] caps stagger indices for long card lists
- [ ] refreshes visible card order immediately before playback
- [ ] reveals immediately instead of animating a hidden launcher
- [ ] starts only after two animation frames and cleans on animationend
- [ ] uses the fallback timer when animationend does not fire
- [ ] cancel removes frames, listeners, classes, variables, and timers
- [ ] cancels safely when the root is detached before playback

### `src/js/modules/__tests__/toolsInfo.test.js` (16)
- [ ] renders dynamic tools UI with ti- prefixed ids
- [ ] shows tools version summary when all tools exist
- [ ] keeps checking copy split between eyebrow, badge and detailed status
- [ ] install button downloads when tools are missing
- [ ] shows install progress text on install button while downloading tools
- [ ] check button reveals update flow when updates are available
- [ ] force reinstall from overflow menu triggers installAll
- [ ] updates summary after successful install
- [ ] does not recreate root DOM on repeated refresh
- [ ] keeps single-bound handlers across multiple refreshes
- [ ] ignores stale refresh response and keeps latest state
- [ ] reuses existing tool card nodes on refresh (partial update)
- [ ] uses cached checkUpdates result within TTL
- [ ] shows explicit offline summary state and quick actions
- [ ] keeps overflow menu and force action in the compact footer row
- [ ] throws localized error when installAll bridge is unavailable

### `src/js/modules/__tests__/toolsView.tools.test.js` (95)
- [ ] opens launcher by default and keeps power tool unavailable on macos
- [ ] renders combined header with breadcrumbs and tools section header
- [ ] uses localized launcher strings in initial markup
- [ ] shows total tools counter for macos
- [ ] opens downloader dependencies tool view from launcher
- [ ] forces downloader dependencies refresh after settings update
- [ ] shows Format Converter as available tool and opens it
- [ ] picks a converter source file and enables conversion
- [ ] accepts dropped converter files
- [ ] runs converter with selected format, quality, and output folder
- [ ] updates converter progress and opens conversion result
- [ ] shows structured converter failures
- [ ] cancels an active converter run
- [ ] does not render launcher hotkey labels
- [ ] shows Backup as a launcher tool when enabled
- [ ] hides Backup from launcher when it is disabled
- [ ] renders available and unavailable sections on windows
- [ ] cleans up ipc listeners when the tools view is hidden
- [ ] opens launcher by default even if last tool is stored
- [ ] restores last hash view when remember setting is enabled
- [ ] falls back to launcher when last view power is unavailable
- [ ] restores File Sorter when last view is remembered
- [ ] shows File Sorter as available tool and opens it
- [ ] keeps File Sorter available when developer mode is enabled
- [ ] supports editable rules, mandatory preview, selection, apply, export, and undo
- [ ] keeps operation selection across filters and invalidates stale previews
- [ ] localizes known sorter reasons and falls back to the original message
- [ ] shows Media Inspector as available tool and opens it
- [ ] auto-analyzes a selected file and renders media report
- [ ] highlights Media Inspector drop zone during drag operations
- [ ] accepts a dropped file for media inspection
- [ ] accepts a dropped dataTransfer item for media inspection
- [ ] ignores empty media drops without clearing the current report
- [ ] copies media report with video pixel format
- [ ] renders compact empty states for sections without streams
- [ ] shows warning status when report contains warning-severity signals
- [ ] blocks repeat analysis while media inspection is in flight
- [ ] renders compact loading state while media inspection is in flight
- [ ] keeps loading meta hidden for empty and error states
- [ ] keeps open-folder action available after analyze failure
- [ ] open-folder failure does not hide a rendered report
- [ ] does not render converter placeholder card
- [ ] opens WG view from launcher and shows back button
- [ ] back button returns to launcher
- [ ] breadcrumbs stay visible and return to launcher
- [ ] shows backup as current breadcrumb after opening Backup
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
- [ ] hash algorithm dropdown exposes only supported UI algorithms
- [ ] shows file size and ready status after selecting hash file
- [ ] opens hash file picker when clicking the drop zone
- [ ] enables hash copy and copies actual hash after verify
- [ ] shows hash progress and stores recent verification history
- [ ] compares two selected files by hash
- [ ] accepts a dropped file for hash verification
- [ ] accepts two dropped files and fills both hash slots
- [ ] combines dropped file paths from mixed dataTransfer sources
- [ ] accepts dropped Windows file URI from text/uri-list
- [ ] accepts raw Windows path from text/plain drop data
- [ ] accepts localhost Windows file URI and opens compare panel for second file
- [ ] highlights hash drop zone during drag operations
- [ ] clears second file selection and falls back to single-file verify
- [ ] resets selected files and expected hash with clear all action
- [ ] normalizes expected hash before single-file verification
- [ ] when expected hash is set, compares expected against both files
- [ ] locks hash controls while hash is calculating
- [ ] keeps compare section hidden until user asks for it
- [ ] shows power tool on macos in developer mode but keeps windows actions disabled
- [ ] hides power tool on linux
- [ ] falls back to launcher when last view power is remembered on macos without developer mode
- [ ] asks confirmation before restart shortcut IPC call
- [ ] does not call shutdown IPC when confirmation is cancelled
- [ ] creates UEFI shortcut on windows
- [ ] renders grouped power layout and session actions
- [ ] shows creating state and allows clearing last power status
- [ ] create another clears current power status and returns focus to the last action

### `src/js/modules/__tests__/tooltipInitializer.test.js` (6)
- [ ] repeated initTooltips does not duplicate tooltip instances
- [ ] updates tooltip content when title changes
- [ ] fallback title update without setContent does not force dispose
- [ ] keeps tooltip when Bootstrap stores text in data-bs-original-title
- [ ] cleanup removes disconnected elements from active tooltip map
- [ ] body click hides shown tooltips

### `src/js/modules/__tests__/topBarReloadGuard.test.js` (2)
- [ ] reloads when there is no active download
- [ ] disables reload button during active download and restores it after

### `src/js/modules/__tests__/topBarResponsive.test.js` (4)
- [ ] sets --topbar-current-height CSS variable
- [ ] updates --topbar-current-height on resize
- [ ] does nothing when top bar is absent
- [ ] does not require the removed More overflow controls

### `src/js/modules/__tests__/trayStateSync.test.js` (3)
- [ ] uses the documented state priority
- [ ] sends startup state and only sends actual changes
- [ ] restores the derived state after reconnecting

### `src/js/modules/__tests__/updateHandler.test.js` (15)
- [ ] renders localized update available flyover and focuses primary action
- [ ] opens flyover below anchor when there is not enough room above
- [ ] shows checking then up-to-date and auto-hides
- [ ] interrupts up-to-date auto-hide when update becomes available
- [ ] starts download from flyover action and switches to progress state
- [ ] renders progress details from updater payload
- [ ] compatibility updateProgressBar wrapper opens progress state
- [ ] shows persistent ready badge after update is downloaded
- [ ] reopens done state from ready badge and clears badge on successful restart
- [ ] restores ready badge and shows install error when restart fails
- [ ] maps network errors to retryable error state
- [ ] maps download errors to retryable error state
- [ ] maps install errors to non-retryable error state
- [ ] retries download from error state when update metadata is known
- [ ] closes flyover on Escape

### `src/js/modules/__tests__/urlInputHandler.test.js` (51)
- [ ] does not show inline error while typing before blur/enter
- [ ] does not paste from clipboard when downloader is unavailable
- [ ] hides action row when URL is empty and shows it after input
- [ ] shows inline error on blur for invalid URL
- [ ] shows error and does not trigger download on Enter with invalid URL
- [ ] Shift+Enter triggers queue-only mode
- [ ] Alt+Enter does not trigger a dedicated action
- [ ] hides error and invalid style when URL becomes valid
- [ ] normalizes URL on blur, paste, drop and Enter
- [ ] auto-opens quality selection after pasted URL resolves with preview and formats
- [ ] auto-opens quality selection when recognized preview has no loaded formats yet
- [ ] warms full video info after a recognized preview without blocking preview render
- [ ] cancels stale full-info warmup when URL changes
- [ ] auto-opens quality selection when yt-dlp returns preview only in thumbnails
- [ ] auto-opens quality selection for pasted URL that already has loaded formats
- [ ] normalizes native pasted URL before preview and auto-open
- [ ] starts preview immediately after native paste without debounce delay
- [ ] auto-opens quality selection when force-preview requests it
- [ ] force-preview reuses cached preview for the same URL
- [ ] cancels stale preview request when URL changes
- [ ] ignores stale preview response after rapid URL replacement
- [ ] does not auto-open quality selection after paste in compact mode
- [ ] does not auto-open quality selection when force-preview requests it in compact mode
- [ ] does not auto-open quality selection when preview image is missing
- [ ] does not auto-open quality selection when content is not recognized
- [ ] does not auto-open quality selection when the setting is disabled
- [ ] does not request preview for invalid URL and keeps preview hidden
- [ ] shows preview spinner while waiting and fetching preview
- [ ] shows auth-required inline error for preview fetch failures
- [ ] shows neutral network-timeout inline error for non-YouTube preview failures
- [ ] Escape clears input, preview and inline error
- [ ] does not handle Enter or Escape from URL input while quality modal is open
- [ ] keeps current paste/clear visibility behavior and shell states
- [ ] adds and removes drag-over class for drag events
- [ ] marks shell as having preview when preview data is rendered
- [ ] renders preview card metadata in detailed and compact modes
- [ ] enables downloader background video for YouTube preview candidates
- [ ] applies downloader background video after full-info warmup when preview metadata is cached
- [ ] shows live preview overlay only when livePreview is available
- [ ] clicking live preview action dispatches explicit player-open event
- [ ] live preview action becomes a close toggle while player is open
- [ ] live preview retry refreshes current preview and reopens player
- [ ] non-YouTube preview keeps the default downloader background
- [ ] clearing the URL stops and resets downloader background video
- [ ] closing the preview card clears the downloader background video
- [ ] switching from YouTube preview to another source clears stale video background
- [ ] background recovery refreshes current YouTube preview without showing an error
- [ ] renders playlist summary and add-all action inside preview
- [ ] playlist current-item action reuses the normal download flow
- [ ] playlist add-all action dispatches queue:addMany with entries
- [ ] opens current source URL when clicking the source icon button

### `src/js/modules/__tests__/videoInfoBroker.test.js` (6)
- [ ] deduplicates parallel preview requests by URL
- [ ] serves preview from cached full info without another IPC request
- [ ] deduplicates full info requests and stores the successful result
- [ ] fetches full info when only preview metadata is cached
- [ ] cancels an in-flight preview request by URL
- [ ] cancels an in-flight full info request by URL

### `src/js/modules/__tests__/videoInfoCache.test.js` (1)
- [ ] stores full video info for quality modal reuse

### `src/js/modules/__tests__/webControlBridge.test.js` (6)
- [ ] returns settings snapshot for the web UI
- [ ] subscribes to main-process web requests and sends responses
- [ ] returns serializable compact quality options for preview requests
- [ ] validates the complete settings patch before applying any setting
- [ ] propagates a structured download path failure
- [ ] applies a valid partial patch and returns canonical settings

### `src/js/modules/__tests__/webControlSettings.test.js` (3)
- [ ] renders status and wires web-control actions
- [ ] reinitializes without duplicating DOM listeners
- [ ] keeps the latest async status when requests resolve out of order

### `src/js/modules/__tests__/webQualitySelection.test.js` (2)
- [ ] keeps a valid paired format payload
- [ ] rejects incompatible or unsafe selections

### `src/js/modules/__tests__/whatsNewModal.test.js` (7)
- [ ] keeps allowed tags
- [ ] removes script tags
- [ ] keeps h1 and table tags for rich markdown
- [ ] strips javascript: href
- [ ] builds overview and feature slides from release notes table
- [ ] adds and removes modal overlay class when modal opens and closes
- [ ] template keeps accessible label and carousel hooks

### `src/js/modules/__tests__/windowsTrayMenu.test.js` (2)
- [ ] applies availability without exposing a path
- [ ] supports keyboard navigation, Escape and action dispatch

### `src/js/modules/__tests__/ytDlpCookiesSettings.test.js` (6)
- [ ] uses defaults for missing or unsupported values
- [ ] normalizes a valid value without mutating the source
- [ ] rejects file paths containing null bytes
- [ ] shows the active mode and supports keyboard listbox navigation
- [ ] reuses the controller state across repeated initialization
- [ ] ignores a stale load response after a newer save

### `src/js/scripts/__tests__/download.selectFormats.test.js` (29)
- [ ] normalizes cookies settings and defaults to off
- [ ] does not add cookies args by default
- [ ] adds browser cookies args to info and preview calls
- [ ] does not add configured cookies args to non-YouTube urls
- [ ] adds cookies file args only for an existing absolute file
- [ ] skips invalid or missing cookies files
- [ ] falls back by quality label when stored format IDs are unavailable
- [ ] falls back to audio-only when object has stale audio format ID
- [ ] preserves mp3 audio output for explicit audio-only selections
- [ ] returns empty media formats for subtitle-only selections
- [ ] builds manual subtitle-only yt-dlp args with SRT conversion
- [ ] builds automatic subtitle args and falls back unsafe languages to English
- [ ] downloads only the explicitly selected subtitle source
- [ ] finds the requested converted subtitle output by temp prefix
- [ ] falls back to source subtitle artifacts when SRT was not produced
- [ ] finds yt-dlp automatic caption artifacts before conversion
- [ ] classifies unsupported URLs, 404, 429 and spawn-like failures
- [ ] converts yt-dlp exit output into structured errors
- [ ] adds no-playlist for a YouTube watch link with playlist metadata
- [ ] keeps playlist URLs eligible for playlist extraction
- [ ] builds lightweight preview args without format checking
- [ ] uses flat playlist extraction only for explicit playlist preview URLs
- [ ] uses a longer cache TTL for normal videos and a short TTL for live videos
- [ ] stores lightweight preview metadata in persistent cache without formats
- [ ] does not persist live preview metadata but keeps playlist summary
- [ ] invalidates persistent preview metadata after the preview TTL
- [ ] invalidates persistent preview metadata when the yt-dlp signature changes
- [ ] caches the resolved yt-dlp binary while the file signature is unchanged
- [ ] skips blocked yt-dlp candidates during preflight

<!-- AUTO-JEST-TESTS:END -->