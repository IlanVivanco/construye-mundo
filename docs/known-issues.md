# Known site issues

Open problems found while working on the site. Remove an entry when it is fixed; add one when you find a problem you
are not fixing right away.

| Issue | Where | Impact | Suggested fix |
|---|---|---|---|
| Child stylesheet version is `rand() . CM_THEME_VERSION` | `theme/functions.php` `iv_enqueue_styles` | Browsers and caches never reuse `style.css`: a new URL on every page view | Use `filemtime()` of `style.css` or the theme version |
| Last commit (`figure` in the `.entry-content` heading margin selector) is not on the server | `theme/style.css` line 111 vs server | Figures in post content miss the margin the repo expects | Deploy `theme/` after the audit, or drop the change |
| Server theme has files the repo lacks: `admin.css` (hides `.e-notice`, not enqueued) and `inc/give.php` (GiveWP fields, not required by `functions.php`) | `wp-content/themes/construye-mundo/` | Dead files; a future deploy with `--delete` would remove them | Confirm they're unused and delete them on the server |
