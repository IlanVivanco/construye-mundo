# Known site issues

Open problems found while working on the site. Remove an entry when it is fixed; add one when you find a problem you
are not fixing right away.

| Issue | Where | Impact | Suggested fix |
|---|---|---|---|
| Child stylesheet version is `rand() . CM_THEME_VERSION` | `theme/functions.php` `iv_enqueue_styles` | Browsers and caches never reuse `style.css`: a new URL on every page view | Use `filemtime()` of `style.css` or the theme version |
| Donation "realmente estás pagando" amounts wrong for 40 € and 80 € | `/colabora/` Gravity Forms form 3 "Donaciones", HTML fields 18 (40 €, says 15,67 €) and 17 (80 €, says 39,67 €) | Contradicts the 80 % deduction the page explains | Should say 8 € and 16 € (80 % up to 250 €); the other notes are right |
| Backups only on the same server | UpdraftPlus, `wp-content/updraft/` | A host failure loses site and backups | Add a remote destination |
| `WP_DEBUG` + `WP_DEBUG_LOG` on; `debug.log` ~1 GB since 2025-07 (web access is blocked: 403) | `wp-config.php` | Disk use; 99.9 % of it is one Photo Gallery 1.8.49 notice (`_load_textdomain_just_in_time` for `photo-gallery`, on every request), which buries real errors | Silence that notice with a mu-plugin, move the log out of `wp-content`, delete the old one |

The full audit, with every finding and the plan, is in Notion (`docs/notion.md`).
