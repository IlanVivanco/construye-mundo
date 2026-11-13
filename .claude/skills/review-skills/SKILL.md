---
name: review-skills
description: Audits and improves the project's skills, docs, and CLAUDE.md against the skill authoring standard and how they performed in real use.
disable-model-invocation: true
compatibility: Node 22+ for the linter; git.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/lint-skills.mjs *)
---

# Review skills

Periodic audit of `.claude/skills/`, the project's docs, and CLAUDE.md. The goal is fewer, sharper instructions that
match how the project and the team work today, with mechanical problems caught by a script rather than by reading.

## Requirements

- Node 22+ and git.
- The project's list of project-specific terms that generic skills must not contain (in CLAUDE.md, under Skills).

## 1. Gather evidence

1. Find the last review: `git log -1 --format='%h %ad' --date=short --grep='review skills'`.
2. Run `node ${CLAUDE_SKILL_DIR}/scripts/lint-skills.mjs .claude/skills --forbid "<project terms>"` and keep its
   output. It checks names, descriptions, body size, reference depth, script paths, dependencies, "Done when"
   criteria, evals, and project terms in generic skills.
3. Read every SKILL.md and its bundled files in full.
4. Collect lessons from real use since the last review:
   - ask the user what went wrong or felt slow;
   - `git log --since=<last review date> -- .claude <docs dir> CLAUDE.md` for workarounds that were added;
   - recent session transcripts (`~/.claude/projects/<project>/*.jsonl`) for repeated corrections, failed calls,
     and steps the model had to rediscover.
5. Check facts against the live system with read-only calls: tool and ability names and parameters, ids, field
   names named in skills and docs.

Done when the linter has run, every skill has been read in full, and every name and id the skills rely on has been
checked.

## 2. Assess each skill

For each skill, note findings under these lenses:

- **Standard**: every linter error and warning.
- **Trigger**: does the description name the situations where it should fire, and only those? Would the user's own
  wording reach it?
- **Steps**: is each completion criterion checkable? Did real runs need steps that are missing?
- **Evals**: do the scenarios still match the skill, and do they pass? Run any that the changes since the last review
  could affect.
- **Accuracy**: stale ids, renamed tools, outdated workarounds, rules contradicted by recent work.
- **Single source of truth**: knowledge copied from docs or CLAUDE.md, or shared by two skills, belongs in the docs
  behind a pointer. Project facts inside a generic skill belong in the project doc.
- **Sediment**: lines that no longer change behavior, or that restate what the model does by default.
- **Deterministic checks**: a written rule that a script could enforce instead.
- **Gaps**: repeated processes from recent work that have no skill yet (candidates for `create-skill`).

Also check the docs for stale entries (fixed issues still listed as known, outdated architecture) and CLAUDE.md for
rules that belong in a skill or a doc.

Done when every skill has findings (or "none") under every lens.

## 3. Propose, then apply

Present the findings as a short list per skill: the problem, the evidence, the proposed edit. Apply only the edits
the user approves, keep the README's skills table in sync with what exists, rerun the linter, and commit with a
message containing "review skills" so the next review can find this one.

Done when every approved edit is applied, the linter reports no errors, the README table matches
`.claude/skills/`, and the review commit exists.
