# Server and deploy

## Server

Shared hosting (Dinahosting). SSH with the `.env` `SSH_*` values (default key). WordPress root `SSH_WP_PATH`
(`/home/construyemundo/www`); DB `construye_wp` (~70 MB), uploads ~1.5 GB.

WP-CLI: the default `php` is 7.0 and breaks WordPress, so run it with PHP 8.2:
`ssh <user>@<host> "cd <wp path> && php82 /usr/local/bin/wp <command>"`. Plugin notices print on every call; ignore
them unless they are the point.

## Deploy

Manual: the theme on the server (`wp-content/themes/construye-mundo/`) is not a git checkout, there is no cron, and
the GitHub repo has no workflows or webhooks. Ship `theme/` only; the rest of the repo is tooling.

1. Back up the server copy outside the webroot: `cp -a <wp path>/wp-content/themes/construye-mundo
   ~/theme-backups/construye-mundo-<yyyymmdd>`.
2. Preview, then sync: `rsync -avc --delete --exclude phpcs.xml --exclude .gitkeep -e "ssh -p <port>" theme/
   <user>@<host>:<wp path>/wp-content/themes/construye-mundo/` (add `-n` first for a dry run). `--delete` removes
   server files the repo lacks, so check the dry run for anything that isn't in git yet.
3. Check the home and a post return 200 and the served `style.css` has the change.

Roll back by syncing the backup folder back. Last reconciled 2026-11-13 (backup `construye-mundo-20261113`); the
server had dead files (`admin.css`, `inc/give.php` from GiveWP) and was missing the last commit.
