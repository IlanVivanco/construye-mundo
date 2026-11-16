#!/usr/bin/env node
// Inventories a WordPress site's design system from three angles:
//   foundations  page-builder kit (Elementor: global colors and typography, theme styles, layout, breakpoints),
//                theme design options, custom fonts, and global CSS sources (builder, Customizer, child theme);
//   stored       colors, typography, radii, and buttons used in the reference documents' Elementor data;
//   rendered     computed styles of body text, headings, links, buttons, and containers on each reference URL, at
//                every active breakpoint (works for any theme, builder, or template).
// Then lists drift candidates: the same token defined in several places with different values.
//
//   node design-system.mjs [--references <json>] [--out <path without extension>] [--adapter <module>]
//
// Writes <out>.md (fully generated) and <out>.json. Defaults: DESIGN_REFERENCES, DESIGN_INVENTORY, WP_ADAPTER.
// References file: [{ "label": "Homepage", "url": "/", "post": 123, "why": "..." }, ...]; "post" (optional) is the
// id of the document whose builder data to read (a page, post, or theme template); "render": false skips sampling
// (e.g. a header template, whose stored values are all that matter).
// The adapter exports SITE and php(code) (read-only PHP; without it only the rendered part runs). Needs Playwright.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values: opt } = parseArgs({
  options: { references: { type: "string" }, out: { type: "string" }, adapter: { type: "string" } },
});
const refsPath = opt.references || process.env.DESIGN_REFERENCES;
const out = opt.out || process.env.DESIGN_INVENTORY;
const adapterPath = opt.adapter || process.env.WP_ADAPTER;
if (!refsPath || !out || !adapterPath) {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1);
  console.error(lines.slice(0, lines.findIndex((l) => !l.startsWith("//"))).join("\n").replace(/^\/\/ ?/gm, ""));
  process.exit(1);
}
const { SITE, php } = await import(pathToFileURL(resolve(adapterPath)).href);
const references = JSON.parse(readFileSync(refsPath, "utf8"));

