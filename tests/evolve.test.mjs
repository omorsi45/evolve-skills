import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const CLI = fileURLToPath(new URL("../scripts/evolve.mjs", import.meta.url));

function makeSkill(name = "demo-skill") {
  const root = mkdtempSync(path.join(tmpdir(), "evolve-skills-test-"));
  const skill = path.join(root, name);
  writeFileSync(
    path.join(root, ".keep"),
    "",
  );
  return { root, skill };
}

function writeSkill(skill, body = "# Demo\n\nOriginal instructions.\n") {
  const parent = path.dirname(skill);
  const name = path.basename(skill);
  if (!existsSync(parent)) {
    throw new Error(`missing test parent: ${parent}`);
  }
  mkdirSync(skill, { recursive: true });
  writeFileSync(
    path.join(skill, "SKILL.md"),
    `---\nname: ${name}\ndescription: Use when testing skill evolution.\n---\n\n${body}`,
  );
}

function runCli(...args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
}

test("init creates one reusable evolution state tree inside the target skill", () => {
  const { skill } = makeSkill();
  writeSkill(skill);

  const result = runCli("init", skill, "--mode", "observational");

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const required = [
    "PURPOSE.md",
    "evolution/config.json",
    "evolution/RUNS.tsv",
    "evolution/raw/MANIFEST.tsv",
    "evolution/wiki/index.md",
    "evolution/wiki/log.md",
    "evolution/wiki/skill-impact.md",
    "evolution/DO-NOT-READ.md",
  ];
  for (const relative of required) {
    assert.equal(existsSync(path.join(skill, relative)), true, relative);
  }
  const config = JSON.parse(readFileSync(path.join(skill, "evolution/config.json"), "utf8"));
  assert.equal(config.mode, "observational");
  assert.equal(config.schema_version, 1);

  const second = runCli("init", skill, "--mode", "evaluated");
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(JSON.parse(second.stdout).mode, "observational");
  assert.equal(
    JSON.parse(readFileSync(path.join(skill, "evolution/config.json"), "utf8")).mode,
    "observational",
  );
  assert.equal(existsSync(path.join(skill, "evolution/evolution")), false);
});

test("init rejects a target whose frontmatter name does not match its directory", () => {
  const { skill } = makeSkill();
  writeSkill(skill);
  const skillFile = path.join(skill, "SKILL.md");
  writeFileSync(
    skillFile,
    readFileSync(skillFile, "utf8").replace("name: demo-skill", "name: wrong-name"),
  );

  const result = runCli("init", skill);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /frontmatter name/i);
  assert.equal(existsSync(path.join(skill, "evolution")), false);
});

test("init adds local source state to an existing gitignore without changing CRLF", () => {
  const { skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);
  const ignore = path.join(skill, "evolution/.gitignore");
  writeFileSync(ignore, "raw/traces/*\r\n", "utf8");

  const result = runCli("init", skill);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readFileSync(ignore, "utf8"), "raw/traces/*\r\nsources.local.json\r\n");
});

test("ingest stores a trace by content hash and does not duplicate it", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);
  const trace = path.join(root, "session.jsonl");
  const content = '{"role":"user","content":"run the demo"}\n';
  writeFileSync(trace, content);
  const sha = createHash("sha256").update(content).digest("hex");

  const first = runCli(
    "ingest",
    skill,
    "--trace",
    trace,
    "--source",
    "manual",
    "--outcome",
    "pass",
  );
  const second = runCli(
    "ingest",
    skill,
    "--trace",
    trace,
    "--source",
    "manual",
    "--outcome",
    "pass",
  );

  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(JSON.parse(first.stdout).status, "ingested");
  assert.equal(JSON.parse(second.stdout).status, "seen");
  assert.equal(
    readFileSync(path.join(skill, "evolution/raw/traces", `${sha}.jsonl`), "utf8"),
    content,
  );
  const rows = readFileSync(path.join(skill, "evolution/raw/MANIFEST.tsv"), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].split("\t")[0], sha);
});

