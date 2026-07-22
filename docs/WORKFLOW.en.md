# Thunder Workflow

Short reference for where things live and what to do during development and releases.

## What This Project Is

Thunder is an Electron app for downloading and playing video/audio and managing
related tools (yt-dlp, ffmpeg, Deno).

## D.O.C.S. Delivery Method

- All tasks follow `D.O.C.S.`: `Discover → Organize → Check → Share`.
- Full guidance: `docs/DOCS.en.md`.
- Any user-facing change must update both `whats-new.md` and `whats-new.en.md`.

## Main Folders

- `src/` — app sources (main/renderer, styles, templates).
- `templates/` — Nunjucks templates that generate `src/index.html`.
- `assets/` — icons, images, resources.
- `docs/` — documentation.
- `scripts/` — build helpers.

## Where to Edit UI

- HTML is generated from `templates/` → output is `src/index.html`.
- Before running/building, execute `npm run templates:build` or changes won't land in `src/index.html`.

## Where to Edit Logic

- Main process: `src/js/app/`.
- Renderer:
  - entrypoint: `src/js/renderer.js` (init only);
  - UI logic: `src/js/modules/`;
  - orchestration/bootstrap: `src/js/modules/app/`;
  - feature modules: `src/js/modules/features/` (for example, `history`, `settings`);
  - compatibility facades for old imports: `src/js/modules/history.js`, `src/js/modules/settings.js`;
  - shared modules: `src/js/modules/shared/` and legacy modules under `src/js/modules/`.
- IPC and preload: `src/js/app/ipcHandlers.js`, `src/js/ipc/channels.js`, `src/js/preload.js`.

### Where Player Lives

- Renderer: `src/js/modules/nowPlaying/` — media-library model, providers,
  playback controller, queue, Media Session, context menu, and UI.
- Main: `src/js/app/nowPlaying*.js` — state v3, import, YouTube, and HLS;
  `src/js/app/mediaOpenService.js` handles files opened by the OS.
- Player IPC follows `channels.js` → `ipcHandlers.js` and
  `nowPlayingIpcHandlers.js` → the whitelist/API in `preload.js`.
- See `docs/tab/Player_Tab.en.md` and
  `docs/tab/Player_Platform_QA.md` for the complete map and packaged QA.

### Windows Tray Panel

- `src/js/app/windowsTrayMenu.js` owns the separate frameless `BrowserWindow`,
  positioning, singleton lifecycle, and native fallback.
- `templates/pages/windows-tray-menu.njk`,
  `src/scss/components/_windows-tray-menu.scss`, and
  `src/js/modules/windowsTrayMenu.js` own markup, styling, and UI behavior.
- IPC uses `windowsTrayMenuIpcHandlers.js`, centralized channels, and a minimal
  sandboxed preload. Renderer code never receives real filesystem paths.

## Quick Dev Start

1. `npm install`
2. `npm start`

## Templates

- One-time: `npm run templates:build`
- Watch mode: `npm run templates:watch`

## Styles

- One-time: `npm run css:build`
- Watch mode: `npm run css:watch`

## Tests and Checks

- `npm test` — unit tests (Jest).
- `npm run lint` — ESLint.
- `npm run typecheck:player` — JavaScript typecheck for Player/main media code.
- `npm run check` — lint + Player typecheck + Jest.
- `console.log` is suppressed in tests via `src/js/tests/setupTests.js`.

## Build

- `npm run build` — build for the current platform.
- `npm run build-mac` / `npm run build-linux` — platform builds.
- File-association or system-integration changes require packaged smoke on the
  target OS using `docs/tab/Player_Platform_QA.md`.
- Tray-panel changes require packaged Windows smoke for both system themes,
  DPI, taskbar placement, multiple monitors, blur/Escape, and keyboard control.

## What’s New (WhatsNew)

- Source of truth is root `whats-new.md`.
- The app reads `whats-new.md` (and `whats-new.en.md`) directly from the project root.
- `npm run whats-new:build` now generates only release notes in `build/`.
- Version in Markdown must match `package.json`.
- The “What’s New” modal is shown automatically after a version update.
- You can open it manually by clicking the version in the UI.
- After showing, the version is marked as seen.

## Important Notes

- `contextIsolation` and `sandbox` are enabled — keep the security model intact.
- Avoid external CDN dependencies at runtime (security risk in Electron).

## Improvements Workflow

Use the sequence in `docs/IMPROVEMENTS_WORKFLOW.en.md`.
