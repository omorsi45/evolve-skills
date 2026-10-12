# Evolve Skills Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent silent transcript loss from unsafe checkpoints, detect proposal patch tampering, and record accurate per-decision trace counts.

**Architecture:** Keep the Node.js CLI and per-skill evolution tree. Add local, per-harness scan receipts without storing transcript contents; bind checkpoints to a successful scan and source configuration. Hash new patch artifacts, validate old proposals against reconstructible baselines, and calculate new-trace counts from manifest timestamps before mutation.

**Tech Stack:** Node.js 20+, ESM, built-in `fs`, `crypto`, `path`, `node:test`, GitHub Actions Node 20 and 24.

**Spec:** `docs/superpowers/specs/2026-10-12-evolve-skills-reliability-design.md`

## Global Constraints

- No new runtime dependencies.
- Local source roots and receipts stay in ignored `evolution/sources.local.json`; scans do not read transcript contents.
- Never advance a checkpoint in `scan`, and never infer human inspection from a receipt.
- Keep per-agent checkpoints independent, `RUNS.tsv` append-only, and old proposal JSON readable.
- Preserve `--approved`, comparable evaluated-score gate, original `SKILL.md` identity, and raw-trace privacy.
- Every change starts with a failing test, followed by targeted green test and `npm run check`.
- Keep branches and PRs isolated from `main`; separate one PR per phase.

## Review Focus

1. `--since` newer than needed history: scan can inspect files but may not allow checkpoint. Test in Task 2.
2. Mid-scan errors or missing roots: no receipt and no advancement. Test in Task 2.
3. Changed roots with newer `RUNS.tsv` decision: scan all new-root history. Test in Task 1.
4. Stale/tampered patches on old pending proposals: recompute before apply. Test in Task 4.
5. Manifest timestamp equal to a previous decision: deterministic boundary excludes it after that decision. Test in Task 6.

---

## Phase 1: reliable checkpoints

### Task 1: Detect source root changes safely

**Files:**
- Modify: `scripts/evolve.mjs:206-283`
- Test: `tests/evolve.test.mjs`

**Interfaces:**
- Consumes: `readSources(evolution)`, `harness(id)`.
- Produces: `normalizedRoots(roots: string[]): string[]` and per-harness `requires_full_scan` with cleared checkpoint on source root changes.

- [ ] Step 1: Add `test("reconfiguring changed roots requires complete history despite later RUNS decision", ...)`. Create two transcript directories, a historical transcript in new roots, a newer RUNS decision, configure original roots, checkpoint it through a valid scan or seed a legacy checkpoint, then change roots. Assert null checkpoint, true full-scan flag, old transcript returned.
- [ ] Step 2: Run `node --test --test-name-pattern="reconfiguring changed roots" tests/evolve.test.mjs`. Expected RED: old checkpoint persists and historic transcript omitted.
- [ ] Step 3: Implement `normalizedRoots`; update `configureSources` to compare effective root sets, preserve unchanged checkpoints, clear receipts and checkpoints and set full-scan flag on change. `scanSources` must suppress last-evolved fallback when that flag is set.
- [ ] Step 4: Rerun targeted test and `npm run check`. Expected GREEN and complete passing suite.
- [ ] Step 5: Commit `git add scripts/evolve.mjs tests/evolve.test.mjs && git commit -m "fix: rescan history when transcript sources change"`.

### Task 2: Record trustworthy scan receipts

**Files:**
- Modify: `scripts/evolve.mjs:284-435`
- Test: `tests/evolve.test.mjs`

**Interfaces:**
- Consumes: `normalizedRoots`, `readSources`, `writeSources`, `source.requires_full_scan`.
- Produces: optional `source.scan_receipt` with `scan_started_at`, `source_id`, `roots_fingerprint`, `prior_checkpoint`, `requires_full_scan`, `since`, `candidate_count` and eligibility.

- [ ] Step 1: Add `test("scan receipts require complete error-free enumeration", ...)`. Assert eligible normal and full scans persist receipts, missing-root and export-only scans clear them, and explicit `--since` later than default cutoff yields no receipt. Include per-harness isolation.
- [ ] Step 2: Run targeted test. Expected RED: `scan_receipt` absent or stale.
- [ ] Step 3: Implement root fingerprint using SHA-256 of normalized-root JSON. Collect per-source outcomes; save only eligible receipts. Any newer scan supersedes prior receipt; no scan may advance `last_scanned_at`.
- [ ] Step 4: Rerun targeted and full `npm run check`. Expected GREEN.
- [ ] Step 5: Commit `git add scripts/evolve.mjs tests/evolve.test.mjs && git commit -m "feat: record eligible scan receipts"`.

### Task 3: Bind checkpoint to completed scans

**Files:**
- Modify: `scripts/evolve.mjs:436-465`, `SKILL.md`, `references/state-layout.md`, `references/trace-sources.md`, `README.md`
- Test: `tests/evolve.test.mjs`

**Interfaces:**
- Consumes: Task 2 `scan_receipt` and `normalizedRoots`.
- Produces: `checkpointSources` validates receipts and updates all selected sources atomically.

