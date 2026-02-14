# Thunder Load Workflow

Short reference for where things live and what to do during development and releases.

## What This Project Is

Thunder Load is an Electron app for downloading video/audio and managing related tools
(yt-dlp, ffmpeg, Deno).

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
  - entrypoint: `src/js/renderer.js`;
  - orchestration/bootstrap: `src/js/modules/app/`;
  - feature modules: `src/js/modules/features/` (for example, `history`, `settings`);
  - compatibility facades for old imports: `src/js/modules/history.js`, `src/js/modules/settings.js`;
  - shared modules: `src/js/modules/shared/` and legacy modules under `src/js/modules/`.
- IPC and preload: `src/js/preload.js`, `src/js/ipc/`.

## Quick Dev Start

1. `npm install`
2. `npm start`

## Templates

- One-time: `npm run templates:build`
- Watch mode: `npm run templates:watch`

## Tests and Checks

- `npm test` — unit tests (Jest).
- `npm run lint` — ESLint.
- `npm run check` — lint + tests.
- `console.log` is suppressed in tests via `src/js/__tests__/setupTests.js`.

## Build

- `npm run build` — build for the current platform.
- `npm run build-mac` / `npm run build-linux` — platform builds.

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
