// Browser-side helpers for BW-BOUNTY-1 on Stacks testnet. The contract is the
// only source of truth: bounties and submissions are read live, nothing is cached.
import { BOUNTY_CONTRACT, HIRO_TESTNET, PILOT_TOKEN } from "@/lib/stacks-pilot";

export type BountyStatus = "open" | "paid" | "refunded";
export type Bounty = {
  id: number; poster: string; height: number; amount: number; title: string; deadline: number; created: number;
  status: BountyStatus; winner: string | null; submissions: Submission[];
};
export type Submission = { builder: string; ref: string; at: number };

const STATUS: BountyStatus[] = ["open", "paid", "refunded"];
const SENDER = BOUNTY_CONTRACT.split(".")[0]!;

/** Plain inscription id check (txid + i + index); the contract stores up to 80 ASCII chars. */
export const isInscriptionRef = (s: string) => /^[0-9a-f]{64}i\d{1,6}$/.test(s.trim());

async function retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let err: unknown;
  for (let i = 0; i < tries; i++) { try { return await fn(); } catch (e) { err = e; await new Promise((r) => setTimeout(r, 400 * 2 ** i)); } }
  throw err;
}

async function ro(fn: string, args: unknown[]) {
  const { fetchCallReadOnlyFunction, cvToJSON } = await import("@stacks/transactions");
  const [contractAddress, contractName] = BOUNTY_CONTRACT.split(".") as [string, string];
  return cvToJSON(await retry(() => fetchCallReadOnlyFunction({ contractAddress, contractName, functionName: fn, functionArgs: args as never, senderAddress: SENDER, network: "testnet" })));
}

/** Builders who called submit-work successfully, found from the contract's tx history. */
async function submitters(): Promise<Map<number, Set<string>>> {
  const out = new Map<number, Set<string>>();
  for (let offset = 0; offset < 1000; offset += 50) {
    const r = await retry(() => fetch(`${HIRO_TESTNET}/extended/v1/address/${BOUNTY_CONTRACT}/transactions?limit=50&offset=${offset}`).then((x) => { if (!x.ok) throw new Error(`HTTP ${x.status}`); return x.json(); }));
    for (const tx of r.results ?? []) {
      if (tx.tx_status !== "success" || tx.contract_call?.function_name !== "submit-work") continue;
      const id = Number(String(tx.contract_call.function_args?.[0]?.repr ?? "").replace(/^u/, ""));
      if (!Number.isInteger(id)) continue;
      if (!out.has(id)) out.set(id, new Set());
      out.get(id)!.add(String(tx.sender_address));
    }
    if ((r.results ?? []).length < 50) break;
  }
  return out;
}

export async function readBounties(): Promise<{ bounties: Bounty[]; burnHeight: number }> {
  const { Cl } = await import("@stacks/transactions");
  const [last, info, subs] = await Promise.all([
    ro("get-last-id", []),
    retry(() => fetch(`${HIRO_TESTNET}/v2/info`).then((r) => r.json())),
    submitters(),
  ]);
  const n = Number(last?.value ?? 0);
  const ids = Array.from({ length: n }, (_, i) => n - i);
  const num = (v: any) => Number(v?.value ?? 0);
  const bounties = await Promise.all(ids.map(async (id) => {
    const v = (await ro("get-bounty", [Cl.uint(id)]))?.value?.value;
    if (!v) return null;
    const builders = [...(subs.get(id) ?? [])];
    const found = await Promise.all(builders.map(async (b) => {
      const s = (await ro("get-submission", [Cl.uint(id), Cl.principal(b)]))?.value?.value;
      return s ? { builder: b, ref: String(s.ref.value), at: num(s.at) } : null;
    }));
    return {
      id, poster: String(v.poster.value), height: num(v.height), amount: num(v.amount), title: String(v.title.value),
      deadline: num(v.deadline), created: num(v.created), status: STATUS[num(v.status)] ?? "open",
      winner: v.winner?.value?.value ? String(v.winner.value.value) : null,
      submissions: found.filter(Boolean) as Submission[],
    } satisfies Bounty;
  }));
  return { bounties: bounties.filter(Boolean) as Bounty[], burnHeight: Number(info?.burn_block_height ?? 0) };
}

export async function testTokenBalance(stx: string): Promise<number> {
  const { fetchCallReadOnlyFunction, cvToJSON, Cl } = await import("@stacks/transactions");
  const [contractAddress, contractName] = PILOT_TOKEN.split(".") as [string, string];
  const j = cvToJSON(await retry(() => fetchCallReadOnlyFunction({ contractAddress, contractName, functionName: "get-balance", functionArgs: [Cl.principal(stx)], senderAddress: stx, network: "testnet" })));
  return Number(j?.value?.value ?? 0);
}

async function callContract(contract: string, functionName: string, functionArgs: unknown[]): Promise<string> {
  const { request } = await import("@stacks/connect");
  // Same provider pinning as the soft-stake pilot: Xverse otherwise routes stx_* through its Bitcoin side.
  const w = window as unknown as { StacksProvider?: unknown; LeatherProvider?: unknown; XverseProviders?: { StacksProvider?: unknown } };
  const provider = w.LeatherProvider ?? w.XverseProviders?.StacksProvider ?? w.StacksProvider;
  const res = await request((provider ? { provider } : {}) as never, "stx_callContract", {
    contract: contract as `${string}.${string}`, functionName, functionArgs: functionArgs as never, network: "testnet", postConditionMode: "allow",
  });
  if (!res?.txid) throw new Error("Wallet returned no transaction");
  return res.txid;
}

export async function mintTestTokens(stx: string) {
  const { Cl } = await import("@stacks/transactions");
  return callContract(PILOT_TOKEN, "mint", [Cl.uint(100000), Cl.principal(stx)]);
}
export async function createBounty(height: number, amount: number, title: string, blocks: number) {
  const { Cl } = await import("@stacks/transactions");
  return callContract(BOUNTY_CONTRACT, "create-bounty", [Cl.uint(height), Cl.uint(amount), Cl.stringUtf8(title), Cl.uint(blocks)]);
}
export async function submitWork(id: number, ref: string) {
  const { Cl } = await import("@stacks/transactions");
  return callContract(BOUNTY_CONTRACT, "submit-work", [Cl.uint(id), Cl.stringAscii(ref.trim())]);
}
export async function acceptAndPay(id: number, builder: string) {
  const { Cl } = await import("@stacks/transactions");
  return callContract(BOUNTY_CONTRACT, "accept-and-pay", [Cl.uint(id), Cl.principal(builder)]);
}
export async function cancelAndRefund(id: number) {
  const { Cl } = await import("@stacks/transactions");
  return callContract(BOUNTY_CONTRACT, "cancel-and-refund", [Cl.uint(id)]);
}
