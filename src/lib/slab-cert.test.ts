import { describe, expect, it } from "vitest";
import { gradeSlab } from "@/lib/land-slab";
import { SLAB_POSTAGE, certFacts, parseSlabCert, slabBaseCost, slabCertHtml, SLAB_GRADING_FEE_SATS } from "@/lib/slab-cert";

const hash = "00000000000000000002a7c4c1e48d76c5a37902165a270156b7a8d72728a054";

describe("BW-SLAB-1 certificate", () => {
  it("grading is free: no site fee and no extra postage", () => {
    expect(SLAB_POSTAGE).toBe(0);
    expect(SLAB_GRADING_FEE_SATS).toBe(0);
    expect(slabBaseCost()).toBe(0);
  });

  it("round-trips its facts through the inscribed HTML", () => {
    const g = gradeSlab({ height: 715093, txCount: 14, hash, layoutWidth: 4, layoutHeight: 4 });
    const f = certFacts(715093, 14, hash, g);
    const back = parseSlabCert(slabCertHtml(f));
    expect(back).toEqual(f);
  });

  it("refuses HTML that is not a slab certificate", () => {
    expect(parseSlabCert("<html><body>hi</body></html>")).toBeNull();
    expect(parseSlabCert('<meta name="bw-slab" content="{&#34;p&#34;:&#34;OTHER&#34;}">')).toBeNull();
  });
});
