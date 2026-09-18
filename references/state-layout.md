# State layout and CLI

Each target skill owns exactly one reusable evolution tree:

```text
target-skill/
  SKILL.md
  PURPOSE.md
  evolution/
    config.json
    sources.local.json       # machine-local, ignored by Git
    RUNS.tsv
    DO-NOT-READ.md
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

`init` creates missing files only. Later runs reuse these directories and append records instead of creating another target folder.

## Commands

```text
evolve-skills init <skill> [--mode observational|evaluated]
evolve-skills harnesses [--json]
evolve-skills configure <skill> --harness <id> [--harness <id> ...] [--root <id>=<path> ...]
evolve-skills scan <skill> [--harness <id> ...] [--since <ISO-8601> | --rescan-all] [--json]
evolve-skills checkpoint <skill> --harness <id> [--harness <id> ...] --through <scan-started-at>
evolve-skills ingest <skill> --trace <file> [--source manual] [--outcome pass|fail|unknown]
evolve-skills status <skill> [--json]
evolve-skills propose <skill> --candidate <file> --pattern <id> --notes <text>
evolve-skills apply <skill> --proposal <id> --approved [--score-before <n> --score-after <n>]
evolve-skills reject <skill> --proposal <id> --reason <text>
evolve-skills no-action <skill> --reason <text>
evolve-skills verify <skill> [--json]
```

Prefix each command with `node <evolve-skills-dir>/scripts/evolve.mjs` when the package is not installed as a command.

## State rules

- `config.json` fixes the mode on first initialization. A later `init` does not silently change it.
- `sources.local.json` stores the user's selected coding agents, resolved transcript roots, and an independent `last_scanned_at` checkpoint for each agent. It is not shared or committed.
- A source with no checkpoint starts at the latest date in `RUNS.tsv`. A new skill with neither value scans all available history once.
- `scan` returns files modified after the source cutoff and no later than its own `scan_started_at`. It never advances state.
- `checkpoint` advances only the named sources after their returned candidates were processed successfully. It cannot move a checkpoint backward.
- `raw/MANIFEST.tsv` deduplicates traces by SHA-256 and records byte length, source, outcome, relative file, and ingestion time.
- `RUNS.tsv` is append-only and records apply, reject, and no-action decisions.
- Proposal metadata moves from `pending` to `applied` or `rejected` once. A stale live-skill hash blocks apply.
- `verify` checks schema, mode, target name, trace hashes and byte counts, proposal files, statuses, and candidate hashes.
- `raw/traces/`, `raw/digests/`, and `sources.local.json` are ignored by the target's local `evolution/.gitignore`.