const hexNorm = (h) => {
  let x = h.replace("#", "").toUpperCase();
  if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join("");
  return `#${x}`;
};
const rgbaToHex = (s) => {
  const [r, g, b, a = 1] = s.match(/[\d.]+%?/g).map((v) => (v.endsWith("%") ? parseFloat(v) / 100 : Number(v)));
  const h = (n) => Math.round(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a * 255) : ""}`.toUpperCase();
};
const tally = (items) => {
  const m = new Map();
  for (const k of items) m.set(k, (m.get(k) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};
const sizeOf = (s) => (s?.size === "" || s?.size == null ? "" : `${s.size}${s.unit === "custom" ? "" : s.unit}`);
const fontBase = (f) => String(f).split(",")[0].replace(/['"]/g, "").toLowerCase()
  .replace(/[-_ ]?(extra|semi|ultra)?[-_ ]?(bold|medium|regular|light|black|thin|heavy|book|italic|normal)\b/g, "").replace(/[^a-z]/g, "");

// --- foundations (server side) -----------------------------------------------------------------
const PHP = String.raw`
$out = ['elementor' => null, 'fonts' => [], 'theme' => [], 'css' => []];
if (defined('ELEMENTOR_VERSION')) {
  $kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
  $s = $kit ? $kit->get_settings() : [];
  $styles = [];
  foreach ($s as $k => $v) {
    if (!preg_match('/^(body|h[1-6]|link_(normal|hover)|button|form_(label|field)|image|paragraph)_/', $k)) continue;
    if ($v === '' || $v === null || $v === [] || (is_array($v) && isset($v['size']) && $v['size'] === '' ) || (is_array($v) && isset($v['top']) && $v['top'] === '')) continue;
    if (preg_match('/(_stop|_position|_xpos|_ypos|_attachment|_repeat|_slideshow|_video|_play|_privacy|_ken_burns|_gradient|_color_b|_bg_width|_box_shadow|_text_shadow|_css_filter|_blur|_brightness|_contrast|_saturate|_hue)/', $k)) continue;
    $styles[$k] = $v;
  }
  $bp = [];
  foreach (\Elementor\Plugin::$instance->breakpoints->get_breakpoints_config() as $name => $c) $bp[$name] = ['value' => $c['value'], 'direction' => $c['direction'], 'active' => $c['is_enabled']];
  $out['elementor'] = [
    'version' => ELEMENTOR_VERSION, 'kit_id' => $kit ? $kit->get_id() : null,
    'system_colors' => $s['system_colors'] ?? [], 'custom_colors' => $s['custom_colors'] ?? [],
    'system_typography' => $s['system_typography'] ?? [], 'custom_typography' => $s['custom_typography'] ?? [],
    'theme_styles' => $styles, '__globals__' => $s['__globals__'] ?? [],
    'layout' => ['container_width' => $s['container_width'] ?? null, 'container_padding' => $s['container_padding'] ?? null, 'space_between_widgets' => $s['space_between_widgets'] ?? null, 'page_title_selector' => $s['page_title_selector'] ?? null, 'default_page_template' => $s['default_page_template'] ?? null],
    'breakpoints' => $bp, 'custom_css' => $s['custom_css'] ?? '',
  ];
  foreach (get_posts(['post_type' => 'elementor_font', 'posts_per_page' => -1]) as $f) $out['fonts'][] = ['source' => 'elementor', 'name' => $f->post_title];
}
foreach (['bsf_custom_fonts'] as $tax) if (taxonomy_exists($tax)) foreach (get_terms(['taxonomy' => $tax, 'hide_empty' => false]) as $t) $out['fonts'][] = ['source' => $tax, 'name' => $t->name];
foreach (get_posts(['post_type' => 'bsf_custom_fonts', 'posts_per_page' => -1]) as $f) $out['fonts'][] = ['source' => 'bsf_custom_fonts', 'name' => $f->post_title];
// Theme design options: options and theme_mods named after the active and parent theme slugs, design keys only
global $wpdb;
$names = $wpdb->get_col($wpdb->prepare("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s", $wpdb->esc_like(get_template()) . '%', $wpdb->esc_like('theme_mods_') . '%'));
foreach ($names as $n) { $v = get_option($n); if (!is_array($v)) continue; $d = []; foreach ($v as $k => $val) if (preg_match('/color|font|width|container|button|breakpoint|radius|padding|spacing|typography|heading|body|link/i', (string) $k) && !preg_match('/usage|nps|cache|_time|transient|header-main-rt|dynamic-(archive|single)/i', (string) $k)) $d[$k] = $val; if ($d) $out['theme'][$n] = $d; }
// Global CSS sources
$out['css']['customizer_additional_css'] = strlen(wp_get_custom_css());
if (is_child_theme()) foreach (glob(get_stylesheet_directory() . '/{*.css,*/*.css,*/*/*.css}', GLOB_BRACE) as $f) $out['css']['child_theme'][str_replace(get_stylesheet_directory() . '/', '', $f)] = filesize($f);
$out['css']['builder_kit_css'] = isset($s) ? strlen($s['custom_css'] ?? '') : 0;
// Builder data for references
$out['documents'] = [];
foreach (REFS as $id) { $p = get_post($id); if ($p) $out['documents'][$id] = ['title' => $p->post_title, 'type' => $p->post_type, 'template_type' => get_post_meta($id, '_elementor_template_type', true), 'data' => get_post_meta($id, '_elementor_data', true)]; }
return $out;`;
let server = null;
if (php) {
  const ids = references.map((r) => r.post).filter(Boolean);
  try {
    server = await php(PHP.replace("REFS", `[${ids.join(",")}]`));
  } catch (e) {
    console.warn(`WARNING: php() failed, foundations and stored values skipped: ${e.message.slice(0, 300)}`);
  }
}
const el = server?.elementor;

// --- stored values from builder data ------------------------------------------------------------
const kitColorList = el ? [...el.system_colors, ...el.custom_colors].map((c) => ({ id: c._id, title: c.title, color: hexNorm(c.color) })) : [];
const kitColors = Object.fromEntries(kitColorList.map((c) => [c.id, c]));
const kitType = el ? [...el.system_typography, ...el.custom_typography].map((t) => ({
  id: t._id, title: t.title, family: t.typography_font_family, weight: t.typography_font_weight, size: sizeOf(t.typography_font_size),
  line_height: t.typography_line_height?.size ? `${t.typography_line_height.size}${t.typography_line_height.unit}` : "",
})) : [];
const stored = { colors: [], type: [], radii: [], buttons: [], boxed: [], globalsUsed: [] };
const visit = (node) => {
  const s = node.settings && !Array.isArray(node.settings) ? node.settings : {};
  const scan = (v) => {
    if (typeof v === "string") {
      for (const [h] of v.matchAll(/#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) stored.colors.push(hexNorm(h));
      for (const [c] of v.matchAll(/rgba?\([^)]+\)/gi)) stored.colors.push(rgbaToHex(c));
    } else if (v && typeof v === "object") Object.values(v).forEach(scan);
  };
  for (const [k, v] of Object.entries(s)) {
    if (k === "__globals__") {
      for (const ref of Object.values(v || {})) {
        if (typeof ref !== "string" || !ref) continue;
        stored.globalsUsed.push(ref);
        const id = ref.match(/colors\?id=(\w+)/)?.[1];
        if (id && kitColors[id]) stored.colors.push(kitColors[id].color);
      }
    } else if (!/^eael_|_stop|gradient_angle/.test(k)) scan(v);
  }
  for (const key of Object.keys(s).filter((k) => k.endsWith("font_family"))) {
    const p = key.slice(0, -"font_family".length);
    const lh = s[`${p}line_height`];
    stored.type.push([node.widgetType || "container", s[key], s[`${p}font_weight`] || "", sizeOf(s[`${p}font_size`]), lh?.size ? lh.size + (lh.unit || "") : ""].join(" | "));
  }
  for (const key of Object.keys(s).filter((k) => /border_radius$/.test(k))) {
    const r = s[key];
    if (r?.top !== undefined && r.top !== "") stored.radii.push(`${r.top}${r.unit}`);
  }
  if (s.boxed_width?.size) stored.boxed.push(`${s.boxed_width.size}${s.boxed_width.unit}`);
  if (node.widgetType === "button") {
    const p = s.text_padding;
    stored.buttons.push(`${s.typography_font_family || "kit"} ${s.typography_font_weight || ""} · padding ${p ? `${p.top}/${p.right}${p.unit}` : "default"} · radius ${s.border_radius ? s.border_radius.top + s.border_radius.unit : "default"} · hover bg ${s.button_background_hover_color || s.__globals__?.button_background_hover_color || "default"}`);
  }
  (node.elements || []).forEach(visit);
};
for (const doc of Object.values(server?.documents || {})) {
  try {
    JSON.parse(doc.data || "[]").forEach(visit);
  } catch {}
}

// --- rendered styles ----------------------------------------------------------------------------
const bps = el?.breakpoints || {};
const active = Object.entries(bps).filter(([, b]) => b.active && b.direction === "max").sort((a, b) => a[1].value - b[1].value);
const widths = [...new Set([390, ...active.slice(1).map(([, b]) => b.value), active.length ? 1440 : 1440, ...(bps.widescreen?.active ? [1920] : [])])];
if (!active.length) widths.splice(0, widths.length, 390, 768, 1024, 1440);
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const rendered = [];
async function sample(ref) {
  const url = new URL(ref.url, SITE).href;
  const perWidth = {};
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      perWidth[width] = await page.evaluate(SAMPLE);
    } catch (e) {
      perWidth[width] = { error: e.message.slice(0, 160) };
    }
    await page.close();
  }
  return { ...ref, url, styles: perWidth };
}
// Runs in the page: most common computed styles per element group, outside header, footer, and navigation.
function SAMPLE() {
  const outside = (e) => e.closest('header, footer, nav, [data-elementor-type="header"], [data-elementor-type="footer"], .site-header, .site-footer');
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const groups = {
    body: "body", h1: "h1", h2: "h2", h3: "h3", h4: "h4", text: "p", link: "p a, li a",
    button: ".elementor-button, .wp-block-button__link, button, input[type=submit], a.button, .ast-button",
    container: ".e-con-boxed > .e-con-inner, .elementor-section-boxed > .elementor-container, .ast-container, .wp-block-group.is-layout-constrained > *, main .container",
  };
  const res = {};
  for (const [g, sel] of Object.entries(groups)) {
    const els = [...document.querySelectorAll(sel)].filter((e) => g === "body" || (!outside(e) && visible(e))).slice(0, 40);
    const combos = {};
    for (const e of els) {
      const cs = getComputedStyle(e);
      const key = g === "container"
        ? `width ${Math.round(e.getBoundingClientRect().width)}px · max-width ${cs.maxWidth} · padding-x ${cs.paddingLeft}`
        : [cs.fontFamily.split(",")[0].replace(/["']/g, ""), cs.fontWeight, cs.fontSize, cs.lineHeight, cs.color,
           ...(g === "button" ? [cs.backgroundColor, `radius ${cs.borderRadius}`, `padding ${cs.paddingTop} ${cs.paddingLeft}`] : [])].join(" · ");
      combos[key] = (combos[key] || 0) + 1;
    }
    res[g] = Object.entries(combos).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }
  return res;
}
try {
  const queue = references.filter((r) => r.render !== false);
  const results = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const ref = queue.shift();
      results.push(await sample(ref));
    }
  }));
  for (const ref of references.filter((r) => r.render !== false)) rendered.push(results.find((r) => r.label === ref.label));
} finally {
  await browser.close();
}

// Font families seen in rendered text, for the typeface check.
const renderedFamiliesFor = () => [...new Set(rendered.flatMap((r) => Object.values(r.styles).flatMap((w) => ["body", "h1", "h2", "h3", "text", "button"].flatMap((g) => (w[g] || []).map(([k]) => k.split(" · ")[0])))))];

// --- drift candidates ---------------------------------------------------------------------------
const drift = [];
const desktop = widths[widths.length - 1] === 1920 ? widths[widths.length - 2] : widths[widths.length - 1];
// Content width: builder kit, theme options, stored containers, rendered containers
const themeWidths = Object.entries(server?.theme || {}).flatMap(([opt, d]) => Object.entries(d).filter(([k, v]) => /content-width|container-width|site-width|container_width/i.test(k) && (typeof v === "number" || /^\d+$/.test(v))).map(([k, v]) => `${opt}.${k} = ${v}px`));
const renderedWidths = tally(rendered.flatMap((r) => (r.styles[desktop]?.container || []).map(([k]) => k.match(/width (\d+)px/)?.[1]).filter(Boolean)));
const widthSources = [
  el?.layout?.container_width?.size ? `builder kit container_width = ${el.layout.container_width.size}${el.layout.container_width.unit}` : null,
  ...themeWidths,
  stored.boxed.length ? `stored boxed widths: ${tally(stored.boxed).map(([w, n]) => `${w} ×${n}`).join(", ")}` : null,
  renderedWidths.length ? `rendered container widths at ${desktop}px: ${renderedWidths.slice(0, 5).map(([w, n]) => `${w}px ×${n}`).join(", ")}` : null,
].filter(Boolean);
if (widthSources.length > 1) drift.push({ topic: "Content width", detail: widthSources });
// Fonts: one typeface registered or referenced under several names
const fontNames = [
  ...(server?.fonts || []).map((f) => `${f.name} (${f.source} font)`),
  ...kitType.map((t) => `${t.family} (kit typography)`),
  ...Object.values(server?.theme || {}).flatMap((d) => Object.entries(d).filter(([k, v]) => /font-family|font_family/i.test(k) && typeof v === "string" && v && v !== "inherit").map(([k, v]) => `${v.split(",")[0].replace(/['"]/g, "")} (theme ${k})`)),
  ...(el?.theme_styles?.body_typography_font_family ? [`${el.theme_styles.body_typography_font_family} (kit body style)`] : []),
];
const byBase = {};
for (const n of [...fontNames, ...renderedFamiliesFor().map((f) => `${f} (rendered)`)]) {
  const [, name, src] = n.match(/^(.*) \((.*)\)$/);
  ((byBase[fontBase(name)] ||= {})[name] ||= new Set()).add(src);
}
for (const [base, names] of Object.entries(byBase)) {
  if (base && Object.keys(names).length > 1) drift.push({ topic: `Typeface "${base}" under ${Object.keys(names).length} names`, detail: Object.entries(names).map(([n, src]) => `${n}: ${[...src].join(", ")}`) });
}
// Kit globals defined but not used by any reference document
if (el) {
  const used = new Set(stored.globalsUsed.map((r) => r.match(/id=(\w+)/)?.[1]));
  const unusedColors = kitColorList.filter((c) => !used.has(c.id));
  const unusedType = kitType.filter((t) => !used.has(t.id));
  if (unusedColors.length) drift.push({ topic: "Kit colors not used by the reference documents", detail: unusedColors.map((c) => `${c.title} ${c.color} (${c.id})`) });
  if (unusedType.length) drift.push({ topic: "Kit typography not used by the reference documents", detail: unusedType.map((t) => `${t.title}: ${t.family} ${t.weight} ${t.size}`) });
  const kitHex = new Set(kitColorList.map((c) => c.color));
  const frequent = tally(stored.colors).filter(([c, n]) => n >= 3 && !kitHex.has(c) && !/^#[0-9A-F]{6}00$/.test(c));
  if (frequent.length) drift.push({ topic: "Hardcoded colors used 3+ times (kit global candidates)", detail: frequent.map(([c, n]) => `${c} ×${n}`) });
  const styled = Object.entries(el.theme_styles || {}).filter(([k]) => /_color$|font_family$/.test(k));
  if (styled.length) drift.push({ topic: "Kit theme styles set (check they match the rendered pages)", detail: styled.map(([k, v]) => `${k} = ${typeof v === "object" ? JSON.stringify(v) : v}`) });
}
// Rendered heading sizes that differ across references at desktop
for (const g of ["h1", "h2"]) {
  const sizes = tally(rendered.map((r) => r.styles[desktop]?.[g]?.[0]?.[0]?.split(" · ")[2]).filter(Boolean));
  if (sizes.length > 1) drift.push({ topic: `${g.toUpperCase()} size differs across references at ${desktop}px`, detail: sizes.map(([s, n]) => `${s} on ${n} reference(s)`) });
}

// --- output -------------------------------------------------------------------------------------
const remOf = (v) => { const m = String(v).match(/([\d.]+)(px|rem)/); return m ? +(m[2] === "px" ? m[1] / 16 : +m[1]).toFixed(4) : null; };
const renderedFamilies = tally(rendered.flatMap((r) => Object.values(r.styles).flatMap((w) => ["body", "h1", "h2", "h3", "text", "button"].flatMap((g) => (w[g] || []).map(([k]) => k.split(" · ")[0])))));
const renderedSizes = [...new Set(rendered.flatMap((r) => Object.values(r.styles).flatMap((w) => ["h1", "h2", "h3", "h4", "text", "link", "button"].flatMap((g) => (w[g] || []).map(([k]) => remOf(k.split(" · ")[2]))))).filter(Boolean))].sort((a, b) => a - b);
const kitName = {};
for (const c of kitColorList) kitName[c.color] ??= c.title;
const data = {
  generated: new Date().toISOString().slice(0, 10),
  references: references.map((r) => ({ ...r, title: server?.documents?.[r.post]?.title, post_type: server?.documents?.[r.post]?.type })),
  breakpoints: bps, widths,
  kit: { colors: kitColorList, typography: kitType, theme_styles: el?.theme_styles || {}, layout: el?.layout || {}, custom_css_bytes: (el?.custom_css || "").length },
  fonts: server?.fonts || [], font_families: renderedFamilies.map(([f]) => f), theme_options: server?.theme || {}, css_sources: server?.css || {},
  colors: tally(stored.colors).map(([color, count]) => ({ color, count, kit: kitName[color] || null })),
  typography: tally(stored.type).map(([combo, count]) => ({ combo, count })),
  radii: tally(stored.radii).map(([radius, count]) => ({ radius, count })),
  buttons: tally(stored.buttons).map(([style, count]) => ({ style, count })),
  sizes_rem: renderedSizes,
  rendered, drift,
};
writeFileSync(`${out}.json`, JSON.stringify(data, null, 1) + "\n");

const table = (head, rows) => (rows.length ? `| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}` : "None.");
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const val = (v) => (typeof v === "object" ? (v.size !== undefined ? `${v.size}${v.unit}` : v.top !== undefined ? `${v.top}/${v.right}/${v.bottom}/${v.left}${v.unit}` : JSON.stringify(v)) : v);
const md = `# Design inventory

Generated ${data.generated} by the \`discover-design-system\` skill. Don't edit: rerun the skill. The hand-written
design-system doc says which of these values are the standard and which are drift.

## References

${table(["Reference", "URL", "Document", "Why"], data.references.map((r) => [esc(r.label), r.url, r.post ? `\`${r.post}\` ${esc(r.title ?? "")} (${r.post_type ?? "?"})` : "—", esc(r.why ?? "")]))}

