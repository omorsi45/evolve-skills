import os from "node:os";
import path from "node:path";

function codeUserRoots(context, extensionPath) {
  const { env, home, platform } = context;
  let bases;
  if (platform === "win32") {
    bases = ["Code", "Code - Insiders", "VSCodium"].map((name) =>
      path.join(env.APPDATA || path.join(home, "AppData", "Roaming"), name, "User"));
  } else if (platform === "darwin") {
    bases = ["Code", "Code - Insiders", "VSCodium"].map((name) =>
      path.join(home, "Library", "Application Support", name, "User"));
  } else {
    const config = env.XDG_CONFIG_HOME || path.join(home, ".config");
    bases = ["Code", "Code - Insiders", "VSCodium"].map((name) =>
      path.join(config, name, "User"));
  }
  return bases.map((base) => path.join(base, ...extensionPath));
}

function extensionMatcher(extensions) {
  const allowed = new Set(extensions.map((extension) => extension.toLowerCase()));
  return (file) => allowed.has(path.extname(file).toLowerCase());
}

const genericExportMatcher = extensionMatcher([".json", ".jsonl", ".md", ".txt"]);

const DEFINITIONS = [
  {
    id: "codex",
    name: "OpenAI Codex",
    discovery: "files",
    roots: ({ env, home }) => {
      const base = env.CODEX_HOME || path.join(home, ".codex");
      return [path.join(base, "sessions"), path.join(base, "archived_sessions")];
    },
    matches: extensionMatcher([".jsonl"]),
    location: "$CODEX_HOME/sessions and $CODEX_HOME/archived_sessions",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    discovery: "files",
    roots: ({ env, home }) => [path.join(env.CLAUDE_CONFIG_DIR || path.join(home, ".claude"), "projects")],
    matches: extensionMatcher([".jsonl"]),
    location: "$CLAUDE_CONFIG_DIR/projects or ~/.claude/projects",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    discovery: "files",
    roots: ({ env, home }) => [path.join(env.GEMINI_CLI_HOME || path.join(home, ".gemini"), "tmp")],
    matches: extensionMatcher([".json"]),
    location: "~/.gemini/tmp/<project-hash>/chats",
  },
  {
    id: "github-copilot-cli",
    name: "GitHub Copilot CLI",
    discovery: "files",
    roots: ({ home }) => [path.join(home, ".copilot", "session-state")],
    matches: extensionMatcher([".json", ".jsonl", ".md"]),
    location: "~/.copilot/session-state",
  },
  {
    id: "vscode-copilot",
    name: "GitHub Copilot Chat in VS Code",
    discovery: "files",
    roots: (context) => codeUserRoots(context, ["workspaceStorage"]),
    matches: (file) => /[\\/]chatSessions[\\/].*\.jsonl?$/i.test(file),
    location: "VS Code User/workspaceStorage/<workspace>/chatSessions",
  },
  {
    id: "kiro",
    name: "Kiro CLI",
    discovery: "files",
    roots: ({ env, home }) => [path.join(env.KIRO_HOME || path.join(home, ".kiro"), "sessions", "cli")],
    matches: extensionMatcher([".json", ".jsonl"]),
    location: "$KIRO_HOME/sessions/cli or ~/.kiro/sessions/cli for ACP sessions",
  },
  {
    id: "cline",
    name: "Cline",
    discovery: "files",
    roots: (context) => codeUserRoots(context, ["globalStorage", "saoudrizwan.claude-dev", "tasks"]),
    matches: (file) => /[\\/](api_conversation_history|ui_messages)\.json$/i.test(file),
    location: "VS Code User/globalStorage/saoudrizwan.claude-dev/tasks",
  },
  {
    id: "roo-code",
    name: "Roo Code",
    discovery: "files",
    roots: (context) => codeUserRoots(context, ["globalStorage", "rooveterinaryinc.roo-cline", "tasks"]),
    matches: (file) => /[\\/](api_conversation_history|ui_messages)\.json$/i.test(file),
    location: "VS Code User/globalStorage/rooveterinaryinc.roo-cline/tasks",
  },
  {
    id: "continue-cli",
    name: "Continue CLI",
    discovery: "files",
    roots: ({ env, home }) => [path.join(env.CONTINUE_GLOBAL_DIR || path.join(home, ".continue"), "sessions")],
    matches: extensionMatcher([".json", ".jsonl"]),
    location: "$CONTINUE_GLOBAL_DIR/sessions or ~/.continue/sessions",
  },
  {
    id: "aider",
    name: "Aider",
    discovery: "files",
    roots: ({ cwd }) => [path.join(cwd, ".aider.chat.history.md")],
    matches: (file) => path.basename(file).toLowerCase() === ".aider.chat.history.md",
    location: "<repository>/.aider.chat.history.md by default",
  },
  {
    id: "cursor",
    name: "Cursor",
    discovery: "export",
    roots: () => [],
    matches: genericExportMatcher,
    location: "Local SQLite storage; export chats to files before scanning",
    instructions: "Export the relevant Cursor chats, then configure that export directory with --root cursor=<path>.",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    discovery: "export",
    roots: () => [],
    matches: genericExportMatcher,
    location: "Use Windsurf's supported conversation export workflow",
    instructions: "Export the relevant Windsurf conversations, then configure that export directory with --root windsurf=<path>.",
  },
  {
    id: "opencode",
    name: "OpenCode",
    discovery: "export",
    roots: () => [],
    matches: genericExportMatcher,
    location: "Local application data, commonly SQLite in current releases",
    instructions: "Run opencode export for the relevant sessions, then configure the export directory with --root opencode=<path>.",
  },
  {
    id: "goose",
    name: "Goose",
    discovery: "export",
    roots: () => [],
    matches: genericExportMatcher,
    location: "Local SQLite session storage",
    instructions: "Export or save the relevant Goose sessions as files, then configure that directory with --root goose=<path>.",
  },
  {
    id: "amp",
    name: "Amp",
    discovery: "export",
    roots: () => [],
    matches: genericExportMatcher,
    location: "Cloud-backed threads through the Amp CLI",
    instructions: "Use amp threads markdown or amp threads export, then configure the export directory with --root amp=<path>.",
  },
  {
    id: "zed",
    name: "Zed Agent Panel",
    discovery: "export",
    roots: () => [],
    matches: genericExportMatcher,
    location: "Local thread database with editor-supported Markdown export",
    instructions: "Export the relevant Zed threads as Markdown, then configure that directory with --root zed=<path>.",
  },
];

function context(overrides = {}) {
  return {
    env: overrides.env || process.env,
    home: overrides.home || os.homedir(),
    cwd: overrides.cwd || process.cwd(),
    platform: overrides.platform || process.platform,
  };
}

export function harness(id, overrides = {}) {
  const definition = DEFINITIONS.find((item) => item.id === id);
  if (!definition) {
    return undefined;
  }
  const current = context(overrides);
  return {
    ...definition,
    default_roots: definition.roots(current).map((root) => path.resolve(root)),
  };
}

export function harnesses(overrides = {}) {
  return DEFINITIONS.map((definition) => {
    const resolved = harness(definition.id, overrides);
    return {
      id: resolved.id,
      name: resolved.name,
      discovery: resolved.discovery,
      location: resolved.location,
      default_roots: resolved.default_roots,
      ...(resolved.instructions ? { instructions: resolved.instructions } : {}),
    };
  });
}

export function matchesTranscript(id, file) {
  const definition = DEFINITIONS.find((item) => item.id === id);
  return Boolean(definition?.matches(file));
}
