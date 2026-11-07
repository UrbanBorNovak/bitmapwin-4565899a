/**
 * BW-LEASE-L1 prepaid-rent harness on a PRIVATE signet (challenge OP_TRUE). Refuses any
 * other chain. Same node setup as scripts/lease-signet-test.ts.
 *   LEASE_RPC=http://u:p@127.0.0.1:38332 bun scripts/lease-rent-signet-test.ts
 */
import { randomBytes } from "node:crypto";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as bitcoin from "bitcoinjs-lib";
import { buildLeaseSpend, finalizeLeaseSpend, newCellKey, signLeaf, xOnly, type LeaseTerms } from "../src/lib/lease-tapscript";
import { completeRentTx, rentChain, rentFundingValue, rentReceipts, tenantPresign, verifyRentBundle, type RentPlan } from "../src/lib/lease-rent";

const url = new URL(process.env.LEASE_RPC ?? "http://u:p@127.0.0.1:38332");
const auth = "Basic " + btoa(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`);
async function rpc<T = unknown>(method: string, params: unknown[] = [], wallet = ""): Promise<T> {
  const r = await fetch(`${url.origin}${wallet ? "/wallet/" + wallet : ""}`, { method: "POST", headers: { authorization: auth }, body: JSON.stringify({ jsonrpc: "1.0", id: 1, method, params }) });
  const j = (await r.json()) as { result: T; error: { message: string } | null };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
let miner = "";
async function mine(n: number) {
  const target = (await rpc<number>("getblockcount")) + n;
  for (let h = await rpc<number>("getblockcount"); h < target; h = await rpc<number>("getblockcount"))
    await rpc("generatetoaddress", [Math.min(5, target - h), miner, 50_000_000]);
}
const tip = () => rpc<number>("getblockcount");
const results: boolean[] = [];
function report(name: string, ok: boolean, detail: string) { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name} → ${detail}`); }
async function attempt(name: string, hex: string, expect: "accept" | "reject") {
  const [t] = await rpc<{ allowed: boolean; "reject-reason"?: string }[]>("testmempoolaccept", [[hex]]);
  let detail = t!.allowed ? "accepted" : t!["reject-reason"] ?? "rejected";
  if (expect === "accept" && t!.allowed) { const id = await rpc<string>("sendrawtransaction", [hex]); await mine(1); detail = `confirmed ${id}`; }
  report(name, (expect === "accept") === t!.allowed, detail);
}

const P = Number(process.env.LEASE_PERIOD ?? 5), R = Number(process.env.LEASE_CSV ?? 10);

