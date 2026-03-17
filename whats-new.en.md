<!-- version: 1.4.1 -->

# What's New

---

| What changed | What you get |
|---|---|
| Improved the Media Inspector interface | Empty, loading, and error states are more compact, better balanced, and handle long file names more cleanly |
| Fixed Media Inspector startup without a local ffprobe | When the bundled `ffprobe` is missing, the tool now tries to install the dependency automatically and also uses a system binary when available |
| Added Media Inspector | You can quickly inspect a local media file by tracks, codecs, and basic warnings before sharing or reviewing it |
| Improved Power Shortcuts | Shortcut actions are grouped by task, each card shows a clearer state, and the last successful creation stays visible |
| Simplified Backup settings | Settings no longer expose a separate disable toggle for Backup and keep only its display options |
| Improved startup responsiveness | The main screen reaches ready state faster while non-critical modules initialize later |
| Simplified Settings and Tools | Large modules are split into smaller internal parts, so reopening screens and switching views is more stable |
| Moved Backup into Tools | Backups are now presented as a tool inside Tools instead of a separate tab |
| Fixed the post-download file-open prompt setting | The file-open prompt shown after a download now correctly follows this toggle |
| Fixed formatting in the post-download dialog | The completion dialog no longer shows raw HTML tags and renders as a normal formatted message |
| Updated development rules | Clearer architecture, build, UI, and IPC guidance for stable changes |
| Updated documentation | Consistent, up-to-date development and scripts guidance |
| Fixed first-run step counter | The label no longer shows `{current}` and `{total}` placeholders |
| Improved download cancel button | The X icon is now centered |
| Redesigned the Settings screen | Sections are easier to scan, module states are clearer, and the layout works better in narrow windows |
