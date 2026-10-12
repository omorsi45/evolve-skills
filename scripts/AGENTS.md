# CLI and transcript harness instructions

This file adds rules for `scripts/` on top of the root `AGENTS.md`.

## Responsibilities

- `evolve.mjs` is the Node.js 20+ ESM command-line entry point: initialize per-skill state; configure/scan/ingest sources; checkpoint; propose, apply, reject, or record no action; report status and verify integrity.
- `harnesses.mjs` defines the coding-agent source catalog, default roots, file matchers, and export-only adapters. Keep detection separate from ingestion.
- Keep CLI output predictable and machine-readable wherever a `--json` option exists. Errors must clearly explain why a command did not proceed.

## State and safety

- Never read raw transcript bodies during a `scan`: enumerate metadata only, respect source cutoffs, and report missing roots/errors.
- Do not advance `last_scanned_at` during `scan`. `checkpoint` must require an exact, eligible, unconsumed scan receipt tied to unchanged source roots; validate every requested source before writing any checkpoint.
- A changed source root must not inherit its old checkpoint or skip history due to a later recorded evolution decision.
- Keep sensitive transcripts and machine-local source state in the target skill's `evolution/` directory under the privacy exclusions. Never print secrets or transcript bodies into error messages.
- Preserve SHA-256-based trace deduplication and verification of candidate and patch artifacts.
- Preserve explicit `--approved` checks and the evaluated-mode requirement that the after score strictly exceeds the before score.
- Validate data before mutating a live skill or append-only decision history; preserve existing persisted records.

## Editing and verification

- Prefer focused helpers and Node built-in APIs; avoid new runtime dependencies or unrelated refactors.
- Add regression coverage in `tests/evolve.test.mjs` for command success, failure, idempotency, and backward-compatible state.
- Keep `SKILL.md`, `references/state-layout.md`, `references/trace-sources.md`, and `README.md` consistent with user-facing CLI changes.
- Run `node --check scripts/evolve.mjs`, `node --check scripts/harnesses.mjs`, and `npm run check`.
