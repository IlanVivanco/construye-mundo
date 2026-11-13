# Server and deploy

## Server

Shared hosting (Dinahosting). SSH with the `.env` `SSH_*` values (default key). WordPress root `SSH_WP_PATH`
(`/home/construyemundo/www`); DB `construye_wp` (~70 MB), uploads ~1.5 GB.

WP-CLI: the default `php` is 7.0 and breaks WordPress, so run it with PHP 8.2:
`ssh <user>@<host> "cd <wp path> && php82 /usr/local/bin/wp <command>"`. Plugin notices print on every call; ignore
them unless they are the point.

## Deploy

Manual. The theme on the server (`wp-content/themes/construye-mundo/`) is not a git checkout, there is no cron, and
the GitHub repo has no workflows or webhooks. Copy `theme/` to that folder (scp/rsync over SSH) and nothing else:
the rest of the repo is tooling (`node_modules/`, `scripts/`, `docs/`, `.env`).

Before deploying, diff `theme/` against the server copy: the server has drifted from the repo before
(`docs/known-issues.md`). Keep a copy of the server folder in `artifacts/` to roll back.
