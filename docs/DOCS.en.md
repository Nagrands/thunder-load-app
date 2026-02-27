# D.O.C.S. Methodology for Thunder Load

A single delivery loop so every change follows the same path from request to release notes.

## Acronym

- `D — Discover`: understand the problem, goal, and user value.
- `O — Organize`: define scope, rollout steps, and validation plan.
- `C — Check`: confirm quality, security, and regression safety.
- `S — Share`: communicate outcomes to the team and users.

## D — Discover

Actions:

- Describe the problem in 1-2 sentences.
- Define the expected user-facing outcome.
- Mark affected areas: `UI`, `main`, `IPC`, `tools`, `build`, `docs`.

Required artifact:

- A short task statement (issue note, PR context, or working note).

Done criteria:

- The user value and exact change surface are clear.

## O — Organize

Actions:

- Split implementation into 2-5 concrete steps.
- Identify risks and rollback/recovery options.
- Lock the required validation commands.

Minimum validation plan:

- Logic changes: `npm run lint` and `npm test`.
- `templates/*.njk` changes: `npm run templates:build` and related tests.
- `src/scss/*.scss` changes: `npm run css:build`.
- User-facing behavior changes: update `whats-new.md` and `whats-new.en.md`, then run `npm run whats-new:build`.

Required artifact:

- Explicit execution plan with validation commands before implementation.

Done criteria:

- There is a concrete rollout plan and a clear verification command list.

## C — Check

Actions:

- Run all commands from the plan.
- Perform a manual sanity check of the primary user flow.
- Review diff for security and regression risks (IPC, sandbox, contextIsolation).

Required artifact:

- Verification summary (in PR or working note): commands + results.

Done criteria:

- Required checks are green and no critical findings remain.

## S — Share

Actions:

- Update user notes (`whats-new*.md`) for user-visible behavior changes.
- Update process/architecture docs when development rules change.
- In PR, state what changed, how it was validated, and known limits.

Required artifact:

- Updated `whats-new*.md` (when needed) and/or relevant `docs/*` files.

Done criteria:

- Another team member can understand impact without reading the whole diff.

## D.O.C.S. Definition of Done

A task is complete only when:

1. All `D`, `O`, `C`, `S` stages are completed.
2. Required validation commands pass.
3. Documentation and user-facing notes match actual app behavior.
