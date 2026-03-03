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

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run templates:build` (if `templates/*.njk` changed)
- [ ] `npm run css:build` (if `src/scss/*.scss` changed)
- [ ] Manual sanity-check completed

## S — Share

- [ ] Update `whats-new.md` and `whats-new.en.md` (if user-facing)
- [ ] Update docs (if process/architecture changed)
- Notes for reviewers/users:
