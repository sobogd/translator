// Validates generated locale content:
//  - content/chrome/<locale>.json must mirror app/(en)/texts.json's key tree
//  - content/pairs/<locale>/<slug>.json must match the FeatureContent shape,
//    carry exactly 4 spotlight cards (pair-page requirement), and a canonical
//    URL that matches its file location.
// Usage: node scripts/validate-pair-content.mjs [locale...]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = "https://translate.iq-factura.com";
const refChrome = JSON.parse(fs.readFileSync(path.join(root, "app", "(en)", "texts.json")));

const only = process.argv.slice(2);
const errors = [];

function keyTree(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) keys.push(`${p}[]`);
    else if (v && typeof v === "object") keys.push(...keyTree(v, p));
    else keys.push(p);
  }
  return keys.sort();
}

function emptyStrings(obj, prefix = "") {
  const bad = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      if (!v.trim()) bad.push(p);
    } else if (v && typeof v === "object") bad.push(...emptyStrings(v, p));
  }
  return bad;
}

// chrome files
const chromeDir = path.join(root, "content", "chrome");
const refTree = keyTree(refChrome).join("\n");
for (const f of fs.existsSync(chromeDir) ? fs.readdirSync(chromeDir).sort() : []) {
  if (!f.endsWith(".json")) continue;
  const loc = f.replace(/\.json$/, "");
  if (only.length && !only.includes(loc)) continue;
  let j;
  try {
    j = JSON.parse(fs.readFileSync(path.join(chromeDir, f)));
  } catch (e) {
    errors.push(`chrome/${f}: invalid JSON (${e.message})`);
    continue;
  }
  const tree = keyTree(j).join("\n");
  if (tree !== refTree) {
    const ref = new Set(refTree.split("\n"));
    const got = new Set(tree.split("\n"));
    const missing = [...ref].filter((k) => !got.has(k));
    const extra = [...got].filter((k) => !ref.has(k));
    errors.push(`chrome/${f}: key tree mismatch (missing: ${missing.join(", ") || "-"}; extra: ${extra.join(", ") || "-"})`);
  }
  for (const p of emptyStrings(j)) errors.push(`chrome/${f}: empty string at ${p}`);
}

// pair files
const PAIR_KEYS = [
  "meta.title", "meta.description", "meta.ogTitle", "meta.ogDescription", "meta.canonical", "meta.ogLocale",
  "hero.badgeVoice", "hero.badgeText", "hero.badgeLanguages", "hero.title", "hero.titleAccent",
  "hero.description", "hero.ctaTry", "hero.ctaSignIn",
  "hero.mockFromLabel", "hero.mockFromPhrase", "hero.mockToLabel", "hero.mockToPhrase",
  "spotlights[]", "comparison.title", "comparison.titleAccent", "comparison.description",
  "comparison.usLabel", "comparison.themLabel", "comparison.rows[]",
  "faq.heading", "faq.headingAccent", "faq.sub", "faq.items[]",
  "finalCta.heading", "finalCta.headingAccent", "finalCta.sub", "finalCta.ctaLabel",
].sort().join("\n");

const pairsDir = path.join(root, "content", "pairs");
let pairCount = 0;
for (const loc of fs.existsSync(pairsDir) ? fs.readdirSync(pairsDir).sort() : []) {
  const dir = path.join(pairsDir, loc);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (only.length && !only.includes(loc)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    pairCount++;
    const slug = f.replace(/\.json$/, "");
    const id = `pairs/${loc}/${f}`;
    let j;
    try {
      j = JSON.parse(fs.readFileSync(path.join(dir, f)));
    } catch (e) {
      errors.push(`${id}: invalid JSON (${e.message})`);
      continue;
    }
    const tree = keyTree(j).join("\n");
    if (tree !== PAIR_KEYS) {
      const ref = new Set(PAIR_KEYS.split("\n"));
      const got = new Set(tree.split("\n"));
      const missing = [...ref].filter((k) => !got.has(k));
      const extra = [...got].filter((k) => !ref.has(k));
      errors.push(`${id}: key tree mismatch (missing: ${missing.join(", ") || "-"}; extra: ${extra.join(", ") || "-"})`);
      continue;
    }
    if (j.spotlights.length !== 4) errors.push(`${id}: spotlights must have exactly 4 cards, got ${j.spotlights.length}`);
    for (const [i, s] of j.spotlights.entries()) {
      if (!s.heading || !s.sub || !Array.isArray(s.bullets) || s.bullets.length !== 2)
        errors.push(`${id}: spotlight[${i}] needs heading, sub and exactly 2 bullets`);
      for (const b of s.bullets ?? []) if (!b.title || !b.sub) errors.push(`${id}: spotlight[${i}] bullet missing title/sub`);
    }
    if (j.comparison.rows.length < 4) errors.push(`${id}: comparison needs >=4 rows, got ${j.comparison.rows.length}`);
    for (const r of j.comparison.rows) if (!r.title || !r.us || !r.them) errors.push(`${id}: comparison row missing title/us/them`);
    if (j.faq.items.length < 5) errors.push(`${id}: faq needs >=5 items, got ${j.faq.items.length}`);
    for (const it of j.faq.items) if (!it.q || !it.a) errors.push(`${id}: faq item missing q/a`);
    const expectedCanonical = loc === "en" ? `${SITE_URL}/${slug}` : `${SITE_URL}/${loc}/${slug}`;
    if (j.meta.canonical !== expectedCanonical)
      errors.push(`${id}: canonical "${j.meta.canonical}" != expected "${expectedCanonical}"`);
    for (const p of emptyStrings(j)) errors.push(`${id}: empty string at ${p}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} error(s), ${pairCount} pair file(s) checked`);
  process.exit(1);
}
console.log(`OK: ${pairCount} pair file(s) valid`);
