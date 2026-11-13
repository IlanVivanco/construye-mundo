# Local DDEV clone

There is no staging, so changes to try before production (plugins, theme code, site-wide settings) go to a local
clone first.

- Location: `~/ddev/construye-mundo/` (DDEV project `construye-mundo`), outside this repo. DB dumps and snapshots
  stay with the clone.
- Theme: symlink or mount `theme/` from this repo into the clone's `wp-content/themes/construye-mundo/`.
- **TBD**: created over SSH (DB dump with WP-CLI, `wp-content/uploads` with rsync), then `search-replace` to the
  `.ddev.site` URL. Write the exact steps here once the first clone works.
