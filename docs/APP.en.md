# Thunder Load Application Guide

This guide describes the current user-facing application.

## Main Sections

### Downloader

- Paste, type, or drop a media URL to load its preview.
- Choose a video, video-only, audio, or MP3 option in the quality picker.
- Add individual links or playlist entries to the persistent queue.
- Run one or two downloads in parallel, cancel active work, and open the output folder or last downloaded file.
- Use the optional clipboard watcher and automatic quality-dialog behavior from Settings.

The downloader uses managed `yt-dlp`, `ffmpeg`, `ffprobe`, and Deno tools. Source support follows the installed `yt-dlp` version; preview-specific features are strongest for YouTube.

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
| File Sorter      | Editable categories, mandatory preview, selected operations, and one-step undo               | Cross-platform                                                 |
| Backup           | Run reusable source-to-destination archive profiles with filters, logs, and preflight checks | Cross-platform behavior uses platform archive tools            |
| Quick Shortcuts  | Create Windows power, recovery, and system shortcuts                                         | Actions are Windows-only; macOS can expose a developer preview |
| WinGet Installer | Build, run, and inspect WinGet package operations                                            | Execution is Windows-only; macOS displays a preview            |

Some tools can be hidden in Settings. Backup remains a tool inside this section, not a top-level tab.

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
- default section and enabled modules;
- managed tools directory and Downloader behavior;
- download quality behavior and parallel limit;
- clipboard/window behavior;
- Downloader tool-status visibility;
- Backup list and log presentation;
- developer-only tool visibility.

The interface is localized in Russian and English.

## Data And Runtime Tools

Default Electron data directories:

- macOS: `~/Library/Application Support/Thunder Load`
- Windows: `%APPDATA%/Thunder Load`
- Linux: `~/.config/Thunder Load`

History, settings, cached previews, queue state, and tool metadata are stored under the application profile or renderer storage. Runtime binaries use the configured tools directory and can be checked, updated, reinstalled, migrated, or reset from the tools manager.

## Platform Support

Automated releases provide Windows NSIS and macOS DMG/ZIP targets for `x64` and `arm64`. These artifacts are currently unsigned. Linux AppImage packaging is available through `npm run build-linux` but is not part of the automated release workflow.

On Linux, `ffmpeg` and `ffprobe` may need to be installed through the system package manager. Compatible runtime tools can also be resolved from `PATH`. Individual Tools features may have narrower platform support as listed above.

## Related Documentation

- [Downloader implementation](tab/Downloader_Tab.md)
- [Tools platform QA](tab/Tools_Platform_QA.md)
- [Developer workflow](WORKFLOW.en.md)
- [D.O.C.S. methodology](DOCS.en.md)
