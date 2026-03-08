<!-- version: 1.4.0 -->

# What's New

---

| What changed | What you get |
|---|---|
| Fixed toast formatting in Settings | Notification text now renders correctly without visible HTML tags |
| Moved the “More” block in Tools to a separate section | Additional actions and settings are now visible immediately |
| Removed the migration option from old tools location | Tools management UI is now simpler and clearer |
| Fixed yt-dlp version display on macOS | The Tools section now shows the installed yt-dlp version again |
| Improved File Sorter in the Tools section | You can now preview sorting first, see file categories, and only then apply the changes |
| Expanded File Sorter settings | You can choose how name conflicts are handled, include subfolders, and exclude specific files or folders |
| Improved File Sorter result review | Preview and results now include search, category/status filters, and export to a file |
| Expanded File Sorter export options | You can copy the filtered list to the clipboard or save it as TXT, CSV, or JSON |
| Improved the “Skipped” list in File Sorter | You can now see which exact files were skipped and why: hidden file, ignored extension, ignored folder, or already inside a category folder |
| Refreshed the File Sorter interface | Workspace, settings, and results are now visually separated, making the tool easier to scan on both large and small screens |
| Refreshed the first-run setup | First launch is now step-by-step, so it is easier to choose the language, active sections, and theme before applying everything |
| File Sorter was reworked internally | The tool is now better structured for future improvements and more stable iteration |
| Unified tooltip behavior across the app | Tooltips now behave consistently in all sections |
| Fixed tooltips in Download History | Main actions and controls in history entries now show tooltips reliably again |
| Fixed delete confirmation overlap in History | Tooltips no longer appear above the delete confirmation dialog |
| Improved “Retry download” in History | The app now smoothly scrolls to the URL field and focuses it after retry |
| Improved handling of YouTube download failures | The app now explains temporary network issues more clearly and automatically retries some failed requests |
| Improved downloader stability | Temporary network failures during downloads are now handled more gracefully, and download history no longer depends on an extra metadata request |
| Improved download error messages | It is now clearer whether a video needs authorization, is unavailable, or is blocked in your region |
| Improved preview and quality selection | Before starting a download, the app now explains more clearly if a video needs authorization, is unavailable, or is temporarily not responding |
| Download error messages are now more consistent | Notifications from different parts of the downloader now describe the same problem in a more uniform way |
| Improved downloader localization | Messages for opening folders, opening the last file, and changing the downloads folder now better match the selected language |
| More reliable error diagnostics | Temporary YouTube limits and network failures are now recognized more consistently across download flows |
| Dependency hints are clearer | If yt-dlp or ffmpeg is missing, the app now more reliably explains what needs to be installed before downloading |
| Downloader tools status is more consistent | Status and fallback messages in the dependency panel now behave more predictably |
| Tools screen is more polished | Launcher labels now follow the selected language more reliably, and the File Sorter how-to modal behaves more consistently |
| Tools UI is more consistent | Card labels, helper modals, and in-screen hints now mix languages less often when the Tools screen opens |
| Downloader UI is more consistent | The Downloader header and dependency status panel now show fewer English fallback labels before the chosen language is applied |
| Backup UI is more consistent | The Backup header, controls, and profile management modal now follow the selected language more reliably from the first render |
| Tools settings are more consistent | The Tools tab disable toggle and Backup hints now follow the selected language more reliably |
| System UI is more consistent | The update flyover and auto-close notification now follow the selected language more reliably without older fallback labels |
| Future translation updates will be easier to maintain | The internal localization dictionary is now organized more cleanly, which should make future text and translation fixes more reliable |
| The active download is easier to track | The top of the Downloader tab now shows the current job, its stage, and progress without needing to inspect the queue list |
| Download queue state handling is more reliable internally | Active, pending, completed, and failed jobs now move between states more consistently behind the scenes |
| Queue errors are easier to understand | Failed downloads now show the likely reason and whether the job can be retried automatically |
| Download history now explains failures better | Failed attempts can now appear in history with the likely reason and whether manual action is needed before retrying |
| Downloader error detection is more precise | The app now better distinguishes restricted access, bot verification, disk space issues, and folder permission errors |
| Failure reasons are detected earlier | Access, disk space, private video, and bot-check issues are now recognized more accurately at the download stage itself |
| Download failures are passed through more reliably | Internal handoff between the downloader and the UI now keeps the failure code and type more accurately instead of relying on message text alone |
