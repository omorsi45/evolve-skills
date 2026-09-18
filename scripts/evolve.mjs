#!/usr/bin/env node

import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { harness, harnesses, matchesTranscript } from "./harnesses.mjs";

const MANIFEST_HEADER = "# sha256\tbytes\tsource\toutcome\ttrace_file\tingested_at\n";
const RUNS_HEADER = "# run\tdate\tmode\tnew_traces\tproposal\tdecision\n";

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exitCode = code;
}

function option(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

function options(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name) {
      if (args[index + 1] === undefined) {
        throw new Error(`${name} requires a value`);
      }
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function normalizeDate(value, name) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${name} must be an ISO 8601 date`);
  }
  return new Date(timestamp).toISOString();
}

function ensureLine(file, line) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = current.split(/\r?\n/);
  if (!lines.includes(line)) {
    const ending = current.includes("\r\n") ? "\r\n" : "\n";
    writeFileSync(
      file,
      `${current}${current && !current.endsWith("\n") ? ending : ""}${line}${ending}`,
      "utf8",
    );
  }
}

function writeIfMissing(file, content) {
  if (!existsSync(file)) {
    writeFileSync(file, content, "utf8");
  }
}

function assertSkill(skillDir) {
  const resolved = path.resolve(skillDir);
  const skillMd = path.join(resolved, "SKILL.md");
  if (!existsSync(skillMd)) {
    throw new Error(`target is not an Agent Skill: missing ${skillMd}`);
  }
  const expectedName = path.basename(resolved);
  if (frontmatterName(readFileSync(skillMd, "utf8")) !== expectedName) {
    throw new Error(`SKILL.md frontmatter name must match target directory: ${expectedName}`);
  }
  return resolved;
}

function assertEvolution(skillDir) {
  const evolution = path.join(skillDir, "evolution");
  if (!existsSync(path.join(evolution, "config.json"))) {
    throw new Error(`evolution state is not initialized; run init for ${skillDir}`);
  }
  return evolution;
}

function safeField(value, name) {
  if (value.includes("\t") || value.includes("\r") || value.includes("\n")) {
    throw new Error(`${name} must not contain tabs or newlines`);
  }
  return value;
}

function init(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const mode = option(args, "--mode", "observational");
  if (!new Set(["observational", "evaluated"]).has(mode)) {
    throw new Error("--mode must be observational or evaluated");
  }

  const evolution = path.join(skillDir, "evolution");
  for (const relative of [
    "raw/traces",
    "raw/digests",
    "wiki/patterns",
    "proposals",
  ]) {
    mkdirSync(path.join(evolution, relative), { recursive: true });
  }

  writeIfMissing(
    path.join(evolution, "config.json"),
    `${JSON.stringify({
      schema_version: 1,
      mode,
      privacy: {
        raw_traces: "local-only",
        publish_wiki: false,
      },
    }, null, 2)}\n`,
  );
  writeIfMissing(path.join(evolution, "RUNS.tsv"), RUNS_HEADER);
  writeIfMissing(path.join(evolution, "raw", "MANIFEST.tsv"), MANIFEST_HEADER);
  writeIfMissing(path.join(evolution, "wiki", "index.md"), "# Pattern index\n");
  writeIfMissing(path.join(evolution, "wiki", "log.md"), "# Evolution log\n");
  writeIfMissing(path.join(evolution, "wiki", "skill-impact.md"), "# Skill impact\n");
  writeIfMissing(
    path.join(evolution, "DO-NOT-READ.md"),
    "# Evolution-only state\n\nDo not read this directory while executing the target skill. It is input to the Wiki Maintainer and Skill Proposer only.\n",
  );
  writeIfMissing(
    path.join(evolution, ".gitignore"),
    "raw/traces/*\nraw/digests/*\nsources.local.json\n",
  );
  ensureLine(path.join(evolution, ".gitignore"), "sources.local.json");
  writeIfMissing(
    path.join(skillDir, "PURPOSE.md"),
    `# ${path.basename(skillDir)} purpose\n\n## Contract\n\nDescribe what this skill must accomplish, its boundaries, and its non-goals. Evolution proposals should preserve this contract.\n\n## Evolution history\n`,
  );

  const storedConfig = JSON.parse(readFileSync(path.join(evolution, "config.json"), "utf8"));
  process.stdout.write(`${JSON.stringify({ skill: skillDir, evolution, mode: storedConfig.mode })}\n`);
}

