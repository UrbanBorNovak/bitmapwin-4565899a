import { describe, expect, it } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import { bech32m } from "@scure/base";
import { cellMessage, extractEquivocationKey, leaseAddress, leaseLeaves, newCellKey, pushNum, signCell, verifyCell } from "./lease-tapscript";

const fill = (b: number) => new Uint8Array(32).fill(b);
const L = newCellKey(fill(1), fill(2)).pub, T = newCellKey(fill(3), fill(4)).pub;
const cell = newCellKey(fill(5), fill(6));
const terms = { landlord: L, tenant: T, equivocation: cell.pub, refundCsv: 288 };

describe("BW-LEASE-L1 tree", () => {
  it("refund needs 288 blocks (OP_NOP3 = CSV) and the tenant key", () => {
    const { refund } = leaseLeaves(terms);
    expect(bitcoin.script.toASM(refund)).toBe(`2001 OP_NOP3 OP_DROP ${T} OP_CHECKSIG`);
  });
  it("slash needs the equivocation key AND the landlord, so the tenant can never slash alone", () => {
    const { slash } = leaseLeaves(terms);
    expect(bitcoin.script.toASM(slash)).toBe(`${cell.pub} OP_CHECKSIGVERIFY ${L} OP_CHECKSIG`);
  });
  it("refuses terms where two roles share a key", () => {
    expect(() => leaseLeaves({ ...terms, equivocation: T })).toThrow();
  });
  it("encodes CSV 16 as OP_16 and 128 with a sign byte", () => {
    expect([...pushNum(16)]).toEqual([0x60]);
    expect([...pushNum(128)]).toEqual([2, 0x80, 0]);
  });
  it("produces a valid deterministic bc1p address", () => {
    const a = leaseAddress(terms);
    expect(a.address).toBe(leaseAddress(terms).address);
    const dec = bech32m.decode(a.address as `${string}1${string}`);
    expect(dec.words[0]).toBe(1);
    expect(Buffer.from(bech32m.fromWords(dec.words.slice(1))).toString("hex")).toBe(a.outputKey);
    expect(a.address.startsWith("bc1p")).toBe(true);
  });
});

describe("write-once cells", () => {
  const m1 = cellMessage("lease-1", 0, "RENT PAID 1"), m2 = cellMessage("lease-1", 0, "VACATED");
  const a = { msg: m1, sig: signCell(cell, m1) }, b = { msg: m2, sig: signCell(cell, m2) };
  it("one honest statement verifies and leaks nothing", () => {
    expect(verifyCell(cell.pub, cell.r, a)).toBe(true);
    expect(extractEquivocationKey(cell.pub, cell.r, a, a)).toBeNull();
  });
  it("two statements on one cell reveal the slash key", () => {
    const d = extractEquivocationKey(cell.pub, cell.r, a, b);
    expect(d).toBe(cell.d.toString(16).padStart(64, "0"));
  });
  it("a forged second signature never yields a key", () => {
    const forged = { msg: m2, sig: a.sig };
    expect(extractEquivocationKey(cell.pub, cell.r, a, forged)).toBeNull();
  });
});
