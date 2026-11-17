# Known site issues

Open problems found while working on the site. Remove an entry when it is fixed; add one when you find a problem you
are not fixing right away.

| Issue | Where | Impact | Suggested fix |
|---|---|---|---|
| Novamira logs that it loads the bundled MCP Adapter (deprecated since 0.7.0) | `novamira` | Log noise only, a few a day | Update Novamira, or install the MCP Adapter plugin |
| Backups only on the same server | UpdraftPlus, `wp-content/updraft/` | A host failure loses site and backups | Add a remote destination |

The full audit, with every finding and the plan, is in Notion (`docs/notion.md`).
