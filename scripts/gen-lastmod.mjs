// Writes content/last-modified.json: the real commit date of every file that
// drives a page, so app/sitemap.ts can stop advertising one hardcoded date
// for whole groups of URLs. Search engines discount <lastmod> once it is
// obviously synthetic, and a constant that has to be bumped by hand is
// synthetic the first time someone forgets.
//
// Runs as part of `npm run build`. The output is committed so a build without
// git history (or with a shallow clone) still has dates; a failure here is
// non-fatal and simply leaves the previous file in place.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "content/last-modified.json";

// One walk of the history, newest commit first, instead of a `git log` per
// file: 220-odd invocations is slow enough to notice in CI.
const TRACKED = ["content", "app/(en)/texts.json", "app/ru/texts.json", "app/_landing/legal-content.ts"];

/** content/pairs/ru/foo.json -> "ru/foo"; a locale's chrome -> "home:ru". */
function keyFor(file) {
  const pair = file.match(/^content\/pairs\/([a-z]{2})\/([a-z0-9-]+)\.json$/);
  if (pair) return `${pair[1]}/${pair[2]}`;
  const chrome = file.match(/^content\/chrome\/([a-z]{2})\.json$/);
  if (chrome) return `home:${chrome[1]}`;
  if (file === "app/(en)/texts.json") return "home:en";
  if (file === "app/ru/texts.json") return "home:ru";
  if (file === "app/_landing/legal-content.ts") return "legal";
  return null;
}

function main() {
  // %cs is the committer date as YYYY-MM-DD, which is the form <lastmod>
  // wants and the form the sitemap already used.
  const log = execFileSync(
    "git",
    ["log", "--format=%cs", "--name-only", "--no-renames", "--", ...TRACKED],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  const dates = {};
  let current = null;
  for (const line of log.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      current = trimmed;
      continue;
    }
    const key = keyFor(trimmed);
    // Newest commit first, so the first date seen for a file is its latest.
    if (key && current && !dates[key]) dates[key] = current;
  }

  const sorted = Object.fromEntries(Object.keys(dates).sort().map((k) => [k, dates[k]]));
  const next = `${JSON.stringify(sorted, null, 2)}\n`;

  let prev = "";
  try {
    prev = readFileSync(OUT, "utf8");
  } catch {
    /* first run */
  }
  if (prev === next) {
    console.log(`[lastmod] ${Object.keys(sorted).length} entries, unchanged`);
    return;
  }
  writeFileSync(OUT, next);
  console.log(`[lastmod] wrote ${Object.keys(sorted).length} entries to ${OUT}`);
}

try {
  main();
} catch (e) {
  // Shallow clone, no git, no history — keep whatever is committed.
  console.log(`[lastmod] skipped (${e.message.split("\n")[0]})`);
}
