# Transcript sources and adapters

The CLI keeps per-target source selection and checkpoints in `evolution/sources.local.json`. The file is local because agent choices, home directories, and export locations differ across machines.

## Supported coding agents

Run `evolve-skills harnesses` for the paths resolved on the current machine. Environment variables and platform-specific user data directories are applied at runtime.

| Identifier | Agent | Discovery | Default source |
|---|---|---|---|
| `codex` | OpenAI Codex | files | `$CODEX_HOME/sessions` and `$CODEX_HOME/archived_sessions`, normally under `~/.codex` |
| `claude-code` | Claude Code | files | `$CLAUDE_CONFIG_DIR/projects`, normally `~/.claude/projects` |
| `gemini-cli` | Gemini CLI | files | `~/.gemini/tmp/<project-hash>/chats` |
| `github-copilot-cli` | GitHub Copilot CLI | files | `~/.copilot/session-state` |
| `vscode-copilot` | GitHub Copilot Chat in VS Code | files | VS Code `User/workspaceStorage/<workspace>/chatSessions` |
| `kiro` | Kiro CLI | files | `$KIRO_HOME/sessions/cli`, normally `~/.kiro/sessions/cli`, for ACP session files |
| `cline` | Cline | files | VS Code `User/globalStorage/saoudrizwan.claude-dev/tasks` |
| `roo-code` | Roo Code | files | VS Code `User/globalStorage/rooveterinaryinc.roo-cline/tasks` |
| `continue-cli` | Continue CLI | files | `$CONTINUE_GLOBAL_DIR/sessions`, normally `~/.continue/sessions` |
| `aider` | Aider | files | `<repository>/.aider.chat.history.md` by default |
| `cursor` | Cursor | export | Export chats, then configure the export directory |
| `windsurf` | Windsurf | export | Export conversations, then configure the export directory |
| `opencode` | OpenCode | export | Use `opencode export`, then configure the export directory |
| `goose` | Goose | export | Export or save sessions, then configure the export directory |
| `amp` | Amp | export | Use `amp threads markdown` or `amp threads export` |
| `zed` | Zed Agent Panel | export | Export the thread as Markdown |

File discovery is based on documented storage where a harness exposes ordinary session files. Database and cloud-backed sources are deliberately export-only. Do not copy or query a live application database, because its schema and locking behavior are private implementation details.

Useful upstream references include [Codex troubleshooting](https://developers.openai.com/es-419/docs/reference/troubleshooting), [Claude Code's `.claude` directory](https://code.claude.com/docs/en/claude-directory), [Gemini CLI session management](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/session-management.md), [GitHub Copilot CLI chronicle](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/chronicle), [Kiro session management](https://kiro.dev/docs/cli/chat/session-management/), [Kiro ACP sessions](https://kiro.dev/docs/cli/acp/), [Aider configuration](https://aider.chat/docs/config/aider_conf.html), and [Amp threads](https://ampcode.com/docs/threads).

## Incremental scan contract

For each configured agent, `scan` chooses its lower bound in this order:

1. `--rescan-all`, which intentionally removes the lower bound;
2. an explicit `--since <ISO-8601>` value;
3. that agent's `last_scanned_at` checkpoint;
4. the target skill's last decision date in `RUNS.tsv`;
5. the beginning of available history.

The upper bound is `scan_started_at`, captured before file enumeration. A candidate must have a modification time strictly after the lower bound and at or before the upper bound. This includes an old session file that was appended after the checkpoint without rereading unchanged older files.

`scan` never changes the checkpoint. After successful processing, call `checkpoint --through <scan_started_at>`. If processing fails, leave the checkpoint unchanged and retry safely. Trace content hashes provide a second deduplication layer.

## Match requirements

Ingest a run only when at least one reliable marker shows that the target skill was active:

- a structured skill activation event;
- the exact loaded path to the target's `SKILL.md`;
- an explicit command naming the skill, supported by the surrounding run;
- harness metadata that identifies the skill by its exact name.

A casual mention of the skill name is not enough. Record ambiguous runs as excluded in `wiki/log.md`, not as evidence.

## Adapter contract

For every selected execution, produce:

- an immutable local file containing the original trace or a faithful harness export;
- a short source identifier with no tabs or newlines, such as `codex-session-export`;
- an outcome of `pass`, `fail`, or `unknown` based on explicit task evidence;
- enough provenance outside sensitive content to find the source again when authorized.

Call `ingest` once per file. Content hashing deduplicates the same run across repeated scans. Do not build another central archive because the target's `evolution/raw/` directory is the archive.

## Outcome classification

Use `pass` only when the requested result was completed and verified. Use `fail` for an explicit error, incorrect result, abandoned workflow, or unmet acceptance criterion. Use `unknown` when the transcript lacks enough evidence. Do not convert `unknown` into `pass` merely because no error was printed.

Apply the privacy rules in `privacy.md` before exporting from any source.
