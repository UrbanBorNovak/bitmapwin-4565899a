import { describe, expect, it } from "vitest";
import { assertTestnetContract, compareAttestations, shouldPause, type ContractTx, type LogRow } from "./stake-watchdog";

const A = "ST1J2P63SDEJY6D5944KKHAWSJCBR455NCASRPWR3";
const attest = (txid: string, over: Partial<ContractTx> = {}, args = ["u1", "u715093", "u100", "u40000"]): ContractTx =>
  ({ txid, status: "success", fn: "attest", sender: A, burnHeight: 40001, args, ...over });
const row: LogRow = { stx_address: A, height: 715093, weight: 100, epoch: 1, issued: 40000 };

describe("stake watchdog", () => {
  it("a logged attestation is not suspicious", () => {
    expect(compareAttestations([attest("t1")], [row], 1, 39264)).toEqual([]);
  });
  it("an attestation missing from the signing log is suspicious", () => {
    const f = compareAttestations([attest("t1")], [], 0, 39264);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: "unmatched-attest", suspicious: true, txid: "t1" });
  });
  it("one log row vouches for only one submission", () => {
    const f = compareAttestations([attest("t1"), attest("t2", { burnHeight: 40002 })], [row], 1, 39264);
    expect(f.map((x) => x.txid)).toEqual(["t2"]);
  });
  it("a different weight than the oracle signed is suspicious", () => {
    const f = compareAttestations([attest("t1", {}, ["u1", "u715093", "u2922", "u40000"])], [row], 1, 39264);
    expect(f[0]?.kind).toBe("unmatched-attest");
  });
  it("pending mempool attestations are checked too", () => {
    expect(compareAttestations([attest("t1", { status: "pending", burnHeight: null })], [], 0, 39264)[0]?.suspicious).toBe(true);
  });
  it("calls before the arm height are ignored", () => {
    expect(compareAttestations([attest("old", { burnHeight: 39261 })], [], 0, 39264)).toEqual([]);
  });
  it("refused attestations are reported but not suspicious", () => {
    expect(compareAttestations([attest("t1", { status: "failed" })], [], 0, 39264)[0]).toMatchObject({ kind: "rejected-attest", suspicious: false });
  });
  it("an unacknowledged admin call is suspicious", () => {
    const f = compareAttestations([{ txid: "a1", status: "success", fn: "unpause", sender: A, burnHeight: 40001, args: [] }], [], 0, 39264);
    expect(f[0]).toMatchObject({ kind: "admin-call", suspicious: true });
  });
  it("more than 60 signatures an hour is a spike", () => {
    expect(compareAttestations([], [], 61, 39264)[0]?.kind).toBe("log-spike");
    expect(compareAttestations([], [], 60, 39264)).toEqual([]);
  });
  it("pauses only when suspicious, unpaused and no pause in flight", () => {
    const bad = compareAttestations([attest("t1")], [], 0, 39264);
    expect(shouldPause(bad, false, false)).toBe(true);
    expect(shouldPause(bad, true, false)).toBe(false);
    expect(shouldPause(bad, false, true)).toBe(false);
    expect(shouldPause(bad, null, false)).toBe(true);
    expect(shouldPause([], false, false)).toBe(false);
  });
  it("refuses mainnet contracts", () => {
    expect(() => assertTestnetContract("SP000000000000000000002Q6VF78.bw-stake")).toThrow();
    expect(() => assertTestnetContract("ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-stake-pilot-v1")).not.toThrow();
  });
});
