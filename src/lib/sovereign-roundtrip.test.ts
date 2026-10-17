import { it, expect } from "vitest";
import { buildListingPsbt } from "@/lib/psbt-builder";
import { buildSovereignStoreHtml } from "@/lib/sovereign-store";
import { DEFAULT_STORE } from "@/lib/store-template";
it("roundtrip", () => {
  const html = buildSovereignStoreHtml(DEFAULT_STORE);
  const js = html.split('<script type="module">')[1]!.split("</script>")[0]!;
  const start = js.indexOf("const b2u"), end = js.indexOf("/* ---------- Nostr");
  const f = new Function(js.slice(start, end) + "return {pp,sp,op};")();
  const b = buildListingPsbt({ txid: "ab".repeat(32), vout: 1, utxoValueSats: 546, sellerAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", priceSats: 90000 });
  const p = f.pp(b);
  expect(f.op(p.tx.ins[0])).toBe("ab".repeat(32) + ":1");
  expect(p.tx.outs[0].val).toBe(90000);
  expect(f.sp(p.tx, p.ins, p.outs)).toBe(b);
});
