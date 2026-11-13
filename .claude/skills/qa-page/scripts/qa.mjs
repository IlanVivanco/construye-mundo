#!/usr/bin/env node
// Mechanical QA of one web page: status and robots, SEO head tags, heading structure, screenshots and horizontal
// overflow at each width, images, console errors and failed requests, internal links, forbidden hosts and text, and
// an axe accessibility scan. Writes report.md, report.json, and screenshots; exits 1 when any check fails.
//
//   node qa.mjs <url> [--out <dir>] [--widths 390,1024,1366,1440] [--expect-robots index|noindex]
//                     [--forbid-host <host,host>] [--forbid-text <text,text>] [--max-links 80]
//
// Defaults from the environment: QA_OUT (default "qa"), QA_WIDTHS, QA_FORBID_HOSTS, QA_FORBID_TEXT.
// Needs Node 22+, Playwright with Chromium, and axe-core in the project.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" }, widths: { type: "string" }, "expect-robots": { type: "string" },
    "forbid-host": { type: "string" }, "forbid-text": { type: "string" }, "max-links": { type: "string" },
  },
});
const url = positionals[0];
if (!url) {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1);
  console.error(lines.slice(0, lines.findIndex((l) => !l.startsWith("//"))).join("\n").replace(/^\/\/ ?/gm, ""));
  process.exit(1);
}
const env = process.env;
const list = (v) => (v || "").split(",").map((x) => x.trim()).filter(Boolean);
const widths = list(opt.widths || env.QA_WIDTHS || "390,1024,1366,1440").map(Number);
const forbidHosts = list(opt["forbid-host"] || env.QA_FORBID_HOSTS);
const forbidText = list(opt["forbid-text"] || env.QA_FORBID_TEXT);
const maxLinks = Number(opt["max-links"] || 80);
const slug = new URL(url).pathname.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";
const outDir = resolve(opt.out || join(env.QA_OUT || "qa", `${new Date().toISOString().slice(0, 10)}-${slug}`));
mkdirSync(outDir, { recursive: true });

const checks = [];
const check = (area, status, msg) => checks.push({ area, status, msg });
const { chromium } = await import("playwright");
const axePath = createRequire(resolve("package.json")).resolve("axe-core");

