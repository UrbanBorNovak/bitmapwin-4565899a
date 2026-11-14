import { describe, expect, it } from "vitest";
import { heldParcelIndexes, landownerMessage, parcelBadgeLabel, parcelHolderMessage, proofFresh, proofTag, readProofTag, roomProofMessage, PROOF_TTL_S } from "./bitchat-landowner";

const addr = "bc1pqqqsyqcyq5rqwzqfpg9scrgwpugpzysnzs23v9ccrydpk8qarc0sj9hjuh";
const other = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
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

describe("parcel holder proof", () => {
  it("a parcel signature can never pass as a landowner signature", () => {
    expect(parcelHolderMessage(715093, addr, "ab".repeat(32), 100)).not.toBe(landownerMessage(715093, addr, "ab".repeat(32), 100));
    expect(roomProofMessage("parcel", 715093, addr, "ab".repeat(32), 100)).toBe(parcelHolderMessage(715093, addr, "ab".repeat(32), 100));
    expect(roomProofMessage(undefined, 715093, addr, "ab".repeat(32), 100)).toBe(landownerMessage(715093, addr, "ab".repeat(32), 100));
  });
  it("carries the parcel kind in the tag", () => {
    const p = { address: addr, signature: "c2ln", issuedAt: 5, kind: "parcel" as const };
    expect(proofTag(p)[4]).toBe("parcel");
    expect(readProofTag([proofTag(p)])?.kind).toBe("parcel");
  });
  it("counts only parcels whose live holder is the signer right now", () => {
    const parcels = [{ index: 12, inscriptionId: "a" }, { index: 3, inscriptionId: "b" }, { index: 40, inscriptionId: "c" }];
    // "c" was transferred away since the scan; "b" lookup failed.
    expect(heldParcelIndexes(parcels, { a: addr, b: null, c: other }, addr)).toEqual([12]);
    expect(heldParcelIndexes(parcels, { a: addr, b: addr }, addr)).toEqual([3, 12]);
    expect(heldParcelIndexes(parcels, {}, addr)).toEqual([]);
  });
  it("labels the badge with the first parcel number and the extra count", () => {
    expect(parcelBadgeLabel([3, 12], 715093)).toBe("3.715093 +1");
    expect(parcelBadgeLabel([12], 715093)).toBe("12.715093");
    expect(parcelBadgeLabel([], 715093)).toBe("");
  });
});

import { checkFresh, decideParcelHolding, RECHECK_MS } from "./bitchat-landowner";

describe("fail-closed parcel checks", () => {
  const cands = [{ index: 12, inscriptionId: "a" }, { index: 3, inscriptionId: "b" }];
  const base = { scan: "ok" as const, incomplete: false, truncated: false, candidates: cands, address: addr };
  it("a failed or partial scan is unavailable, never a badge", () => {
    expect(decideParcelHolding({ ...base, scan: "failed", live: { a: { address: addr } } }).status).toBe("unavailable");
    expect(decideParcelHolding({ ...base, incomplete: true, live: { a: { address: addr } } }).status).toBe("unavailable");
  });
  it("failed holder lookups are unavailable, not 'holds nothing'", () => {
    expect(decideParcelHolding({ ...base, live: { a: null, b: { address: other } } })).toEqual({ status: "unavailable", reason: "parcel holder lookup failed" });
  });
  it("grants only parcels confirmed live to the signer", () => {
    expect(decideParcelHolding({ ...base, live: { a: { address: addr }, b: null } })).toEqual({ status: "held", parcels: [12] });
    expect(decideParcelHolding({ ...base, live: { a: { address: other }, b: { address: other } } })).toEqual({ status: "none" });
  });
  it("a cut-off scan with no confirmed parcel cannot say none", () => {
    expect(decideParcelHolding({ ...base, truncated: true, candidates: [], live: {} }).status).toBe("unavailable");
  });
  it("a badge result goes stale after 5 minutes", () => {
    expect(RECHECK_MS).toBe(300_000);
    expect(checkFresh(1_000_000, 1_000_000 + 299_999)).toBe(true);
    expect(checkFresh(1_000_000, 1_000_000 + 300_000)).toBe(false);
    expect(checkFresh(undefined, 1)).toBe(false);
  });
});
