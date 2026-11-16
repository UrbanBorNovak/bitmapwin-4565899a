// Browser-side Stacks testnet helpers for the soft-stake pilot. Libraries load
// on demand so nothing Stacks-related runs during SSR.
import { HIRO_TESTNET, PILOT_STAKE, PILOT_TOKEN } from "@/lib/stacks-pilot";
import { isMainnetStx, isTestnetStx } from "@/lib/stacks-softstake";

export type PilotStake = { owner: string; weight: number; expires: number; epoch: number; at: number } | null;

export async function connectStacksTestnet(): Promise<string> {
  const { request } = await import("@stacks/connect");
  const res = await request({ forceWalletSelect: true }, "getAddresses");
  const all = (res?.addresses ?? []).map((a) => a.address);
  const t = all.find(isTestnetStx);
  if (t) return t;
  if (all.some(isMainnetStx)) throw new Error("Your Stacks wallet is on Mainnet. Switch it to Testnet and connect again.");
  throw new Error("No Stacks address returned. Use Leather or Xverse.");
}

export async function callPilot(which: "stake" | "token", functionName: string, functionArgs: unknown[]): Promise<string> {
  const { request } = await import("@stacks/connect");
  const res = await request("stx_callContract", {
    contract: (which === "stake" ? PILOT_STAKE : PILOT_TOKEN) as `${string}.${string}`,
    functionName, functionArgs: functionArgs as never, network: "testnet", postConditionMode: "allow",
  });
  if (!res?.txid) throw new Error("Wallet returned no transaction");
  return res.txid;
}

async function readOnly(contractId: string, fn: string, args: unknown[], sender: string) {
  const { fetchCallReadOnlyFunction, cvToJSON } = await import("@stacks/transactions");
  const [contractAddress, contractName] = contractId.split(".") as [string, string];
  const cv = await fetchCallReadOnlyFunction({ contractAddress, contractName, functionName: fn, functionArgs: args as never, senderAddress: sender, network: "testnet" });
  return cvToJSON(cv);
}

/** Live pilot state for one BITMAP and Stacks address, read from the testnet contract. */
export async function readPilot(height: number, stx: string) {
  const { Cl } = await import("@stacks/transactions");
  const [stake, pending, bal, info] = await Promise.all([
    readOnly(PILOT_STAKE, "get-stake", [Cl.uint(height)], stx),
    readOnly(PILOT_STAKE, "pending", [Cl.uint(height)], stx),
    readOnly(PILOT_TOKEN, "get-balance", [Cl.principal(stx)], stx),
    fetch(`${HIRO_TESTNET}/v2/info`).then((r) => r.json()),
  ]);
  const s = stake?.value?.value;
  const num = (v: any) => Number(v?.value ?? 0);
  return {
    stake: s ? { owner: String(s.owner.value), weight: num(s.weight), expires: num(s.expires), epoch: num(s.epoch), at: num(s.at) } as PilotStake : null,
    pending: Number(pending?.value ?? 0),
    balance: Number(bal?.value?.value ?? 0),
    burnHeight: Number(info?.burn_block_height ?? 0),
  };
}

export async function txStatus(txid: string): Promise<"pending" | "success" | "failed" | "unknown"> {
  try {
    const r = await fetch(`${HIRO_TESTNET}/extended/v1/tx/${txid.startsWith("0x") ? txid : `0x${txid}`}`);
    if (!r.ok) return "unknown";
    const s = String((await r.json())?.tx_status ?? "");
    return s === "success" ? "success" : s === "pending" ? "pending" : s ? "failed" : "unknown";
  } catch { return "unknown"; }
}
