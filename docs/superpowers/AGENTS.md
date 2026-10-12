# Superpowers design and plan instructions

This file applies to `docs/superpowers/` together with the root `AGENTS.md`.

## Document roles

- `specs/` stores dated design documents: problem statement, requirements, constraints, accepted approaches, and testable behavior.
- `plans/` stores dated implementation plans: file boundaries, concrete tasks, regression tests, verification steps, and execution handoff.
- These are **historical design records**. A previous plan is not proof that its implementation was completed or that its instructions still reflect the current code.

## Maintenance

- Read the corresponding specification before changing an implementation plan. Record dependencies and preserve scope decisions.
- Distinguish proposed behavior from verified implementation. Link relevant code, tests, and PRs when reporting completion.
- Do not retroactively alter approved historical plans merely because the code evolved. Add a dated follow-up when documenting a new design.
- Keep implementation commands and paths accurate; validate them against the current repository before proposing new work.
- Do not place private transcript bodies or credentials in specs, plans, or examples.
