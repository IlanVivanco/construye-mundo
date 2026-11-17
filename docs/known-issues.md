# Known site issues

Open problems found while working on the site. Remove an entry when it is fixed; add one when you find a problem you
are not fixing right away.

| Issue | Where | Impact | Suggested fix |
|---|---|---|---|
| Child stylesheet version is `rand() . CM_THEME_VERSION` | `src/theme/functions.php` `iv_enqueue_styles` | Browsers and caches never reuse `style.css`: a new URL on every page view | Use `filemtime()` of `style.css` or the theme version |
| `WP_DEBUG` on in production (log at `~/wp-logs/`, see `docs/deploy.md`) | `wp-config.php` | Fine while the log stays small; the Photo Gallery notice is silenced by `src/mu-plugins/silence-photo-gallery-textdomain-notice.php` | Turn off once the plugin cleanup is done |
| Photo Gallery logs ~700 `TenWebNewLibConfig` dynamic-property deprecations a day (not the silenced textdomain notice) | `photo-gallery/wd/config.php` | Log noise only (~150 KB/day) | Replace Photo Gallery, or extend the mu-plugin |
| Novamira logs that it loads the bundled MCP Adapter (deprecated since 0.7.0) | `novamira` | Log noise only, a few a day | Update Novamira, or install the MCP Adapter plugin |
| Leftover cron events from removed plugins: `w3tc_purge_all_wpcron`, `give_weekly_scheduled_events`, `give_monthly_scheduled_events` | WP-Cron | None (no callback) | Unschedule with `wp cron event delete` |
| Backups only on the same server | UpdraftPlus, `wp-content/updraft/` | A host failure loses site and backups | Add a remote destination |

The full audit, with every finding and the plan, is in Notion (`docs/notion.md`).