test("status reads only the target skill's colocated evolution state", () => {
  const first = makeSkill("first-skill");
  const second = makeSkill("second-skill");
  writeSkill(first.skill);
  writeSkill(second.skill);
  assert.equal(runCli("init", first.skill, "--mode", "evaluated").status, 0);
  assert.equal(runCli("init", second.skill).status, 0);
  const trace = path.join(first.root, "failed.jsonl");
  writeFileSync(trace, '{"error":"bad command"}\n');
  assert.equal(
    runCli("ingest", first.skill, "--trace", trace, "--outcome", "fail").status,
    0,
  );

  const firstStatus = runCli("status", first.skill, "--json");
  const secondStatus = runCli("status", second.skill, "--json");

  assert.equal(firstStatus.status, 0, firstStatus.stderr || firstStatus.stdout);
  assert.equal(secondStatus.status, 0, secondStatus.stderr || secondStatus.stdout);
  assert.deepEqual(JSON.parse(firstStatus.stdout).traces, {
    total: 1,
    pass: 0,
    fail: 1,
    unknown: 0,
  });
  assert.equal(JSON.parse(firstStatus.stdout).mode, "evaluated");
  assert.equal(JSON.parse(secondStatus.stdout).traces.total, 0);
});

test("harness catalog covers popular file and export based coding agents", () => {
  const result = runCli("harnesses", "--json");

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const harnesses = JSON.parse(result.stdout);
  const byId = new Map(harnesses.map((harness) => [harness.id, harness]));
  for (const id of [
    "codex",
    "claude-code",
    "gemini-cli",
    "github-copilot-cli",
    "vscode-copilot",
    "kiro",
    "cursor",
    "windsurf",
    "cline",
    "roo-code",
    "continue-cli",
    "aider",
    "opencode",
    "goose",
    "amp",
    "zed",
  ]) {
    assert.equal(byId.has(id), true, id);
  }
  assert.equal(byId.get("codex").discovery, "files");
  assert.equal(byId.get("cursor").discovery, "export");
});

test("scan starts at the last evolution date and advances only after checkpoint", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);
  appendFileSync(
    path.join(skill, "evolution/RUNS.tsv"),
    "0001\t2026-01-02T00:00:00.000Z\tobservational\t0\t-\tno_action\n",
  );

  const sessions = path.join(root, "codex-sessions");
  mkdirSync(sessions);
  const oldTrace = path.join(sessions, "old.jsonl");
  const newTrace = path.join(sessions, "new.jsonl");
  const ignored = path.join(sessions, "notes.txt");
  writeFileSync(oldTrace, "{\"session\":\"old\"}\n");
  writeFileSync(newTrace, "{\"session\":\"new\"}\n");
  writeFileSync(ignored, "not a transcript\n");
  utimesSync(oldTrace, new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-01T00:00:00.000Z"));
  utimesSync(newTrace, new Date("2026-01-03T00:00:00.000Z"), new Date("2026-01-03T00:00:00.000Z"));
  utimesSync(ignored, new Date("2026-01-03T00:00:00.000Z"), new Date("2026-01-03T00:00:00.000Z"));

  const configured = runCli(
    "configure",
    skill,
    "--harness",
    "codex",
    "--root",
    `codex=${sessions}`,
  );
  assert.equal(configured.status, 0, configured.stderr || configured.stdout);

  const first = runCli("scan", skill, "--json");
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstScan = JSON.parse(first.stdout);
  assert.equal(firstScan.last_evolved_at, "2026-01-02T00:00:00.000Z");
  assert.equal(firstScan.harnesses[0].since, "2026-01-02T00:00:00.000Z");
  assert.deepEqual(firstScan.harnesses[0].candidates.map((item) => item.path), [newTrace]);

  const beforeCheckpoint = JSON.parse(runCli("status", skill, "--json").stdout);
  assert.equal(beforeCheckpoint.sources[0].last_scanned_at, null);

  const checkpoint = runCli(
    "checkpoint",
    skill,
    "--harness",
    "codex",
    "--through",
    firstScan.scan_started_at,
  );
  assert.equal(checkpoint.status, 0, checkpoint.stderr || checkpoint.stdout);

  const second = JSON.parse(runCli("scan", skill, "--json").stdout);
  assert.equal(second.harnesses[0].since, firstScan.scan_started_at);
  assert.equal(second.harnesses[0].candidates.length, 0);
  const afterCheckpoint = JSON.parse(runCli("status", skill, "--json").stdout);
  assert.equal(afterCheckpoint.sources[0].last_scanned_at, firstScan.scan_started_at);

  const full = JSON.parse(runCli("scan", skill, "--json", "--rescan-all").stdout);
  assert.equal(full.harnesses[0].since, null);
  assert.deepEqual(
    full.harnesses[0].candidates.map((item) => path.basename(item.path)).sort(),
    ["new.jsonl", "old.jsonl"],
  );
});

