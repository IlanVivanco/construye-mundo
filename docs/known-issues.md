# Known site issues

Open problems found while working on the site. Remove an entry when it is fixed; add one when you find a problem you
are not fixing right away.

| Issue | Where | Impact | Suggested fix |
|---|---|---|---|
| Child stylesheet version is `rand() . CM_THEME_VERSION` | `theme/functions.php` `iv_enqueue_styles` | Browsers and caches never reuse `style.css`: a new URL on every page view | Use `filemtime()` of `style.css` or the theme version |
| `WP_DEBUG` on in production (log at `~/wp-logs/`, see `docs/deploy.md`) | `wp-config.php` | Fine while the log stays small; the Photo Gallery notice is silenced by `mu-plugins/silence-photo-gallery-textdomain-notice.php` | Turn off once the plugin cleanup is done |
| UpdraftPlus 1.26.14 logs a `urldecode()` null deprecation ~30 times a day | `includes/class-onboarding.php` | Log noise only | Wait for an update |
| Leftover cron events from removed plugins: `w3tc_purge_all_wpcron`, `give_weekly_scheduled_events`, `give_monthly_scheduled_events` | WP-Cron | None (no callback) | Unschedule with `wp cron event delete` |
| Backups only on the same server | UpdraftPlus, `wp-content/updraft/` | A host failure loses site and backups | Add a remote destination |

The full audit, with every finding and the plan, is in Notion (`docs/notion.md`).
