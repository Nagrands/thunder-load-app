# Thunder Application Guide

This guide describes the current user-facing application.

## Main Sections

### Downloader

- Paste, type, or drop a media URL to load its preview.
- Choose a video, video-only, audio, or MP3 option in the quality picker.
- Add individual links or playlist entries to the persistent queue.
- Run one or two downloads in parallel, cancel active work, and open the output folder or last downloaded file.
- Use the optional clipboard watcher and automatic quality-dialog behavior from Settings.

The downloader uses managed `yt-dlp`, `ffmpeg`, `ffprobe`, and Deno tools. Source support follows the installed `yt-dlp` version; preview-specific features are strongest for YouTube.

### Player

- The media library remains available when empty and never blocks playlist
  navigation or creation.
- Sources include local audio/video, folders, individual YouTube links,
  M3U/M3U8, and compatible HTTP(S)/HLS media.
- User playlists persist. A separate Up Next queue takes priority and is
  cleared on restart.
- The context menu supports playback, queueing, playlist add/reorder, reveal,
  containing-folder open, information, display-title rename, and metadata-only
  removal.
- YouTube import analyzes formats through `yt-dlp` before choosing `Auto`,
  `Best`, `Audio`, or an exact codec/FPS/bitrate/size option.
- The dock remains available on pause and hides without a playback session. It
  includes three repeat modes, transient volume feedback, and accessible
  tooltip/ARIA labels.
- Chromium Media Session supplies system metadata, state, position, and
  Play/Pause/Next/Previous/Seek commands. macOS also has Dock transport items.
- Files opened from Finder/Explorer are imported and started; remaining files
  enter the transient queue.

See the [Player documentation](tab/Player_Tab.en.md) for complete behavior,
architecture, formats, security constraints, and validation.

### Products

The Products section reformats structured product lists. It can:

- normalize headings and item names;
- group entries into sections;
- build summaries and green-product summaries;
- report uncertain or invalid lines;
- compare the formatted output with the source;
- apply corrections back to the input and copy a section or the complete result;
- use an editable local dictionary for recurring normalization rules.

### Tools

The Tools launcher contains:

| Tool             | Purpose                                                                                      | Platform notes                                                 |
| ---------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| WG Unlock        | Apply and inspect WireGuard-related recovery settings                                        | Windows and macOS flows differ                                 |
| Hash Check       | Calculate hashes, compare files, and reuse recent results                                    | Cross-platform                                                 |
| Media Inspector  | Read container, stream, codec, bitrate, HDR, and subtitle data through `ffprobe`             | Requires `ffprobe`                                             |
| Format Converter | Convert one local audio or video file through `ffmpeg`                                       | Requires `ffmpeg`                                              |
| File Sorter      | Editable categories, mandatory preview, selected operations, and one-step undo               | Cross-platform                                                 |
| Backup           | Run reusable source-to-destination archive profiles with filters, logs, and preflight checks | Cross-platform behavior uses platform archive tools            |
| Quick Shortcuts  | Create Windows power, recovery, and system shortcuts                                         | Actions are Windows-only; macOS can expose a developer preview |

Tools and Backup are always available. Backup remains inside this section, not
a top-level tab.

### File Sorter

File Sorter follows a safe `configure → preview → apply` workflow:

- categories and extension lists can be added, renamed, and deleted; each rule
  uses a compact row with separate category, destination folder, and extension
  fields, while the `Other` fallback always remains available;
- the global rule set persists and can be reset to defaults;
- the name-conflict policy uses the application's custom dropdown control;
- every run starts with a complete operation plan whose compact control panel
  combines search, filters, category totals, and localized problem reasons
  above a full-width operation list;
- the header preview button creates the plan, then hides and restores it without
  rescanning; showing the plan scrolls it into view and moves keyboard focus to
  its heading;
- individual operations or all currently filtered selectable rows can be
  included or excluded;
- changing the folder or any sorting option marks the plan stale and requires a
  new preview;
- the most recent completed run can be undone until another run or application
  restart.

## Download History

History is part of Downloader and supports:

- text and source filtering;
- sorting by date, title, size, quality, or source;
- pagination and configurable page size;
- opening the file, folder, or source page;
- retrying a download;
- deleting a record or its local file;
- undo for supported removal actions;
- CSV and JSON export.

## Settings

Settings control:

- interface language and theme;
- font size and visual effects;
- the built-in editor for all 16 shortcuts, including search, conflict
  detection, and restoring defaults;
- managed tools directory and Downloader behavior;
- download quality behavior and parallel limit;
- clipboard/window behavior;
- Downloader tool-status visibility;
- developer-only tool visibility.

### Keyboard Shortcuts

The Shortcuts section in Settings lists every application action, its scope,
and its current key combination. Choose Change on a row and press the new
combination; `Esc` cancels recording. When a combination is already assigned,
Thunder lets you cancel or swap the two actions.

The editor accepts combinations containing `Ctrl`/`Cmd` or `Alt`, plus
`F1`–`F12`. Global shortcuts for reload and websites can be disabled without
affecting in-app shortcuts. Assignments apply immediately, persist across
launches, and are included in configuration exports. Importing an older file
without shortcut data uses the platform defaults.

The interface is localized in Russian and English.

## Data And Runtime Tools

Default Electron data directories:

- macOS: `~/Library/Application Support/Thunder Load`
- Windows: `%APPDATA%/Thunder Load`
- Linux: `~/.config/Thunder Load`

The data folder keeps the historical `Thunder Load` name for compatibility, so
upgrading to Thunder does not move settings or history.

History, settings, cached previews, download queue state, the Player media
library, and tool metadata are stored under the application profile or renderer
storage. Player's transient queue is not persisted. Runtime binaries use the
configured tools directory and can be checked, updated, reinstalled, migrated,
or reset from the tools manager.

## Platform Support

Automated releases provide Windows NSIS and macOS DMG installers for `x64` and `arm64`. Application auto-updates are Windows-only; macOS users install new versions manually from the DMG release assets. These artifacts are currently unsigned. Linux AppImage packaging is available through `npm run build-linux` but is not part of the automated release workflow.

Windows NSIS installs per-machine with elevation. macOS associations use
`Viewer`/`Alternate`, making Thunder available in Open With without taking a
format automatically. System Now Playing/SMTC and associations require packaged
validation on the target operating system.

On Windows, left-clicking the Thunder notification-area icon shows or hides the
main window. Right-clicking opens a compact Windows 11-style panel with Open
Thunder, Last video, Downloads folder, Settings, and Quit actions. The panel
follows the system theme and closes after an action, on blur, or when `Esc` is
pressed. `Up`/`Down`, `Home`/`End`, and `Enter`/`Space` provide complete keyboard
navigation; Thunder falls back to the native menu if the panel cannot load.

Player requires FFmpeg for YouTube and AVI/MPEG fallback. YouTube playlists are
not supported, and YouTube URLs inside M3U/M3U8 are skipped with a warning
because they require interactive quality selection.

On Linux, `ffmpeg` and `ffprobe` may need to be installed through the system package manager. Compatible runtime tools can also be resolved from `PATH`. Individual Tools features may have narrower platform support as listed above.

## Related Documentation

- [Downloader implementation](tab/Downloader_Tab.md)
- [Player guide and architecture](tab/Player_Tab.en.md)
- [Tools platform QA](tab/Tools_Platform_QA.md)
- [Developer workflow](WORKFLOW.en.md)
- [D.O.C.S. methodology](DOCS.en.md)
