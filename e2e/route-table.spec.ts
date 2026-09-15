import { test, expect } from "@playwright/test";
import { readdirSync, statSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";
import { ROUTE_PATTERNS, matchRoute } from "../apps/web/lib/route-table";

/* The middleware's route table IS the page tree. If a page is added without a line
   in apps/web/lib/route-table.ts, middleware would 404 it; if a line outlives its
   page, a dead URL would render the storefront fallback. This walks the real
   directory so neither can happen quietly. ADDED, never edited into an existing spec. */

const LOCALE_DIR = resolve("apps/web/app/[locale]");

function pagePatterns(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pagePatterns(p, out);
    else if (name === "page.tsx") out.push(relative(LOCALE_DIR, dir).split(sep).join("/"));
  }
  return out;
}

test("every page under app/[locale] is in the route table, and nothing else is", () => {
  const onDisk = pagePatterns(LOCALE_DIR).filter((p) => p !== "[slug]" && p !== "[...rest]").sort();
  expect(onDisk.length, "the page scan found nothing — wrong directory?").toBeGreaterThan(20);
  expect([...ROUTE_PATTERNS].sort()).toEqual(onDisk);
});

test("matchRoute: real pages match, everything else does not", () => {
  expect(matchRoute("/")).toBe("");
  expect(matchRoute("/explore")).toBe("explore");
  expect(matchRoute("/explore/")).toBe("explore");
  expect(matchRoute("/class/0b6f9a52-1d5e-4a3e-9d1e-3c2b1a0f9e8d")).toBe("class/[id]");
  expect(matchRoute("/guardian/threads/abc")).toBe("guardian/threads/[id]");
  expect(matchRoute("/dashboard/new-class")).toBe("dashboard/new-class");

  for (const miss of ["/a/b", "/class", "/live", "/signup", "/admin", "/class/a/b", "/explore/x", "/yassine-math"]) {
    expect(matchRoute(miss), `${miss} is not a page`).toBeNull();
  }
});