function ingest(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  const traceArg = option(args, "--trace");
  if (!traceArg) {
    throw new Error("ingest requires --trace <path>");
  }
  const trace = path.resolve(traceArg);
  if (!existsSync(trace)) {
    throw new Error(`trace does not exist: ${trace}`);
  }
  const source = safeField(option(args, "--source", "manual"), "--source");
  const outcome = safeField(option(args, "--outcome", "unknown"), "--outcome");
  if (!new Set(["pass", "fail", "unknown"]).has(outcome)) {
    throw new Error("--outcome must be pass, fail, or unknown");
  }

  const bytes = readFileSync(trace);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const manifest = path.join(evolution, "raw", "MANIFEST.tsv");
  const seen = readFileSync(manifest, "utf8")
    .split("\n")
    .some((line) => line.startsWith(`${sha}\t`));
  if (seen) {
    process.stdout.write(`${JSON.stringify({ status: "seen", sha256: sha })}\n`);
    return;
  }

  const extension = path.extname(trace) || ".trace";
  const relative = path.posix.join("raw", "traces", `${sha}${extension}`);
  copyFileSync(trace, path.join(evolution, ...relative.split("/")));
  appendFileSync(
    manifest,
    [sha, bytes.length, source, outcome, relative, new Date().toISOString()].join("\t") + "\n",
    "utf8",
  );
  process.stdout.write(`${JSON.stringify({ status: "ingested", sha256: sha, trace_file: relative })}\n`);
}

function dataRows(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"));
}

function lastEvolvedAt(evolution) {
  const rows = dataRows(path.join(evolution, "RUNS.tsv"));
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = rows[index].split("\t")[1];
    if (value && Number.isFinite(Date.parse(value))) {
      return new Date(Date.parse(value)).toISOString();
    }
  }
  return null;
}

function sourcesFile(evolution) {
  return path.join(evolution, "sources.local.json");
}

function readSources(evolution) {
  const file = sourcesFile(evolution);
  if (!existsSync(file)) {
    return { schema_version: 1, harnesses: {} };
  }
  const state = JSON.parse(readFileSync(file, "utf8"));
  if (state.schema_version !== 1 || !state.harnesses || typeof state.harnesses !== "object") {
    throw new Error(`invalid local source state: ${file}`);
  }
  return state;
}

