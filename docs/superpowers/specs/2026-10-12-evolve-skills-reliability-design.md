# Evolve Skills reliability and integrity design

Date: 2026-10-12
Status: awaiting written-spec review
Repository: `omorsi45/evolve-skills`

## Goal and approved scope

Improve reliability and safety across three related workflows, with separate implementation pull requests: (1) trustworthy incremental checkpoints and transcript source changes, (2) stored proposal patch integrity with legacy compatibility, and (3) accurate new-trace counts in evolution decisions.

This is the architectural path of Superpowers brainstorming. Code implementation requires approval of this written specification, then an approved implementation plan and execution approach.

The existing privacy-ignore fix in PR #1 stays separate and unmerged unless explicitly integrated later.

## Codebase findings

- `scripts/evolve.mjs` owns `configure`, `scan`, `checkpoint`, `propose`, `apply`, `reject`, `no-action`, and `verify`.
- `sources.local.json` contains each harness's configured transcript roots and `last_scanned_at`. `scan` currently has no durable record of successful enumeration.
- `checkpoint` accepts any parseable `--through` date newer than the prior checkpoint, including dates unrelated to any scan.
- `configure` preserves the previous checkpoint after changing roots. Merely resetting it to null would still allow `lastEvolvedAt` to skip old files.
- Proposal candidate hashes are verified, but existing `*.patch` content is not checked for tampering.
- The `RUNS.tsv` column `new_traces` currently receives the cumulative proposal `trace_count`, not a count for the current evolution interval.

These are static code findings. Tests must reproduce each defect before any implementation.

## Global constraints

- Keep Node.js 20+ compatibility and no runtime dependencies beyond built-in Node modules. CI must pass on Node 20 and 24.
- Keep traces and source metadata local; never commit raw transcripts, local roots, digests, or scan receipts.
- A scan reads transcript file metadata only. It must never silently advance a checkpoint.
- The agent must review, ingest, or explicitly exclude all candidates before checkpointing. A scan receipt proves enumeration, not human or agent processing.
- Preserve the `evolution/` directory, source independence, `PURPOSE.md`, and human approval and evaluated-score gates.
- Preserve historical RUNS rows and older proposal records without automatic rewriting.
- Make one narrow, test-first change per task. Run the full test suite and code review before each PR. Do not auto-merge.
- Update CLI instructions, `SKILL.md`, README, and reference docs where behavior changes. Skill-document edits require skill-specific behavior tests.

## Phase 1: scan receipts and safe checkpointing

### Local state

In ignored `evolution/sources.local.json`, add optional fields per configured harness:

- `scan_receipt`: the latest eligible scan, containing source ID, `scan_started_at`, effective cutoff, candidate count, normalized roots fingerprint, and the checkpoint value observed when the scan began.
- `requires_full_scan`: true after the effective roots of an existing configured source change, until a valid checkpoint follows a full scan.

Preserve schema version 1 and interpret absent fields as legacy defaults. Normalize roots by resolving, deduplicating, and sorting paths before comparing or fingerprinting them. Treat fingerprints as accidental-misuse detection, not authentication.

### Scan contract

`scan` retains its current output and does not change `last_scanned_at`. It may persist the receipt for each independently scanned source.

A receipt is eligible only when all configured roots exist and can be enumerated without errors, the source has usable roots rather than `export_required`, and the scan's lower bound covers the required history. Normal scans and `--rescan-all` may qualify. An explicit `--since` newer than the default cutoff may return results but must not be checkpointable.

If `requires_full_scan` is true, ignore both the former checkpoint and `lastEvolvedAt` as lower bounds. Only complete coverage from the beginning qualifies for a checkpoint. An errored or missing-root scan invalidates that source's previous receipt and reports the reason, but leaves other sources independent. A newer scan supersedes an older receipt.

### Checkpoint contract

Keep the existing invocation `checkpoint <skill> --harness <id> --through <scan_started_at>`.

Validate, before any state write:

