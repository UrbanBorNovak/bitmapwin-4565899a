import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Runs the V8 inscription's own BW-PAGE-1 code with chain reads replaced by fixtures.
const source = readFileSync(new URL("./guardian-delegate-v8.ts", import.meta.url), "utf8");
const block = source.slice(source.indexOf("var PAGES={}"), source.indexOf("function pageOpen("));
const G = "a".repeat(64) + "i0";
const PAGE = "b".repeat(64) + "i0";
const OTHER = "c".repeat(64) + "i0";
const W1 = "bc1q" + "q".repeat(38);
const W2 = "bc1p" + "p".repeat(58);

function load(opts: { parents: string[]; guardianAddr?: string | null; pageAddr?: string | null }) {
  const json: Record<string, unknown> = {
    [`/r/children/${G}/0`]: { ids: [PAGE], more: false, page: 0 },
    [`/r/parents/${PAGE}`]: { ids: opts.parents, more: false, page: 0 },
    [`/r/inscription/${G}`]: opts.guardianAddr ? { address: opts.guardianAddr } : {},
    [`/r/inscription/${PAGE}`]: opts.pageAddr ? { address: opts.pageAddr } : {},
  };
  const ctx: any = {
    j: async (u: string) => { if (!(u in json)) throw new Error("404 " + u); return json[u]; },
    t: async (u: string) => (u === `/content/${PAGE}` ? 'BW-PAGE-1\n{"title":"T"}' : ""),
    pageDraw() {},
    Promise, JSON, Array, String,
  };
  runInNewContext(block, ctx);
  ctx.pageLoad(G);
  return new Promise<any>((r) => setTimeout(() => r(ctx), 30));
}

describe("BW-PAGE-1 custody labels", () => {
  it("same address means only co-located now", async () => {
    const c = await load({ parents: [G], guardianAddr: W1, pageAddr: W1 });
    expect(c.PAGES[G].st).toBe("LIVE");
    expect(c.PAGES[G].cus).toBe("SAME");
  });
  it("different addresses are SPLIT, never inferred as a transfer or historical page", async () => {
    const c = await load({ parents: [G], guardianAddr: W1, pageAddr: W2 });
    expect(c.PAGES[G].st).toBe("LIVE");
    expect(c.PAGES[G].cus).toBe("SPLIT");
  });
  it("missing owner data stays UNKNOWN while provenance is kept", async () => {
    const c = await load({ parents: [G], guardianAddr: null, pageAddr: W2 });
    expect(c.PAGES[G].st).toBe("LIVE");
    expect(c.PAGES[G].cus).toBe("UNKNOWN");
  });
  it("a page child that does not list this Guardian as parent is refused", async () => {
    const c = await load({ parents: [OTHER], guardianAddr: W1, pageAddr: W1 });
    expect(c.PAGES[G].st).toBe("NONE");
  });
});