function writeSources(evolution, state) {
  writeFileSync(
    sourcesFile(evolution),
    `${JSON.stringify({ ...state, updated_at: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
}

function listHarnesses(args) {
  const result = harnesses();
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  for (const item of result) {
    process.stdout.write(`${item.id}\t${item.discovery}\t${item.name}\t${item.location}\n`);
  }
}

function configureSources(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  const selected = [...new Set(options(args, "--harness"))];
  if (selected.length === 0) {
    throw new Error("configure requires at least one --harness <id>");
  }
  for (const id of selected) {
    if (!harness(id)) {
      throw new Error(`unknown harness: ${id}; run harnesses to list supported agents`);
    }
  }

  const roots = new Map();
  for (const value of options(args, "--root")) {
    const separator = value.indexOf("=");
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error("--root must use <harness>=<path>");
    }
    const id = value.slice(0, separator);
    const root = value.slice(separator + 1);
    if (!selected.includes(id)) {
      throw new Error(`--root names an unselected harness: ${id}`);
    }
    roots.set(id, [...(roots.get(id) || []), path.resolve(root)]);
  }

  const previous = readSources(evolution);
  const configuredAt = new Date().toISOString();
  const configured = {};
  for (const id of selected) {
    const definition = harness(id);
    const old = previous.harnesses[id];
    configured[id] = {
      roots: roots.has(id) ? roots.get(id) : old?.roots || definition.default_roots,
      last_scanned_at: old?.last_scanned_at || null,
      configured_at: old?.configured_at || configuredAt,
    };
  }
  writeSources(evolution, { schema_version: 1, harnesses: configured });
  process.stdout.write(`${JSON.stringify({ skill: skillDir, harnesses: selected })}\n`);
}

function scanRoot(root, harnessId, cutoffMs, throughMs) {
  const candidates = [];
  const errors = [];
  const resolvedRoot = path.resolve(root);
  if (!existsSync(resolvedRoot)) {
    return { candidates, missing: resolvedRoot, errors };
  }

  const consider = (file) => {
    if (!matchesTranscript(harnessId, file)) {
      return;
    }
    try {
      const details = statSync(file);
      if (!details.isFile() || details.size === 0) {
        return;
      }
      if (details.mtimeMs > cutoffMs && details.mtimeMs <= throughMs) {
        candidates.push({
          path: path.resolve(file),
          modified_at: details.mtime.toISOString(),
          bytes: details.size,
        });
      }
    } catch (error) {
      errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  try {
    const rootDetails = statSync(resolvedRoot);
    if (rootDetails.isFile()) {
      consider(resolvedRoot);
      return { candidates, errors };
    }
  } catch (error) {
    errors.push(`${resolvedRoot}: ${error instanceof Error ? error.message : String(error)}`);
    return { candidates, errors };
  }

  const pending = [resolvedRoot];
  while (pending.length > 0) {
    const directory = pending.pop();
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          pending.push(file);
        } else if (entry.isFile()) {
          consider(file);
        }
      }
    } catch (error) {
      errors.push(`${directory}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { candidates, errors };
}

function scanSources(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  const state = readSources(evolution);
  const requested = options(args, "--harness");
  const selected = requested.length > 0 ? [...new Set(requested)] : Object.keys(state.harnesses);
  if (selected.length === 0) {
    throw new Error("no coding agents are configured; ask which agents the user uses, then run configure");
  }
  for (const id of selected) {
    if (!state.harnesses[id]) {
      throw new Error(`harness is not configured for this skill: ${id}`);
    }
  }
  if (args.includes("--rescan-all") && option(args, "--since") !== undefined) {
    throw new Error("use either --rescan-all or --since, not both");
  }

  const lastEvolution = lastEvolvedAt(evolution);
  const scanStartedAt = new Date().toISOString();
  const throughMs = Date.parse(scanStartedAt);
  const sinceArg = option(args, "--since");
  const explicitSince = sinceArg === undefined || sinceArg === "last-evolution"
    ? undefined
    : normalizeDate(sinceArg, "--since");
  const results = [];

  for (const id of selected) {
    const definition = harness(id);
    const source = state.harnesses[id];
    const since = args.includes("--rescan-all")
      ? null
      : explicitSince || source.last_scanned_at || lastEvolution;
    const cutoffMs = since ? Date.parse(since) : Number.NEGATIVE_INFINITY;
    const roots = source.roots.map((root) => path.resolve(root));
    if (roots.length === 0) {
      results.push({
        id,
        name: definition.name,
        status: "export_required",
        since,
        roots,
        candidates: [],
        instructions: definition.instructions,
      });
      continue;
    }

    const candidates = [];
    const missing_roots = [];
    const errors = [];
    for (const root of roots) {
      const scanned = scanRoot(root, id, cutoffMs, throughMs);
      candidates.push(...scanned.candidates);
      if (scanned.missing) {
        missing_roots.push(scanned.missing);
      }
      errors.push(...scanned.errors);
    }
    candidates.sort((left, right) => left.path.localeCompare(right.path));
    results.push({
      id,
      name: definition.name,
      status: "ready",
      since,
      roots,
      candidates,
      missing_roots,
      errors,
    });
  }

  const result = {
    skill: skillDir,
    last_evolved_at: lastEvolution,
    scan_started_at: scanStartedAt,
    harnesses: results,
  };
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  process.stdout.write(`${path.basename(skillDir)}: last evolved ${lastEvolution || "never"}\n`);
  for (const source of results) {
    process.stdout.write(
      source.status === "export_required"
        ? `${source.id}: export required. ${source.instructions}\n`
        : `${source.id}: ${source.candidates.length} candidate transcript(s) since ${source.since || "the beginning"}\n`,
    );
  }
  process.stdout.write(`Checkpoint successful processing through ${scanStartedAt}.\n`);
}

function checkpointSources(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  const state = readSources(evolution);
  const selected = [...new Set(options(args, "--harness"))];
  if (selected.length === 0) {
    throw new Error("checkpoint requires at least one --harness <id>");
  }
  const throughArg = option(args, "--through");
  if (!throughArg) {
    throw new Error("checkpoint requires --through <scan-started-at>");
  }
  const through = normalizeDate(throughArg, "--through");
  for (const id of selected) {
    const source = state.harnesses[id];
    if (!source) {
      throw new Error(`harness is not configured for this skill: ${id}`);
    }
    if (source.last_scanned_at && Date.parse(through) < Date.parse(source.last_scanned_at)) {
      throw new Error(`checkpoint cannot move backward for ${id}`);
    }
  }
  for (const id of selected) {
    state.harnesses[id].last_scanned_at = through;
  }
  writeSources(evolution, state);
  process.stdout.write(`${JSON.stringify({ skill: skillDir, harnesses: selected, through })}\n`);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function lineEndingProfile(text) {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/(?<!\r)\n/g) || []).length;
  return crlf > 0 && lf === 0 ? "crlf" : crlf === 0 ? "lf" : "mixed";
}

