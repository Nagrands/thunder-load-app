---
tags: [player, media-library, youtube, hls, electron]
alias: Player tab
---

# Player Tab

This document covers Player user flows, architecture, persisted data, IPC, and
operating-system integration. It describes the application after the media
library state migration to version 3.

## Capabilities

- local audio and video files;
- folders containing supported media;
- individual YouTube videos with quality selection;
- HTTP(S) media and HLS imported from M3U/M3U8;
- persistent user playlists and a separate transient queue;
- background and fullscreen playback;
- system media keys and system metadata;
- Finder/Explorer open-file handling and file associations.

## Media Library

The media library remains fully usable when it contains no files. Its empty
state is part of the content area and never blocks navigation, playlist CRUD,
or import controls.

Users can add files, folders, a YouTube link, or a new playlist from the empty
state. A media row contains artwork, display title and artist, duration, size,
availability, and a context-menu button. Rename changes only `displayTitle`;
remove never renames or deletes the physical file.

The context menu opens with the row button, right click, `ContextMenu`, or
`Shift+F10`. Arrow keys, `Home`, `End`, `Escape`, and focus restoration are
supported. Available actions include playback, transient queue, user playlist,
playlist reordering, Finder/Explorer reveal, containing-folder open,
information, display-title rename, and library/playlist removal. File actions
are hidden for YouTube and network items and disabled for missing local files.

## Playlists and Transient Queue

User playlists persist with the library and support create, rename, delete, and
track ordering. The system Media Library playlist represents the whole catalog
and cannot be deleted.

The Up Next queue is memory-only. Manually queued items take priority over the
active playlist, can be viewed, reordered, removed, or cleared, and are never
written to state v3. When Finder or Explorer opens multiple files, the first is
started and the remaining files enter this transient queue.

### Player Dialogs

Playlist creation and rename, YouTube URL entry, quality selection, add to
playlist, display-title rename, and track information use the shared Thunder
modal shell. Dialogs close through `Escape`, backdrop click, the close button,
or Cancel, trap focus while open, and restore focus to the invoking control.

The YouTube dialog remains open between URL analysis and quality selection. It
shows a busy state during analysis and reports errors inline without losing the
entered URL. Playlist and media-entry removal continue to use the shared
confirmation modal.

## Playback Controls

The dock and Now Playing label are visible during loading, playback, and pause.
They hide after Stop, the end of the queue, or when no track exists. The hide
transition uses opacity, transform, and max-height; the dock becomes `inert`
after the transition. Reduced-motion preferences disable these transitions.

Repeat cycles through Off → Repeat One → Repeat Playlist → Off. Repeat One has
a visible `1` marker. Volume percentage appears during input, wheel changes,
mute, hover, or focus and fades after 1500 ms while the slider remains visible.
Dock, mini-player, and row buttons use the shared tooltip initializer, including
dynamic Play/Pause/Repeat labels and matching ARIA text.

The media-library mini-player uses three zones: artwork and metadata, transport
controls with a timeline, and volume plus a compact open-full-player action.
The former text-based Now Playing button is replaced by a tooltip-enabled icon.
At narrow widths the album and volume slider hide first, then the timeline moves
to a second row; Previous, Play/Pause, Next, and open-full-player remain
available.

## YouTube Quality Selection

YouTube import is a two-step flow. The main process first gets full metadata and
formats through `yt-dlp`; the user then chooses `Auto`, `Best`, `Audio`, or an
exact format. Available resolution, FPS, container, video/audio codecs,
bitrate, and approximate size are shown when present.

An exact selection stores stable `format_id` values or a video/audio pair,
never an expiring media URL. If the selected format disappears, Player returns
`YOUTUBE_QUALITY_UNAVAILABLE` instead of silently falling back to Auto.

Every YouTube option is delivered through the local HLS pipeline. Metadata is
cached for five minutes with 32 LRU entries; playback selections use a
90-second/32-entry cache. Keys include the canonical URL and quality selector,
and parallel resolves of the same selection are deduplicated.

## Local HLS and FFmpeg

`src/js/app/nowPlayingHlsService.js` owns protected playback sessions:

