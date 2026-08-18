---
name: D.O.C.S task
about: Create a task using the D.O.C.S methodology
title: "[D.O.C.S] "
labels: []
assignees: ""
---

## D — Discover

- Problem:
- Expected user outcome:
- Affected areas (`UI/main/IPC/tools/build/docs`):

## O — Organize

- Implementation steps (2-5):

1.
2.

- Risks/rollback:
- Validation commands:

## C — Check

- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck:player` (if Player/main media code changed)
- [ ] `pnpm test`
- [ ] `pnpm run check`
- [ ] `pnpm run templates:build` (if `templates/*.njk` changed)
- [ ] `pnpm run css:build` (if `src/scss/*.scss` changed)
- [ ] Manual sanity-check completed
- [ ] IPC registry/handler/preload/API verified together (if IPC changed)
- [ ] Packaged target-OS smoke completed (if associations/system integration changed)

## S — Share

- [ ] Update `whats-new.md` and `whats-new.en.md` (if user-facing)
- [ ] Update docs (if process/architecture changed)
- Notes for reviewers/users:
