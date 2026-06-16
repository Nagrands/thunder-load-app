

## Автотесты (Jest)

- Автосборка списка: `npm run test-check:sync-tests`
- Найдено файлов: 76
- Найдено тест-кейсов (test/it): 762

<!-- AUTO-JEST-TESTS:START -->

### `src/js/app/__tests__/backupManager.test.js` (2)
- [ ] returns true for Compress-Archive module autoload failure
- [ ] returns false for unrelated powershell error

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

### `src/js/app/__tests__/ipcHandlers.toolsActions.test.js` (83)
- [ ] set-open-on-copy-url-status toggles clipboard monitor and persists state
- [ ] hashPickFile returns selected path
- [ ] mediaInspectorPickFile returns selected path
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
- [ ] allows two parallel DOWNLOAD_VIDEO and rejects third
- [ ] DOWNLOAD_VIDEO blocks reload while a download is active and restores it afterwards
- [ ] rejects second DOWNLOAD_VIDEO when parallel limit is set to 1
- [ ] DOWNLOAD_VIDEO shows warning when yt-dlp and ffmpeg are missing
- [ ] DOWNLOAD_VIDEO shows warning when only ffmpeg is missing
- [ ] DOWNLOAD_VIDEO returns structured classified error for known download failures
- [ ] DOWNLOAD_VIDEO does not emit duplicate renderer toast for classified failures
- [ ] CANCEL_DOWNLOAD_JOB cancels only the targeted active job
- [ ] CANCEL_DOWNLOAD_JOB is idempotent for an unknown job
- [ ] CANCEL_DOWNLOAD_JOB returns a structured cancellation error
- [ ] STOP_DOWNLOAD still cancels all active tokens
- [ ] wingetCheckStatus returns unsupported outside Windows
- [ ] wingetCheckStatus checks exact IDs and returns versions
- [ ] wingetCheckStatus parses bulk table output
- [ ] wingetCheckStatus falls back to positional package query when bulk output is unusable
- [ ] wingetRunInstall rejects invalid package IDs
- [ ] wingetRunUninstall rejects invalid package IDs
- [ ] wingetRunInstall streams PowerShell output and succeeds
- [ ] wingetRunInstall filters noisy PowerShell progress output
- [ ] wingetRunUpdate returns non-zero PowerShell exit
- [ ] wingetRunUninstall starts PowerShell with uninstall command

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

### `src/js/app/__tests__/runtimeTools.test.js` (1)
- [ ] falls back from preferred yt-dlp path to default path when preferred is not executable

### `src/js/app/__tests__/toolsVersions.test.js` (2)
- [ ] reads yt-dlp version from stdout
- [ ] falls back to stderr output for yt-dlp version

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

### `src/js/app/__tests__/window.trayRuntime.test.js` (4)
- [ ] handles click/double-click/right-click and refresh events on windows tray
- [ ] creates a template tray image on macOS and keeps it on download events
- [ ] window-close IPC respects minimize-to-tray behavior on Windows
- [ ] warns and keeps window open when closing during active download

### `src/js/app/__tests__/windowActivation.test.js` (6)
- [ ] activates and focuses window on macOS
- [ ] returns false for missing window
- [ ] focuses visible non-maximized window on Windows without maximizing
- [ ] restores and focuses minimized window on Windows without maximizing
- [ ] shows and focuses hidden window on Windows
- [ ] keeps non-Windows behavior unchanged

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

### `src/js/modules/__tests__/compactDownloaderQuality.test.js` (3)
- [ ] persists compact view mode and applies shell classes
- [ ] builds video and audio selectors from preview formats
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

### `src/js/modules/__tests__/downloaderLivePreview.test.js` (7)
- [ ] opens player and starts playback with sound from explicit event
- [ ] hides and clears player on close
- [ ] closes modal on Escape and returns focus to opener
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

### `src/js/modules/__tests__/downloadManager.test.js` (76)
- [ ] loadQueueFromStorage filters invalid entries and exact duplicates
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
- [ ] clears completed jobs via bulk action
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
- [ ] syncs completed storage after removing one job and clearing done
- [ ] clears completed storage when clearing the whole queue
- [ ] opens and reveals a restored completed job
- [ ] filters complete status groups without changing queue counters

### `src/js/modules/__tests__/downloadProgress.test.js` (5)
- [ ] supports legacy numeric progress payload
- [ ] aggregates object payload progress for two active jobs
- [ ] resets tracking when download state transitions to idle
- [ ] shows current stage in button text for a single active job
- [ ] keeps queue count in downloader tab accessibility while progress is active

