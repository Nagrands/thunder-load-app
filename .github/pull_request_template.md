## Summary

What changed and why.

## D.O.C.S. Checklist

### D — Discover

- [ ] Problem and expected user outcome are clearly described.
- [ ] Affected areas are listed (`UI`, `main`, `IPC`, `tools`, `build`, `docs`).

### O — Organize

- [ ] Implementation steps are defined.
- [ ] Risks and rollback notes are captured.
- [ ] Validation commands are selected.

### C — Check

- [ ] `npm run lint`
- [ ] `npm run typecheck:player` (if Player/main media code changed)
- [ ] `npm test`
- [ ] `npm run check`
- [ ] `npm run templates:build` (if `templates/*.njk` changed)
- [ ] `npm run css:build` (if `src/scss/*.scss` changed)
- [ ] Manual sanity check completed for key user flow
- [ ] IPC registry/handler/preload/API checked together (if IPC changed)
- [ ] Packaged target-OS smoke completed (if associations/system integration changed)

### S — Share

- [ ] `whats-new.md` and `whats-new.en.md` updated (if user-facing behavior changed)
- [ ] Process/docs updated when rules or architecture changed
- [ ] PR description includes verification results and known limitations

## Verification Notes

List commands run and short results.
