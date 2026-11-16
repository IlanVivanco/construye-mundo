#!/usr/bin/env node
// Inventories a WordPress site: environment, themes (parent and child), theme options, plugins, content types,
// taxonomies, templates (theme files, block templates, Elementor Theme Builder), menus, and URL settings.
//
//   node site.mjs [--out <path without extension>] [--adapter <module>]
//
// Writes <out>.md (readable, fully generated) and <out>.json. Defaults: SITE_INVENTORY, WP_ADAPTER.
// The adapter exports SITE, rest(path, { method, body }) and, optionally, php(code) to run read-only PHP; without
// php() the sections the REST API doesn't expose (theme options, template usage and conditions, child-theme files,
// field groups) are marked as not collected.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values: opt } = parseArgs({ options: { out: { type: "string" }, adapter: { type: "string" } } });
const out = opt.out || process.env.SITE_INVENTORY;
const adapterPath = opt.adapter || process.env.WP_ADAPTER;
if (!out || !adapterPath) {
  const lines = (await import("node:fs")).readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1);
  console.error(lines.slice(0, lines.findIndex((l) => !l.startsWith("//"))).join("\n").replace(/^\/\/ ?/gm, ""));
  process.exit(1);
}
const { SITE, rest, php } = await import(pathToFileURL(resolve(adapterPath)).href);
const root = (path) => rest(path.replace(/^/, "../")).catch(() => null); // rest() is relative to /wp/v2
const tryRest = (path) => rest(path).catch((e) => ({ error: e.message.slice(0, 120) }));

// --- REST: available on any WordPress site ------------------------------------------------------
const index = await fetch(`${SITE}/wp-json/`).then((r) => r.json());
const [types, taxonomies, themes, plugins, menus, locations, settings, templates, parts] = await Promise.all([
  tryRest("types?context=edit"), tryRest("taxonomies?context=edit"), tryRest("themes?per_page=100"),
  tryRest("plugins?per_page=100"), tryRest("menus?per_page=100&context=edit"), tryRest("menu-locations"),
  tryRest("settings"), tryRest("templates?per_page=100"), tryRest("template-parts?per_page=100"),
]);
const menuItems = {};
for (const m of Array.isArray(menus) ? menus : []) {
  const items = await tryRest(`menu-items?menus=${m.id}&per_page=100&context=edit`);
  menuItems[m.id] = Array.isArray(items) ? items.map((i) => ({ title: i.title?.raw ?? i.title?.rendered, url: i.url, parent: i.parent })) : [];
}

