#!/usr/bin/env node
// Bulk edits that are too large for an MCP call (whole Elementor trees, long content).
// Everything else (create posts, ACF, Yoast, preview, publish) goes through the cm-novamira MCP.
//
//   node scripts/wp.mjs pull <type> <id>                  fetch one item into artifacts/work/<type>-<id>/
//   node scripts/wp.mjs push <type> <id> [--live]         send local edits back, then delete the local copy
//                                                         (refuses published items without --live)
//   node scripts/wp.mjs clone-page --from <id> --spec <file> [--update <id> [--live]]
//
// <type> is a REST base: pages, posts, event, guide, ...
// clone-page creates drafts. After every Elementor write the page CSS is regenerated (refreshElementorCss).
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ROOT, SITE, rest, refreshElementorCss } from "./lib/site.mjs";

const WORK = join(ROOT, "artifacts", "work");
const workDir = (type, id) => join(WORK, `${type}-${id}`);
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

async function pull(type, id) {
  const item = await rest(`${type}/${id}?context=edit`);
  const dir = workDir(type, id);
  mkdirSync(dir, { recursive: true });
  const elementor = item.meta?._elementor_data;
  if (elementor) writeJson(join(dir, "elementor.json"), JSON.parse(elementor));
  if (item.content?.raw) writeFileSync(join(dir, "content.html"), item.content.raw);
  writeJson(join(dir, "fields.json"), {
    title: item.title.raw,
    slug: item.slug,
    excerpt: item.excerpt?.raw,
    ...(item.acf && !Array.isArray(item.acf) ? { acf: item.acf } : {}),
  });
  writeJson(join(dir, ".pulled.json"), { status: item.status, modified_gmt: item.modified_gmt, link: item.link });
  console.log(`pulled ${type}/${id} (${item.status}) -> ${dir}`);
}

async function push(type, id, { live }) {
  const dir = workDir(type, id);
  if (!existsSync(join(dir, ".pulled.json"))) throw new Error(`pull ${type} ${id} first`);
  const pulled = readJson(join(dir, ".pulled.json"));
  const remote = await rest(`${type}/${id}?context=edit&_fields=status,modified_gmt`);
  if (remote.modified_gmt !== pulled.modified_gmt) {
    throw new Error(`${type}/${id} changed on the site since it was pulled (${pulled.modified_gmt} -> ${remote.modified_gmt}). Pull again and reapply your edits.`);
  }
  if (remote.status === "publish" && !live) {
    throw new Error(`${type}/${id} is published: pushing changes the live page. Re-run with --live if that is intended.`);
  }
  const body = readJson(join(dir, "fields.json"));
  if (existsSync(join(dir, "content.html"))) body.content = readFileSync(join(dir, "content.html"), "utf8");
  const tree = existsSync(join(dir, "elementor.json")) ? readJson(join(dir, "elementor.json")) : null;
  if (tree) body.meta = { _elementor_data: JSON.stringify(tree) };
  const saved = await rest(`${type}/${id}`, { method: "POST", body });
  if (tree) await refreshElementorCss(id, tree);
  rmSync(dir, { recursive: true, force: true }); // the site now holds this content; keep no local copy
  console.log(`pushed ${type}/${id} (${saved.status}); local copy removed`);
}

// --- clone-page: copy a V3 Elementor page and replace its copy by element id -------------

const TEXT_WIDGETS = new Set(["heading", "text-editor", "button", "icon-list", "nested-accordion"]);
const COPIED_META = [
  "_elementor_edit_mode", "_elementor_template_type", "_elementor_page_settings",
  "site-sidebar-layout", "site-content-layout", "ast-site-content-layout", "site-post-title", "ast-featured-img",
];

function replaceList(id, current = [], values, key) {
  if (values.length !== current.length) throw new Error(`${id}: needs ${current.length} items, got ${values.length}`);
  current.forEach((item, i) => (item[key] = values[i]));
}

function applyTexts(node, texts, report) {
  const s = node.settings && !Array.isArray(node.settings) ? node.settings : (node.settings = {});
  const override = texts[node.id];
  if (override) {
    report.used.add(node.id);
    for (const [k, v] of Object.entries(override)) {
      if (k === "link") s.link = { ...(s.link || {}), url: v };
      else if (k === "icon_list") replaceList(node.id, s.icon_list, v, "text");
      else if (k === "items") replaceList(node.id, s.items, v, "item_title");
      else {
        if (typeof s[k] === "string" && /<(span|strong|em|a|br)\b/.test(s[k]) && !/<(span|strong|em|a|br)\b/.test(v)) {
          report.lostMarkup.push(`${node.id}.${k}`);
        }
        s[k] = v;
      }
    }
  } else if (TEXT_WIDGETS.has(node.widgetType)) {
    report.missing.push(`${node.id} (${node.widgetType})`);
  }
  for (const child of node.elements || []) applyTexts(child, texts, report);
}

async function clonePage({ from, spec: specFile, update, live }) {
  const spec = readJson(specFile);
  if (update) {
    const target = await rest(`pages/${update}?context=edit&_fields=status`);
    if (target.status === "publish" && !live) {
      throw new Error(`pages/${update} is published: updating it changes the live page. Re-run with --live if that is intended.`);
    }
  }
  const ref = await rest(`pages/${from}?context=edit`);
  const tree = JSON.parse(ref.meta._elementor_data);
  const report = { used: new Set(), missing: [], lostMarkup: [] };
  tree.forEach((n) => applyTexts(n, spec.texts, report));

  const unknown = Object.keys(spec.texts).filter((id) => !report.used.has(id));
  if (unknown.length) throw new Error(`unknown element ids in spec: ${unknown.join(", ")}`);
  if (report.missing.length) console.warn(`WARNING: ${report.missing.length} text widgets keep the reference copy: ${report.missing.join(", ")}`);
  if (report.lostMarkup.length) console.warn(`WARNING: inline markup (highlights, links) dropped in: ${report.lostMarkup.join(", ")}`);

  const meta = Object.fromEntries(COPIED_META.filter((k) => k in ref.meta).map((k) => [k, ref.meta[k]]));
  meta._elementor_data = JSON.stringify(tree);
  const body = { title: spec.title, slug: spec.slug, template: ref.template, meta, ...(update ? {} : { status: "draft" }) };
  const page = await rest(update ? `pages/${update}` : "pages", { method: "POST", body });
  await refreshElementorCss(page.id, tree);
  console.log(`${page.status} ${page.id}: ${SITE}/wp-admin/post.php?post=${page.id}&action=elementor`);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { from: { type: "string" }, spec: { type: "string" }, update: { type: "string" }, live: { type: "boolean" } },
});
const [cmd, a, b] = positionals;
const commands = {
  pull: () => pull(a, b),
  push: () => push(a, b, values),
  "clone-page": () => clonePage(values),
};
if (!commands[cmd]) {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1);
  console.error(lines.slice(0, lines.findIndex((l) => !l.startsWith("//"))).join("\n").replace(/^\/\/ ?/gm, ""));
  process.exit(1);
}
commands[cmd]().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
