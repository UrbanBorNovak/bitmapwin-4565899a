/**
 * BW-LEASE-L1 signet harness. Runs every lease spend against a real, unmodified
 * Bitcoin Core node on a PRIVATE signet (challenge OP_TRUE, mined locally).
 * Never point this at mainnet: it refuses any chain other than "signet".
 *
 *   bitcoind -signet -signetchallenge=51 -rpcuser=u -rpcpassword=p -fallbackfee=0.0001
 *   LEASE_RPC=http://u:p@127.0.0.1:38332 bun scripts/lease-signet-test.ts
 */
import { randomBytes } from "node:crypto";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as bitcoin from "bitcoinjs-lib";
import {
  buildLeaseSpend, cellMessage, extractEquivocationKey, finalizeLeaseSpend, leaseAddress,
  newCellKey, signCell, signLeaf, xOnly, type LeaseLeaf, type LeaseTerms,
} from "../src/lib/lease-tapscript";

const url = new URL(process.env.LEASE_RPC ?? "http://u:p@127.0.0.1:38332");
const auth = "Basic " + btoa(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`);
async function rpc<T = unknown>(method: string, params: unknown[] = [], wallet = ""): Promise<T> {
  const r = await fetch(`${url.origin}${wallet ? "/wallet/" + wallet : ""}`, { method: "POST", headers: { authorization: auth }, body: JSON.stringify({ jsonrpc: "1.0", id: 1, method, params }) });
  const j = (await r.json()) as { result: T; error: { message: string } | null };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

const results: { name: string; expect: "accept" | "reject"; ok: boolean; detail: string }[] = [];
async function attempt(name: string, hex: string, expect: "accept" | "reject") {
  const [t] = await rpc<{ allowed: boolean; "reject-reason"?: string }[]>("testmempoolaccept", [[hex]]);
  let detail = t!.allowed ? "accepted" : t!["reject-reason"] ?? "rejected";
  if (expect === "accept" && t!.allowed) { const id = await rpc<string>("sendrawtransaction", [hex]); await mine(1); detail = `confirmed ${id}`; }
  const ok = (expect === "accept") === t!.allowed;
  results.push({ name, expect, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} → ${detail}`);
}

let miner = "";
/** generatetoaddress may stop early when its tries run out; keep going until n blocks exist. */
async function mine(n: number) {
  const target = (await rpc<number>("getblockcount")) + n;
  // small batches: signet proof-of-work is ~1.5 s/block on CPU and long RPCs time out
  for (let h = await rpc<number>("getblockcount"); h < target; h = await rpc<number>("getblockcount"))
    await rpc("generatetoaddress", [Math.min(5, target - h), miner, 50_000_000]);
}
const tip = () => rpc<number>("getblockcount");
/** Refund lock for the run. Production terms use 288; a shorter lock exercises the same BIP-68/112 rules. */
const CSV = Number(process.env.LEASE_CSV ?? 20);
const sec = () => bytesToHex(randomBytes(32));