- [ ] Step 1: Add `test("checkpoint rejects arbitrary timestamps and consumes exact eligible receipts", ...)` and `test("checkpoint validates all harnesses before writing any", ...)`. Cover future, wrong timestamp, duplicate, errored, root changes, and successful checkpoint.
- [ ] Step 2: Run targeted tests. Expected RED: invalid checkpoints accepted.
- [ ] Step 3: Prevalidate every source, receipt, effective roots, prior checkpoint, scan flag, and through date before a single `writeSources` call. Consume receipt and clear full-scan flag on success. Update usage docs with requirement to process candidates before checkpointing.
- [ ] Step 4: Run targeted and full `npm run check`. Expected GREEN. Inspect docs for unchanged approval/privacy semantics.
- [ ] Step 5: Commit `git add scripts/evolve.mjs tests/evolve.test.mjs SKILL.md README.md references/state-layout.md references/trace-sources.md && git commit -m "fix: require eligible scan receipts for checkpoints"`.

### Phase 1 delivery

- [ ] Verify fresh `npm run check`, Node 20 and 24 CI, and scoped diff.
- [ ] Open Phase 1 PR without merging to `main`.

## Phase 2: proposal patch integrity

### Task 4: Hash and validate newly created patch artifacts

**Files:**
- Modify: `scripts/evolve.mjs:603-781`, `references/state-layout.md`
- Test: `tests/evolve.test.mjs`

**Interfaces:**
- Consumes: `sha256`, `proposalFiles`, `propose`, `applyProposal`, `rejectProposal`.
- Produces: new `metadata.patch_sha256` and `validateProposalPatch` used by `verify`, `apply`, `reject`.

- [ ] Step 1: Add `test("new proposals reject patch tampering before verification or decisions", ...)`. Create a proposal, modify `.patch`, assert `verify`, `apply` and `reject` fail without modifying `SKILL.md` or proposal decision.
- [ ] Step 2: Run targeted test. Expected RED: tampering is accepted.
- [ ] Step 3: Hash saved patch bytes during `propose`, add metadata and validation on verification and finalization.
- [ ] Step 4: Run targeted and `npm run check`. Expected GREEN.
- [ ] Step 5: Commit `git add scripts/evolve.mjs tests/evolve.test.mjs references/state-layout.md && git commit -m "fix: verify stored proposal patch hashes"`.

### Task 5: Maintain accurate legacy proposal compatibility

**Files:**
- Modify: `scripts/evolve.mjs:724-883`, `README.md`
- Test: `tests/evolve.test.mjs`

**Interfaces:**
- Consumes: Task 4 `validateProposalPatch`, `proposalPatch`.
- Produces: `legacy_unverified_patches` verification counter; legacy pending reconstitution gate.

- [ ] Step 1: Add `test("legacy proposal patches are reported unverified and validated when pending", ...)`. Remove hash from sample metadata, assert verified legacy reporting; when pending, corrupted stored patch blocks apply; applied legacy remains readable.
- [ ] Step 2: Run targeted test. Expected RED: no warning and corrupted patch applies.
- [ ] Step 3: Reconstruct expected pending legacy patch from matching unchanged baseline and candidate. Keep applied/rejected legacy proposals verifiable with warning instead of fake hashes.
- [ ] Step 4: Run targeted and full `npm run check`. Expected GREEN.
- [ ] Step 5: Commit `git add scripts/evolve.mjs tests/evolve.test.mjs README.md && git commit -m "fix: preserve legacy proposal patch integrity"`.

### Phase 2 delivery

- [ ] Verify fresh `npm run check`, Node 20/24 CI, and scoped diff.
- [ ] Open stacked Phase 2 PR based on Phase 1 branch, clearly noting the dependency.

## Phase 3: accurate evolution history

### Task 6: Compute per-decision new trace counts

**Files:**
- Modify: `scripts/evolve.mjs:189-205,629-645,724-799`, `references/state-layout.md`
- Test: `tests/evolve.test.mjs`

**Interfaces:**
- Consumes: `raw/MANIFEST.tsv`, `RUNS.tsv` decision rows.
- Produces: `newTracesSinceLastDecision(evolution, decisionTime: string): number` and a prevalidated count supplied to `recordDecision`.

- [ ] Step 1: Add `test("RUNS new_traces counts new manifest entries since previous decision", ...)`. Cover first decision, a second no-action without ingestion (0), subsequent ingest (1), rejection, and malformed manifest date. Assert invalid manifest does not update live skill or append records.
- [ ] Step 2: Run targeted test. Expected RED: cumulative counts on subsequent decisions.
- [ ] Step 3: Parse manifest dates, compare strict `previousDecision < ingested_at <= decisionTime` (first decision has no lower bound), validate before any mutating decision operation, and pass count to `recordDecision`. Preserve proposal cumulative `trace_count`.
- [ ] Step 4: Run targeted and `npm run check`; inspect legacy rows unchanged. Expected GREEN.
- [ ] Step 5: Commit `git add scripts/evolve.mjs tests/evolve.test.mjs references/state-layout.md && git commit -m "fix: report per-decision new trace counts"`.

### Phase 3 delivery

- [ ] Verify fresh `npm run check`, Node 20/24 CI, and scoped diff.
- [ ] Open stacked Phase 3 PR based on Phase 2 branch, clearly noting the dependency.

## Final review and integration

- [ ] Review all three diffs against this plan and design.
- [ ] Report any unresolved risks, failed tests, CI links, and PR dependencies.
- [ ] Keep all PRs open for human review. No merges or publication without explicit separate authorization.
