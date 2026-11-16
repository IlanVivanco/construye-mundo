# Construye Mundo

WordPress child theme for the NGO Construye Mundo (construyemundo.org), based on Astra, plus the Claude Code setup to
work on the site.

- `src/`: what ships to the server, deployed on push to `main` (`docs/deploy.md`). Nothing else in the repo does.
  - `src/theme/`: the child theme, `wp-content/themes/construye-mundo/`.
  - `src/mu-plugins/`: must-use plugins, `wp-content/mu-plugins/`.
- `scripts/`, `.claude/`, `docs/`: tooling and knowledge for working on the site with Claude.

## Get started

You need Node.js 22+, Claude Code, and the Novamira plugin active on the site.

1. In WordPress, go to **Users → Profile → Application Passwords** and create a password.
2. Run `npm run setup`. It asks for the username and that password, writes `.env`, and checks the connection.
3. Add the `SSH_*` values to `.env` (see `.env.example`).
4. Open this folder in Claude Code and approve the **cm-novamira** server when asked.

## Local clone

DDEV project `construye-mundo` in `~/ddev/construye-mundo/` (https://construye-mundo.ddev.site). Refresh it from
production with `scripts/clone-refresh.sh`; setup and details in `docs/local-dev.md`.
