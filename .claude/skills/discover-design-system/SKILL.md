---
name: discover-design-system
description: Inventories a WordPress site's design system (page-builder kit colors, typography, theme styles, layout and breakpoints; theme design options; fonts; global CSS sources; values stored in reference documents; and computed styles rendered on reference pages at every breakpoint), finds drift between them, and maintains the project's design-system doc that page builds and design reviews compare against. Use when setting up that doc for a site, after the kit, theme settings, or reference pages change, when the doc looks stale, or when asked which styles the site uses.
compatibility: WordPress; optional Elementor; read-only PHP through the site adapter for foundations; Node 22+ and Playwright with Chromium.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/design-system.mjs *)
---

# Discover design system

Builds the project's design system from what the site actually defines and renders. A script collects three layers
(foundations, stored values, rendered styles) and the drift between them into a generated inventory; with the user,
Claude turns that into the hand-written design-system doc: the standard values, and a decision for each drift.
Run it once when a project starts (the heavy pass), then after the kit, theme settings, or reference pages change.

## Requirements

- A **site adapter** module exporting `SITE` and `php(code)` (read-only PHP). Without `php()` only the rendered
  layer runs.
- **Project settings** in the project doc that configures the discovery skills (find it from the project's
  CLAUDE.md): adapter path, references file, inventory output path, design-system doc path. The script reads
  `WP_ADAPTER`, `DESIGN_REFERENCES`, and `DESIGN_INVENTORY`, or `--adapter`, `--references`, `--out`.
- Node 22+ and Playwright with Chromium in the project (`npm i -D playwright`, `npx playwright install chromium`).

## 1. Choose the references

One reference per template family the site renders, so every kind of page is measured: front page, each page
template in use, each content type's single and archive template, landing pages, and the header and footer
templates. Take the family list from the site inventory (call the Skill tool with `discover-site` first if there is
none). For each reference record `label`, `url`, the builder document id in `post` when there is one, `why`, and
`"render": false` for header and footer templates (their stored values matter; their pages are sampled anyway).
Prefer a recent, representative example of each family; leave out test content.

Done when every template family in the site inventory has a reference or a stated reason to leave it out, and the
user has agreed on the list.

## 2. Collect

Run `node ${CLAUDE_SKILL_DIR}/scripts/design-system.mjs`. It writes `<inventory>.md` and `<inventory>.json`; the
JSON is what `build-from-design` compares client designs against. A full run renders every reference at every
active breakpoint and takes several minutes.

Done when both files carry today's date, every reference has rendered styles (or a recorded error), and the drift
candidates section exists.

## 3. Decide the drift

For each drift candidate (one token defined in several places with different values, unused globals, frequent
hardcoded values, inconsistent heading sizes), work out which value is the standard: compare with the rendered
majority and the newest reference pages. Ask the user to confirm, in one round (AskUserQuestion, recommended option
first). Record each decision, and whether the source should be fixed on the site, in the design-system doc. Fixing
the site is a separate task the user asks for.

Done when every drift candidate has a decision or is listed as open.

## 4. Write the design-system doc

Create it from [assets/doc-template.md](assets/doc-template.md) the first time, then keep it current: color roles,
type scale, buttons and states, cards, layout and container widths, breakpoints, spacing, fonts per weight,
highlights, header and footer, global CSS sources, and the drift decisions. Name each value and where it lives (kit
global, theme option, CSS file, hardcoded). Point to the inventory for full lists instead of copying them.

Done when every template topic has concrete values that match the inventory or a recorded decision.

## 5. Report

Tell the user what changed since the last run (`git diff` on the inventory and the doc), the decisions made, the
open items, and the site fixes worth doing.

Done when the user has the summary and the docs are saved.