### `src/js/modules/__tests__/downloadQualityModal.test.js` (27)
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

### `src/js/modules/__tests__/downloadQueueFilter.test.js` (2)
- [ ] restores only supported persisted filters
- [ ] persists selection and invokes the render callback once

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

### `src/js/modules/__tests__/firstRunModal.test.js` (3)
- [ ] shows wizard on first run, preserves selections, and applies them
- [ ] treats Backup as a tool inside Tools in the summary
- [ ] does not show modal when already completed

### `src/js/modules/__tests__/footerStatusBar.test.js` (11)
- [ ] loads and renders global footer state in top mode
- [ ] moves group-menu into footer when sentinel leaves top viewport
- [ ] moves group-menu back to top bar when returning to top
- [ ] updates the active section when tab changes
- [ ] hides footer tools block when settings toggle broadcasts hidden state
- [ ] opens settings from the footer action
- [ ] renders history action before settings in the footer
- [ ] keeps footer meta label as tab
- [ ] scrolls smoothly to top from footer action
- [ ] keeps footer controller stable when IntersectionObserver is unavailable
- [ ] does not switch modes while sentinel stays inside hysteresis band

### `src/js/modules/__tests__/historyActions.test.js` (1)
- [ ] refresh button updates search query and pulls history

### `src/js/modules/__tests__/historyView.test.js` (24)
- [ ] applies density class and active button
- [ ] updates header icon and total files size summary
- [ ] renders compact pagination controls with page-size options
- [ ] hides pagination for empty history
- [ ] keeps pagination disabled states in sync with current page
- [ ] groups entries by date with labels
- [ ] moves secondary actions into menu
- [ ] opens inline media inspector inside a history card and toggles it closed
- [ ] opens inline media inspector inside row details and keeps only one open
- [ ] renders compact row badge line with source and size
- [ ] renders failed history entry with failure badge and disabled file actions
- [ ] retry from row menu scrolls to URL input and focuses it
- [ ] toggles control-deck more menu and closes on escape
- [ ] animates download history panel when footer button toggles it
- [ ] updates active filters badge and resets filters to defaults
- [ ] renders unified search+filters card with required controls
- [ ] enables virtualized rendering for large history pages
- [ ] keeps full render for small history pages
- [ ] toggles details when clicking history row body
- [ ] renders copy controls for source and file detail rows
- [ ] renders redesigned details structure including size field
- [ ] toggles select all / unselect all for a date group
- [ ] renders deleted badge and disables open actions for deleted entry
- [ ] collapses and expands filters with persisted state

### `src/js/modules/__tests__/hotkeys.backupTransfer.test.js` (1)
- [ ] routes Ctrl+3 and Meta+3 to the Tools backup entry point

### `src/js/modules/__tests__/i18n.test.js` (2)
- [ ] keeps translations accessible after split
- [ ] t and applyI18n work with merged translation sections

### `src/js/modules/__tests__/modalHandlers.test.js` (1)
- [ ] marks shortcuts modal as overlay-active while open

### `src/js/modules/__tests__/modals.confirmationHtml.test.js` (3)
- [ ] sanitizes HTML when allowHtml=true
- [ ] falls back to text when DOMPurify is missing
- [ ] returns custom confirm, cancel, and close results

### `src/js/modules/__tests__/network.test.js` (3)
- [ ] shows error toast on offline event
- [ ] shows success toast on online event
- [ ] does not require network indicator DOM nodes

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

### `src/js/modules/__tests__/registerTabs.backupTransfer.test.js` (5)
- [ ] registers Download, Tools, and Products tabs
- [ ] redirects legacy backup default tab to Tools entry point
- [ ] ignores the removed Downloader developer preference
- [ ] shows history button only for the Downloader tab callbacks
- [ ] initializes downloader preview modules when Download tab renderer runs

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

### `src/js/modules/__tests__/settings.template.test.js` (6)
- [ ] keeps Backup controls inside Tools and removes separate sidebar tab
- [ ] includes the emerald theme in settings and first-run templates
- [ ] uses compact appearance panel and preserves control ids
- [ ] includes about app tab and version fields in settings template
- [ ] includes auto quality modal toggle in downloader settings
- [ ] builds the standalone notifications lab page