test("configure persists selected agents and scan explains export-only sources", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);
  const sessions = path.join(root, "empty-sessions");
  mkdirSync(sessions);

  const configured = runCli(
    "configure",
    skill,
    "--harness",
    "codex",
    "--harness",
    "cursor",
    "--root",
    `codex=${sessions}`,
  );
  assert.equal(configured.status, 0, configured.stderr || configured.stdout);
  const stateFile = path.join(skill, "evolution/sources.local.json");
  assert.equal(existsSync(stateFile), true);
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  assert.deepEqual(Object.keys(state.harnesses), ["codex", "cursor"]);
  assert.match(readFileSync(path.join(skill, "evolution/.gitignore"), "utf8"), /sources\.local\.json/);

  const scan = JSON.parse(runCli("scan", skill, "--json").stdout);
  assert.equal(scan.harnesses.length, 2);
  const cursor = scan.harnesses.find((source) => source.id === "cursor");
  assert.equal(cursor.status, "export_required");
  assert.match(cursor.instructions, /export/i);

  const invalid = runCli("configure", skill, "--harness", "unknown-agent");
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /unknown harness/i);
});

test("propose stores one reviewable atomic change without editing the live skill", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);
  const live = path.join(skill, "SKILL.md");
  const before = readFileSync(live, "utf8");
  const candidate = path.join(root, "candidate.md");
  writeFileSync(candidate, before.replace("Original instructions.", "Improved instructions."));

  const result = runCli(
    "propose",
    skill,
    "--candidate",
    candidate,
    "--pattern",
    "reliable-behavior",
    "--notes",
    "Use the behavior supported by the trace evidence.",
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readFileSync(live, "utf8"), before);
  const response = JSON.parse(result.stdout);
  assert.equal(response.proposal, "0001");
  const base = path.join(skill, "evolution/proposals/0001");
  assert.equal(existsSync(`${base}.candidate.md`), true);
  assert.equal(existsSync(`${base}.patch`), true);
  const metadata = JSON.parse(readFileSync(`${base}.json`, "utf8"));
  assert.equal(metadata.pattern, "reliable-behavior");
  assert.equal(metadata.status, "pending");
  assert.equal(metadata.before_sha256, createHash("sha256").update(before).digest("hex"));
  assert.equal(
    metadata.after_sha256,
    createHash("sha256").update(readFileSync(candidate)).digest("hex"),
  );
  assert.match(readFileSync(`${base}.patch`, "utf8"), /-Original instructions\./);
  assert.match(readFileSync(`${base}.patch`, "utf8"), /\+Improved instructions\./);
});