- it listens only on a random `127.0.0.1` port;
- routes contain a cryptographically random token and session UUID;
- only main-process-resolved URLs or a prevalidated local path are accepted;
- only the session manifest and segments can be requested;
- H.264/AAC can use stream copy; other codecs are transcoded;
- transcoding tries `-hwaccel auto` and falls back to CPU;
- processes stop on layer release, session close, and application exit;
- cleanup enforces a 30-minute TTL, eight sessions, and a 2 GiB cache limit.

HLS playback uses the packaged `hls.js` dependency. Chromium-compatible local
files use direct playback. AVI, MPEG, and MPG are routed through FFmpeg/HLS
because Chromium container and codec support is not reliable for them.

## Formats and M3U

Declared formats:

- audio: `mp3`, `m4a`, `aac`, `flac`, `wav`, `ogg`, `opus`;
- video: `mp4`, `mkv`, `webm`, `mov`, `avi`, `mpeg`, `mpg`;
- playlists: `m3u`, `m3u8`.

Import also accepts compatible `oga`, `weba`, and `m4v` aliases. System file
associations expose the user-facing set declared in `package.json`.

M3U/M3U8 import reads UTF-8 with optional BOM, ignores comments and nested
playlists, resolves relative paths from the playlist directory, accepts
supported HTTP(S) media and remote HLS, removes duplicates, and enforces a
1 MiB/1000-entry limit. YouTube URLs are skipped with a warning because they
require interactive quality selection.

## State v3

Persisted state contains the catalog, user playlists, active playlist, selected
track, volume, mute, shuffle, repeat, and background-playback preferences.

A v3 track contains `id`, `providerId`, `sourceRef`, `title`, `displayTitle`,
`artist`, `album`, `duration`, `sizeBytes`, `kind`, `mimeType`, `artworkUrl`,
`availability`, and `qualitySelection`. Providers are `local`, `youtube`, and
`network`. v1/v2 state is deterministically normalized to v3. Transient queue
items, HLS tokens/session IDs, and expiring URLs are never persisted.

`GET_STATE` refreshes local availability. `SET_STATE` validates and writes
state without running `fs.stat` across the catalog. Writes use a 250 ms trailing
debounce, single-flight serialization, and flush on hide/dispose.

Safety limits are 5000 tracks, 500 user playlists, and a 2 MiB persisted-state
IPC payload.

## Renderer Architecture

- `nowPlayingView.js`: orchestration and public lifecycle;
- `mediaLibraryModel.js`: v3 catalog and playlists;
- `mediaLibraryView.js`: library, empty state, and mini-player;
- `playerDialog.js`: shared Player dialog modes and lifecycle;
- `playbackController.js`: two media layers and transport state;
- local, YouTube, and network providers: source-specific resolution;
- `providerRegistry.js`: unified resolution and release lifecycle;
- `transientQueue.js`: non-persistent Up Next queue;
- `playerContextMenu.js`: accessible context menu;
- `mediaSessionManager.js`: Chromium Media Session;
- playback controls and playlist renderer: targeted UI updates;
- fullscreen and visual-transition controllers: scene lifecycle.

`renderer.js` remains initialization-only. `registerTabs.js` lazily creates one
Player instance and keeps it mounted while tabs change.

## Main Process and IPC

Main-process responsibilities are split across:

- `nowPlayingState.js`: v3 schema and migration;
- `nowPlayingLibrary.js`: import, metadata, M3U, availability;
- `nowPlayingYouTube.js`: quality DTOs, selection, and resolve;
- `nowPlayingHlsService.js`: FFmpeg/HLS lifecycle;
- `nowPlayingTimelinePreviewService.js`: cancellable frame extraction and LRU;
- `nowPlayingIpcHandlers.js`: validation and structured results;
- `mediaOpenService.js`: startup argv, Windows second instance, macOS open-file;
- `window.js`: macOS Dock Menu snapshot and transport commands.

Channels are declared in `src/js/ipc/channels.js`, registered through
`src/js/app/ipcHandlers.js`, and explicitly allowed by `src/js/preload.js`.
Renderer code does not call `ipcRenderer` directly.