### `src/js/modules/__tests__/settings.test.js` (26)
- [ ] shows badge and marks button disabled when disabled = true
- [ ] hides badge and removes disabled class when disabled = false
- [ ] sets accessibility attrs for wg sidebar badge
- [ ] updates backup status card without requiring a sidebar tab
- [ ] silently ignores unknown module keys
- [ ] shows badge as off when stored flag is true
- [ ] is disabled by default and persists checkbox changes
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
- [ ] syncs checkbox with storage and dispatches tools:visibility
- [ ] defaults to enabled and stores disabled state
- [ ] applies initial states and persists changes for downloader behavior switches
- [ ] renders embedded tools info when downloader settings tab is active
- [ ] collectCurrentConfig does not expose appearance.showNetworkStatus
- [ ] does not export the removed Downloader developer preference
- [ ] applyConfig clears legacy topbarNetworkStatusVisible key
- [ ] ignores legacy Downloader config and removes its storage key

### `src/js/modules/__tests__/settings.toastHtml.test.js` (2)
- [ ] uses showToast allowHtml for font size toasts
- [ ] uses showToast allowHtml for theme toasts

### `src/js/modules/__tests__/settingsModal.test.js` (12)
- [ ] opens and closes mobile sections panel via toggle
- [ ] closes mobile panel and updates active label after tab click
- [ ] restores label from saved lastSettingsTab on init
- [ ] restores about label from saved lastSettingsTab on init
- [ ] openSettings resets mobile panel state and syncs label
- [ ] closeSettings removes modal scroll lock
- [ ] closeSettings suppresses settings trigger tooltip while focus is restored
- [ ] opens first-run modal from settings without reload
- [ ] populates about section details on init
- [ ] copies app info from about section
- [ ] starts update check from about section and closes settings
- [ ] opens whats new from about section via existing version trigger

### `src/js/modules/__tests__/state.test.js` (1)
- [ ] keeps download actions disabled when downloader is unavailable

### `src/js/modules/__tests__/tabSystem.test.js` (4)
- [ ] does not append a tab wrapper into itself when re-rendering an emptied tab
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

### `src/js/modules/__tests__/tools.toolViewState.test.js` (5)
- [ ] resolves remembered tool only when it is available
- [ ] resolves remembered backup tool and falls back when disabled
- [ ] tracks developer unlock state for macOS power tools
- [ ] reads persisted developer unlock state from storage
- [ ] remembers media-inspector as a valid last tool view

### `src/js/modules/__tests__/tools.wingetPackages.test.js` (6)
- [ ] catalog keeps Afterburner stable and moves 7-Zip into system
- [ ] returns renderable categories sorted by localized title
- [ ] validates custom package IDs conservatively
- [ ] parses custom IDs and deduplicates selected package IDs
- [ ] aggregates package status for single and multi-id groups
- [ ] builds install, upgrade, and uninstall scripts with winget version preflight

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

### `src/js/modules/__tests__/toolsView.tools.test.js` (91)
- [ ] opens launcher by default and keeps power tool unavailable on macos
- [ ] renders combined header with breadcrumbs and tools section header
- [ ] uses localized launcher strings in initial markup
- [ ] shows total tools counter for macos
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
- [ ] opens WinGet Installer in preview mode on macos
- [ ] renders WinGet package cards with inline status and collapsible categories
- [ ] persists WinGet category open state
- [ ] automatically checks built-in WinGet statuses when opened on windows
- [ ] uses Russian WinGet mode labels in translations
- [ ] copies generated WinGet script
- [ ] runs WinGet install on windows with selected package IDs
- [ ] runs WinGet uninstall on windows with selected package IDs
- [ ] checks WinGet status and runs update for selected packages
- [ ] renders WinGet live log events for active run
- [ ] keeps File Sorter available when developer mode is enabled
- [ ] supports editable rules, mandatory preview, selection, apply, export, and undo
- [ ] keeps operation selection across filters and invalidates stale previews
- [ ] localizes known sorter reasons and falls back to the original message
- [ ] shows Media Inspector as available tool and opens it
- [ ] auto-analyzes a selected file and renders media report
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
- [ ] shows live preview action only when livePreview is available
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

### `src/js/modules/__tests__/whatsNewModal.test.js` (5)
- [ ] keeps allowed tags
- [ ] removes script tags
- [ ] keeps h1 and table tags for rich markdown
- [ ] strips javascript: href
- [ ] adds and removes modal overlay class when modal opens and closes

### `src/js/scripts/__tests__/download.selectFormats.test.js` (15)
- [ ] falls back by quality label when stored format IDs are unavailable
- [ ] falls back to audio-only when object has stale audio format ID
- [ ] preserves mp3 audio output for explicit audio-only selections
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

<!-- AUTO-JEST-TESTS:END -->
