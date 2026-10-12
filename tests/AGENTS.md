# Test instructions

This file applies to `tests/` together with the root `AGENTS.md`.

## Test harness

- Tests use built-in `node:test` and `node:assert/strict`. Keep the suite executable through `npm test`.
- `tests/evolve.test.mjs` launches the real CLI with `spawnSync`, creates isolated **temporary** skill directories, and inspects command output plus filesystem state.
- Build fixtures inside the test's temporary directory. Never depend on real user agent sessions, home-directory transcripts, credentials, local IDE state, or network access.
- Use deterministic timestamps and fixed synthetic trace contents. Assert persisted state and exit status; do not rely only on log wording.

## Regression workflow

- When fixing a bug, write a regression test that fails for the original behavior before the fix, then make it pass.
- Test failure paths that must leave state unchanged, such as invalid checkpoints, missing roots, corrupt patches, rejected proposals, and malformed manifests.
- Preserve checks for existing public commands, legacy state compatibility, privacy exclusions, and explicit human approval.
- Keep fixtures small and inspectable; never write real private trace data to this repository.
- Run focused tests when useful, then `npm test` and the full `npm run check` before marking the work verified.