const browser = await chromium.launch();
const shots = [];
try {
  // --- main load at desktop: status, head, headings, links, console, requests, axe ---------------
  const page = await browser.newPage({ viewport: { width: widths[widths.length - 1], height: 900 } });
  const consoleErrors = [];
  const failed = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));
  page.on("requestfailed", (r) => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 150)}`));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url().slice(0, 150)}`));
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  const status = res?.status();
  check("status", status === 200 ? "pass" : "fail", `HTTP ${status} for ${url}`);

  const head = await page.evaluate(() => {
    const m = (sel, attr = "content") => document.querySelector(sel)?.getAttribute(attr) ?? null;
    return {
      title: document.title, description: m('meta[name="description"]'), robots: m('meta[name="robots"]'),
      canonical: m('link[rel="canonical"]', "href"), ogTitle: m('meta[property="og:title"]'), ogDescription: m('meta[property="og:description"]'),
      ogImage: m('meta[property="og:image"]'), twitterCard: m('meta[name="twitter:card"]'), lang: document.documentElement.lang,
      schema: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => { try { const j = JSON.parse(s.textContent); return (j["@graph"] || [j]).map((x) => x["@type"]).flat(); } catch { return []; } }),
    };
  });
  const robotsHeader = res?.headers()["x-robots-tag"] || null;
  const noindex = /noindex/i.test(`${head.robots} ${robotsHeader}`);
  if (opt["expect-robots"]) check("seo", (opt["expect-robots"] === "noindex") === noindex ? "pass" : "fail", `robots: ${head.robots ?? "none"}${robotsHeader ? `, X-Robots-Tag: ${robotsHeader}` : ""} (expected ${opt["expect-robots"]})`);
  else check("seo", noindex ? "warn" : "pass", `robots: ${head.robots ?? "none"}${noindex ? " (page is noindex)" : ""}`);
  const len = (s) => (s ? s.length : 0);
  check("seo", head.title && len(head.title) >= 30 && len(head.title) <= 65 ? "pass" : "warn", `title (${len(head.title)} chars): ${head.title}`);
  check("seo", head.description && len(head.description) >= 120 && len(head.description) <= 160 ? "pass" : "warn", `meta description (${len(head.description)} chars): ${head.description ?? "missing"}`);
  check("seo", head.canonical ? "pass" : "warn", `canonical: ${head.canonical ?? "missing"}`);
  check("seo", head.ogTitle && head.ogDescription && head.ogImage ? "pass" : "warn", `Open Graph: title ${head.ogTitle ? "✓" : "✗"}, description ${head.ogDescription ? "✓" : "✗"}, image ${head.ogImage ? "✓" : "✗"}; twitter:card ${head.twitterCard ?? "✗"}`);
  check("seo", head.schema.length ? "pass" : "warn", `schema types: ${head.schema.join(", ") || "none"}`);
  check("a11y", head.lang ? "pass" : "fail", `html lang: ${head.lang || "missing"}`);

  const content = await page.evaluate(() => {
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((h) => h.getClientRects().length).map((h) => ({ level: +h.tagName[1], text: h.textContent.trim().slice(0, 80) }));
    const links = [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.href, text: a.textContent.trim().slice(0, 60), inMain: !a.closest('header, footer, nav, [data-elementor-type="header"], [data-elementor-type="footer"]') }));
    const images = [...document.images].map((i) => ({ src: i.currentSrc || i.src, alt: i.getAttribute("alt"), w: i.naturalWidth, shown: i.getBoundingClientRect().width, decorative: i.getAttribute("role") === "presentation" || i.getAttribute("aria-hidden") === "true" }));
    const anchors = [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).filter((h) => h.length > 1 && !document.getElementById(decodeURIComponent(h.slice(1))));
    return { headings, links, images, anchors, text: document.body.innerText };
  });
  const h1 = content.headings.filter((h) => h.level === 1);
  check("structure", h1.length === 1 ? "pass" : "fail", `${h1.length} visible H1${h1.length ? `: ${h1.map((h) => h.text).join(" | ")}` : ""}`);
  const skips = content.headings.filter((h, i) => i && h.level > content.headings[i - 1].level + 1).map((h) => `H${h.level} "${h.text}"`);
  check("structure", skips.length ? "warn" : "pass", skips.length ? `skipped heading levels before: ${skips.slice(0, 5).join(", ")}` : "heading levels don't skip");
  check("links", content.anchors.length ? "fail" : "pass", content.anchors.length ? `anchors with no target: ${[...new Set(content.anchors)].join(", ")}` : "every on-page anchor has a target");

  const noAlt = content.images.filter((i) => i.alt === null && !i.decorative);
  check("images", noAlt.length ? "fail" : "pass", noAlt.length ? `${noAlt.length} image(s) without an alt attribute: ${noAlt.slice(0, 5).map((i) => i.src.split("/").pop()).join(", ")}` : "every image has an alt attribute");
  // A 0 natural width also happens for SVGs without intrinsic size, so confirm by fetching the file.
  const zero = [...new Set(content.images.filter((i) => i.src && i.w === 0 && !i.src.startsWith("data:")).map((i) => i.src))];
  const broken = [];
  for (const src of zero) {
    const r = await fetch(src).catch(() => null);
    if (!r || r.status >= 400) broken.push({ src: `${r ? r.status : "error"} ${src}` });
  }
  check("images", broken.length ? "fail" : "pass", broken.length ? `${broken.length} broken image(s): ${broken.slice(0, 5).map((i) => i.src).join(", ")}` : "no broken images");
  const oversized = content.images.filter((i) => i.shown > 0 && i.w > i.shown * 2.5 && i.w > 1200);
  check("images", oversized.length ? "warn" : "pass", oversized.length ? `${oversized.length} image(s) much larger than shown: ${oversized.slice(0, 5).map((i) => `${i.src.split("/").pop()} (${i.w}px shown at ${Math.round(i.shown)}px)`).join(", ")}` : "image sizes fit their display size");

  check("console", consoleErrors.length ? "warn" : "pass", consoleErrors.length ? `${consoleErrors.length} console error(s): ${[...new Set(consoleErrors)].slice(0, 5).join(" | ")}` : "no console errors");
  check("requests", failed.length ? "warn" : "pass", failed.length ? `${failed.length} failed request(s): ${[...new Set(failed)].slice(0, 8).join(" | ")}` : "no failed requests");

  // Forbidden hosts (in the page's own markup, outside the shared header and footer) and forbidden text
  const html = await page.evaluate(() => {
    const body = document.body.cloneNode(true);
    body.querySelectorAll('header, footer, [data-elementor-type="header"], [data-elementor-type="footer"], .site-header, .site-footer').forEach((e) => e.remove());
    return body.innerHTML;
  });
  for (const host of forbidHosts) {
    const n = html.split(host).length - 1;
    check("content", n ? "fail" : "pass", n ? `${n} reference(s) to forbidden host ${host}` : `no references to ${host}`);
  }
  for (const t of forbidText) {
    const hit = content.text.toLowerCase().includes(t.toLowerCase());
    check("content", hit ? "fail" : "pass", hit ? `visible text contains "${t}"` : `no "${t}" in visible text`);
  }

  // Internal links in the main content: status
  const origin = new URL(url).origin;
  const internal = [...new Set(content.links.filter((l) => l.inMain && l.href.startsWith(origin)).map((l) => l.href.split("#")[0]))].slice(0, maxLinks);
  const bad = [];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (internal.length) {
      const href = internal.shift();
      try {
        const r = await fetch(href, { redirect: "manual" });
        if (r.status >= 400) bad.push(`${r.status} ${href}`);
        else if (r.status >= 300) bad.push(`${r.status} → ${r.headers.get("location")} (${href})`);
      } catch (e) {
        bad.push(`error ${href}`);
      }
    }
  }));
  const broken4xx = bad.filter((b) => /^[45]\d\d|^error/.test(b));
  check("links", broken4xx.length ? "fail" : bad.length ? "warn" : "pass", bad.length ? `internal links not 200: ${bad.slice(0, 10).join(" | ")}` : "internal links in the content return 200");

  // Accessibility (axe-core, WCAG 2 A/AA)
  await page.addScriptTag({ path: axePath });
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
  });
  const serious = axe.filter((v) => v.impact === "serious" || v.impact === "critical");
  check("a11y", serious.length ? "fail" : axe.length ? "warn" : "pass", axe.length ? `axe: ${axe.map((v) => `${v.id} (${v.impact}, ${v.nodes})`).join(", ")}` : "axe: no WCAG A/AA violations");
  await page.close();

  // --- every width: screenshot and horizontal overflow ----------------------------------------
  for (const width of widths) {
    const p = await browser.newPage({ viewport: { width, height: 900 } });
    await p.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    const overflow = await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
      // Elementor's JS sticky rewrites inline position/top (also on the resize a full-page capture causes) and
      // leaves a hidden spacer: a stylesheet with !important outranks its inline styles.
      const pin = document.createElement("style");
      pin.textContent = ".elementor-sticky--active, .elementor-sticky { position: relative !important; top: auto !important; }"
        + " .elementor-sticky__spacer { display: none !important; }";
      document.head.append(pin);
      for (const el of document.querySelectorAll("body *")) {
        const pos = getComputedStyle(el).position;
        if (pos === "fixed") el.style.setProperty("position", "absolute", "important");
        if (pos === "sticky") el.style.setProperty("position", "relative", "important");
      }
      const vw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 1 && r.width > 0 && getComputedStyle(e).visibility !== "hidden"; })
        .map((e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`);
      return { scroll: document.documentElement.scrollWidth > vw, wide: [...new Set(wide)].slice(0, 5) };
    });
    const file = join(outDir, `${width}.png`);
    await p.screenshot({ path: file, fullPage: true });
    shots.push(file);
    check("layout", overflow.scroll ? "fail" : overflow.wide.length ? "warn" : "pass", overflow.scroll ? `${width}px: page scrolls horizontally (${overflow.wide.join(", ")})` : overflow.wide.length ? `${width}px: elements extend past the viewport but are clipped (${overflow.wide.join(", ")})` : `${width}px: no horizontal overflow`);
    await p.close();
  }
} finally {
  await browser.close();
}

const icon = { pass: "✓", warn: "!", fail: "✗" };
const count = (s) => checks.filter((c) => c.status === s).length;
const md = `# QA: ${url}

${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${count("fail")} failed, ${count("warn")} warnings, ${count("pass")} passed.
Screenshots: ${shots.map((s) => `\`${s.split("/").pop()}\``).join(", ")} in \`${outDir}\`.

| | Area | Result |
|---|---|---|
${checks.sort((a, b) => ({ fail: 0, warn: 1, pass: 2 })[a.status] - ({ fail: 0, warn: 1, pass: 2 })[b.status]).map((c) => `| ${icon[c.status]} | ${c.area} | ${c.msg.replace(/\|/g, "\\|")} |`).join("\n")}

Not checked by this script: visual match with the design, copy and brand voice, facts, and the project's own
checklist items. Review the screenshots at every width.
`;
writeFileSync(join(outDir, "report.md"), md);
writeFileSync(join(outDir, "report.json"), JSON.stringify({ url, widths, checks, shots }, null, 1));
console.log(`${count("fail")} failed, ${count("warn")} warnings, ${count("pass")} passed → ${join(outDir, "report.md")}`);
process.exit(count("fail") ? 1 : 0);
