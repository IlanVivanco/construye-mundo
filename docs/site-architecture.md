# Site architecture

How the site is built and how to work with each part. Lists (plugins, templates, menus, fields) live in the generated
`docs/site-inventory.md`; run `discover-site` to create it and after structural changes.

## Stack

Astra parent + Astra Pro, child theme `theme/` (styles in `style.css`, small tweaks in `functions.php`). Elementor +
Pro. SEO: Yoast. Cookies: Complianz. Images: Smush. Analytics: Site Kit + GTM4WP. Redirects: Redirection. Shared
hosting (Dinahosting, to be confirmed in `docs/deploy.md`).

Theme behaviour worth knowing:

- The blog page (`is_home`) shows only category `3` ("noticias").
- AddToAny's script loads only on single posts and archives.

The rest (content types, templates, menus) is TBD until `discover-site` runs.

## Redirects

The Redirection plugin holds the 301s (group "Redirecciones" for new ones; "Joomla" holds the old site's URLs). `/colabora/turismo-ong-antigua/` (draft page 3612) goes to `/colabora/turismo-ong/` (rule 1022, 2026-11-14).

## Page cache

WP Fastest Cache (free) serves cached HTML through `.htaccess`; mobile visitors get no cache. Set up 2026-11-14:

- Pages with a Gravity Forms form are excluded (exact rules): `colabora`, `colabora/turismo-ong` and the crowdfunding
  page. Add any new page with a form to the exclusions, or its cached nonce breaks the form after a day.
- The whole cache expires every 6 hours (cron `wp_fastest_cache_0`, `everysixhours`), under the 12-hour minimum life
  of a WordPress nonce.
- `WPFC_CLEAR_CACHE_AFTER_PLUGIN_UPDATE` and `_THEME_UPDATE` in `wp-config.php` purge it after updates (backup of
  the previous file: `~/theme-backups/wp-config-20261114.php`). Theme deploys by rsync don't trigger it: purge by hand.
- Purge from PHP: `$GLOBALS['wp_fastest_cache']->deleteCache(true)`.
