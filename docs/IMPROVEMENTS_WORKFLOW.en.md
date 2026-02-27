# Thunder Load Improvements Workflow

This document describes a consistent, safe, and repeatable flow for project improvements.

Baseline execution standard for every task: `docs/DOCS.en.md` (`Discover → Organize → Check → Share`).

## 1. Define the Improvement

- Describe the problem/goal in 1–2 sentences.
- State the expected outcome (UX/functional change).
- Identify the affected area (UI, main process, IPC, tooling, build).

## 2. Quick Diagnosis

- Locate the relevant logic (see `docs/WORKFLOW.en.md`).
- Find affected modules in `src/js/**` and templates in `templates/**`.
- If UI is affected, remember `templates/` → `src/index.html` and run `npm run templates:build`.

## 3. Plan the Changes

- Split work into 2–5 steps.
- Separate safe changes from potentially risky ones.
- If user data is involved, consider migration/rollback.

## 4. Implementation

- Make small, coherent changes.
- Keep the security model intact (IPC whitelist, contextIsolation, sandbox).
- Avoid CDN dependencies at runtime.

## 5. Tests and Checks

- `npm run lint` — strict lint (no warnings).
- `npm test` — unit tests.
- For UI changes, run quick manual checks of key scenarios.
- Avoid noisy `console.log` in tests (use a global mock).

## 6. Documentation

- Update `docs/WORKFLOW.en.md` if the process changes.
- Update root `whats-new.md` for user-facing changes (it is the source of truth).

## 7. Commits

- Split into meaningful commits (lint/refactor separate from features).
- Commit messages: short `type: summary`.

## 8. Review Order

1. Automated checks: `npm run lint`, `npm test`.
2. Diff review: security, regressions, UX impact.
3. Manual UI check (key flows + accessibility).
4. Docs and `whatsNew.md` if user-facing changes were made.
5. Only then approve/merge.

## 9. Final Verification

- Review the diff for regressions.
- Ensure `npm run lint` and `npm test` pass.

## 10. Next Steps (Optional)

- Create a release note.
- Plan the next improvement.

## Improvements Backlog

1. Add CSP without inline scripts to harden UI security.
2. Replace dynamic HTML injections with safe templates/sanitizer where `insertAdjacentHTML` is used.
3. Add a unified renderer logging helper (levels, disabled in prod).
4. Improve update UX: show changelog from `whatsNew.md` in the update modal.
5. Move supported platforms/hosts list into a config for easier expansion.
6. Add IPC smoke tests for key channels.
7. Auto‑verify `whatsNew.md` version during `npm run check`.
8. Add an e2e smoke test (launch Electron, verify main window).
9. Offline graceful degradation: visible “no network” banner.
10. Refactor `history.js` into sub‑modules (render, pagination, filters).
11. Stable download log schema with migrations.
12. Configurable queue limits and parallel downloads.
13. Mini diagnostics (CPU/RAM/disk) in Help/About.
14. Auto‑build “What’s New” from `whats-new.md` for releases (`npm run whats-new:build`).
15. Optional UI localization (RU/EN) via dictionaries.
