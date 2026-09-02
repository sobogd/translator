// IndexNow ping, run from .github/workflows/deploy.yml after the prod restart.
//
// One endpoint (api.indexnow.org) fans the submission out to Bing, Yandex,
// Seznam and Naver. Google does not participate — it stays on GSC + the
// regular crawl, so nothing here replaces the sitemap.
//
// Submits only what the deploy actually changed. Re-submitting all 259 URLs
// on every release is what the protocol calls spam, and repeated offenders
// get their key throttled (429) — the whole list only goes out when the
// change is site-wide (shared template) or the diff is unavailable.
//
// Runs on the GitHub runner, not the VPS: it needs git history, and only the
// built .next is shipped to the server.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const KEY = process.env.INDEXNOW_KEY;
const SITE_URL = (process.env.SITE_URL ?? "https://iq-translate.com").replace(/\/$/, "");
const ENDPOINT = "https://api.indexnow.org/indexnow";

// Files that change what a single page renders, mapped to that page's URL.
// Everything else either affects every page (-> full submit) or no page at
// all (-> skipped). Mirrors lib/locale-paths.ts: en lives at the root, every
// other locale under /<locale>.
const localeHome = (locale) => (locale === "en" ? "/" : `/${locale}`);
const localePath = (locale, slug) => (locale === "en" ? `/${slug}` : `/${locale}/${slug}`);

// Touching one of these changes the rendered output of every page, so the
// per-file mapping below cannot express it — fall back to the full list.
const SITE_WIDE = [
  /^app\/_landing\//,
  /^app\/layout\.tsx$/,
  /^app\/globals\.css$/,
  /^app\/sitemap\.ts$/,
  /^app\/robots\.ts$/,
  /^lib\//,
  /^components\//,
  /^next\.config\.ts$/,
];

// Derived or non-rendering files: a change here never needs its own ping.
// content/index.ts is generated from the content/ tree by
// scripts/gen-content-index.mjs, so the JSON that drove it is already in the
// diff and maps on its own.
const IGNORED = [
  /^content\/index\.ts$/,
  /^\.github\//,
  /^scripts\//,
  /^prisma\//,
  /^package(-lock)?\.json$/,
  /^README\.md$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^nginx\//,
  /^tsconfig\.json$/,
  /^eslint\.config\.mjs$/,
  /^postcss\.config\.mjs$/,
];

/** One changed file -> the page paths it affects, or null when it needs a full submit.
 *  Exported so the mapping can be exercised without performing a submission. */
export function pathsForFile(file) {
  if (IGNORED.some((re) => re.test(file))) return [];

  // Legal copy is checked before the site-wide app/_landing/ rule below:
  // it only feeds the two English legal pages, not the shared chrome.
  if (file === "app/_landing/legal-content.ts") return ["/privacy", "/terms"];

  if (SITE_WIDE.some((re) => re.test(file))) return null;

  // A locale's chrome drives its home page and its /pricing page — the pair
  // pages of that locale render their own content JSON for everything but
  // the header/footer, which is what the site-wide rule above already covers.
  const chrome = file.match(/^content\/chrome\/([a-z]{2})\.json$/);
  if (chrome) return [localeHome(chrome[1]), localePath(chrome[1], "pricing")];
  if (file === "app/(en)/texts.json") return ["/", "/pricing"];
  if (file === "app/ru/texts.json") return ["/ru", "/ru/pricing"];

  const pair = file.match(/^content\/pairs\/([a-z]{2})\/([a-z0-9-]+)\.json$/);
  if (pair) return [localePath(pair[1], pair[2])];

  // Unknown file under a rendering directory: assume the worst rather than
  // silently skipping a page that did change.
  if (/^(app|content)\//.test(file)) return null;
  return [];
}

async function changedPaths(files) {
  const out = new Set();
  for (const file of files) {
    const paths = pathsForFile(file);
    if (paths === null) return null; // site-wide change
    paths.forEach((p) => out.add(p));
  }
  return [...out];
}

/** Every live URL, read from the deployed sitemap rather than re-deriving it
 *  from lib/pairs.ts — the sitemap is already the single source of truth and
 *  a second copy of the URL rules here would drift. */
async function allUrlsFromSitemap() {
  const res = await fetch(`${SITE_URL}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml responded ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function gitDiff(before, sha) {
  // github.event.before is all-zeroes on the first push to a branch and empty
  // on workflow_dispatch; both mean "no usable diff" -> full submit.
  if (!before || !sha || /^0+$/.test(before)) return null;
  try {
    const out = execFileSync("git", ["diff", "--name-only", `${before}..${sha}`], {
      encoding: "utf8",
    });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch (e) {
    console.log(`[indexnow] git diff failed (${e.message}) — submitting everything`);
    return null;
  }
}

async function main() {
  if (!KEY) {
    console.log("[indexnow] INDEXNOW_KEY not set — skipping");
    return;
  }

  const files = gitDiff(process.env.BEFORE_SHA, process.env.CURRENT_SHA);
  let urls;

  if (files === null) {
    urls = await allUrlsFromSitemap();
    console.log(`[indexnow] no diff available — full submit (${urls.length} urls)`);
  } else {
    const paths = await changedPaths(files);
    if (paths === null) {
      urls = await allUrlsFromSitemap();
      console.log(`[indexnow] site-wide change — full submit (${urls.length} urls)`);
    } else if (paths.length === 0) {
      console.log("[indexnow] no page-affecting files in this deploy — nothing to submit");
      return;
    } else {
      // The en home is SITE_URL with no trailing slash, same form the sitemap
      // and the canonical tags use — a slashed variant would be a URL Bing
      // has never seen.
      urls = paths.map((p) => `${SITE_URL}${p}`.replace(/\/$/, ""));
      console.log(`[indexnow] ${urls.length} changed url(s):\n  ${urls.join("\n  ")}`);
    }
  }

  // INDEXNOW_DRY_RUN prints the payload and stops — used to check the
  // file-to-URL mapping after touching it, without burning a real submission.
  if (process.env.INDEXNOW_DRY_RUN) {
    console.log(`[indexnow] dry run, not submitting ${urls.length} url(s)`);
    return;
  }

  // 10 000 URLs per request is the protocol cap; 259 fits in one.
  const body = {
    host: new URL(SITE_URL).host,
    key: KEY,
    keyLocation: `${SITE_URL}/${KEY}.txt`,
    urlList: urls,
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  // 200/202 = accepted. 400 malformed, 403 key not verifiable at keyLocation,
  // 422 url not on this host, 429 throttled. All are logged, none are fatal:
  // the deploy already succeeded and indexing is not release-critical.
  const text = await res.text().catch(() => "");
  console.log(`[indexnow] ${res.status} ${res.statusText} ${text}`.trim());
}

// Guarded so importing this module (to check the mapping) does not submit.
// process.argv[1] is undefined under `node -e`, hence the null check.
const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (import.meta.url === entry) {
  main().catch((e) => {
    console.log(`[indexnow] failed: ${e.message}`);
  });
}
