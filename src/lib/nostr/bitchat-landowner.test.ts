import { describe, expect, it } from "vitest";
import { landownerMessage, proofFresh, proofTag, readProofTag, PROOF_TTL_S } from "./bitchat-landowner";

const addr = "bc1pqqqsyqcyq5rqwzqfpg9scrgwpugpzysnzs23v9ccrydpk8qarc0sj9hjuh";
describe("landowner proof", () => {
  it("message binds block, address and nostr key", () => {
    expect(landownerMessage(715093, addr, "ab".repeat(32), 100)).toContain("715093.bitmap");
    expect(landownerMessage(715093, addr, "ab".repeat(32), 100)).not.toBe(landownerMessage(715094, addr, "ab".repeat(32), 100));
  });
  it("expires after 24 hours and refuses future dates", () => {
    expect(PROOF_TTL_S).toBe(86400);
    expect(proofFresh(1000, 1000 + 86400)).toBe(true);
    expect(proofFresh(1000, 1000 + 86401)).toBe(false);
    expect(proofFresh(2000, 1000)).toBe(false);
  });
  it("round-trips the tag and rejects junk", () => {
    const p = { address: addr, signature: "c2ln", issuedAt: 5 };
    expect(readProofTag([proofTag(p)])).toEqual(p);
    expect(readProofTag([["proof", "notanaddress", "x", "5"]])).toBeNull();
  });
});
