#!/usr/bin/env node
// First-run setup (`npm run setup`, after `npm install`): creates .env with the user's WordPress
// application password and checks that the site and Novamira answer. Safe to re-run.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { ROOT, loadEnv } from "./lib/site.mjs";

const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  console.error(`Node 22 or newer is required (you have ${process.versions.node}).`);
  process.exit(1);
}

const envFile = join(ROOT, ".env");
let env = loadEnv();
if (!env.WP_SITE_URL || !env.WP_USER || !env.WP_APP_PASSWORD) {
  if (!process.stdin.isTTY) {
    console.error("Set WP_SITE_URL, WP_USER and WP_APP_PASSWORD (in .env or the environment) and run setup again.");
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const site = ((await rl.question("\nWordPress site URL [https://construyemundo.org]: ")).trim() || "https://construyemundo.org").replace(/\/$/, "");
  console.log("Create an application password in WP Admin → Users → Profile → Application Passwords.\n");
  const user = (await rl.question("WordPress username or email: ")).trim();
  const password = (await rl.question("Application password: ")).trim();
  rl.close();
  if (existsSync(envFile)) console.log("Replacing the existing .env.");
  writeFileSync(envFile, `WP_SITE_URL=${site}\nWP_USER=${user}\nWP_APP_PASSWORD="${password}"\n`, { mode: 0o600 });
  env = loadEnv();
}

// The adapter reads the site URL when it loads, and the copy imported above loaded before .env existed:
// the query string loads a fresh copy.
const { SITE, rest, ability } = await import("./lib/site.mjs?configured");
console.log(`Connecting to ${SITE}`);

try {
  const me = await rest("users/me?context=edit&_fields=name,roles");
  console.log(`✓ WordPress: connected as ${me.name} (${me.roles.join(", ")})`);
} catch (e) {
  console.error(`✗ WordPress: ${e.message}\n  Check the username and application password in .env.`);
  process.exit(1);
}

try {
  const ctx = await ability("novamira/agent-context");
  const pro = /Pro\b[^\n]*license not active/.test(ctx.instructions || "") ? " (Pro license not active: no Elementor abilities)" : "";
  console.log(`✓ Novamira: abilities reachable, v${ctx.server?.plugin_version}${pro}`);
} catch (e) {
  console.error(`✗ Novamira: ${e.message}\n  Your user may lack permission, or the plugin is inactive.`);
  process.exit(1);
}

console.log("\nAll set. Open this folder in Claude Code and approve the cm-novamira server when asked.");
