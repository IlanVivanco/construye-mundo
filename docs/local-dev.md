# Local DDEV clone

There is no staging, so changes to try before production (plugins, theme code, site-wide settings) go to a local
clone first.

- Location: `~/ddev/construye-mundo/`, DDEV project `construye-mundo`, at https://construye-mundo.ddev.site. Outside
  this repo. DB dumps stay in the clone's `.ddev/db-dumps/` (they hold donor data: never copy them into the repo).
- Log in with your production user and password (the users table comes from production).
- Mail goes to Mailpit: `ddev launch -m`.

## Refresh from production

`scripts/clone-refresh.sh` (add `--skip-files` to refresh only the database). Read-only on production. It:

1. Rsyncs the WordPress files, without backups, caches, logs, `wp-config.php` or the child theme (~2 GB the first
   time, ~5 min).
2. Dumps the database with WP-CLI over SSH and imports it (keeps the last 3 dumps).
3. Replaces the production URL, in plain and JSON-escaped form (Elementor data), and in generated CSS.
4. Makes the clone safe: Stripe in test mode with the live keys deleted, Gravity SMTP off (real mail), GTM4WP and
   Site Kit off (analytics), UpdraftPlus off, search engines blocked.
5. Clears WP Fastest Cache and Elementor's CSS cache.

Test donations work locally with Stripe's test cards (the test keys come from production). Stripe's webhooks can't
reach the clone, so test entries stay `Processing`: check the PaymentIntent in Stripe instead.

## Updating plugins

Licensed plugins (Elementor Pro, Schema Pro, Novamira Pro, Gravity SMTP, Gravity Forms Stripe) don't offer their update
package to the clone's domain. Read each package URL from production's `update_plugins` site transient over SSH
(read-only; the URLs carry the license, so write them to a file, not to the terminal), download the zips and install
them with `ddev wp plugin install <zip> --force`. Take `ddev snapshot` first; after updating, run
`ddev wp elementor update db`, `ddev wp elementor-pro update db` and `ddev wp elementor flush-css`.

## Repo mounts

`.ddev/docker-compose.repo-mounts.yaml` mounts `src/theme/` as `wp-content/themes/construye-mundo/` and each file of
`src/mu-plugins/` into `wp-content/mu-plugins/`, so repo edits show up in the clone without copying. A new mu-plugin needs
its own line there and a `ddev restart`. Restart too after a mounted path moves in the repo (the old mount stays empty) or when a mounted mu-plugin file
stops picking up edits (single-file mounts go stale when the file is replaced).

## First-time setup

If the clone is lost, rebuild it:

1. `mkdir -p ~/ddev/construye-mundo && cd ~/ddev/construye-mundo && ddev config --project-name=construye-mundo
   --project-type=wordpress --docroot="" --php-version=8.2 --database=mariadb:10.11 --webserver-type=apache-fpm`
   (production: PHP 8.2, MariaDB 10.11).
2. Write the repo mounts file (above) and create the empty mount point `wp-content/themes/construye-mundo/`.
3. `ddev start`, then in the generated `wp-config.php` remove the `#ddev-generated` line (so DDEV stops rewriting
   it) and add `WP_ENVIRONMENT_TYPE` `local` and `WP_DEBUG` + `WP_DEBUG_LOG` (log in `wp-content/debug.log`).
4. `scripts/clone-refresh.sh`.
