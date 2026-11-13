# Known site issues

Open problems found while working on the site. Remove an entry when it is fixed; add one when you find a problem you
are not fixing right away.

| Issue | Where | Impact | Suggested fix |
|---|---|---|---|
| Child stylesheet version is `rand() . CM_THEME_VERSION` | `theme/functions.php` `iv_enqueue_styles` | Browsers and caches never reuse `style.css`: a new URL on every page view | Use `filemtime()` of `style.css` or the theme version |
| WP Fastest Cache has no auto-expiry and isn't cleared after updates (cleared by hand 2026-11-13) | All cached pages; `/colabora/` | After the next plugin update or once nonces expire, stale HTML can again break the mobile menu (missing Astra Pro JS) and the donation AJAX (stale Gravity Forms nonce) | Set a timeout shorter than a nonce's life, exclude form pages, clear after every update |
| Donation "realmente estás pagando" amounts wrong for 40 € and 80 € | `/colabora/` Gravity Forms "Donaciones" | Contradicts the 80 % deduction the page explains | Recalculate (80 % up to 250 €) |
| Backups only on the same server | UpdraftPlus, `wp-content/updraft/` | A host failure loses site and backups | Add a remote destination |
| `WP_DEBUG` + `WP_DEBUG_LOG` on; `debug.log` ~1 GB | `wp-config.php` | Disk use, noise | Turn the log off in production, archive and delete |
| Old "Turismo solidario antigua" (3612) is a draft since 2026-11-13, so `/colabora/turismo-ong-antigua/` returns 404 | Was indexed and linked from the footer menu (item now hidden) | Visitors from Google land on a 404 | 301 to `/colabora/turismo-ong/` in Redirection |

The full audit, with every finding and the plan, is in Notion (`docs/notion.md`).