## Breakpoints

${Object.keys(bps).length ? table(["Breakpoint", "Value", "Direction", "Active"], Object.entries(bps).map(([n, b]) => [n, `${b.value}px`, b.direction, b.active ? "yes" : "no"])) : "No builder breakpoints found."}

Rendered styles below are sampled at ${widths.join(", ")} px.

${el ? `## Builder kit (Elementor ${esc(el.version)}, kit \`${el.kit_id}\`)

### Colors

${table(["Title", "Color", "Id"], kitColorList.map((c) => [esc(c.title), `\`${c.color}\``, `\`${c.id}\``]))}

### Typography presets

${table(["Title", "Family", "Weight", "Size", "Line height", "Id"], kitType.map((t) => [esc(t.title), esc(t.family), t.weight, esc(t.size), t.line_height, `\`${t.id}\``]))}

### Theme styles and layout

${table(["Setting", "Value"], [...Object.entries(el.layout || {}).filter(([, v]) => v !== null && v !== ""), ...Object.entries(el.theme_styles || {})].map(([k, v]) => [`\`${k}\``, `\`${esc(val(v))}\``]))}

Kit global presets assigned to theme styles: ${Object.entries(el.__globals__ || {}).filter(([, v]) => v).map(([k, v]) => `\`${k}\` → \`${v}\``).join(", ") || "none"}.
` : ""}
## Theme design options

${Object.keys(data.theme_options).length ? Object.entries(data.theme_options).map(([o, d]) => `**\`${o}\`**: ${Object.entries(d).slice(0, 60).map(([k, v]) => `\`${k}\` = \`${esc(val(v)).slice(0, 80)}\``).join("; ")}${Object.keys(d).length > 60 ? "; …" : ""}`).join("\n\n") : "None found."}

## Fonts

Registered: ${data.fonts.map((f) => `${esc(f.name)} (${f.source})`).join(", ") || "none found"}

Rendered families (by use): ${renderedFamilies.map(([f, n]) => `${esc(f)} ×${n}`).join(", ")}

## Global CSS sources

${table(["Source", "Bytes"], [["Builder kit custom CSS", data.kit.custom_css_bytes], ["Customizer Additional CSS", data.css_sources.customizer_additional_css ?? "?"], ...Object.entries(data.css_sources.child_theme || {}).map(([f, b]) => [`child theme \`${f}\``, b])])}

