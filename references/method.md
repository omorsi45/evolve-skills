# WikiSkill method adaptation

This project adapts the method in [WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution](https://arxiv.org/abs/2608.27454) to ordinary, independently installed Agent Skills.

## Paper concepts retained

1. Separate immutable raw executions, persistent compiled knowledge, and active procedural instructions.
2. Keep the inference agent away from optimizer wiki content.
3. Use a Wiki Maintainer to consolidate both failures and successes into reusable patterns.
4. Let a Wiki-informed proposer inspect patterns, prior proposal outcomes, and selected traces.
5. Make each proposal atomic and target one skill.
6. Keep wiki history even when a proposal is rejected.
7. In evaluated mode, accept a candidate only when its comparable validation score strictly improves.

The paper's experimental sampling policy is the default here: at most eight traces per iteration, with up to five failures and three successes, and no more than 15,000 characters from each trace in model context. The proposer should inspect at least four traces before changing a skill.

## Adaptations for a reusable public skill

- State is colocated at `<target-skill>/evolution/` instead of stored under one central experiment workspace. This keeps ownership, cleanup, and history local to each skill without creating nested copies over time.
- `observational` mode supports real work where no stable validation benchmark exists. It requires trace evidence and human review but makes no measured performance claim.
- Every live edit requires explicit human approval, including edits that pass an evaluated gate.
- The CLI manages deterministic state, hashes, proposals, and gates. The host agent still performs trace interpretation, wiki maintenance, candidate authoring, and any domain-specific evaluation.

## Wiki Maintainer output

Create or update `wiki/patterns/<pattern-id>.md` only for meaningful, generalizable evidence. Each page should stay concise and contain:

- the observed behavior;
- the root cause, not only the symptom;
- concrete successful or failed action sequences from traces;
- an actionable correction or reusable strategy;
- evidence references that can be traced back to manifest hashes.

Update an existing page when the pattern already exists. Every `wiki/index.md` entry must summarize the problem, cause, and remedy clearly enough that a proposer can decide whether to open the page. Append the iteration findings to `wiki/log.md`.

## Skill Proposer output

Before proposing:

1. Read `wiki/index.md` and `wiki/skill-impact.md`.
2. Inspect relevant pattern pages and at least four execution traces.
3. Check rejected proposals so the same failed intervention is not repeated.
4. Confirm the change preserves `PURPOSE.md` and the target's frontmatter name.
5. Change one contiguous section only. Split independent changes into later proposals.

Return `no_action` when the evidence is weak, contradictory, already covered, or unlikely to improve target behavior.

## Gate interpretation

`observational` means a human accepts a narrow proposal because repeated real executions support it. It does not establish benchmark improvement.

`evaluated` means the baseline and candidate were measured on the same held-out validation tasks with the same environment, model, tools, scoring function, and run policy. Accept only when `score_after > score_before`. Reject ties and regressions. Keep the wiki either way.
