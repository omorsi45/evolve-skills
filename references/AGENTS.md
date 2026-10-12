# Reference documentation instructions

This file applies to `references/` together with the root `AGENTS.md`.

## Source-of-truth relationships

- `privacy.md`: required handling of sensitive execution traces and safe publication.
- `state-layout.md`: per-target `evolution/` filesystem layout, CLI command list, and persistence invariants.
- `trace-sources.md`: transcript source-specific discovery, activation evidence, exports, and checkpoint guidance.
- `method.md`: evidence-based knowledge maintenance and how wiki patterns support narrow proposals.
- `SKILL.md` at repository root specifies the agent-facing workflow. The actual implementation is in `scripts/`; tests verify its observable behavior.

## Editing guidance

- Do not add promises that the CLI does not enforce. In particular, a scan receipt proves an eligible enumeration, **not** that an agent read and reviewed every candidate.
- Distinguish observational evidence from evaluated improvements; do not claim measured score gains without comparable evaluation results.
- Keep trace files local and sensitive. Do not embed credentials, raw private conversations, client data, or machine-local root paths in examples.
- If changing state shape, command options, or source discovery rules, cross-check the corresponding code and tests and update affected references together.
- Prefer precise examples using placeholder skill paths over personal paths.
- After a reference-only edit, inspect links and consistency; for behavior-related documentation changes, run `npm run check`.
