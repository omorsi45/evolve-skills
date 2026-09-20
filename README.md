# Evolve Skills

**Make Agent Skills improve from real execution history.**

`evolve-skills` is an installable Agent Skill that learns from another skill's real runs, builds a persistent knowledge base of what works and what fails, and proposes small improvements over time.

Inspired by the [WikiSkill paper](https://arxiv.org/abs/2608.27454) by Google, it keeps **raw experience → persistent wiki → skill edits** separate so knowledge compounds across iterations instead of being lost.

## Quick start

**Requirements:** a filesystem-based Agent Skills setup, Node.js 20+, and access to the skill you want to improve.

Install it directly into your agent's skills folder:

```bash
git clone https://github.com/omorsi45/evolve-skills.git <skills-folder>/evolve-skills
```

Or download the repo and copy the entire `evolve-skills` folder there. Keep `SKILL.md`, `scripts/`, and `references/` together.

Then tell your agent:

```text
Use evolve-skills to evolve /path/to/my-skill.
```

That's the normal workflow — you do **not** need to operate the CLI manually.

## How it works

```text
real runs
   ↓
raw traces
   ↓
persistent wiki of patterns
   ↓
small proposed SKILL.md change
   ↓
human approval / evaluation gate
   ↓
improved skill
```

Each target skill keeps its own evolution state:

```text
my-skill/
  SKILL.md
  PURPOSE.md
  evolution/
    raw/
    wiki/
    proposals/
    RUNS.tsv
```

This lets the system remember recurring failures, successful strategies, previous proposals, and rejected ideas without bloating the live skill.

## Why this matters

Static skills do not learn from use. After many real tasks, your execution history already contains evidence about unclear instructions, missing edge cases, repeated failures, useful workarounds, and workflows that consistently succeed.

`evolve-skills` turns that evidence into an auditable improvement loop while keeping the live skill protected.

### Core features

- learns from real execution history;
- persistent WikiSkill-style knowledge per target skill;
- observational and benchmark-gated evolution modes;
- one narrow, atomic skill change per proposal;
- explicit human approval before live edits;
- strict `score_after > score_before` gate in evaluated mode;
- deduplicated, content-addressed trace ingestion;
- per-agent transcript scan checkpoints;
- persistent accepted, rejected, and `no_action` history;
- integrity checks for traces and proposals;
- support for 16 popular coding-agent harnesses;
- no runtime dependencies beyond Node.js 20+.

## Research results

The project is inspired by **WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution**.

Across five benchmarks, the paper reports average improvements over the no-skill baseline of:

| Model | Average improvement |
| --- | ---: |
| Qwen-3.5-4B | **+12.3 points** |
| Qwen-3.5-9B | **+17.5 points** |
| Qwen-3.6-27B | **+23.9 points** |

On the spreadsheet benchmark, Qwen-3.6-27B improved by **+40.9 points**. The paper also reports cross-model transfer and shows that persistent wiki knowledge is important to effective skill evolution.

> These are **WikiSkill paper results**, not benchmark claims for this repository. `evolve-skills` is an independent implementation inspired by the paper's persistent raw → wiki → skill architecture.

[Read the paper →](https://arxiv.org/abs/2608.27454)

## Two modes

| Mode | Use it when | Behavior |
| --- | --- | --- |
| **Observational** | You want to learn from normal real-world runs | Finds recurring patterns and proposes evidence-based improvements for review |
| **Evaluated** | You have a repeatable benchmark or validation set | Applies a proposal only when `score_after > score_before` |

If an evaluated proposal does not improve the score, the live skill stays unchanged while the accumulated wiki knowledge is preserved.

## Safety by design

The system does not silently rewrite production skills. It separates evidence collection, wiki maintenance, proposal creation, review, and application.

A live `SKILL.md` change requires explicit human approval. Rejected proposals and `no_action` outcomes remain in history so the system can learn from them instead of repeatedly suggesting the same bad edit.

<details>
<summary><strong>Direct CLI usage</strong></summary>

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

Use the exact `scan_started_at` returned by `scan` as the checkpoint, and only after every candidate for that source has been processed successfully.

Machine-specific transcript paths live in the target skill's ignored `evolution/sources.local.json`; reusable evolution knowledge stays in its `evolution/` tree.

Run `node scripts/evolve.mjs --help` for the full command list. See `references/state-layout.md` for command forms and state layout.

</details>

<details>
<summary><strong>Development</strong></summary>

```bash
node --test tests/evolve.test.mjs
node --check scripts/evolve.mjs
node --check scripts/harnesses.mjs
```

</details>

## Method & attribution

Independent implementation inspired by:

Liyan Tang, Cyrus Rashtchian, Chun-Sung Ferng, Andrew Tomkins, Da-Cheng Juan, and Tu Vu. **WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution.** arXiv:2608.27454, 2026.

The paper is licensed under CC BY 4.0. This project's source code and original documentation are licensed under MIT. This project is not affiliated with or endorsed by Google Research.
