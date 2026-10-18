import { mkdirSync, writeFileSync, copyFileSync, rmSync } from "fs";
import { brotliCompressSync, constants } from "zlib";
import { buildStoreHtml, DEFAULT_STORE } from "./src/lib/store-template";
import { buildSovereignStoreHtml } from "./src/lib/sovereign-store";
import { buildTinyStudioHtml } from "./src/lib/tiny-studio";
const br = (s: string) => brotliCompressSync(Buffer.from(s), { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT } });
const out: Record<string, number> = {};
/** Files that must never ship packed: the sovereign shop cannot be inscribed (ordinals.com sandbox blocks its outside connections). */
const NO_BR = new Set(["sovereign.html"]);
function pkg(dir: string, files: Record<string, string>, src: string[]) {
  mkdirSync(`/tmp/pkg/${dir}/src`, { recursive: true });
  for (const [n, c] of Object.entries(files)) {
    writeFileSync(`/tmp/pkg/${dir}/${n}`, c);
    if (n.endsWith(".html") && !NO_BR.has(n)) {
      const b = br(c);
      writeFileSync(`/tmp/pkg/${dir}/${n}.br`, b);
      out[`${dir}/${n}`] = b.length;
    }
  }
  for (const n of NO_BR) rmSync(`/tmp/pkg/${dir}/${n}.br`, { force: true });
  for (const s of src) copyFileSync(`/dev-server/src/lib/${s}`, `/tmp/pkg/${dir}/src/${s}`);
}
const fast = buildStoreHtml({ ...DEFAULT_STORE }), sov = buildSovereignStoreHtml({ ...DEFAULT_STORE } as any);
pkg("bitmap-tiny-store", { "index.html": fast, "sovereign.html": sov }, ["store-template.ts", "sovereign-store.ts", "nostr-listing.ts"]);
pkg("bitmap-tiny-studio", { "index.html": buildTinyStudioHtml({ height: 840000 }) }, ["tiny-studio.ts"]);
console.log(JSON.stringify(out));
