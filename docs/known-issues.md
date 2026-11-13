# Known site issues

Open problems found while working on the site. Remove an entry when it is fixed; add one when you find a problem you
are not fixing right away.

| Issue | Where | Impact | Suggested fix |
|---|---|---|---|
| Child stylesheet version is `rand() . CM_THEME_VERSION` | `theme/functions.php` `iv_enqueue_styles` | Browsers and caches never reuse `style.css`: a new URL on every page view | Use `filemtime()` of `style.css` or the theme version |
| WP Fastest Cache serves stale desktop HTML (no auto-expiry, not cleared after updates) | All cached pages; `/colabora/` | Missing Astra Pro JS (404) breaks the mobile menu; stale Gravity Forms nonce breaks the donation AJAX | Clear cache, exclude form pages, set a timeout, clear after every update |
| Donation "realmente estás pagando" amounts wrong for 40 € and 80 € | `/colabora/` Gravity Forms "Donaciones" | Contradicts the 80 % deduction the page explains | Recalculate (80 % up to 250 €) |
| Backups only on the same server | UpdraftPlus, `wp-content/updraft/` | A host failure loses site and backups | Add a remote destination |
| `WP_DEBUG` + `WP_DEBUG_LOG` on; `debug.log` ~1 GB | `wp-config.php` | Disk use, noise | Turn the log off in production, archive and delete |

The full audit, with every finding and the plan, is in Notion (`docs/notion.md`).