test("propose rejects a bundle of separated changes", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill, "# Demo\n\nFirst behavior.\n\nKeep this context.\n\nSecond behavior.\n");
  assert.equal(runCli("init", skill).status, 0);
  const live = path.join(skill, "SKILL.md");
  const before = readFileSync(live, "utf8");
  const candidate = path.join(root, "candidate.md");
  writeFileSync(
    candidate,
    before
      .replace("First behavior.", "Improved first behavior.")
      .replace("Second behavior.", "Improved second behavior."),
  );

  const result = runCli(
    "propose",
    skill,
    "--candidate",
    candidate,
    "--pattern",
    "two-unrelated-patterns",
    "--notes",
    "This must be split.",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /one contiguous change/i);
  assert.deepEqual(
    readdirSync(path.join(skill, "evolution/proposals")),
    [],
  );
});

test("propose rejects a candidate that renames the target skill", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);
  const live = path.join(skill, "SKILL.md");
  const candidate = path.join(root, "candidate.md");
  writeFileSync(
    candidate,
    readFileSync(live, "utf8").replace("name: demo-skill", "name: renamed-skill"),
  );

  const result = runCli(
    "propose",
    skill,
    "--candidate",
    candidate,
    "--pattern",
    "rename",
    "--notes",
    "Do not rename targets.",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /frontmatter name/i);
});

test("apply requires explicit approval and records an observational change", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);
  const live = path.join(skill, "SKILL.md");
  const before = readFileSync(live, "utf8");
  const candidate = path.join(root, "candidate.md");
  const after = before.replace("Original instructions.", "Observed improvement.");
  writeFileSync(candidate, after);
  assert.equal(
    runCli(
      "propose",
      skill,
      "--candidate",
      candidate,
      "--pattern",
      "observed-pattern",
      "--notes",
      "Supported by recurring traces.",
    ).status,
    0,
  );

  const blocked = runCli("apply", skill, "--proposal", "0001");
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /--approved/);
  assert.equal(readFileSync(live, "utf8"), before);

  const applied = runCli("apply", skill, "--proposal", "0001", "--approved");
  assert.equal(applied.status, 0, applied.stderr || applied.stdout);
  assert.equal(readFileSync(live, "utf8"), after);
  const metadata = JSON.parse(
    readFileSync(path.join(skill, "evolution/proposals/0001.json"), "utf8"),
  );
  assert.equal(metadata.status, "applied");
  assert.match(readFileSync(path.join(skill, "evolution/RUNS.tsv"), "utf8"), /\t0001\tapplied/);
  assert.match(
    readFileSync(path.join(skill, "evolution/wiki/skill-impact.md"), "utf8"),
    /observed-pattern/,
  );
  assert.match(readFileSync(path.join(skill, "PURPOSE.md"), "utf8"), /0001.*observed-pattern/);
});

test("evaluated mode applies only a measured score improvement", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill, "--mode", "evaluated").status, 0);
  const live = path.join(skill, "SKILL.md");
  const before = readFileSync(live, "utf8");
  const candidate = path.join(root, "candidate.md");
  writeFileSync(candidate, before.replace("Original instructions.", "Measured improvement."));
  assert.equal(
    runCli(
      "propose",
      skill,
      "--candidate",
      candidate,
      "--pattern",
      "measured-pattern",
      "--notes",
      "Candidate for benchmark evaluation.",
    ).status,
    0,
  );

  const missing = runCli("apply", skill, "--proposal", "0001", "--approved");
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /score-before/);
  const worse = runCli(
    "apply",
    skill,
    "--proposal",
    "0001",
    "--approved",
    "--score-before",
    "0.8",
    "--score-after",
    "0.7",
  );
  assert.notEqual(worse.status, 0);
  assert.match(worse.stderr, /must improve/);
  assert.equal(readFileSync(live, "utf8"), before);

  const improved = runCli(
    "apply",
    skill,
    "--proposal",
    "0001",
    "--approved",
    "--score-before",
    "0.8",
    "--score-after",
    "0.9",
  );
  assert.equal(improved.status, 0, improved.stderr || improved.stdout);
  assert.match(readFileSync(live, "utf8"), /Measured improvement/);
  const metadata = JSON.parse(
    readFileSync(path.join(skill, "evolution/proposals/0001.json"), "utf8"),
  );
  assert.deepEqual(metadata.scores, { before: 0.8, after: 0.9 });
});