async function main() {
  const info = await rpc<{ chain: string }>("getblockchaininfo");
  if (info.chain !== "signet") throw new Error(`refusing to run on chain "${info.chain}"`);
  try { await rpc("loadwallet", ["lease"]); } catch { /* already loaded */ }
  miner = await rpc<string>("getnewaddress", [], "lease");
  if ((await rpc<number>("getbalance", [], "lease")) < 1) await mine(101);

  const sec = () => bytesToHex(randomBytes(32));
  const landlordSk = sec(), tenantSk = sec();
  const terms: LeaseTerms = { landlord: xOnly(landlordSk), tenant: xOnly(tenantSk), equivocation: newCellKey(randomBytes(32), randomBytes(32)).pub, refundCsv: R };
  const landlordScript = bytesToHex(bitcoin.address.toOutputScript(await rpc<string>("getnewaddress", [], "lease"), bitcoin.networks.testnet));
  const tenantScript = bytesToHex(bitcoin.address.toOutputScript(await rpc<string>("getnewaddress", [], "lease"), bitcoin.networks.testnet));
  const plan: RentPlan = { periods: 3, rentSats: 20_000, periodBlocks: P, feeSats: 500, landlordScript };
  const DEPOSIT = 40_000, value = rentFundingValue(plan, DEPOSIT);

  async function fundLease() {
    const addr = rentChain(terms, "tb", { txid: "00".repeat(32), vout: 0, value }, plan).lease.address;
    const txid = await rpc<string>("sendtoaddress", [addr, value / 1e8], "lease");
    await mine(1);
    const tx = await rpc<{ vout: { n: number; value: number; scriptPubKey: { hex: string } }[] }>("getrawtransaction", [txid, true]);
    const o = tx.vout.find((v) => Math.round(v.value * 1e8) === value)!;
    return { txid, vout: o.n, value, scriptPubKey: o.scriptPubKey.hex };
  }

  /* ---- LEASE A: honest schedule ---- */
  const fa = await fundLease();
  const a = rentChain(terms, "tb", fa, plan);
  const sigsA = tenantPresign(a.steps, tenantSk);
  const problems = verifyRentBundle(terms, "tb", fa, plan, sigsA);
  report("landlord verifies the tenant's 3 pre-signed periods against the live funding output", problems.length === 0, problems.join("; ") || "all valid");

  const hex = (k: number, s = sigsA) => completeRentTx(a.lease, a.steps[k]!, s[k]!, landlordSk);
  await attempt("period 1 at 1 confirmation (needs " + P + ")", hex(0), "reject");
  await attempt("period 2 before period 1 is on chain", hex(1), "reject");
  {
    // landlord edits period 1 to take 30,000 instead of 20,000 but reuses the tenant's signature
    const tx = bitcoin.Transaction.fromHex(a.steps[0]!.unsignedHex);
    tx.outs[0]!.value = 30_000n; tx.outs[1]!.value -= 10_000n;
    const sighash = bytesToHex(tx.hashForWitnessV1(0, [Buffer.from(a.lease.scriptPubKey, "hex")], [BigInt(value)], bitcoin.Transaction.SIGHASH_DEFAULT, Buffer.from(a.lease.leafHashes.mutual, "hex")));
    tx.setWitness(0, [Buffer.from(sigsA[0]!, "hex"), Buffer.from(signLeaf(sighash, landlordSk), "hex"), Buffer.from(a.lease.leaves.mutual, "hex"), Buffer.from(a.lease.controlBlocks.mutual, "hex")]);
    await mine(P);
    await attempt("landlord raises period-1 rent to 30,000 using the tenant's signature", tx.toHex(), "reject");
  }
  {
    const b = buildLeaseSpend({ terms, network: "tb", leaf: "refund", prevTxid: fa.txid, prevVout: fa.vout, prevValue: value, toScript: tenantScript, feeSats: 500 });
    await attempt("tenant refunds everything before the landlord's window closes", finalizeLeaseSpend(b, "refund", { tenant: signLeaf(b.sighash, tenantSk) }), "reject");
  }
  await attempt("period 1 after " + P + " blocks", hex(0), "accept");
  await attempt("period 2 one block after period 1", hex(1), "reject");
  await mine(P - 1);
  await attempt("period 2 after " + P + " more blocks", hex(1), "accept");
  await mine(P - 1);
  await attempt("period 3 after " + P + " more blocks", hex(2), "accept");

  const confirmed = new Set<string>();
  for (const s of a.steps) { const t = await rpc<{ confirmations?: number }>("getrawtransaction", [s.txid, true]); if ((t.confirmations ?? 0) > 0) confirmed.add(s.txid); }
  const receipts = rentReceipts(a.steps, confirmed);
  report("receipts read from chain: all 3 periods paid", receipts.every((r) => r.paid), receipts.map((r) => `${r.period}:${r.paid ? "paid" : "unpaid"}`).join(" "));
  {
    const landlordGot = (await Promise.all(a.steps.map((s) => rpc<{ vout: { value: number; scriptPubKey: { hex: string } }[] }>("getrawtransaction", [s.txid, true]))))
      .reduce((n, t) => n + Math.round(t.vout.find((v) => v.scriptPubKey.hex === landlordScript)!.value * 1e8), 0);
    report("landlord received exactly 3 × 20,000", landlordGot === 60_000, `${landlordGot.toLocaleString("en-US")} sats`);
  }
  {
    const d = a.deposit;
    const early = buildLeaseSpend({ terms, network: "tb", leaf: "refund", prevTxid: d.txid, prevVout: d.vout, prevValue: d.value, toScript: tenantScript, feeSats: 500 });
    await attempt("tenant takes the deposit right after the last period", finalizeLeaseSpend(early, "refund", { tenant: signLeaf(early.sighash, tenantSk) }), "reject");
    await mine(R - 1);
    const ok = buildLeaseSpend({ terms, network: "tb", leaf: "refund", prevTxid: d.txid, prevVout: d.vout, prevValue: d.value, toScript: tenantScript, feeSats: 500 });
    await attempt("tenant takes the 40,000 deposit back after " + R + " blocks", finalizeLeaseSpend(ok, "refund", { tenant: signLeaf(ok.sighash, tenantSk) }), "accept");
  }

  /* ---- LEASE B: landlord stops collecting ---- */
  const fb = await fundLease();
  const b = rentChain(terms, "tb", fb, plan);
  const sigsB = tenantPresign(b.steps, tenantSk);
  await mine(P - 1);
  await attempt("lease B: period 1 collected on time", completeRentTx(b.lease, b.steps[0]!, sigsB[0]!, landlordSk), "accept");
  await mine(R - 1);
  {
    const s1 = b.steps[0]!;
    const r = buildLeaseSpend({ terms, network: "tb", leaf: "refund", prevTxid: s1.txid, prevVout: 1, prevValue: s1.remaining, toScript: tenantScript, feeSats: 500 });
    await attempt("lease B: landlord idle for " + R + " blocks, tenant reclaims the unpaid rest", finalizeLeaseSpend(r, "refund", { tenant: signLeaf(r.sighash, tenantSk) }), "accept");
  }
  await attempt("lease B: landlord tries period 2 afterwards", completeRentTx(b.lease, b.steps[1]!, sigsB[1]!, landlordSk), "reject");

  const failed = results.filter((x) => !x).length;
  console.log(`\n${results.length - failed}/${results.length} cases behaved as expected`);
  if (failed) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
