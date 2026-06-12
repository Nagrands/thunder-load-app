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
- Update both root `whats-new.md` and `whats-new.en.md` for user-facing changes.
- Run `npm run whats-new:build` to validate the version and regenerate release notes.

## 7. Commits

- Split into meaningful commits (lint/refactor separate from features).
- Use Conventional Commits: `type(scope): summary`.

## 8. Review Order

1. Automated checks: `npm run lint`, `npm test`.
2. Diff review: security, regressions, UX impact.
3. Manual UI check (key flows + accessibility).
4. Docs and both `whats-new*.md` files if user-facing changes were made.
5. Only then approve/merge.

## 9. Final Verification

- Review the diff for regressions.
- Ensure `npm run lint` and `npm test` pass.

## 10. Next Steps (Optional)

- Create a release note.
- Plan the next improvement.