// --- PHP: what REST doesn't expose (read-only) ---------------------------------------------------
const PHP = String.raw`
global $wpdb;
$sheet = get_stylesheet(); $tpl = get_template();
$theme = wp_get_theme(); $parent = $theme->parent();
// Theme options: theme_mods plus options named after the theme slugs (astra-settings, et_divi, generate_settings, ...)
$opt_names = $wpdb->get_col($wpdb->prepare("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s OR option_name IN (%s, %s)", $wpdb->esc_like($tpl) . '%', $wpdb->esc_like($sheet) . '%', 'theme_mods_' . $tpl, 'theme_mods_' . $sheet));
$theme_options = [];
foreach ($opt_names as $n) { $v = get_option($n); $theme_options[$n] = is_array($v) ? ['keys' => count($v), 'design' => array_filter($v, fn($val, $k) => preg_match('/color|font|width|container|button|breakpoint|radius|padding|spacing|layout|typography|heading|body/i', (string) $k) && !is_array($val) || (is_array($val) && preg_match('/font|typography|color|button|container|width/i', (string) $k)), ARRAY_FILTER_USE_BOTH)] : ['value' => is_scalar($v) ? substr((string) $v, 0, 200) : gettype($v)]; }
// Theme files: page templates and stylesheets, child and parent
$files = function ($dir) { $out = []; foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)) as $f) { if (preg_match('/\.(css|php)$/', $f) && !preg_match('#/(node_modules|vendor|inc/lib)/#', $f)) $out[substr($f, strlen($dir) + 1)] = filesize($f); } return $out; };
$child_files = is_child_theme() ? $files(get_stylesheet_directory()) : [];
$page_templates = wp_get_theme()->get_page_templates(null, 'page');
// Template usage across published content
$usage = $wpdb->get_results("SELECT p.post_type, COALESCE(NULLIF(m.meta_value, ''), 'default') AS template, COUNT(*) AS n FROM {$wpdb->posts} p LEFT JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = '_wp_page_template' WHERE p.post_status = 'publish' AND p.post_type NOT IN ('attachment','revision','nav_menu_item','wp_global_styles','custom_css','customize_changeset','oembed_cache','user_request','wp_navigation') GROUP BY p.post_type, template ORDER BY n DESC", ARRAY_A);
// Builder usage
$elementor = defined('ELEMENTOR_VERSION') ? ['version' => ELEMENTOR_VERSION, 'pro' => defined('ELEMENTOR_PRO_VERSION') ? ELEMENTOR_PRO_VERSION : null, 'active_kit' => (int) get_option('elementor_active_kit'), 'built_with' => $wpdb->get_results("SELECT p.post_type, COUNT(*) n FROM {$wpdb->posts} p JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = '_elementor_edit_mode' AND m.meta_value = 'builder' WHERE p.post_status = 'publish' GROUP BY p.post_type", ARRAY_A)] : null;
$theme_builder = [];
if ($elementor) {
  foreach (get_posts(['post_type' => 'elementor_library', 'posts_per_page' => -1, 'post_status' => 'publish']) as $t) {
    $type = get_post_meta($t->ID, '_elementor_template_type', true);
    if (in_array($type, ['section', 'container', 'page', 'kit', 'widget'], true)) continue;
    $theme_builder[] = ['id' => $t->ID, 'type' => $type, 'title' => $t->post_title, 'conditions' => array_values((array) get_post_meta($t->ID, '_elementor_conditions', true)), 'modified' => substr($t->post_modified, 0, 10)];
  }
}
$acf = function_exists('acf_get_field_groups') ? array_map(fn($g) => ['title' => $g['title'], 'key' => $g['key'], 'location' => array_map(fn($or) => implode(' & ', array_map(fn($r) => $r['param'] . $r['operator'] . $r['value'], $or)), $g['location']), 'fields' => array_map(fn($f) => $f['name'] . ':' . $f['type'], acf_get_fields($g['key']) ?: []), 'show_in_rest' => !empty($g['show_in_rest'])], acf_get_field_groups()) : null;
return [
  'wp' => get_bloginfo('version'), 'php' => PHP_VERSION, 'server' => $_SERVER['SERVER_SOFTWARE'] ?? null, 'multisite' => is_multisite(),
  'theme' => ['active' => $sheet, 'name' => $theme->get('Name'), 'version' => $theme->get('Version'), 'parent' => $parent ? ['slug' => $tpl, 'name' => $parent->get('Name'), 'version' => $parent->get('Version')] : null, 'block_theme' => wp_is_block_theme()],
  'theme_options' => $theme_options, 'child_files' => $child_files, 'page_templates' => $page_templates, 'template_usage' => $usage,
  'front' => ['show_on_front' => get_option('show_on_front'), 'page_on_front' => (int) get_option('page_on_front'), 'page_for_posts' => (int) get_option('page_for_posts')],
  'permalinks' => get_option('permalink_structure'), 'elementor' => $elementor, 'theme_builder' => $theme_builder, 'acf' => $acf,
  'additional_css_bytes' => strlen(wp_get_custom_css()),
];`;
let server = null;
if (php) {
  try {
    server = await php(PHP);
  } catch (e) {
    console.warn(`WARNING: php() failed, server-side sections skipped: ${e.message.slice(0, 200)}`);
  }
}

// --- assemble -----------------------------------------------------------------------------------
const list = (x) => (Array.isArray(x) ? x : []);
const activePlugins = list(plugins).filter((p) => p.status === "active").map((p) => ({ name: p.name, plugin: p.plugin, version: p.version }));
const data = {
  generated: new Date().toISOString().slice(0, 10),
  site: { url: SITE, name: index.name, description: index.description, timezone: index.timezone_string, namespaces: index.namespaces },
  server,
  themes: list(themes).map((t) => ({ slug: t.stylesheet, name: t.name?.raw ?? t.name, version: t.version, status: t.status, template: t.template })),
  plugins: { active: activePlugins, inactive: list(plugins).filter((p) => p.status !== "active").map((p) => p.name) },
  types: Object.values(types && !types.error ? types : {}).filter((t) => t.viewable || t.slug === "wp_block").map((t) => ({ slug: t.slug, name: t.name, rest_base: t.rest_base, taxonomies: t.taxonomies, hierarchical: t.hierarchical })),
  taxonomies: Object.values(taxonomies && !taxonomies.error ? taxonomies : {}).map((t) => ({ slug: t.slug, name: t.name, types: t.types, rest_base: t.rest_base })),
  block_templates: list(templates).map((t) => ({ id: t.id, title: t.title?.rendered ?? t.slug, source: t.source })),
  template_parts: list(parts).map((t) => ({ id: t.id, area: t.area, source: t.source })),
  menus: list(menus).map((m) => ({ id: m.id, name: m.name, locations: m.locations, items: menuItems[m.id] })),
  menu_locations: Object.values(locations && !locations.error ? locations : {}).map((l) => ({ name: l.name, description: l.description, menu: l.menu })),
  settings: settings && !settings.error ? { title: settings.title, url: settings.url, show_on_front: settings.show_on_front, page_on_front: settings.page_on_front, page_for_posts: settings.page_for_posts, posts_per_page: settings.posts_per_page } : null,
};
writeFileSync(`${out}.json`, JSON.stringify(data, null, 1) + "\n");