1. Each harness has a latest eligible receipt with exactly the requested `--through`.
2. The timestamp is not in the future and cannot move its checkpoint backward.
3. Current source ID, normalized roots, existing checkpoint, and full-scan state match the receipt.
4. The scan did not have missing roots, enumeration errors, or incomplete historical coverage.

Check every selected harness first, then update all of them together, so a multi-harness request cannot partially advance progress. Consume receipts upon checkpoint and clear `requires_full_scan`. A duplicate attempt without a new scan must fail.

The CLI cannot know whether the operator actually inspected all candidates. Keep the explicit processing rule in `SKILL.md`. Crash recovery is rescan and safe retry, using existing SHA-256 trace deduplication.

### Reconfiguration contract

When normalized roots are unchanged, preserve the checkpoint. When they change, clear the checkpoint and receipt and set `requires_full_scan` to true. A changed root must rescan old transcripts even when the skill has a recent evolution decision. Reconfiguring one harness must not reset another.

### Phase 1 acceptance

Regression tests: future and fabricated checkpoints; timestamp mismatch; errored or missing-root scans; export-only source; newer explicit `--since`; per-harness isolation and atomic multi-harness validation; unchanged roots; changed roots with a later evolution date; successful scan, checkpoint, consumed receipt, and safe retry.

## Phase 2: proposal patch integrity

Add `patch_sha256` to each new proposal's metadata, based on the saved `.patch` bytes. `verify`, `apply`, and `reject` must reject a new proposal when this hash differs. Keep existing candidate, baseline, approval, and evaluated-score checks.

Old proposals with no `patch_sha256` remain accessible, without rewriting them:

- `verify` validates available fields and reports `legacy_unverified_patches` in text and JSON. Never imply old patch bytes were cryptographically checked.
- A pending legacy proposal can be applied only if its stored patch matches a fresh patch reconstructed from the matching live baseline and candidate.
- An already applied or rejected legacy proposal remains readable and is explicitly reported as having a patch that cannot always be independently verified without the original baseline.

Hash verification does not establish proposal quality, trace provenance, or permission to apply.

### Phase 2 acceptance

Tests: tamper only with patch bytes; test `verify`, `apply`, and `reject`; ensure missing or altered candidate files still fail; verify pending legacy proposals are checked against the current baseline; ensure historical legacy proposals remain readable with an accurate warning.

## Phase 3: truthful evolution history

Maintain the current `RUNS.tsv` columns, append-only behavior, and untouched historic rows. For each new `apply`, `reject`, or `no-action` entry, `new_traces` counts unique manifest entries ingested after the previous recorded decision and no later than the current decision. For the first decision, count all ingested entries. Use existing manifest `ingested_at` timestamps, not cumulative proposal metadata.

Preserve `proposal.trace_count` as its separate cumulative evidence snapshot. Invalid manifest timestamps fail with a useful error instead of producing misleading counts. Define comparison boundaries in deterministic tests to avoid same-millisecond flakiness.

### Phase 3 acceptance

Tests: first decision; two consecutive decisions with no new ingest; a new ingest between decisions; rejected and no-action decisions; older RUNS rows preserved; bad manifest timestamp rejected.

## Failure handling and deployment

- Incomplete scans, malformed sources, stale receipts, and root mismatches must produce actionable errors without advancing checkpoints.
- Corrupted new patch artifacts must block verification and finalization; legacy integrity limitations must be visible.
- Decisions must not be appended when required manifest data is invalid.
- Scope each phase to its owning files and docs. Use independent PRs in phase order. Base on `main` after preceding phases merge, or clearly mark a stacked dependency.
- For every phase: failing regression test on baseline, smallest fix, targeted green test, full `npm run check`, Node 20/24 CI, diff review, and code review.

## Non-goals

No automatic transcript classification or proof of candidate review, live SQLite access, hidden skill self-modification, approval bypass, database migration, wholesale CLI refactor, or reconstruction of unavailable old baselines.

## Handoff gate

Once this specification is approved, invoke Superpowers `writing-plans` and create `docs/superpowers/plans/` tasks with exact file paths, red-green tests, and commands. Request review of that plan and the execution method before touching implementation code.
