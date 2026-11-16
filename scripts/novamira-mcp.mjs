#!/usr/bin/env node
// stdio launcher for the cm-novamira MCP server: runs the repo-pinned
// @automattic/mcp-wordpress-remote with the .env credentials as WP_API_* env vars
// (the package ignores CLI flags). Run `npm install` once after cloning.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SITE, loadEnv } from "./lib/site.mjs";

const proxy = join(ROOT, "node_modules", "@automattic", "mcp-wordpress-remote", "dist", "proxy.js");
if (!existsSync(proxy)) {
  console.error("Missing dependencies: run `npm install` in the repo root.");
  process.exit(1);
}
const env = loadEnv();
if (!env.WP_USER || !env.WP_APP_PASSWORD) {
  console.error("Set WP_USER and WP_APP_PASSWORD in .env (see .env.example)");
  process.exit(1);
}

const child = spawn(process.execPath, [proxy], {
  stdio: "inherit",
  env: {
    ...process.env,
    WP_API_URL: `${SITE}${env.WP_MCP_PATH || "/wp-json/mcp/novamira"}`,
    WP_API_USERNAME: env.WP_USER,
    WP_API_PASSWORD: env.WP_APP_PASSWORD,
  },
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
