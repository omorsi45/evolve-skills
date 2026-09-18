# Evolve Skills

`evolve-skills` is an open-source Agent Skill for improving another Agent Skill from its real execution history. It adapts the persistent raw, wiki, and skills architecture from the WikiSkill research paper while keeping each target's evolution state inside that target skill.

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

One target gets one stable `evolution/` tree. Repeated runs add traces, patterns, proposals, and decisions to that tree. They do not create `evolve-skills/<skill>/<skill>/...` nesting or a central folder containing copies of everybody's skills.

## What it provides

- observational mode for evidence from real work sessions;
- evaluated mode with a strict `score_after > score_before` gate;
- content-addressed, deduplicated trace ingestion;
- per-agent scan checkpoints that skip transcripts at or before the last successful scan;
- automatic first-scan fallback to the target skill's last evolution date;
- guided setup for 16 popular coding agents across Windows, macOS, and Linux;
- direct discovery for file-backed agents and safe export workflows for database or cloud-backed agents;
- persistent pattern and proposal history;
- atomic proposal enforcement;
- explicit human approval before live edits;
- rejection and `no_action` outcomes without losing the wiki;
- integrity checks for traces and proposals;
- no runtime dependencies beyond Node.js 20 or newer.

## Install as an Agent Skill

Clone or copy this directory into a skill location supported by your agent harness. Keep the directory name `evolve-skills` and preserve `SKILL.md`, `scripts/`, and `references/` together.

Then ask your agent:

```text
Use evolve-skills to evolve /path/to/my-skill in observational mode.
```

The agent follows `SKILL.md` and uses the bundled CLI for deterministic state changes.

## Direct CLI use

```text
node scripts/evolve.mjs init /path/to/my-skill --mode observational
node scripts/evolve.mjs harnesses
node scripts/evolve.mjs configure /path/to/my-skill --harness codex --harness claude-code
node scripts/evolve.mjs scan /path/to/my-skill --json
node scripts/evolve.mjs ingest /path/to/my-skill --trace ./run.jsonl --outcome fail
node scripts/evolve.mjs checkpoint /path/to/my-skill --harness codex --through 2026-09-18T20:00:00.000Z
node scripts/evolve.mjs status /path/to/my-skill
node scripts/evolve.mjs verify /path/to/my-skill
```

Use the exact `scan_started_at` returned by `scan` as the checkpoint value, and only after every candidate for that source was processed successfully. Source choices and paths live in the target's ignored `evolution/sources.local.json`; evolution knowledge and decisions remain in the target's reusable `evolution/` tree.

Run `node scripts/evolve.mjs --help` for the command list. See `references/state-layout.md` for all command forms.

## Development

```text
node --test tests/evolve.test.mjs
node --check scripts/evolve.mjs
node --check scripts/harnesses.mjs
```

## Method and attribution

This is an independent implementation inspired by:

Liyan Tang, Cyrus Rashtchian, Chun-Sung Ferng, Andrew Tomkins, Da-Cheng Juan, and Tu Vu. [WikiSkill: Compiling Agent Experience into Persistent Knowledge for Skill Evolution](https://arxiv.org/abs/2608.27454), arXiv:2608.27454, 2026.

The paper is licensed under CC BY 4.0. This project's source code and original documentation are licensed under MIT. This project is not affiliated with or endorsed by Google Research.