function frontmatterName(text) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1];
  const value = block
    ?.split(/\r?\n/)
    .map((line) => /^name:\s*(.*?)\s*$/.exec(line)?.[1])
    .find((name) => name !== undefined);
  if (!value) {
    return undefined;
  }
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
}

function diffOperations(beforeLines, afterLines) {
  const rows = beforeLines.length + 1;
  const columns = afterLines.length + 1;
  const lcs = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (let i = beforeLines.length - 1; i >= 0; i -= 1) {
    for (let j = afterLines.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = beforeLines[i] === afterLines[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const operations = [];
  let i = 0;
  let j = 0;
  while (i < beforeLines.length || j < afterLines.length) {
    if (i < beforeLines.length && j < afterLines.length && beforeLines[i] === afterLines[j]) {
      operations.push({ type: "equal", line: beforeLines[i] });
      i += 1;
      j += 1;
    } else if (j < afterLines.length && (i === beforeLines.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      operations.push({ type: "insert", line: afterLines[j] });
      j += 1;
    } else {
      operations.push({ type: "delete", line: beforeLines[i] });
      i += 1;
    }
  }
  return operations;
}

function proposalPatch(before, after) {
  if (before === after) {
    throw new Error("candidate does not change SKILL.md");
  }
  if (lineEndingProfile(before) !== lineEndingProfile(after)) {
    throw new Error("candidate changes the SKILL.md line-ending profile");
  }
  const a = before.replaceAll("\r\n", "\n").split("\n");
  const b = after.replaceAll("\r\n", "\n").split("\n");
  const operations = diffOperations(a, b);
  let groups = 0;
  let inChange = false;
  for (const operation of operations) {
    if (operation.type === "equal") {
      inChange = false;
    } else if (!inChange) {
      groups += 1;
      inChange = true;
    }
  }
  if (groups !== 1) {
    throw new Error("candidate must contain exactly one contiguous change");
  }

  const firstChange = operations.findIndex((operation) => operation.type !== "equal");
  let lastChange = operations.length - 1;
  while (operations[lastChange].type === "equal") {
    lastChange -= 1;
  }
  const beforeChange = operations.slice(0, firstChange);
  const changed = operations.slice(firstChange, lastChange + 1);
  const oldStart = beforeChange.filter((operation) => operation.type !== "insert").length + 1;
  const newStart = beforeChange.filter((operation) => operation.type !== "delete").length + 1;
  const removed = changed.filter((operation) => operation.type === "delete").map((operation) => operation.line);
  const added = changed.filter((operation) => operation.type === "insert").map((operation) => operation.line);
  const lines = [
    "--- SKILL.md",
    "+++ SKILL.candidate.md",
    `@@ -${oldStart},${removed.length} +${newStart},${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
    "",
  ];
  return lines.join("\n");
}

function status(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  const config = JSON.parse(readFileSync(path.join(evolution, "config.json"), "utf8"));
  const counts = { total: 0, pass: 0, fail: 0, unknown: 0 };
  for (const row of dataRows(path.join(evolution, "raw", "MANIFEST.tsv"))) {
    const fields = row.split("\t");
    const outcome = fields[3];
    counts.total += 1;
    if (Object.hasOwn(counts, outcome) && outcome !== "total") {
      counts[outcome] += 1;
    }
  }
  const patternDir = path.join(evolution, "wiki", "patterns");
  const patterns = readdirSync(patternDir).filter((name) => name.endsWith(".md")).length;
  const sourceState = readSources(evolution);
  const sources = Object.entries(sourceState.harnesses).map(([id, source]) => ({
    id,
    last_scanned_at: source.last_scanned_at || null,
    roots: source.roots,
  }));
  const result = {
    skill: skillDir,
    mode: config.mode,
    traces: counts,
    patterns,
    last_evolved_at: lastEvolvedAt(evolution),
    sources,
  };
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stdout.write(
      `${path.basename(skillDir)}: ${counts.total} traces (${counts.fail} fail, ${counts.pass} pass, ${counts.unknown} unknown), ${patterns} patterns, mode=${config.mode}, last evolved=${result.last_evolved_at || "never"}\n`,
    );
  }
}

function nextProposalId(proposalsDir) {
  const ids = readdirSync(proposalsDir)
    .map((name) => /^(\d{4})\.json$/.exec(name)?.[1])
    .filter(Boolean)
    .map(Number);
  return String((ids.length ? Math.max(...ids) : 0) + 1).padStart(4, "0");
}

function proposalFiles(evolution, args) {
  const id = option(args, "--proposal");
  if (!id || !/^\d{4}$/.test(id)) {
    throw new Error("command requires --proposal <four-digit-id>");
  }
  const base = path.join(evolution, "proposals", id);
  const metadataFile = `${base}.json`;
  const candidateFile = `${base}.candidate.md`;
  if (!existsSync(metadataFile) || !existsSync(candidateFile)) {
    throw new Error(`proposal does not exist: ${id}`);
  }
  const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
  if (metadata.id !== id) {
    throw new Error(`proposal id does not match its filename: ${id}`);
  }
  return { id, base, metadataFile, candidateFile, metadata };
}

function recordDecision(evolution, config, proposal, decision) {
  const runsFile = path.join(evolution, "RUNS.tsv");
  const run = String(dataRows(runsFile).length + 1).padStart(4, "0");
  const date = new Date().toISOString();
  appendFileSync(
    runsFile,
    [run, date, config.mode, proposal.trace_count ?? 0, proposal.id, decision].join("\t") + "\n",
    "utf8",
  );
  appendFileSync(
    path.join(evolution, "wiki", "skill-impact.md"),
    `\n## ${date} ${decision} ${proposal.id}\n\n- Pattern: \`${proposal.pattern}\`\n- Notes: ${proposal.notes}\n`,
    "utf8",
  );
}

function evaluatedScores(config, args) {
  if (config.mode !== "evaluated") {
    return undefined;
  }
  const beforeRaw = option(args, "--score-before");
  const afterRaw = option(args, "--score-after");
  if (beforeRaw === undefined || afterRaw === undefined) {
    throw new Error("evaluated mode requires --score-before and --score-after");
  }
  const before = Number(beforeRaw);
  const after = Number(afterRaw);
  if (!Number.isFinite(before) || !Number.isFinite(after)) {
    throw new Error("evaluation scores must be finite numbers");
  }
  if (after <= before) {
    throw new Error("evaluated proposal must improve the score");
  }
  return { before, after };
}

function updatePurpose(skillDir, proposal) {
  const purposeFile = path.join(skillDir, "PURPOSE.md");
  let content = readFileSync(purposeFile, "utf8");
  if (!/^## Evolution history\s*$/m.test(content)) {
    content = `${content.trimEnd()}\n\n## Evolution history\n`;
  }
  const notes = proposal.notes.replace(/\s+/g, " ").trim();
  content = `${content.trimEnd()}\n\n- ${proposal.applied_at}: proposal ${proposal.id}, pattern \`${proposal.pattern}\`. ${notes}\n`;
  writeFileSync(purposeFile, content, "utf8");
}

function propose(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  const candidateArg = option(args, "--candidate");
  const pattern = safeField(option(args, "--pattern", ""), "--pattern");
  const notes = option(args, "--notes", "");
  if (!candidateArg) {
    throw new Error("propose requires --candidate <SKILL.md>");
  }
  if (!pattern) {
    throw new Error("propose requires --pattern <pattern-id>");
  }
  if (!notes.trim()) {
    throw new Error("propose requires --notes <text>");
  }
  const candidateFile = path.resolve(candidateArg);
  if (!existsSync(candidateFile)) {
    throw new Error(`candidate does not exist: ${candidateFile}`);
  }

  const liveFile = path.join(skillDir, "SKILL.md");
  const before = readFileSync(liveFile, "utf8");
  const after = readFileSync(candidateFile, "utf8");
  const expectedName = path.basename(skillDir);
  if (frontmatterName(before) !== expectedName || frontmatterName(after) !== expectedName) {
    throw new Error(`SKILL.md frontmatter name must remain ${expectedName}`);
  }
  const patch = proposalPatch(before, after);
  const proposalsDir = path.join(evolution, "proposals");
  const id = nextProposalId(proposalsDir);
  const base = path.join(proposalsDir, id);
  const metadata = {
    schema_version: 1,
    id,
    created_at: new Date().toISOString(),
    pattern,
    notes,
    status: "pending",
    before_sha256: sha256(before),
    after_sha256: sha256(after),
    trace_count: dataRows(path.join(evolution, "raw", "MANIFEST.tsv")).length,
  };
  writeFileSync(`${base}.candidate.md`, after, "utf8");
  writeFileSync(`${base}.patch`, patch, "utf8");
  writeFileSync(`${base}.json`, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ proposal: id, status: "pending" })}\n`);
}

function applyProposal(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  if (!args.includes("--approved")) {
    throw new Error("apply requires explicit human approval via --approved");
  }
  const proposal = proposalFiles(evolution, args);
  if (proposal.metadata.status !== "pending") {
    throw new Error(`proposal ${proposal.id} is ${proposal.metadata.status}, not pending`);
  }
  const config = JSON.parse(readFileSync(path.join(evolution, "config.json"), "utf8"));
  const scores = evaluatedScores(config, args);
  const liveFile = path.join(skillDir, "SKILL.md");
  const before = readFileSync(liveFile);
  const candidate = readFileSync(proposal.candidateFile);
  if (sha256(before) !== proposal.metadata.before_sha256) {
    throw new Error(`proposal ${proposal.id} is stale because SKILL.md changed`);
  }
  if (sha256(candidate) !== proposal.metadata.after_sha256) {
    throw new Error(`proposal ${proposal.id} candidate hash does not match metadata`);
  }

  writeFileSync(liveFile, candidate);
  const updated = {
    ...proposal.metadata,
    status: "applied",
    applied_at: new Date().toISOString(),
    ...(scores ? { scores } : {}),
  };
  writeFileSync(proposal.metadataFile, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  updatePurpose(skillDir, updated);
  recordDecision(evolution, config, updated, "applied");
  process.stdout.write(`${JSON.stringify({ proposal: proposal.id, status: "applied" })}\n`);
}

function rejectProposal(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  const proposal = proposalFiles(evolution, args);
  if (proposal.metadata.status !== "pending") {
    throw new Error(`proposal ${proposal.id} is ${proposal.metadata.status}, not pending`);
  }
  const reason = option(args, "--reason", "").trim();
  if (!reason) {
    throw new Error("reject requires --reason <text>");
  }
  const config = JSON.parse(readFileSync(path.join(evolution, "config.json"), "utf8"));
  const updated = {
    ...proposal.metadata,
    status: "rejected",
    rejected_at: new Date().toISOString(),
    reason,
  };
  writeFileSync(proposal.metadataFile, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  recordDecision(evolution, config, updated, "rejected");
  process.stdout.write(`${JSON.stringify({ proposal: proposal.id, status: "rejected" })}\n`);
}

function noAction(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  const reason = option(args, "--reason", "").trim();
  if (!reason) {
    throw new Error("no-action requires --reason <text>");
  }
  const config = JSON.parse(readFileSync(path.join(evolution, "config.json"), "utf8"));
  const record = {
    id: "-",
    pattern: "none",
    notes: reason,
    trace_count: dataRows(path.join(evolution, "raw", "MANIFEST.tsv")).length,
  };
  recordDecision(evolution, config, record, "no_action");
  process.stdout.write(`${JSON.stringify({ status: "no_action" })}\n`);
}

function resolveWithin(base, relative) {
  const resolved = path.resolve(base, ...relative.split("/"));
  const remainder = path.relative(base, resolved);
  if (remainder.startsWith("..") || path.isAbsolute(remainder)) {
    throw new Error(`path escapes evolution directory: ${relative}`);
  }
  return resolved;
}

function verifySkill(skillArg, args) {
  const skillDir = assertSkill(skillArg);
  const evolution = assertEvolution(skillDir);
  const live = readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
  if (frontmatterName(live) !== path.basename(skillDir)) {
    throw new Error("SKILL.md frontmatter name must match the target directory");
  }

  const config = JSON.parse(readFileSync(path.join(evolution, "config.json"), "utf8"));
  if (config.schema_version !== 1) {
    throw new Error(`unsupported evolution schema version: ${config.schema_version}`);
  }
  if (!new Set(["observational", "evaluated"]).has(config.mode)) {
    throw new Error(`invalid evolution mode: ${config.mode}`);
  }

  const manifest = path.join(evolution, "raw", "MANIFEST.tsv");
  let traceCount = 0;
  for (const row of dataRows(manifest)) {
    const fields = row.split("\t");
    if (fields.length !== 6) {
      throw new Error("invalid trace manifest row");
    }
    const [expectedSha, expectedBytes, , outcome, relative] = fields;
    if (!/^[a-f0-9]{64}$/.test(expectedSha)) {
      throw new Error("invalid trace hash in manifest");
    }
    if (!new Set(["pass", "fail", "unknown"]).has(outcome)) {
      throw new Error(`invalid trace outcome: ${outcome}`);
    }
    const traceFile = resolveWithin(evolution, relative);
    if (!existsSync(traceFile)) {
      throw new Error(`missing trace file: ${relative}`);
    }
    const trace = readFileSync(traceFile);
    if (sha256(trace) !== expectedSha) {
      throw new Error(`trace hash mismatch: ${relative}`);
    }
    if (trace.length !== Number(expectedBytes)) {
      throw new Error(`trace byte count mismatch: ${relative}`);
    }
    traceCount += 1;
  }

  let proposalCount = 0;
  const proposalsDir = path.join(evolution, "proposals");
  for (const name of readdirSync(proposalsDir).filter((entry) => /^\d{4}\.json$/.test(entry))) {
    const id = name.slice(0, 4);
    const base = path.join(proposalsDir, id);
    const metadata = JSON.parse(readFileSync(`${base}.json`, "utf8"));
    if (metadata.id !== id || metadata.schema_version !== 1) {
      throw new Error(`invalid proposal metadata: ${id}`);
    }
    if (!new Set(["pending", "applied", "rejected"]).has(metadata.status)) {
      throw new Error(`invalid proposal status: ${id}`);
    }
    if (!existsSync(`${base}.candidate.md`) || !existsSync(`${base}.patch`)) {
      throw new Error(`proposal files are incomplete: ${id}`);
    }
    const candidate = readFileSync(`${base}.candidate.md`);
    if (sha256(candidate) !== metadata.after_sha256) {
      throw new Error(`proposal candidate hash mismatch: ${id}`);
    }
    proposalCount += 1;
  }

  const result = { valid: true, skill: skillDir, traces: traceCount, proposals: proposalCount };
  process.stdout.write(
    args.includes("--json")
      ? `${JSON.stringify(result)}\n`
      : `${path.basename(skillDir)}: valid (${traceCount} traces, ${proposalCount} proposals)\n`,
  );
}

function usage() {
  process.stdout.write("Usage: evolve-skills <harnesses|init|configure|scan|checkpoint|ingest|status|propose|apply|reject|no-action|verify> [skill-dir] [options]\n");
}

function main(argv) {
  const [command, skillArg, ...args] = argv;
  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }
  if (command === "harnesses") {
    listHarnesses(argv.slice(1));
    return;
  }
  if (!skillArg) {
    throw new Error(`${command} requires <skill-dir>`);
  }
  if (command === "init") {
    init(skillArg, args);
    return;
  }
  if (command === "ingest") {
    ingest(skillArg, args);
    return;
  }
  if (command === "configure") {
    configureSources(skillArg, args);
    return;
  }
  if (command === "scan") {
    scanSources(skillArg, args);
    return;
  }
  if (command === "checkpoint") {
    checkpointSources(skillArg, args);
    return;
  }
  if (command === "status") {
    status(skillArg, args);
    return;
  }
  if (command === "propose") {
    propose(skillArg, args);
    return;
  }
  if (command === "apply") {
    applyProposal(skillArg, args);
    return;
  }
  if (command === "reject") {
    rejectProposal(skillArg, args);
    return;
  }
  if (command === "no-action") {
    noAction(skillArg, args);
    return;
  }
  if (command === "verify") {
    verifySkill(skillArg, args);
    return;
  }
  throw new Error(`unknown command: ${command}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
