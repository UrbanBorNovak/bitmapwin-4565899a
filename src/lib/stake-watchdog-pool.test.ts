import { describe, expect, it } from "vitest";
import { reconcilePool, shouldPause, type PoolTx } from "./stake-watchdog";

const POOL = "ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-stake-pilot-v1";
const ASSET = "ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-test-sbtc::tsbtc";
const A = "ST1J2P63SDEJY6D5944KKHAWSJCBR455NCASRPWR3";
const B = "ST2P0SD4JPHFKJ42DDH2VQVS59P7XJFYC4K8NHGWR";
const tx = (txid: string, fn: string | null, sender: string, from: string, to: string, amount: string, status: PoolTx["status"] = "success"): PoolTx =>
  ({ txid, fn, sender, status, transfers: [{ asset: ASSET, amount, sender: from, recipient: to }] });
const fund = (n: string) => tx("f", "fund", A, A, POOL, n);
const claim = (n: string, to = A) => tx("c", "claim", A, POOL, to, n);

describe("reward pool reconciliation", () => {
  it("live history: fund 50,000 then claim 50,000 leaves an explained empty pool", () => {
    const r = reconcilePool([fund("50000"), claim("50000")], 0n, POOL, ASSET);
    expect(r.summary).toMatchObject({ funded: "50000", paidOut: "50000", expected: "0", matches: true });
    expect(r.findings).toEqual([]);
  });
  it("a pool holding less than funding minus payouts is suspicious and pauses", () => {
    const r = reconcilePool([fund("50000")], 40000n, POOL, ASSET);
    expect(r.findings[0]).toMatchObject({ kind: "pool-mismatch", suspicious: true });
    expect(shouldPause(r.findings, false, false)).toBe(true);
  });
  it("a pool holding more than expected is also suspicious", () => {
    expect(reconcilePool([fund("50000")], 60000n, POOL, ASSET).findings[0]?.kind).toBe("pool-mismatch");
  });
  it("tokens sent straight to the pool are counted and reported, not suspicious", () => {
    const r = reconcilePool([fund("100"), tx("d", null, B, B, POOL, "25")], 125n, POOL, ASSET);
    expect(r.summary.matches).toBe(true);
    expect(r.findings).toEqual([expect.objectContaining({ kind: "direct-deposit", suspicious: false })]);
    expect(shouldPause(r.findings, false, false)).toBe(false);
  });
  it("tokens leaving through a call that never pays out are suspicious", () => {
    const r = reconcilePool([fund("100"), tx("x", "unpause", A, POOL, B, "100")], 0n, POOL, ASSET);
    expect(r.findings).toEqual([expect.objectContaining({ kind: "pool-outflow", suspicious: true })]);
  });
  it("a claim paid to someone other than the claimer is suspicious", () => {
    const r = reconcilePool([fund("100"), claim("100", B)], 0n, POOL, ASSET);
    expect(r.findings[0]).toMatchObject({ kind: "claim-recipient", suspicious: true });
  });
  it("failed transactions and other tokens are ignored", () => {
    const other = { ...fund("999"), transfers: [{ asset: "ST1.other::x", amount: "999", sender: A, recipient: POOL }] };
    const r = reconcilePool([fund("100"), tx("bad", "claim", A, POOL, A, "100", "failed"), other], 100n, POOL, ASSET);
    expect(r.summary).toMatchObject({ expected: "100", matches: true });
    expect(r.findings).toEqual([]);
  });
  it("funding from an address other than the treasury is suspicious", () => {
    const r = reconcilePool([fund("100")], 100n, POOL, ASSET, { treasury: B, contractHeld: 100n });
    expect(r.findings).toEqual([expect.objectContaining({ kind: "fund-sender", suspicious: true })]);
  });
  it("contract pool-held must equal funding minus payouts and ignore direct transfers", () => {
    const ok = reconcilePool([fund("60000"), tx("d", null, B, B, POOL, "5000")], 65000n, POOL, ASSET, { treasury: A, contractHeld: 60000n });
    expect(ok.summary).toMatchObject({ matches: true, held: "60000", direct: "5000" });
    expect(ok.findings.some((f) => f.suspicious)).toBe(false);
    const bad = reconcilePool([fund("60000"), tx("d", null, B, B, POOL, "5000")], 65000n, POOL, ASSET, { treasury: A, contractHeld: 65000n });
    expect(bad.findings).toContainEqual(expect.objectContaining({ kind: "pool-held-mismatch", suspicious: true }));
    expect(bad.summary.matches).toBe(false);
  });
});
