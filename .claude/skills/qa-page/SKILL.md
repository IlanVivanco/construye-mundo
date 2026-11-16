---
name: qa-page
description: Runs quality checks on a web page before hand-off or go-live (HTTP status and robots, SEO head tags, heading structure, screenshots and overflow at every breakpoint, images, console errors, failed requests, internal links, forbidden hosts and placeholder text, accessibility), then works through the project's go-live checklist and reports what fails. Use when asked to QA, check, test, or review a page or post, before publishing, or as the review step of another page or content skill.
compatibility: Node 22+, Playwright with Chromium, and axe-core installed in the project.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/qa.mjs *)
---

# QA a page

Checks one page the way a careful reviewer would, in two layers: a script for everything mechanical, then the
project's go-live checklist for what needs judgment. The script never changes the site; fixes are a separate step
the user or the calling skill decides on.

## Requirements

- Node 22+, Playwright with Chromium, and axe-core in the project (`npm i -D playwright axe-core`,
  `npx playwright install chromium`).
- The project's **go-live checklist** and QA settings (widths, forbidden hosts and text, expected robots for test
  pages, output folder), found from the project's CLAUDE.md. The script reads `QA_OUT`, `QA_WIDTHS`,
  `QA_FORBID_HOSTS`, `QA_FORBID_TEXT` from the environment, or the matching flags. Without settings it checks at
  390, 1024, 1366, and 1440 px with no forbidden hosts or text.

## 1. Get a URL the browser can open

A published page: its URL. A draft: a public preview link from the project's preview method (for Elementor,
`elementor/create-preview-link`; it snapshots one revision, so make a new one after each change). A login-only
preview won't load in the script's browser.

Done when the URL loads in a plain request (`curl -sI <url>` returns 200).

## 2. Run the checks

Run `node ${CLAUDE_SKILL_DIR}/scripts/qa.mjs <url>`, adding `--expect-robots noindex` for test content and
`--expect-robots index` for real content. It writes `report.md`, `report.json`, and one screenshot per width to the
output folder, and exits 1 when a check fails.

Done when the report exists and every width has a screenshot.

## 3. Review what the script can't judge

1. Look at every screenshot: broken layouts, overlapping or clipped text, empty sections, wrong images, unstyled
   embeds. For a page built from a design, compare with the design's screenshots at the same widths.
2. Go through the project's go-live checklist for this content type, item by item, skipping what the report already
   covers.
3. Triage the report: separate problems this page introduced from site-wide ones (shared header and footer, known
   issues in the project's docs).

Done when every checklist item is marked pass, fail, or not applicable, and every failed check is classed as this
page or site-wide.

## 4. Report

Tell the user, failures first: what fails, where (width, element, link), whether this page or the whole site causes
it, and the fix you recommend. Include the report path and the front URL. Add site-wide problems that aren't yet
listed to the project's known-issues doc.

Done when the user has the summary and new site-wide problems are recorded.
