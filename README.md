# Evolve Skills

**Continual learning infrastructure for coding agents, without retraining the model.**

Turns real agent execution traces into persistent knowledge, benchmark-gated skill improvements, and human-reviewed updates.

Instead of treating `SKILL.md` as static configuration, it lets a skill accumulate evidence from real runs, compile recurring patterns into persistent knowledge, propose a narrow improvement, and apply it only after review or evaluation.

Inspired by [WikiSkill](https://arxiv.org/abs/2608.27454), the architecture keeps three layers separate:

```text
raw experience → persistent knowledge → executable skill
```

That separation matters. The system can learn from a failed proposal without polluting the live skill, preserve useful knowledge across iterations, and keep every production change auditable.

## Quick start

**Requirements:** Node.js 20+, a filesystem-based Agent Skills setup, and access to the skill you want to improve.

Install Evolve Skills into your agent's skills folder:

```bash
git clone https://github.com/omorsi45/evolve-skills.git <skills-folder>/evolve-skills
```

Keep `SKILL.md`, `scripts/`, and `references/` together.

Then tell your agent:

```text
Use evolve-skills to evolve /path/to/my-skill.
```

That is the normal workflow. You do not need to operate the CLI manually.

## How it works

Evolve Skills treats each real execution as another piece of training evidence for the skill.

```text
real runs
   ↓
raw traces
   ↓
persistent wiki of patterns
   ↓
candidate SKILL.md update
   ↓
evaluation / human review
   ↓
approved improvement
   ↓
next real run
```

The loop is intentionally conservative. A run does not directly rewrite the live skill.

Instead:

1. **Executions become evidence.** Successful and failed runs are collected as immutable traces.
2. **Evidence becomes knowledge.** Recurring causes, strategies, and edge cases are compiled into a persistent wiki.
3. **Knowledge becomes a proposal.** The agent proposes one narrow, auditable change to the target `SKILL.md`.
4. **The proposal passes a gate.** Observational mode requires human review. Evaluated mode also requires `score_after > score_before`.
5. **The live skill changes only after approval.** Rejected proposals and no-action decisions remain part of the learning history.

### The ML analogy

This is not literal gradient descent over neural-network weights. It is an evidence-driven optimization loop over an agent's reusable procedural knowledge.

A useful mental model is:

| Machine learning | Evolve Skills |
| --- | --- |
| Training example | Real agent execution |
| Feedback / loss signal | Pass, fail, or benchmark score |
| Training data | Raw execution traces |
| Learned representation | Persistent wiki |
| Policy / behavior | `SKILL.md` |
| Candidate update | Proposed skill patch |
| Validation | Evaluation gate |
| Deployment | Human-approved apply |

The model weights may stay fixed, while the skill keeps learning from experience.

## State lives with the skill

Each target skill owns its own evolution history:

```text
my-skill/
  SKILL.md
  PURPOSE.md
  evolution/
    config.json
    sources.local.json
    RUNS.tsv
    raw/
      MANIFEST.tsv
      traces/
      digests/
    wiki/
      index.md
      log.md
      skill-impact.md
      patterns/
    proposals/
      0001.json
      0001.patch
      0001.candidate.md
```

This keeps learning local to the skill instead of building one central archive for every agent and project.

The system preserves:

- raw execution evidence;
- recurring failure and success patterns;
- accepted, rejected, and `no_action` decisions;
- proposal history;
- per-agent scan checkpoints;
- hashes used for deduplication and integrity checks.

## Why it matters

Agent Skills are usually static. Real usage is not.

After enough tasks, execution history contains evidence about:

- instructions that are consistently misunderstood;
- edge cases the skill does not cover;
- strategies that repeatedly work;
- workflows that waste time;
- fixes that already failed;
- patterns that should become reusable knowledge.

Without a learning layer, that evidence disappears into old transcripts.

Evolve Skills converts it into persistent, reviewable knowledge that can improve the skill over time without silently rewriting production instructions.

## Core features

- Learns from real execution history.
- Maintains a persistent WikiSkill-style knowledge base per target skill.
- Separates raw evidence, learned knowledge, and live instructions.
- Supports **observational** and **benchmark-gated evaluated** evolution.
- Allows one narrow, atomic `SKILL.md` change per proposal.
- Requires explicit human approval before every live edit.
- Enforces `score_after > score_before` in evaluated mode.
- Deduplicates traces with content-addressed SHA-256 ingestion.
- Tracks independent checkpoints for each configured coding agent.
- Preserves accepted, rejected, and `no_action` history.
- Verifies trace, proposal, and candidate integrity.
- Supports **16 coding-agent harnesses**, including OpenAI Codex, Claude Code, Gemini CLI, GitHub Copilot, Kiro, Cline, Roo Code, Continue, Aider, Cursor, Windsurf, OpenCode, Goose, Amp, and Zed.
- Has no runtime dependencies beyond Node.js 20+.

## Two modes

| Mode | Use it when | Gate |
| --- | --- | --- |
| **Observational** | Real work produces useful evidence but no reliable benchmark exists | Evidence-based proposal + human approval |
| **Evaluated** | A repeatable validation set and comparable numeric score exist | Human approval + strict `score_after > score_before` |

### Observational

Observational mode learns from normal work sessions.

It looks for recurring patterns across successful and failed executions, updates the persistent wiki, and proposes a small change for review. It does **not** claim measured performance improvement when no benchmark exists.

### Evaluated

Evaluated mode adds a validation gate.

The unchanged baseline and candidate must be measured under the same environment, model, tools, scoring function, validation tasks, and run policy.

A candidate is eligible only when:

```text
score_after > score_before
```

Ties and regressions are rejected. The accumulated wiki knowledge remains even when the candidate does not ship.

## Safety by design

Self-improvement should not mean uncontrolled self-rewriting.

Evolve Skills deliberately separates:

```text
evidence collection
      ↓
knowledge compilation
      ↓
proposal creation
      ↓
evaluation
      ↓
human approval
      ↓
live skill update
```

Key safeguards:

- the target skill cannot read its own optimizer state during normal inference;
- raw traces are treated as sensitive and kept local by default;
- proposals do not modify the live `SKILL.md`;
- every live edit requires explicit human approval;
- evaluated changes must beat the baseline;
- rejected proposals remain in history so the system does not keep rediscovering the same bad intervention;
- integrity checks validate traces, proposals, hashes, and state.

See [references/privacy.md](references/privacy.md) for trace-handling rules.

## Supported coding agents

Evolve Skills can discover or ingest sessions from 16 coding-agent harnesses.

Direct file-backed discovery is supported where the agent exposes ordinary session files. Database-backed and cloud-backed agents use an export-first workflow rather than reading live application databases.

Run:

```bash
node scripts/evolve.mjs harnesses
```

Then configure one or more sources:

```bash
node scripts/evolve.mjs configure /path/to/my-skill \
  --harness codex \
  --harness claude-code
```

See [references/trace-sources.md](references/trace-sources.md) for the full adapter list and discovery behavior.

## Direct CLI usage

Most users can let their coding agent operate Evolve Skills directly. The CLI is available for explicit control, automation, and debugging.

```bash
node scripts/evolve.mjs init /path/to/my-skill --mode observational
node scripts/evolve.mjs harnesses
node scripts/evolve.mjs configure /path/to/my-skill --harness codex --harness claude-code
node scripts/evolve.mjs scan /path/to/my-skill --json
node scripts/evolve.mjs ingest /path/to/my-skill --trace ./run.jsonl --outcome fail
node scripts/evolve.mjs checkpoint /path/to/my-skill --harness codex --through 2026-09-18T20:00:00.000Z
node scripts/evolve.mjs status /path/to/my-skill
node scripts/evolve.mjs verify /path/to/my-skill
```

Use the exact `scan_started_at` returned by `scan` as the checkpoint, and advance it only after every candidate from that source has been processed successfully.

Machine-specific transcript paths live in the target skill's ignored `evolution/sources.local.json`. Reusable learned knowledge stays inside its `evolution/` tree.

Run:

```bash
node scripts/evolve.mjs --help
```

for the full command list. See [references/state-layout.md](references/state-layout.md) for the complete state model and CLI contract.

## Development

```bash
node --test tests/evolve.test.mjs
node --check scripts/evolve.mjs
node --check scripts/harnesses.mjs
```

Or run the package check:

```bash
npm run check
```

## Research context

Evolve Skills is an independent implementation inspired by:

Liyan Tang, Cyrus Rashtchian, Chun-Sung Ferng, Andrew Tomkins, Da-Cheng Juan, and Tu Vu. **WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution.** arXiv:2608.27454, 2026.

The project adapts the paper's core separation of **raw experience → persistent knowledge → skill evolution** to independently installed Agent Skills and real coding-agent workflows.

The WikiSkill paper reports substantial benchmark gains from persistent skill knowledge, including cross-model transfer. Those are **paper results, not benchmark claims for this repository**.

For the exact adaptation used here, see [references/method.md](references/method.md).

## Method and attribution

This repository is an independent implementation inspired by the WikiSkill paper. It is not affiliated with or endorsed by Google Research.

The paper is licensed under CC BY 4.0. This project's original source code and documentation are licensed under the MIT License.

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.
