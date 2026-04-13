<!-- version: 1.4.4 -->

# What's New

---

| What changed | What you get |
|---|---|
| Fixed scroll getting stuck after closing modals and overlays | Scroll locking is now handled by a single internal manager, so closing dialogs, how-to overlays, or leaving the Tools tab restores page scrolling reliably without a refresh |
| The app background is now lighter and more minimal | The main backdrop is cleaner and less distracting, still follows the active theme accent, and now differs between screens only in subtle ways |
| Fixed YouTube background preview in Downloader | When `yt-dlp` returns a playable Googlevideo URL without an explicit container field, the app now infers the format and restores the muted background video preview behind the Downloader interface |
| Added background and live preview for YouTube links in Downloader | Pasting a YouTube URL still enables the muted decorative background preview, and now an explicit button can open a separate modal player with sound; when the preview source is refreshed, the player tries to continue the same video from roughly the same position |
| Downloader tools status moved into the footer top-state | The `yt-dlp`, `ffmpeg`, and `Deno` block now lives next to the current section label in the lower bar, appears only near the top of the page, and still respects the existing Settings toggle |
| Section navigation now migrates from the header into the footer | Tabs stay in the header near the top of the page, then move into the lower bar while scrolling down together with a quick back-to-top action |
| Footer stays available in developer mode | The bottom bar now remains usable even when developer mode is enabled, so quick actions and section status stay on screen |
| Tab content no longer slides under the footer | Top-level screens now reserve space for the bottom bar, so work areas and lower controls stay visible above the fixed footer |
| Windows system quick shortcuts were updated in Tools | Instead of Device Manager and Network Settings, the panel now creates shortcuts for `appwiz.cpl` (Programs and Features) and `cleanmgr` (Disk Cleanup) |
| The quick shortcuts panel in Tools is now more compact | The always-visible summary block was removed, the section header uses less space, and the latest-action status appears only after an operation runs |
| Hash Check now has a compact redesign and fixed Drag and Drop on Windows | File selection and verification settings take less space, there is a quick reset action, and dropped Windows paths plus `file://` URIs are parsed correctly again |
| File Sorter now uses a simpler layout, and the Russian locale labels it as «Сортировщик» | Preview, sorting parameters, workspace controls, and tool settings are grouped into a more compact flow, so the working path is easier to scan and operate |