test("reject closes a proposal without changing the live skill", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);
  const live = path.join(skill, "SKILL.md");
  const before = readFileSync(live, "utf8");
  const candidate = path.join(root, "candidate.md");
  writeFileSync(candidate, before.replace("Original instructions.", "Rejected instructions."));
  assert.equal(
    runCli(
      "propose",
      skill,
      "--candidate",
      candidate,
      "--pattern",
      "weak-pattern",
      "--notes",
      "Review this candidate.",
    ).status,
    0,
  );

  const result = runCli(
    "reject",
    skill,
    "--proposal",
    "0001",
    "--reason",
    "Evidence was not strong enough.",
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readFileSync(live, "utf8"), before);
  const metadata = JSON.parse(
    readFileSync(path.join(skill, "evolution/proposals/0001.json"), "utf8"),
  );
  assert.equal(metadata.status, "rejected");
  assert.equal(metadata.reason, "Evidence was not strong enough.");
  assert.match(readFileSync(path.join(skill, "evolution/RUNS.tsv"), "utf8"), /\t0001\trejected/);
});

test("no-action records an evolution run without creating a proposal", () => {
  const { skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);

  const result = runCli(
    "no-action",
    skill,
    "--reason",
    "No recurring evidence supports a safe change.",
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(readFileSync(path.join(skill, "evolution/RUNS.tsv"), "utf8"), /\t-\tno_action/);
  assert.deepEqual(readdirSync(path.join(skill, "evolution/proposals")), []);
  assert.match(
    readFileSync(path.join(skill, "evolution/wiki/skill-impact.md"), "utf8"),
    /No recurring evidence supports a safe change\./,
  );
});

test("verify detects tampered traces and proposal candidates", () => {
  const { root, skill } = makeSkill();
  writeSkill(skill);
  assert.equal(runCli("init", skill).status, 0);
  const trace = path.join(root, "session.jsonl");
  const traceContent = '{"outcome":"pass"}\n';
  writeFileSync(trace, traceContent);
  const ingested = runCli("ingest", skill, "--trace", trace, "--outcome", "pass");
  assert.equal(ingested.status, 0, ingested.stderr || ingested.stdout);
  const traceFile = path.join(
    skill,
    "evolution",
    ...JSON.parse(ingested.stdout).trace_file.split("/"),
  );
  const live = path.join(skill, "SKILL.md");
  const candidate = path.join(root, "candidate.md");
  writeFileSync(
    candidate,
    readFileSync(live, "utf8").replace("Original instructions.", "Verified instructions."),
  );
  assert.equal(
    runCli(
      "propose",
      skill,
      "--candidate",
      candidate,
      "--pattern",
      "verified-pattern",
      "--notes",
      "Keep integrity metadata.",
    ).status,
    0,
  );

  const valid = runCli("verify", skill, "--json");
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  assert.equal(JSON.parse(valid.stdout).valid, true);

  writeFileSync(traceFile, '{"outcome":"tampered"}\n');
  const badTrace = runCli("verify", skill);
  assert.notEqual(badTrace.status, 0);
  assert.match(badTrace.stderr, /trace hash mismatch/i);

  writeFileSync(traceFile, traceContent);
  writeFileSync(
    path.join(skill, "evolution/proposals/0001.candidate.md"),
    "tampered candidate\n",
  );
  const badCandidate = runCli("verify", skill);
  assert.notEqual(badCandidate.status, 0);
  assert.match(badCandidate.stderr, /candidate hash mismatch/i);
});