async function main() {
  const info = await rpc<{ chain: string }>("getblockchaininfo");
  if (info.chain !== "signet") throw new Error(`refusing to run on chain "${info.chain}"`);
  try { await rpc("createwallet", ["lease"]); } catch { try { await rpc("loadwallet", ["lease"]); } catch { /* loaded */ } }
  miner = await rpc<string>("getnewaddress", [], "lease");
  if ((await rpc<number>("getbalance", [], "lease")) < 1) await mine(101); // coinbase maturity

  const landlordSk = sec(), tenantSk = sec();
  const cell = newCellKey(randomBytes(32), randomBytes(32));
  const terms: LeaseTerms = { landlord: xOnly(landlordSk), tenant: xOnly(tenantSk), equivocation: cell.pub, refundCsv: CSV };
  const lease = leaseAddress(terms, "tb");
  console.log("lease address", lease.address);

  const payout = bitcoin.address.toOutputScript(await rpc<string>("getnewaddress", [], "lease"), bitcoin.networks.testnet);
  const toScript = bytesToHex(payout);
  const BOND = 100_000, FEE = 1_000;

  /** Funds one bond UTXO (the tenant's funding transaction) and confirms it. */
  async function fund() {
    const txid = await rpc<string>("sendtoaddress", [lease.address, BOND / 1e8], "lease");
    await mine(1);
    const tx = await rpc<{ vout: { n: number; value: number; scriptPubKey: { hex: string } }[] }>("getrawtransaction", [txid, true]);
    const vout = tx.vout.find((o) => o.scriptPubKey.hex === lease.scriptPubKey)!;
    if (Math.round(vout.value * 1e8) !== BOND) throw new Error("funding output value mismatch");
    return { prevTxid: txid, prevVout: vout.n, prevValue: BOND, height: await tip() };
  }
  const spend = (leaf: LeaseLeaf, f: Awaited<ReturnType<typeof fund>>, seq?: number) => {
    const b = buildLeaseSpend({ terms, network: "tb", leaf, ...f, toScript, feeSats: FEE });
    if (seq !== undefined) { b.tx.ins[0]!.sequence = seq; b.sighash = bytesToHex(b.tx.hashForWitnessV1(0, [Uint8Array.from(Buffer.from(lease.scriptPubKey, "hex"))], [BigInt(BOND)], bitcoin.Transaction.SIGHASH_DEFAULT, Uint8Array.from(Buffer.from(lease.leafHashes[leaf], "hex")))); }
    return b;
  };

  // 1. MUTUAL CLOSE
  const m = await fund();
  { const b = spend("mutual", m); await attempt("mutual: tenant signs only (landlord slot forged)", finalizeLeaseSpend(b, "mutual", { tenant: signLeaf(b.sighash, tenantSk), landlord: signLeaf(b.sighash, tenantSk) }), "reject"); }
  { const b = spend("mutual", m); await attempt("mutual: both sign, right away", finalizeLeaseSpend(b, "mutual", { tenant: signLeaf(b.sighash, tenantSk), landlord: signLeaf(b.sighash, landlordSk) }), "accept"); }

  // 2. TIMELOCKED REFUND
  const r = await fund();
  { const b = spend("refund", r); await attempt(`refund: 1 confirmation (needs ${CSV})`, finalizeLeaseSpend(b, "refund", { tenant: signLeaf(b.sighash, tenantSk) }), "reject"); }
  await mine(r.height + CSV - 2 - (await tip()));
  { const b = spend("refund", r); await attempt(`refund: next block is only confirmation ${CSV - 1}`, finalizeLeaseSpend(b, "refund", { tenant: signLeaf(b.sighash, tenantSk) }), "reject"); }
  { const b = spend("refund", r, CSV - 1); await attempt(`refund: nSequence lowered to ${CSV - 1} to dodge the script lock`, finalizeLeaseSpend(b, "refund", { tenant: signLeaf(b.sighash, tenantSk) }), "reject"); }
  { const b = spend("refund", r, 0xfffffffd); await attempt("refund: relative lock disabled in nSequence", finalizeLeaseSpend(b, "refund", { tenant: signLeaf(b.sighash, tenantSk) }), "reject"); }
  await mine(1);
  { const b = spend("refund", r); await attempt("refund: landlord signs instead of tenant, after the lock", finalizeLeaseSpend(b, "refund", { tenant: signLeaf(b.sighash, landlordSk) }), "reject"); }
  { const b = spend("refund", r); await attempt(`refund: tenant once ${CSV} confirmations are reached`, finalizeLeaseSpend(b, "refund", { tenant: signLeaf(b.sighash, tenantSk) }), "accept"); }

  // 3. PENALTY (slash)
  const s = await fund();
  { const b = spend("slash", s); await attempt("slash: tenant alone (own E key + tenant key)", finalizeLeaseSpend(b, "slash", { equivocation: signLeaf(b.sighash, cell.d.toString(16).padStart(64, "0")), landlord: signLeaf(b.sighash, tenantSk) }), "reject"); }
  { const b = spend("slash", s); await attempt("slash: landlord with a guessed E key (no equivocation)", finalizeLeaseSpend(b, "slash", { equivocation: signLeaf(b.sighash, sec()), landlord: signLeaf(b.sighash, landlordSk) }), "reject"); }
  const honest = { msg: cellMessage(lease.address, 0, "RENT PAID 1"), sig: signCell(cell, cellMessage(lease.address, 0, "RENT PAID 1")) };
  const none = extractEquivocationKey(cell.pub, cell.r, honest, honest);
  results.push({ name: "slash: one honest statement leaks no key", expect: "reject", ok: none === null, detail: none ? "LEAKED" : "no key" });
  console.log(`${none === null ? "PASS" : "FAIL"}  slash: one honest statement leaks no key`);
  const lie = { msg: cellMessage(lease.address, 0, "VACATED"), sig: signCell(cell, cellMessage(lease.address, 0, "VACATED")) };
  const leaked = extractEquivocationKey(cell.pub, cell.r, honest, lie);
  if (!leaked) throw new Error("equivocation did not reveal the key");
  { const b = spend("slash", s); await attempt("slash: landlord + key leaked by equivocation, 1 conf", finalizeLeaseSpend(b, "slash", { equivocation: signLeaf(b.sighash, leaked), landlord: signLeaf(b.sighash, landlordSk) }), "accept"); }

  // 4. RACE: refund matured and already spent → late slash is a double spend
  const late = await fund();
  await mine(CSV - 1);
  { const b = spend("refund", late); await attempt(`race: tenant refunds at ${CSV}`, finalizeLeaseSpend(b, "refund", { tenant: signLeaf(b.sighash, tenantSk) }), "accept"); }
  { const b = spend("slash", late); await attempt("race: landlord slashes after the refund confirmed", finalizeLeaseSpend(b, "slash", { equivocation: signLeaf(b.sighash, leaked), landlord: signLeaf(b.sighash, landlordSk) }), "reject"); }

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} cases behaved as expected`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
