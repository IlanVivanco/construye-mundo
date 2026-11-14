# Server and deploy

## Server

Shared hosting (Dinahosting). SSH with the `.env` `SSH_*` values (default key). WordPress root `SSH_WP_PATH`
(`/home/construyemundo/www`); DB `construye_wp` (~70 MB), uploads ~1.5 GB.

WP-CLI: the default `php` is 7.0 and breaks WordPress, so run it with PHP 8.2:
`ssh <user>@<host> "cd <wp path> && php82 /usr/local/bin/wp <command>"`. Plugin notices print on every call; ignore
them unless they are the point.

Debug log: `WP_DEBUG_LOG` writes to `~/wp-logs/wp-debug.log`, outside the webroot (`~/logs` belongs to the host and
holds the Apache logs, read-only). The log before 2026-11-14, without the Photo Gallery noise, is
`~/wp-logs/debug-2025-07_2026-11-sin-photo-gallery.log.gz`. `wp-config.php` backup before these changes:
`~/theme-backups/wp-config-20261114.php`.

## Deploy

Manual: the theme on the server (`wp-content/themes/construye-mundo/`) is not a git checkout, there is no cron, and
the GitHub repo has no workflows or webhooks. Ship `theme/` and `mu-plugins/`; the rest of the repo is tooling.

`mu-plugins/` holds single files, copied one by one (no `--delete`: the server folder also has Elementor's
`elementor-safe-mode.php`): `scp mu-plugins/<file> <user>@<host>:<wp path>/wp-content/mu-plugins/`. Delete a file on
the server when you delete it from the repo.

Theme:

1. Back up the server copy outside the webroot: `cp -a <wp path>/wp-content/themes/construye-mundo
   ~/theme-backups/construye-mundo-<yyyymmdd>`.
2. Preview, then sync: `rsync -avc --delete --exclude phpcs.xml --exclude .gitkeep -e "ssh -p <port>" theme/
   <user>@<host>:<wp path>/wp-content/themes/construye-mundo/` (add `-n` first for a dry run). `--delete` removes
   server files the repo lacks, so check the dry run for anything that isn't in git yet.
3. Check the home and a post return 200 and the served `style.css` has the change.
4. Purge the page cache (`docs/site-architecture.md`, Page cache): an rsync doesn't trigger it.

Roll back by syncing the backup folder back. Last reconciled 2026-11-13 (backup `construye-mundo-20261113`); the
server had dead files (`admin.css`, `inc/give.php` from GiveWP) and was missing the last commit.
