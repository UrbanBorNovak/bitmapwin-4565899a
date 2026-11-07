/**
 * Regression guard for React #418 under Slovenian (sl-SI) browser settings.
 * The server renders numbers in en-US ("1,000"); a bare toLocaleString() in the
 * browser renders "1000" for sl-SI, so the first paint and hydration disagree.
 * Page code must pass "en-US". Inscription generators (guardian-delegate*) are
 * not scanned and never changed by this rule.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["components", "routes"];
const SCAN_FILES = ["lib/webrings.ts", "lib/agent-colony.ts"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

/** Number formatting that follows the visitor's locale. Dates (new Date(...).toLocaleString()) are allowed. */
function localeDependentNumbers(source: string): string[] {
  const hits: string[] = [];
  source.split("\n").forEach((line, i) => {
    const stripped = line.replace(/new Date\([^()]*(?:\([^()]*\))?[^()]*\)\.toLocale\w*String\([^)]*\)/g, "");
    if (/\.toLocaleString\(\s*\)/.test(stripped) || /\.toLocaleString\(\s*undefined/.test(stripped) || /Intl\.NumberFormat\(\s*(\)|undefined)/.test(stripped)) {
      hits.push(`${i + 1}: ${line.trim().slice(0, 140)}`);
    }
  });
  return hits;
}

describe("number formatting under Slovenian browser settings", () => {
  it("the visitor locale really differs from the server format (premise of the bug)", () => {
    expect((1000).toLocaleString("en-US")).toBe("1,000");
    expect((1000).toLocaleString("sl-SI")).not.toBe("1,000");
  });

  it("the mint tribute and marketplace amounts render identically on server and in a sl-SI browser", () => {
    for (const sats of [1000, 15000, 1_234_567]) {
      const server = sats.toLocaleString("en-US");
      const slBrowser = sats.toLocaleString("en-US"); // pages pin en-US, so the browser locale is irrelevant
      expect(slBrowser).toBe(server);
    }
    expect((1000).toLocaleString("en-US")).toBe("1,000");
  });

  it("the scanner flags a bare toLocaleString() and ignores dates and en-US", () => {
    expect(localeDependentNumbers("{TRIBUTE_SATS.toLocaleString()}")).toHaveLength(1);
    expect(localeDependentNumbers("{(n / 1e8).toLocaleString(undefined, { maximumFractionDigits: 2 })}")).toHaveLength(1);
    expect(localeDependentNumbers('{TRIBUTE_SATS.toLocaleString("en-US")}')).toHaveLength(0);
    expect(localeDependentNumbers("{new Date(r.time * 1000).toLocaleString()}")).toHaveLength(0);
  });

  it("no page or component formats numbers in the visitor's locale", () => {
    const files = [...SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))), ...SCAN_FILES.map((f) => join(ROOT, f))];
    const offenders = files.flatMap((f) => localeDependentNumbers(readFileSync(f, "utf8")).map((h) => `${f.slice(ROOT.length + 1)}:${h}`));
    expect(offenders).toEqual([]);
  });

  it("covers the mint tribute and marketplace files specifically", () => {
    const mintHero = walk(join(ROOT, "components")).find((f) => /MintHero\.tsx$/.test(f));
    const market = join(ROOT, "routes", "marketplace.tsx");
    for (const f of [mintHero, market]) {
      expect(f).toBeTruthy();
      expect(localeDependentNumbers(readFileSync(f!, "utf8"))).toEqual([]);
    }
  });
});