// --- markdown -------------------------------------------------------------------------------------
const table = (head, rows) => (rows.length ? `| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}` : "None found.");
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const s = server || {};
const tb = list(s.theme_builder);
const md = `# Site inventory

Generated ${data.generated} by the \`discover-site\` skill from ${SITE}. Don't edit: rerun the skill. The
hand-written architecture doc explains what these parts are for.${server ? "" : "\n\n**Server-side sections not collected** (the adapter has no \`php()\`)."}

## Environment

- WordPress ${s.wp ?? "?"}, PHP ${s.php ?? "?"}, server \`${esc(s.server ?? "?")}\`, multisite: ${s.multisite ?? "?"}
- Theme: **${esc(s.theme?.name ?? data.themes.find((t) => t.status === "active")?.name)}** (\`${s.theme?.active ?? "?"}\` ${s.theme?.version ?? ""})${s.theme?.parent ? `, child of **${esc(s.theme.parent.name)}** (\`${s.theme.parent.slug}\` ${s.theme.parent.version})` : ""}; block theme: ${s.theme?.block_theme ?? "?"}
- Page builder: ${s.elementor ? `Elementor ${s.elementor.version}${s.elementor.pro ? ` + Pro ${s.elementor.pro}` : ""}, active kit \`${s.elementor.active_kit}\`` : "none detected"}
- Front page: ${s.front ? `${s.front.show_on_front}, page \`${s.front.page_on_front}\`, posts page \`${s.front.page_for_posts}\`` : esc(JSON.stringify(data.settings))}; permalinks \`${s.permalinks ?? "?"}\`
- Additional CSS (Customizer): ${s.additional_css_bytes ?? "?"} bytes
- REST namespaces: ${data.site.namespaces.map((n) => `\`${n}\``).join(", ")}

## Plugins (${data.plugins.active.length} active)

${table(["Plugin", "Version"], data.plugins.active.map((p) => [esc(p.name), p.version]))}

Inactive: ${data.plugins.inactive.map(esc).join(", ") || "none"}

## Theme options

Options named after the theme slugs, with their design-related keys (full values in the JSON).

${table(["Option", "Keys", "Design-related keys"], Object.entries(s.theme_options || {}).map(([k, v]) => [`\`${k}\``, v.keys ?? "", v.design ? Object.keys(v.design).slice(0, 25).map((x) => `\`${x}\``).join(", ") + (Object.keys(v.design).length > 25 ? ", …" : "") : esc(v.value)]))}

## Child theme files

${table(["File", "Bytes"], Object.entries(s.child_files || {}).sort((a, b) => b[1] - a[1]).map(([f, b]) => [`\`${f}\``, b]))}

## Content types

${table(["Type", "REST base", "Taxonomies"], data.types.map((t) => [`${esc(t.name)} (\`${t.slug}\`)`, `\`${t.rest_base}\``, t.taxonomies.join(", ")]))}

Taxonomies: ${data.taxonomies.map((t) => `${esc(t.name)} (\`${t.slug}\` → ${t.types.join(", ")})`).join("; ")}

## Templates

Theme page templates: ${Object.entries(s.page_templates || {}).map(([f, n]) => `\`${f}\` (${esc(n)})`).join(", ") || "none"}

Usage on published content:

${table(["Post type", "Template", "Published"], list(s.template_usage).map((u) => [u.post_type, `\`${u.template}\``, u.n]))}

${s.elementor ? `Built with Elementor (published): ${list(s.elementor.built_with).map((b) => `${b.post_type} ${b.n}`).join(", ")}` : ""}

Block templates: ${data.block_templates.map((t) => `\`${t.id}\` (${t.source})`).join(", ") || "none"}

${tb.length ? `### Elementor Theme Builder (${tb.length})

Templates without display conditions don't render anywhere by themselves (loop items and popups are used from other
templates).

${table(["Id", "Type", "Title", "Conditions", "Modified"], tb.map((t) => [t.id, t.type, esc(t.title), t.conditions.length ? t.conditions.map((c) => `\`${c}\``).join(", ") : "—", t.modified]))}` : ""}

## Navigation

${table(["Menu", "Locations", "Items"], data.menus.map((m) => [`${esc(m.name)} (\`${m.id}\`)`, (m.locations || []).join(", ") || "—", (m.items || []).filter((i) => !i.parent).map((i) => esc(i.title)).join(", ")]))}

Menu locations: ${data.menu_locations.map((l) => `\`${l.name}\` → ${l.menu || "empty"}`).join(", ") || "none"}. Page builders can also hold
menus inside header templates; check the Theme Builder header above.

${s.acf ? `## Custom field groups (ACF)

${table(["Group", "Location", "Fields", "REST"], s.acf.map((g) => [esc(g.title), esc(g.location.join(" or ")), g.fields.length, g.show_in_rest ? "yes" : "no"]))}` : ""}
`;
writeFileSync(`${out}.md`, md.replace(/\n{3,}/g, "\n\n"));
console.log(`wrote ${out}.md and ${out}.json${server ? "" : " (REST only)"}`);
