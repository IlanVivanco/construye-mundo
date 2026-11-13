# Construye Mundo

WordPress child theme for the NGO Construye Mundo (construyemundo.org), based on Astra, plus the Claude Code setup to
work on the site.

- `theme/`: the child theme. This is what gets deployed (`docs/deploy.md`).
- `scripts/`, `.claude/`, `docs/`: tooling and knowledge for working on the site with Claude.

## Get started

You need Node.js 22+, Claude Code, and the Novamira plugin active on the site.

1. In WordPress, go to **Users → Profile → Application Passwords** and create a password.
2. Run `npm run setup`. It asks for the username and that password, writes `.env`, and checks the connection.
3. Add the `SSH_*` values to `.env` (see `.env.example`).
4. Open this folder in Claude Code and approve the **cm-novamira** server when asked.

## Local clone

DDEV project `construye-mundo` in `~/ddev/construye-mundo/`. Setup and refresh steps: `docs/local-dev.md`.
