# Known site issues

Open problems found while working on the site. Remove an entry when it is fixed; add one when you find a problem you
are not fixing right away.

| Issue | Where | Impact | Suggested fix |
|---|---|---|---|
| Novamira logs that it loads the bundled MCP Adapter (deprecated since 0.7.0) | `novamira` | Log noise only, a few a day | Update Novamira, or install the MCP Adapter plugin |
| No donation entries in the Donaciones form (id 3) since 2025-11-25, while the other forms keep receiving entries | Gravity Forms, `/colabora/` | Donations may be failing, or arriving only by other channels | Compare with Stripe's dashboard; make a small real donation |
| Donation form (`/colabora/`): step 2 hides "Continuar" until every required field and privacy are filled; the Stripe step is in English with no amount summary | Gravity Forms form 3, Stripe add-on | Likely lost donations | See the UI/UX audit in Notion (`docs/notion.md`) |
| The 404 page requests a font over `http://` (mixed content) | 404 template | Console error, font may not load | Fix the font URL |
| Backups only on the same server | UpdraftPlus, `wp-content/updraft/` | A host failure loses site and backups | Add a remote destination |

The full audit, with every finding and the plan, is in Notion (`docs/notion.md`).