## Stored values (reference documents' builder data)

### Colors

${table(["Color", "Uses", "Kit color"], data.colors.slice(0, 30).map((c) => [`\`${c.color}\``, c.count, esc(c.kit ?? "")]))}

### Typography (top 25)

${table(["Widget", "Family", "Weight", "Size", "Line height", "Uses"], data.typography.slice(0, 25).map((t) => [...t.combo.split(" | ").map(esc), t.count]))}

Radii: ${data.radii.map((r) => `\`${r.radius}\` ×${r.count}`).join(", ") || "none"}

${table(["Button style", "Uses"], data.buttons.map((b) => [esc(b.style), b.count]))}

## Rendered styles

Most common computed style per element group (family · weight · size · line height · color; buttons add background,
radius, padding). Header, footer, and navigation are excluded.

${rendered.map((r) => `### ${esc(r.label)} (${r.url})

${table(["Group", ...widths.map((w) => `${w}px`)], ["h1", "h2", "h3", "h4", "text", "link", "button", "container"].map((g) => [g, ...widths.map((w) => r.styles[w]?.error ? `error: ${esc(r.styles[w].error)}` : esc((r.styles[w]?.[g] || []).slice(0, 2).map(([k, n]) => `${k} ×${n}`).join("<br>")))]))}`).join("\n\n")}

## Drift candidates

${drift.map((d) => `- **${esc(d.topic)}**\n${d.detail.map((x) => `  - ${esc(x)}`).join("\n")}`).join("\n") || "None found."}
`;
writeFileSync(`${out}.md`, md.replace(/\n{3,}/g, "\n\n"));
console.log(`wrote ${out}.md and ${out}.json (${references.length} references × ${widths.length} widths, ${drift.length} drift topics)`);
