import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Execute the inscription's own embedded code, with chain reads replaced by fixtures.
const source = readFileSync(new URL("./guardian-delegate-v8.ts", import.meta.url), "utf8");
const embedded = source.slice(source.indexOf("var PETS=[]"), source.indexOf('\n`;'));
// The array has a companion design store now; locate the declaration without depending on its value.
const code = embedded || source.slice(source.indexOf("var PETS=[],PETD=[];"), source.indexOf('\n`;'));
const self = "a".repeat(64) + "i0";
const lean = "b".repeat(64) + "i0";
const html = "c".repeat(64) + "i0";
const vox = [[0, 3, 0, 4, 4, 6, 0, 0], [0, 7, 0, 2, 2, 2, 1, 1]];

async function harness(ids = [lean, html]) {
  const calls: string[] = [];
  const nodes: any[] = [];
  const element = () => {
    const el: any = { style: {}, children: [], appendChild(n: any) { this.children.push(n); }, remove() {} };
    nodes.push(el); return el;
  };
  const ctx: any = {
    SELF: self, VOX: [], G: null, CIT: null, isFinite,
    kids: async () => ids,
    metaOf: async (id: string) => {
      calls.push("metadata:" + id);
      return id === lean ? { p: "BITMAPWIN-PET", sire: self, sh: "quadruped", C: ["#124578", "#ffffff", "#ff0000"],
        v: vox.map(v => v.map((x, i) => i < 6 ? x * 10 : x).join(",")).join(";") } : null;
    },
    fetch: async (url: string) => {
      calls.push(url);
      return { ok: true, headers: { get: () => "text/html" }, text: async () =>
        `BITMAPWIN PET <script>const M={"sire":"${self}","sh":"biped"},C=["#c07fff","#ffffff"],V=${JSON.stringify(vox)};</script>` };
    },
    setTimeout() {}, addEventListener() {},
    navigator: { clipboard: { writeText: async (s: string) => { ctx.copied = s; } } },
    document: { createElement: element, getElementById: () => null, body: { appendChild() {} } },
  };
  runInNewContext(code, ctx);
  ctx.petLoad();
  for (let i = 0; i < 30 && ctx.PETS.length < ids.length; i++) await Promise.resolve();
  return { ctx, calls, nodes };
}

describe("self-contained Guardian baby prompts", () => {
  it("uses each loaded lean and HTML baby's own shape, used colours, glow and unscaled bounds", async () => {
    const { ctx, calls } = await harness();
    expect(ctx.PETS.length).toBe(2);
    for (const [, prompt] of ctx.aiPrompts()) {
      expect(prompt).toContain(`baby 1 [${lean}]: four-legged beast`);
      expect(prompt).toContain(`baby 2 [${html}]: upright two-legged body`);
      expect(prompt).toContain("4 x 7 x 6 voxel units");
      expect(prompt).toContain("#124578, #ffffff");
      expect(prompt).toContain("#c07fff, #ffffff");
      expect(prompt).toContain("glowing voxels #ffffff");
      expect(prompt).not.toContain("#ff0000"); // unused palette entry
    }
    const before = calls.length;
    ctx.aiPrompts();
    expect(calls.length).toBe(before); // no extra lookup to copy a prompt
    expect(calls).toEqual(["metadata:" + lean, "metadata:" + html, "/content/" + html]);
  });
  it("does not invent missing palette or body category, and reports no unloaded babies", async () => {
    const { ctx } = await harness([]);
    expect(ctx.aiPets()).toBe("none loaded");
    expect(ctx.aiPet({ id: lean, C: [], V: vox }, 0)).toContain("shape category not recorded");
    expect(ctx.aiPet({ id: lean, C: [], V: vox }, 0)).toContain("not recorded (do not invent colours)");
  });
  it("regenerates the copied prompt after a baby loads rather than copying the old panel snapshot", async () => {
    const { ctx, nodes } = await harness([]);
    ctx.AIPON = true; ctx.aiPanel();
    const copy = nodes.find(n => n.textContent === "COPY");
    expect(copy).toBeDefined();
    ctx.PETS.push(lean);
    ctx.PETD.push({ id: lean, sh: "serpent", C: ["#124578", "#ffffff"], V: vox });
    copy.onclick();
    await Promise.resolve();
    expect(ctx.copied).toContain("long segmented serpent");
    expect(ctx.copied).toContain("#124578");
  });
});