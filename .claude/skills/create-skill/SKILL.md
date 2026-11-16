---
name: create-skill
description: Turns a repeatable process into a project skill (a SKILL.md folder in .claude/skills/), written to the Agent Skills standard and kept detachable from the project where possible, with evals. Use when the user asks to make something a skill, or when a task just done follows fixed steps that will recur.
---

# Create a skill

A skill is the procedure for a process that recurs. It lives in `.claude/skills/<name>/` and is shared through git.
Facts about the project belong in the project's docs, and rules for every session in CLAUDE.md, so a skill can stay
a procedure that works on any project of its kind. [references/authoring-rules.md](references/authoring-rules.md)
has the limits and conventions this skill applies; if the `writing-for-agents` skill is installed, call the Skill
tool with it for the writing itself.

## 1. Confirm it belongs in a skill

- The process has fixed, ordered steps and will run again. One-off fixes and pure facts don't qualify.
- No existing skill covers it: list `.claude/skills/` and read the descriptions. Extend an existing skill when the
  new process is a variant of it.
- Decide the invocation: model-invoked (the model starts it when the description matches) or user-invoked
  (`disable-model-invocation: true`, for audits, releases, and anything whose timing the user should control).
- Agree the name with the user (rules in authoring-rules.md).

Done when the user has agreed on the name, the scope, and the invocation.

## 2. Capture the process

Work from a real run, ideally the one just completed. Write down:

- inputs the user must provide, and what to ask when they are missing;
- steps in order, each with a checkable completion criterion ("draft exists with categories and FAQ set", not
  "post looks good");
- exact calls copied from the run: ability and tool names, parameter shapes, script commands;
- gotchas hit during the run and how they were resolved;
- verification: how to read the result back, and what the hand-off contains;
- what is project-specific (site URLs, ids, field names, voice, paths) and what is generic.

Done when every step of the real run maps to a written step or a deliberate omission, and every project-specific
fact is marked.

## 3. Write evals

Write three or more scenarios in `evals/evals.json` before the body, so the skill is written to pass them
(format in authoring-rules.md): the main request, a variant that should stop short (a review-only or
missing-input case), and a follow-up use. Put small input files in `evals/files/`.

Done when `evals/evals.json` has at least three scenarios with prompts, expected outputs, and verifiable
expectations.

## 4. Write the skill

- Frontmatter: `name`, `description` (what it does, then "Use when …" with each distinct trigger), and only the
  optional fields it needs (`compatibility`, `allowed-tools`, `disable-model-invocation`).
- Body: steps first, short, each ending with "Done when …". Explain the reason behind a rule instead of
  capitalizing it.
- Move long reference material into `references/`, templates into `assets/`, and executable code into `scripts/`,
  one level deep, each linked from the step that needs it.
- Bundled scripts: reference them as `${CLAUDE_SKILL_DIR}/scripts/<file>`, say whether to run or read them, and
  list their dependencies in a Requirements section or `compatibility`.
- Project-specific facts go in a project doc that CLAUDE.md points to, not in the skill; the skill names the
  settings it needs (a `references/project-setup.md` table) and asks the user for missing ones. Script defaults can
  come from environment variables set in `.claude/settings.json`. Keep a skill project-bound only when
  generalizing it would cost more than it saves, and mark it with `metadata: {scope: project}`.
- Another skill is invoked as "call the Skill tool with `<name>`", never by linking into its folder.

Done when the linter (`review-skills` → `scripts/lint-skills.mjs`) reports no errors for the skill.

## 5. Test

Run each eval in a fresh session (a subagent with only the prompt) with the skill, and once without it as a
baseline. Use test content on the live site and delete it afterwards unless the user wants to keep it. Fix every
step that was unclear, wrong, or missing, and run again.

Done when every eval's expectations pass with the skill, and the skill run beats the baseline.

## 6. Register

Add the skill to the README's skills table (one line, plain language), add any new project doc to CLAUDE.md, and
tell the user how to start it.

Done when the README lists the skill and the user knows how to start it.
