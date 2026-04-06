<!-- version: 1.4.4 -->

# What's New

---

| What changed | What you get |
|---|---|
| The Downloader tools block in Settings now uses a glassy redesign | The embedded dependency card now matches the refreshed visual language, showing readiness, `yt-dlp`/`ffmpeg`/`Deno` versions, the tools folder path, and a compact overflow menu for extra actions |
| Added background and live preview for YouTube links in Downloader | Pasting a YouTube URL still enables the muted decorative background preview, and now an explicit button can open a separate modal player with sound; when the preview source is refreshed, the player tries to continue the same video from roughly the same position |
| Downloader tools status moved into the footer top-state | The `yt-dlp`, `ffmpeg`, and `Deno` block now lives next to the current section label in the lower bar, appears only near the top of the page, and still respects the existing Settings toggle |
| The global progress bar moved into the Downloader tab button | Download progress now stays attached to navigation and remains visible in both the header and the footer without a separate top strip |
| Redesigned the main page and settings backgrounds | Downloader, Tools, Backup, and Settings now use distinct atmospheric background modes that still follow the active app theme while separating screens more clearly |
| Fixed the window expand toggles on Windows | The options that react to copied URLs and completed downloads now maximize an already open or minimized window correctly without pulling it back from a tray-hidden state |
| Fixed the lingering tooltip after closing Settings | The footer settings button no longer leaves a visible tooltip behind after the modal is opened and closed |
| Fixed the network-timeout wording for previews and downloads | Timeouts from non-YouTube sources now show a neutral source-related message instead of incorrectly mentioning YouTube |
| The History button moved from the header into the footer | Download history now sits next to Settings in the lower bar, appears only on the Downloader tab, and no longer clutters the top quick actions area |
| Settings and theme switcher were removed from the top bar | The upper chrome is cleaner and keeps only quick actions, while settings and back-to-top stay in the footer |
| Section navigation now migrates from the header into the footer | Tabs stay in the header near the top of the page, then move into the lower bar while scrolling down together with a quick back-to-top action |
| The app update UI was cleaned up and improved | Updates now use a single flyover flow near the app version, show checking and up-to-date states, keep a compact “ready to restart” badge, and distinguish network, download, and install errors |
| Added the new Emerald color theme | The app now includes another calm dark option with emerald and teal accents, available in both Settings and the first-run flow |
| Developer mode now persists and controls more UI | It no longer resets after restart or language changes, can disable the Downloader tab, and hides extra quick actions in the top bar while active |
