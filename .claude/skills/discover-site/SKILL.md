---
name: discover-site
description: Inventories a WordPress site (environment, parent and child themes, theme options, plugins, content types, templates of every kind, page-builder templates and their conditions, menus, custom fields, URLs) into generated docs, then updates the project's hand-written architecture doc from them. Use when setting up a project on a WordPress site, when the site's structure changed (theme, plugins, templates, content types), when the architecture doc looks stale, or when asked how the site is built.
compatibility: WordPress REST API with an authenticated user; optional read-only PHP through the site adapter; Node 22+.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/site.mjs *)
---

# Discover site

Builds the project's picture of how a WordPress site is put together. A script collects the facts into a generated
inventory; Claude turns them into the hand-written architecture doc that explains what each part is for and how
to work with it. Run it once when a project starts (the heavy pass), then again after structural changes.

## Requirements

- A **site adapter** module exporting `SITE` and `rest(path, { method, body })` (authenticated WP REST, relative to
  `/wp/v2`), and optionally `php(code)` to run read-only PHP. Without `php()` the theme options, template usage,
  page-builder conditions, child-theme files, and custom field groups are skipped.
- **Project settings** in the project doc that configures the discovery skills (find it from the project's
  CLAUDE.md): adapter path, inventory output path, architecture doc path. The script reads `WP_ADAPTER` and
  `SITE_INVENTORY` from the environment, or `--adapter` and `--out`. Ask the user for whatever is missing.
- Node 22+.

## 1. Collect

Run `node ${CLAUDE_SKILL_DIR}/scripts/site.mjs`. It writes `<inventory>.md` and `<inventory>.json`.

Done when both files carry today's date and the Environment section names the active theme and its parent.

## 2. Check what the script can't see

Read the generated inventory and look up, with read-only calls, what it flags or leaves open:

- page-builder templates without display conditions: unused, or used from other templates (loop items, popups)?
- theme files that override templates (single, archive, page templates) and which content they render;
- menus held inside page-builder header templates rather than WordPress menu locations;
- forms, embeds, and integrations (form plugins, marketing embeds in templates);
- how URLs are managed (permalink plugins, redirects) and how a URL change is made.

Done when every flagged item has an answer or is listed as an open question.

## 3. Update the architecture doc

Create or update the project's architecture doc. For each content type: what builds it, where its content and
fields live, which template renders it, and how to create or edit one. Then the shared parts (header, footer,
menus), URLs, and the access paths for reading and writing. Point to the generated inventory for lists instead of
copying them, so the doc stays short and doesn't go stale.

Done when every content type and template family in the inventory is explained in the doc or deliberately left out.

## 4. Report

Tell the user what changed since the last run (`git diff` on the inventory), the open questions, and anything that
looks broken (dead template conditions, inactive plugins still referenced, templates nothing uses).

Done when the user has the summary and the docs are saved.
