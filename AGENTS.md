# Evolve Skills: coding agent instructions

## Project

This repository provides the `evolve-skills` Agent Skill and a Node.js CLI that evolves **one named target skill** from execution traces. The skill's operating contract is in [SKILL.md](SKILL.md). [README.md](README.md) is the public quick start; keep it aligned with user-visible CLI changes.

## Repository map

- `scripts/evolve.mjs`: CLI commands and persistent per-target evolution state.
- `scripts/harnesses.mjs`: coding-agent transcript source definitions and discovery rules.
- `tests/evolve.test.mjs`: CLI integration and regression tests using isolated temporary skills.
- `references/`: methods, trace sources, privacy, and state-layout documentation.
- `docs/superpowers/`: archived designs and implementation plans.
- `.github/workflows/ci.yml`: checks for supported Node versions.

Read the more specific `AGENTS.md` in a subdirectory before editing files there. Nested guidance adds to these repository-wide rules.

## Environment and commands

- Use **Node.js 20 or newer**, ECMAScript modules, and built-in Node APIs. The project has no runtime dependencies to install.
- Run the test suite: `npm test`.
- Run the complete local/CI checks before proposing a merge: `npm run check`.
- Inspect supported transcript providers without user data: `node scripts/evolve.mjs harnesses --json`.
- Use `npm run check` as the authoritative verification command. Do not claim tests pass without checking its result.

## Safety and evolution invariants

- Work only on the user-named target skill. Do not evolve this repository's own `evolve-skills` skill unless the user expressly chooses it as the target.
- While running a target skill for inference/evaluation, **exclude that skill's `evolution/` directory from its context**. Optimizer records must not leak into ordinary execution.
- Treat transcripts, local paths, prompts, credentials, and tool output as sensitive. Read [references/privacy.md](references/privacy.md) before ingesting, logging, or publishing trace-derived material. Never commit `evolution/raw/traces/`, `evolution/raw/digests/`, or `evolution/sources.local.json`.
- Keep per-target evolution state in the target's own `evolution/` tree, not in a shared centralized store.
- Scanning reads file metadata, not transcript contents; never advance a source's checkpoint without an eligible scan receipt and completion of candidate review.
- Do not modify a live target `SKILL.md` during proposal creation. Applying a proposal requires explicit human approval; evaluated mode also requires a strictly improving comparable score.
- Preserve append-only decision history, content integrity checks, compatibility with existing state, and clear privacy boundaries.

## How to change this repository

1. Inspect relevant code, tests, `SKILL.md`, and scoped guidance before editing. Preserve existing interfaces and keep changes focused.
2. For behavior changes, add a regression test that reproduces the problem, then make it pass. Include error cases and backward compatibility where applicable.
3. Update the matching reference documentation and public usage instructions if command behavior changes.
4. Run `npm run check`, inspect the diff, and report actual test results and remaining limitations. Never invent execution evidence.
5. Do not commit user traces, machine-specific paths, tokens, or other private data. Do not bypass required approvals or weaken CI to make a change appear successful.
