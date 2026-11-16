#!/usr/bin/env node
// Mechanical checks for Agent Skills (SKILL.md folders), from the Agent Skills spec and Anthropic's authoring
// best practices. Prints one line per finding and exits 1 when any error is found.
//
//   node lint-skills.mjs [<skills dir>] [--forbid <term,term>]
//
// <skills dir> defaults to .claude/skills. --forbid lists project-specific terms (site names, ids) that must not
// appear in generic skills; a skill whose frontmatter has `metadata: { scope: project }` is exempt.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { forbid: { type: "string" } } });
const root = positionals[0] || ".claude/skills";
const forbid = (values.forbid || "").split(",").map((t) => t.trim()).filter(Boolean);
const findings = [];
const add = (level, skill, msg) => findings.push({ level, skill, msg });

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const fm = {};
  let key = null;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      fm[key] = kv[2].replace(/^["']|["']$/g, "");
    } else if (key && /^\s+/.test(line)) fm[key] += "\n" + line.trim();
  }
  return { fm, body: text.slice(m[0].length) };
}
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const localLinks = (text) =>
  [...text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((m) => m[1]).filter((l) => !/^[a-z]+:|^\//.test(l));

for (const name of readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory())) {
  const dir = join(root, name);
  const file = join(dir, "SKILL.md");
  if (!existsSync(file)) {
    add("error", name, "no SKILL.md");
    continue;
  }
  const text = readFileSync(file, "utf8");
  const parsed = frontmatter(text);
  if (!parsed) {
    add("error", name, "no YAML frontmatter");
    continue;
  }
  const { fm, body } = parsed;
  const userOnly = fm["disable-model-invocation"] === "true";
  const projectScoped = /scope:\s*project/.test(fm.metadata || "");

  // Frontmatter (agentskills.io specification; Claude Code skills docs)
  if (!fm.name) add("error", name, "frontmatter has no name");
  else {
    if (fm.name !== name) add("error", name, `name "${fm.name}" doesn't match the folder name`);
    if (fm.name.length > 64 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name)) add("error", name, "name must be ≤64 chars of lowercase letters, digits, single hyphens");
    if (/anthropic|claude/.test(fm.name)) add("error", name, "name must not contain 'anthropic' or 'claude'");
  }
  const desc = fm.description || "";
  if (!desc) add("error", name, "frontmatter has no description");
  if (desc.length > 1024) add("error", name, `description is ${desc.length} chars (max 1024)`);
  if (desc.length + (fm.when_to_use || "").length > 1536) add("warn", name, "description + when_to_use over 1536 chars is truncated in the skill listing");
  if (/<[a-z][^>]*>/i.test(desc)) add("error", name, "description contains XML/HTML tags");
  if (!userOnly && !/\buse (it )?when\b|\bwhen (the user|asked)\b/i.test(desc)) add("warn", name, "description should say when to use the skill (\"Use when …\")");
  if (/\b(I can|you can|I will)\b/.test(desc)) add("warn", name, "description should be in third person");

  // Body size and structure (best practices: under 500 lines, one level of references)
  const lines = body.split("\n").length;
  if (lines > 500) add("error", name, `SKILL.md body is ${lines} lines (max 500); move detail into reference files`);
  else if (lines > 300) add("warn", name, `SKILL.md body is ${lines} lines; consider moving detail into reference files`);
  const steps = [...body.matchAll(/^## (\d+)\.\s.*$/gm)];
  if (steps.length) {
    const sections = body.split(/^## /m).filter((s) => /^\d+\./.test(s));
    const missing = sections.filter((s) => !/\bDone when\b/.test(s)).map((s) => s.split("\n")[0]);
    if (missing.length) add("warn", name, `steps without a "Done when" criterion: ${missing.join("; ")}`);
  }
  if (/\b(ALWAYS|NEVER|MUST)\b/.test(body)) add("info", name, "all-caps ALWAYS/NEVER/MUST: explain the reason instead where possible");

  // References: exist, and are one level deep
  for (const link of localLinks(body)) {
    const target = join(dir, link);
    if (!existsSync(target)) add("error", name, `link to missing file: ${link}`);
    else if (/\.md$/.test(link)) {
      const nested = localLinks(readFileSync(target, "utf8")).filter((l) => /\.md$/.test(l) && existsSync(join(dir, l)));
      if (nested.length) add("warn", name, `${link} links to further skill files (${nested.join(", ")}); keep references one level deep`);
      const refLines = readFileSync(target, "utf8").split("\n").length;
      if (refLines > 100 && !/^##? (Contents|Table of contents)/im.test(readFileSync(target, "utf8"))) add("info", name, `${link} is ${refLines} lines without a table of contents`);
    }
  }

  // Bundled scripts: referenced through ${CLAUDE_SKILL_DIR}, never through invented placeholders
  const files = walk(dir).map((f) => relative(dir, f));
  const scripts = files.filter((f) => f.startsWith("scripts/"));
  if (/<(this )?skill( dir| folder)?>\/scripts/.test(body)) add("error", name, "script path uses a placeholder; use ${CLAUDE_SKILL_DIR}/scripts/…");
  for (const s of scripts) {
    if (!body.includes(s)) add("warn", name, `bundled ${s} is never referenced in SKILL.md`);
    else if (!body.includes("${CLAUDE_SKILL_DIR}/" + s)) add("warn", name, `${s} is referenced without \${CLAUDE_SKILL_DIR}`);
  }
  if (scripts.length && !/^## Requirements/m.test(body) && !fm.compatibility) add("warn", name, "bundles scripts but declares no Requirements section or compatibility field");

  // Evals (best practices: at least three scenarios)
  const evalsFile = join(dir, "evals", "evals.json");
  if (existsSync(evalsFile)) {
    try {
      const ev = JSON.parse(readFileSync(evalsFile, "utf8"));
      if (ev.skill_name !== fm.name) add("error", name, "evals.json skill_name doesn't match the skill name");
      if (!Array.isArray(ev.evals) || ev.evals.length < 3) add("warn", name, "evals.json has fewer than 3 scenarios");
      for (const e of ev.evals || []) {
        if (!e.prompt || !e.expected_output || !(e.expectations || []).length) add("error", name, `eval ${e.id}: needs prompt, expected_output, and expectations`);
        for (const f of e.files || []) if (!existsSync(join(dir, f))) add("error", name, `eval ${e.id}: missing file ${f}`);
      }
    } catch (err) {
      add("error", name, `evals.json is not valid JSON: ${err.message}`);
    }
  } else add("info", name, "no evals/evals.json");

  // Project-specific terms in generic skills
  if (forbid.length && !projectScoped) {
    for (const f of files.filter((f) => /\.(md|mjs|js|json|sh|py)$/.test(f))) {
      const content = readFileSync(join(dir, f), "utf8").toLowerCase();
      const hits = forbid.filter((t) => content.includes(t.toLowerCase()));
      if (hits.length) add("error", name, `${f} contains project-specific terms: ${hits.join(", ")}`);
    }
  }
}

const order = { error: 0, warn: 1, info: 2 };
findings.sort((a, b) => a.skill.localeCompare(b.skill) || order[a.level] - order[b.level]);
for (const f of findings) console.log(`${f.level.padEnd(5)} ${f.skill}: ${f.msg}`);
const errors = findings.filter((f) => f.level === "error").length;
console.log(`\n${errors} error(s), ${findings.filter((f) => f.level === "warn").length} warning(s)`);
process.exit(errors ? 1 : 0);
