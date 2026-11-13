# Deploy

How theme code reaches the server. **TBD: confirm over SSH.** The GitHub repo (public) has no workflows, webhooks, or
deployments, so a server-side `git pull` or a manual upload is likely.

Since the `ai-setup` branch the theme lives in `theme/`, next to tooling that must not reach the server
(`node_modules/`, `scripts/`, `docs/`, `.env`). Whatever the deploy is, it ships `theme/` only, to
`wp-content/themes/construye-mundo/`.

Fill in once confirmed: host, WordPress root, how the theme is updated, and how to roll back.