| Direction               | Channels                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer → main, invoke | `now-playing:import-files`, `now-playing:import-folder`, `now-playing:import-paths`, `now-playing:analyze-youtube-video`, `now-playing:import-youtube-video`, `now-playing:resolve-youtube-track`, `now-playing:create-local-playback-session`, `now-playing:close-playback-session`, `now-playing:get-timeline-preview`, `now-playing:get-state`, `now-playing:set-state`, `now-playing:reveal-track`, `now-playing:open-track-location` |
| Renderer → main, send   | `now-playing:cancel-timeline-preview`, `now-playing:open-files-ready`, `now-playing:media-state`                                                                                                                                                                                                                                                                                                      |
| Main → renderer         | `now-playing:open-files`, `now-playing:media-command`                                                                                                                                                                                                                                                                                                                                                 |

Operations return `{ success, data, error: { code, message } }`.

## Premium interface and timeline previews

Video uses `contain`, preserving the complete frame against a black surface
with a subtle vignette. The sidebar, top toolbar, and bottom dock are separate
glass panels that auto-hide during playback while respecting pin, low-effects,
and `prefers-reduced-motion`.

The current-media card shows resolution, video/audio codecs, and size when
available. The values live in optional `TrackV3.mediaInfo`; the existing local
import probe supplies local metadata and selected YouTube formats supply remote
metadata. The persisted state remains version 3.

The Information window uses a dedicated presentation card inside the shared
Player modal. It shows artwork or an available transient timeline poster,
title, artist/album, badges, and known technical details without exposing the
full local path or URL. Unknown values are omitted, with a Lucide fallback for
audio and missing artwork. Information mode keeps one Close button; other
shared-form modes restore their regular fields and footer.

Timeline hover invokes `now-playing:get-timeline-preview`. The main process
validates the track/session, buckets time to two seconds, and extracts a
320×180 JPEG in a separate FFmpeg process. Only one extraction runs at once;
stale requests are cancelled through
`now-playing:cancel-timeline-preview`, and results use a bounded LRU cache.
Preview generation never seeks the active media element or creates a second
playback session.

The sidebar supports double-click playback and drag-and-drop reordering of the
active list. User-playlist or system-library order is persisted without
changing the separate transient Up Next queue.

## Performance and Lifecycle

- a single lazy-created Player instance;
- two reusable media layers for `A → B → A` reuse;
- `forceRefresh` invalidates reuse;
- position updates are limited to roughly 8 Hz;
- time text changes only on whole seconds;
- only previous/current/loading rows update on a tick;
- queue snapshots are stable and the full catalog is not scanned per tick;
- media listeners are retained and removed on dispose;
- HLS sessions are released with their media layer.

## Operating-System Integration

Chromium Media Session is the single source for macOS Now Playing Center,
Windows SMTC, and media keys. Metadata includes title, artist, album, artwork,
duration, position, and state. Play, Pause, Next, Previous, Stop, and Seek are
supported.

Media Session position is published at most once per second except for track,
state, and explicit seek changes. Electron hardware acceleration remains enabled
by default; no experimental Chromium GPU flags are added.

The macOS Dock Menu exposes the current track plus Play/Pause, Previous, and
Next. The Windows AUMID matches `build.appId`: `com.thunderload.app`.

File associations live in `package.json`. macOS uses `Viewer` and `Alternate`,
so Thunder appears in Open With without taking formats automatically. Windows
NSIS uses `perMachine: true`, requires elevation, and registers Thunder as an
available default application.

## Validation

Run:

```bash
npm run css:build
npm run whats-new:build
npm run lint
npm run typecheck:player
npm test
npm run check
```

Run `npm run templates:build` only when Nunjucks changes. Packaged QA must also
be performed on target systems: macOS x64/arm64 for Now Playing Center, Dock
Menu, media keys, background playback, and Open With; Windows for SMTC, media
keys, metadata, per-machine NSIS, associations, and cold/warm open-file flows.
Automated tests do not replace real installer and system-panel validation.
