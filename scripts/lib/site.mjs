// Shared helpers: credentials from .env, WP REST calls and Novamira ability calls.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SITE = (loadEnv().WP_SITE_URL || "").replace(/\/$/, "");
export const API = `${SITE}/wp-json/wp/v2`;
const ABILITIES = `${SITE}/wp-json/wp-abilities/v1/abilities`;
const MCP = `${SITE}${loadEnv().WP_MCP_PATH || "/wp-json/mcp/novamira"}`;

export function loadEnv() {
  const env = {};
  const file = join(ROOT, ".env");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("WP_"))) };
}

export function authHeader() {
  const env = loadEnv();
  if (!SITE) throw new Error("Set WP_SITE_URL in .env (see .env.example)");
  if (!env.WP_USER || !env.WP_APP_PASSWORD) {
    throw new Error("Set WP_USER and WP_APP_PASSWORD in .env (see .env.example)");
  }
  const token = Buffer.from(`${env.WP_USER}:${env.WP_APP_PASSWORD.replace(/\s/g, "")}`).toString("base64");
  return `Basic ${token}`;
}

async function request(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: authHeader(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.replace(SITE, "")} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export const rest = (path, { method = "GET", body } = {}) => request(`${API}/${path}`, method, body);

// Runs a WordPress ability (Novamira, Elementor, ...) through the Abilities REST API. The method follows the
// ability's annotations, read once per ability: read-only → GET with the input as `input[key]=value` query
// parameters; destructive → DELETE, which also reads its input from the query string, so a large input (a whole
// Elementor tree) can't fit: those go through the MCP endpoint instead; anything else → POST.
const annotations = new Map();
async function annotationsOf(name) {
  if (!annotations.has(name)) annotations.set(name, (await request(`${ABILITIES}/${name}`, "GET"))?.meta?.annotations ?? {});
  return annotations.get(name);
}
export async function ability(name, input = {}) {
  const { readonly, destructive } = await annotationsOf(name);
  if (destructive) return mcpAbility(name, input);
  if (!readonly) return request(`${ABILITIES}/${name}/run`, "POST", { input });
  const query = new URLSearchParams(Object.entries(input).map(([k, v]) => [`input[${k}]`, String(v)]));
  return request(`${ABILITIES}/${name}/run${query.size ? `?${query}` : ""}`, "GET");
}

// Runs an ability through the site's MCP endpoint (the same server as the cm-novamira MCP), as JSON-RPC.
let mcpSession;
async function mcpCall(method, params) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(mcpSession ? { "Mcp-Session-Id": mcpSession } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MCP ${method} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  mcpSession ||= res.headers.get("mcp-session-id");
  const msg = JSON.parse(text);
  if (msg.error) throw new Error(`MCP ${method}: ${msg.error.message}`);
  return msg.result;
}
async function mcpAbility(name, input) {
  if (!mcpSession) {
    await mcpCall("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "connector-scripts", version: "1" } });
  }
  const result = await mcpCall("tools/call", { name: "mcp-adapter-execute-ability", arguments: { ability_name: name, parameters: input } });
  // Errors and some results come back as plain text instead of structured content.
  const text = (result.content || []).map((c) => c.text).filter(Boolean).join("\n");
  let out = result.structuredContent;
  if (out === undefined) {
    try {
      out = JSON.parse(text);
    } catch {
      out = { success: !result.isError, message: text };
    }
  }
  if (result.isError || out?.success === false) throw new Error(`${name}: ${(text || JSON.stringify(out)).slice(0, 3000)}`);
  return out?.data ?? out;
}

// Runs read-only PHP on the site (Novamira execute-php) and returns its return value. Used by the discovery
// skills for data the REST API doesn't expose (theme options, template conditions). Admin-only on the site.
export async function php(code) {
  const res = await ability("novamira/execute-php", { code });
  if (res?.success === false) throw new Error(`php: ${res.error_message || JSON.stringify(res).slice(0, 500)}`);
  return res?.return_value ?? res;
}

// Elementor compiles each document's CSS into a file that REST meta writes don't refresh: after writing
// `_elementor_data` or `_elementor_page_settings` through REST the page keeps the old styles. The Novamira Elementor
// abilities are Pro (unlicensed on this site), so this clears the post's CSS meta and Elementor's file cache in PHP.
export async function refreshElementorCss(postId) {
  await clearElementorCache(postId);
}

export const clearElementorCache = (...postIds) =>
  php(`foreach ([${postIds.map(Number).join(",")}] as $id) { delete_post_meta($id, '_elementor_css'); delete_post_meta($id, '_elementor_element_cache'); }
\\Elementor\\Plugin::$instance->files_manager->clear_cache();
return true;`);
