# Evolve Skills

**Make your Agent Skills improve from experience instead of staying static.**

`evolve-skills` is an installable Agent Skill that watches how another skill performs in real runs, turns repeated successes and failures into persistent knowledge, and proposes targeted improvements to that skill over time.

It is inspired by the **WikiSkill** research architecture: keep raw execution experience, a persistent wiki of learned patterns, and the live skill separate so knowledge can compound across iterations instead of being lost between runs.

> **Install it like any other skill:** clone this repository directly into your agent's skills folder. There is no package to publish or server to run.

## Why use it?

Most Agent Skills are written once and then remain unchanged. But after dozens of real tasks, your agent has already generated useful evidence about:

- instructions that are unclear;
- steps that repeatedly fail;
- workflows that consistently work;
- model-specific workarounds;
- missing edge cases;
- edits that were tried before and should not be repeated.

`evolve-skills` turns that history into an auditable improvement loop:

```text
real runs
   ↓
raw traces
   ↓
persistent wiki of patterns
   ↓
small proposed skill edit
   ↓
human approval / evaluation gate
   ↓
better SKILL.md
```

The learning state stays **inside the target skill**, so each skill develops its own reusable memory:

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

## What the research found

This project is inspired by **WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution**.

In the paper's experiments across five benchmarks and multiple model families, WikiSkill improved average Qwen performance over the no-skill baseline by:

| Model | Average improvement |
| --- | ---: |
| Qwen-3.5-4B | **+12.3 points** |
| Qwen-3.5-9B | **+17.5 points** |
| Qwen-3.6-27B | **+23.9 points** |

On individual tasks, the gains could be substantially larger. For example, Qwen-3.6-27B improved by **+40.9 points** on the spreadsheet benchmark. The paper also found that evolved skills can transfer across models and that persistent wiki knowledge is important to effective skill evolution.

Paper: https://arxiv.org/abs/2608.27454

**Important:** those numbers are results from the WikiSkill paper, not benchmark claims for this repository. `evolve-skills` is an independent implementation inspired by its persistent raw → wiki → skill architecture.

## Install in seconds

Requirements:

- an agent that supports filesystem-based Agent Skills;
- Node.js 20+;
- filesystem access to the skill you want to improve.

### Option 1 — clone directly into your skills folder

Replace `<skills-folder>` with the directory your agent uses for skills:

```bash
git clone https://github.com/omorsi45/evolve-skills.git <skills-folder>/evolve-skills
```

That's it. Keep the repository as one folder named `evolve-skills` inside your skills directory.

You should end up with:

```text
<skills-folder>/
  evolve-skills/
    SKILL.md
    scripts/
    references/
```

### Option 2 — download and copy

Download this repository and copy the entire `evolve-skills` directory into your agent's skills folder.

Do **not** copy only `SKILL.md`; keep `SKILL.md`, `scripts/`, and `references/` together.

## Use it

Once installed, just tell your agent which skill you want to improve:

```text
Use evolve-skills to evolve /path/to/my-skill.
```

Or explicitly choose a mode:

```text
Use evolve-skills to evolve /path/to/my-skill in observational mode.
```

The agent reads `SKILL.md` and uses the bundled CLI to manage the evolution state safely.

You do not need to manually run the CLI for normal agent-driven use.

## Two evolution modes

### Observational mode

Best for normal real-world usage.

It learns from actual work sessions, finds recurring patterns, and proposes improvements for review.

```text
Use evolve-skills to evolve /path/to/my-skill in observational mode.
```

This mode is evidence-based, but it does not claim a measured performance improvement unless you separately evaluate the change.

### Evaluated mode

Best when you have a repeatable benchmark or validation set.

A proposed skill change is accepted only when:

```text
score_after > score_before
```

If performance does not improve, the live skill is left unchanged while the accumulated wiki knowledge is preserved for future attempts.

## What it provides

- learns from real execution history;
- persistent WikiSkill-style knowledge that compounds over time;
- observational and benchmark-gated evolution modes;
- small, atomic skill-edit proposals instead of uncontrolled rewrites;
- explicit human approval before modifying the live skill;
- strict `score_after > score_before` gating in evaluated mode;
- rollback-safe proposal history;
- content-addressed and deduplicated trace ingestion;
- per-agent transcript scan checkpoints;
- persistent records of successful and rejected ideas;
- integrity verification for traces and proposals;
- support for 16 popular coding-agent harnesses;
- no runtime dependencies beyond Node.js 20+.

## Why the persistent wiki matters

A simple "read the last few failures and rewrite the prompt" loop forgets what happened before.

`evolve-skills` instead keeps a growing knowledge layer containing recurring failure modes, successful strategies, proposal history, and skill impact.

That means later improvements can build on earlier evidence instead of rediscovering the same lessons.

The live skill stays concise while the detailed history remains available to the evolution process.

## Safety by design

Skill evolution should not silently rewrite production instructions.

This project therefore keeps proposal generation separate from application:

1. collect evidence;
2. update persistent patterns;
3. propose one narrow change;
4. review it;
5. apply only with explicit approval;
6. in evaluated mode, require a strictly better score.

Rejected proposals and `no_action` outcomes are also retained so the system does not repeatedly rediscover the same bad edit.

## Direct CLI use

You can also operate the evolution state manually:

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

Use the exact `scan_started_at` returned by `scan` as the checkpoint value, and only after every candidate for that source has been processed successfully.

Machine-specific transcript paths live in the target skill's ignored `evolution/sources.local.json`. Evolution knowledge and decisions remain in the target's reusable `evolution/` tree.

Run:

```bash
node scripts/evolve.mjs --help
```

for the full command list. See `references/state-layout.md` for command forms and state layout.

## Development

```bash
node --test tests/evolve.test.mjs
node --check scripts/evolve.mjs
node --check scripts/harnesses.mjs
```

## Method and attribution

This is an independent implementation inspired by:

Liyan Tang, Cyrus Rashtchian, Chun-Sung Ferng, Andrew Tomkins, Da-Cheng Juan, and Tu Vu. **WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution.** arXiv:2608.27454, 2026.

https://arxiv.org/abs/2608.27454

The paper is licensed under CC BY 4.0. This project's source code and original documentation are licensed under MIT. This project is not affiliated with or endorsed by Google Research.
