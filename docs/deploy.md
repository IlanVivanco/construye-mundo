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

Automatic: `.github/workflows/deploy.yml` (Ilán's `IlanVivanco/wp-deployment-action`, `SERVER_TYPE: custom`) runs on
every push to `main` that touches `src/`: PHP 8.2 lint, theme rsync with `--delete`, mu-plugins
rsync without it (the server folder also has Elementor's `elementor-safe-mode.php`), page cache purge, and a 200 check
on the home and `/colabora/`. Run it by hand from the Actions tab; manual runs default to a dry run.

GitHub settings: environment `production`, which only `main` can deploy to. Secret `SSH_PRIVATE_KEY` is Ilán's own
SSH key (`~/.ssh/id_rsa`, his choice over a deploy-only key): when he rotates that key, update the secret. Host,
user and path are in the workflow itself. The host key isn't pinned (Ilán's choice): the action trusts the key the
server presents, so a Dinahosting server change needs no update.

A file deleted from `src/mu-plugins/` stays on the server: delete it there by hand. The rest of the repo is tooling and
never ships.

Manual fallback, when Actions is down or for a hotfix. mu-plugins, one file at a time:
`scp src/mu-plugins/<file> <user>@<host>:<wp path>/wp-content/mu-plugins/`. Theme:

1. Back up the server copy outside the webroot: `cp -a <wp path>/wp-content/themes/construye-mundo
   ~/theme-backups/construye-mundo-<yyyymmdd>`.
2. Preview, then sync: `rsync -avc --delete --exclude phpcs.xml --exclude .gitkeep -e "ssh -p <port>" src/theme/
   <user>@<host>:<wp path>/wp-content/themes/construye-mundo/` (add `-n` first for a dry run). `--delete` removes
   server files the repo lacks, so check the dry run for anything that isn't in git yet.
3. Check the home and a post return 200 and the served `style.css` has the change.
4. Purge the page cache (`docs/site-architecture.md`, Page cache): an rsync doesn't trigger it.

Roll back by reverting the commit on `main` (the workflow redeploys), or by syncing a backup folder back. Last
reconciled by hand 2026-11-13 (backup `construye-mundo-20261113`); the server had dead files (`admin.css`, `inc/give.php` from GiveWP) and was missing the last commit.
