# Known site issues

Open problems found while working on the site. Remove an entry when it is fixed; add one when you find a problem you
are not fixing right away.

| Issue | Where | Impact | Suggested fix |
|---|---|---|---|
| Child stylesheet version is `rand() . CM_THEME_VERSION` | `theme/functions.php` `iv_enqueue_styles` | Browsers and caches never reuse `style.css`: a new URL on every page view | Use `filemtime()` of `style.css` or the theme version |
