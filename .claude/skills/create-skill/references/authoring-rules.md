# Skill authoring rules

Checked against the Agent Skills specification (agentskills.io/specification), Anthropic's skill authoring best
practices (platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), and the Claude Code skills
docs (code.claude.com/docs/en/skills). `review-skills` → `scripts/lint-skills.mjs` checks the mechanical ones.

## Frontmatter

- `name`: up to 64 characters, lowercase letters, digits, single hyphens; matches the folder name; no "anthropic"
  or "claude". Verb-first names (`build-from-design`) are the convention in this collection; keep it consistent.
- `description`: up to 1024 characters, no XML tags, third person. What the skill does, then "Use when …" with one
  trigger per distinct situation. The model tends to under-trigger skills, so name the user's own wording.
  Description plus `when_to_use` is cut at 1,536 characters in the skill listing: lead with the main use.
- Optional: `compatibility` (environment needs, up to 500 characters), `allowed-tools` (e.g.
  `Bash(node ${CLAUDE_SKILL_DIR}/scripts/x.mjs *)` to skip the permission prompt for bundled scripts),
  `disable-model-invocation: true` (user-started only; the description becomes a one-line human summary),
  `metadata` (e.g. `scope: project` for a deliberately project-bound skill).

## Body

- Under 500 lines; most skills need far fewer. Steps first, each ending with a checkable "Done when …".
- One source of truth per fact: project facts in project docs, shared knowledge in one place, never copied.
- Explain why a rule exists; all-caps ALWAYS/NEVER is a sign the reason is missing.
- No time-sensitive statements ("as of this month"); consistent terminology throughout.
- Name MCP tools unambiguously: the server and tool (`<server>:<tool>`), or the project doc's named server.
- Match the degree of freedom to the risk: exact commands for fragile sequences, judgment for open-ended work.

## Files

- `references/` for reference docs, `assets/` for templates, `scripts/` for code; one level deep from SKILL.md.
  Reference files over 100 lines get a table of contents.
- Scripts are referenced as `${CLAUDE_SKILL_DIR}/scripts/<file>`; say whether to run or read each one; scripts
  handle their own errors and print usage when arguments are missing. List dependencies.

## Evals

`evals/evals.json`, at least three scenarios:

```json
{
  "skill_name": "<name>",
  "evals": [
    {
      "id": 1,
      "prompt": "The user's request",
      "expected_output": "What success looks like",
      "files": ["evals/files/<input>"],
      "expectations": ["A verifiable statement about the run or its output"]
    }
  ]
}
```

Run each in a fresh session with the skill and once without it (baseline). Expectations should be checkable from
the transcript or the result, e.g. "ran X before Y", "asked about Z", "did not write to the site".
