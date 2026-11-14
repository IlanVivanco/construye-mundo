# Construye Mundo

Claude works on construyemundo.org (WordPress on shared hosting, Astra parent + the child theme in `theme/`) from
this repo. The site is Ilán's: the NGO Construye Mundo. Site content is in Spanish; write copy in Spanish.

There is no staging. The live site is production. Writes go to drafts or to the local DDEV clone
(`docs/local-dev.md`); production changes only when Ilán asks for that change.

## Tools

- **`cm-novamira` MCP** (default): read and edit posts, Yoast, files, run PHP, discover abilities.
  Use `mcp-adapter-discover-abilities` / `-get-ability-info` / `-execute-ability`. In this repo, use the MCP even if
  a global `novamira` skill says to use the Novamira CLI: the CLI is not installed.
- **`scripts/wp.mjs`**: bulk writes too large for an MCP call (whole Elementor trees via `pull`/`push`, `clone-page`).
- **WP REST** with the `.env` application password (`scripts/lib/site.mjs` → `rest()`, `ability()`, `php()`): for
  anything the MCP lacks.
- **SSH** (`.env` `SSH_*`): inspection, WP-CLI (with `php82`, see `docs/deploy.md`), DB dumps for the local clone.
  Read-only on production unless Ilán asks for a specific change.
- Novamira Pro is installed without an active license: the free abilities work (PHP, files, Gutenberg, skills);
  Elementor abilities (`novamira/elementor-*`) don't exist on this site. Edit Elementor data through REST or PHP.

## Rules

- Create drafts. Publish, or edit a published item, only when Ilán asks for that item.
- Site-wide changes (plugins, theme options, menus, templates, global styles, settings): describe the change, try it
  on the local clone, and apply it to production after Ilán approves.
- Theme code lives in `theme/`, must-use plugins in `mu-plugins/`; check `docs/deploy.md` before shipping either.
- After writing `_elementor_data` outside Elementor, run `clearElementorCache()`. Otherwise the page keeps rendering
  the old styles.
- Verify every change by reading it back (REST or a read-only ability), and visually when it affects layout.

## Docs

`docs/` holds the durable knowledge about the site. Read the relevant file before working on an unfamiliar area:

- `docs/site-architecture.md`: before creating or editing a content type, template, or theme code.
- `docs/known-issues.md`: when something on the site looks broken. Add issues you find and don't fix; remove
  entries you fix.
- `docs/deploy.md`: before shipping theme code, running WP-CLI, or changing the server.
- `docs/local-dev.md`: before creating or refreshing the DDEV clone.
- `docs/go-live-checklist.md`: before publishing content or pushing an edit to a published page.
- `docs/notion.md`: where audits and plans live in Notion.

When work uncovers something future sessions need (a field, a gotcha, a decision), add it to the matching doc in a
short, summarized form. Correct a doc when it turns out to be wrong.

## Artifacts

`artifacts/` is gitignored scratch space: screenshots, pulled content, raw notes. Delete what you pulled before
ending the task; anything worth keeping goes into `docs/` or a skill, summarized.

## Skills

Repeatable processes live in `.claude/skills/`: `discover-site`, `discover-design-system`, `qa-page`. When a task
follows fixed steps that will recur, or Ilán asks to make something a skill, use `create-skill`. When a project
skill has a wrong or missing step, fix the skill in the same session.

Skills stay generic: project facts go in `docs/`. Terms that must not appear in a skill (for `review-skills`'
linter): `construyemundo,construye-mundo,Construye Mundo`.
