---
name: evolve-skills
description: Evolve a specific Agent Skill from real execution traces using a persistent WikiSkill-style knowledge base. Use when a user asks to evolve, improve, or learn from runs of a named skill, or requests WikiSkill-based skill evolution.
license: MIT
metadata:
  version: "1.1.0"
---

# Evolve Skills

Evolve one existing Agent Skill at a time. Keep its raw experience, persistent wiki, proposals, and decision history inside that target skill's stable `evolution/` directory. Never create a central copy of every target skill.

The bundled CLI requires Node.js 20 or newer and filesystem access to the target skill. Direct discovery supports file-backed agents. Database and cloud-backed agents require a transcript export.

## Non-negotiable boundaries

- Target only the skill the user named. Resolve ambiguity before changing another skill.
- Never evolve this `evolve-skills` skill unless the user explicitly names it as the target.
- Never let an inference run of the target skill read `evolution/`. That leaks optimizer knowledge into execution and weakens the evidence.
- Treat raw traces as local and sensitive. Read `references/privacy.md` before ingesting or publishing traces.
- Produce at most one contiguous `SKILL.md` change per proposal.
- Do not edit the live `SKILL.md` during analysis or proposal creation.
- Apply no proposal without explicit human approval.
- In evaluated mode, apply only when the candidate score is strictly greater than the baseline score.
- Preserve the wiki after both accepted and rejected proposals.

## Run the workflow

Locate this skill's directory, then invoke its CLI as:

```text
node <evolve-skills-dir>/scripts/evolve.mjs <command> <target-skill-dir> [options]
```

1. Confirm that `<target-skill-dir>/SKILL.md` exists and its frontmatter `name` matches the directory name. Read the target's `SKILL.md` and `PURPOSE.md` if present.

2. Choose the mode:
   - Use `evaluated` when a repeatable validation set and comparable numeric score exist.
   - Use `observational` when evidence comes from real work sessions without a reliable benchmark. State that this mode supports evidence-based review, not a measured performance claim.

3. Initialize once. Re-running this command reuses the same tree and does not overwrite its mode or history.

```text
node <evolve-skills-dir>/scripts/evolve.mjs init <target-skill-dir> --mode observational
```

4. Configure transcript sources once per target skill. If `evolution/sources.local.json` does not exist, ask the user this question and wait for the answer:

```text
Which coding agents do you use? List all that apply, such as Codex, Claude Code, Gemini CLI, GitHub Copilot, Kiro, Cursor, Windsurf, Cline, Roo Code, Continue, Aider, OpenCode, Goose, Amp, or Zed.
```

List all supported identifiers when needed:

```text
node <evolve-skills-dir>/scripts/evolve.mjs harnesses
```

Persist the user's selection locally. Repeat `--harness` for every agent. Use `--root <harness>=<path>` only to override discovery or point an export-backed agent at an export directory.

```text
node <evolve-skills-dir>/scripts/evolve.mjs configure <target-skill-dir> --harness codex --harness claude-code
```

Do not ask again while the local source state exists unless the user wants to change agents or a configured source is no longer valid. This file contains machine-specific paths and is ignored by Git.

5. Discover only transcripts newer than that source's checkpoint. If a source has no checkpoint yet, scanning starts at the target skill's last recorded evolution decision. If neither exists, it starts at the beginning. `scan` reads directory metadata, not transcript contents, and does not advance any checkpoint.

```text
node <evolve-skills-dir>/scripts/evolve.mjs scan <target-skill-dir> --json
```

Use `--rescan-all` only when the user intentionally requests historical reprocessing. For a source reported as `export_required`, follow its native export instruction and configure the exported directory. Never read or copy a live SQLite database.

6. Review only the returned candidates while `evolution/` is excluded from the inference context. Require positive evidence that the target skill ran, such as a structured activation record, loaded `SKILL.md` path, or explicit invocation supported by the surrounding run. A name mention alone is not evidence. Read `references/trace-sources.md` before matching or adapting a source.

Export each selected run to a local trace file without rewriting its contents, then ingest it with its provenance and outcome:

```text
node <evolve-skills-dir>/scripts/evolve.mjs ingest <target-skill-dir> --trace <trace-file> --source <adapter-or-manual> --outcome pass
```

After every candidate from one source was successfully inspected and either ingested or explicitly excluded, advance only that source through the exact `scan_started_at` returned by `scan`:

```text
node <evolve-skills-dir>/scripts/evolve.mjs checkpoint <target-skill-dir> --harness codex --through <scan_started_at>
```

Do not checkpoint a source when discovery, inspection, matching, or ingestion failed. Content hashing still deduplicates traces if a safe retry sees the same run again.

7. Act as the Wiki Maintainer in a fresh context when the runtime supports it. Read the existing wiki and a stratified sample of up to five failing and three passing traces, capped at 15,000 characters per trace. Consolidate recurring, generalizable causes and strategies into `evolution/wiki/patterns/`. Update `index.md` and append an iteration summary to `log.md`. Do not duplicate an existing pattern.

8. Act as the Skill Proposer in another fresh context when possible. Read `wiki/index.md`, `wiki/skill-impact.md`, relevant pattern pages, and at least four traces before proposing a change. Prefer a narrow patch to the existing skill. Create a candidate file outside the live `SKILL.md`, then register it:

```text
node <evolve-skills-dir>/scripts/evolve.mjs propose <target-skill-dir> --candidate <candidate-SKILL.md> --pattern <pattern-id> --notes <evidence-summary>
```

9. Review the stored candidate and patch with the user. For evaluated mode, run the same validation set against the unchanged baseline and candidate. Do not reuse non-comparable scores.

10. After explicit approval, apply through the gate:

```text
# Observational
node <evolve-skills-dir>/scripts/evolve.mjs apply <target-skill-dir> --proposal 0001 --approved

# Evaluated
node <evolve-skills-dir>/scripts/evolve.mjs apply <target-skill-dir> --proposal 0001 --approved --score-before 0.72 --score-after 0.79
```

If the evidence or evaluation does not support the proposal, reject it without touching the live skill:

```text
node <evolve-skills-dir>/scripts/evolve.mjs reject <target-skill-dir> --proposal 0001 --reason <reason>
```

If no safe, useful change is warranted, record that outcome instead of forcing an edit:

```text
node <evolve-skills-dir>/scripts/evolve.mjs no-action <target-skill-dir> --reason <reason>
```

11. Finish by checking the colocated state, last evolution date, per-agent scan checkpoints, and content hashes:

```text
node <evolve-skills-dir>/scripts/evolve.mjs verify <target-skill-dir>
node <evolve-skills-dir>/scripts/evolve.mjs status <target-skill-dir>
```

Read `references/method.md` when maintaining the wiki or proposing a change. Read `references/state-layout.md` when operating or debugging the CLI. Read `references/trace-sources.md` when integrating a new harness or transcript format.
