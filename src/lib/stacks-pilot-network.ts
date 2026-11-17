// Network-wide soft-stake pilot totals, read in the browser from Stacks testnet.
import { HIRO_TESTNET, PILOT_STAKE } from "@/lib/stacks-pilot";

async function readOnly(contractId: string, fn: string, args: unknown[], sender: string) {
  const { fetchCallReadOnlyFunction, cvToJSON } = await import("@stacks/transactions");
  const [contractAddress, contractName] = contractId.split(".") as [string, string];
  return cvToJSON(await fetchCallReadOnlyFunction({ contractAddress, contractName, functionName: fn, functionArgs: args as never, senderAddress: sender, network: "testnet" }));
}

export type PilotNetwork = {
  staked: number; active: number; activeWeight: number; totalWeight: number; fundedTotal: number; poolHeld: number;
  paidOut: number; unshared: number; perPeriod: number; periodLen: number; fundedThisPeriod: number; burnHeight: number;
};

/** Network-wide pilot totals: stakes are found from successful `attest` calls, then re-read live. */
export async function readNetwork(): Promise<PilotNetwork> {
  const { Cl } = await import("@stacks/transactions");
  const heights = new Set<number>();
  for (let offset = 0; offset < 1000; offset += 50) {
    const r = await fetch(`${HIRO_TESTNET}/extended/v1/address/${PILOT_STAKE}/transactions?limit=50&offset=${offset}`);
    if (!r.ok) throw new Error("Hiro unavailable");
    const j = await r.json();
    for (const tx of j.results ?? []) {
      if (tx.tx_status !== "success" || tx.contract_call?.function_name !== "attest") continue;
      const h = Number(String(tx.contract_call.function_args?.[1]?.repr ?? "").replace(/^u/, ""));
      if (Number.isInteger(h)) heights.add(h);
    }
    if ((j.results ?? []).length < 50) break;
  }
  const sender = PILOT_STAKE.split(".")[0]!;
  const [status, funding, info] = await Promise.all([
    readOnly(PILOT_STAKE, "status", [], sender),
    readOnly(PILOT_STAKE, "funding", [], sender),
    fetch(`${HIRO_TESTNET}/v2/info`).then((r) => r.json()),
  ]);
  const burnHeight = Number(info?.burn_block_height ?? 0);
  const stakes = await Promise.all([...heights].map((h) => readOnly(PILOT_STAKE, "get-stake", [Cl.uint(h)], sender)));
  const live = stakes.map((s) => s?.value?.value).filter(Boolean);
  const n = (v: any) => Number(v?.value ?? 0);
  const st = status.value, f = funding.value;
  return {
    staked: live.length,
    active: live.filter((s: any) => burnHeight <= n(s.expires)).length,
    activeWeight: live.filter((s: any) => burnHeight <= n(s.expires)).reduce((a: number, s: any) => a + n(s.weight), 0),
    totalWeight: n(st["total-weight"]), unshared: n(st.stranded),
    fundedTotal: n(f["funded-total"]), poolHeld: n(f["pool-held"]),
    paidOut: n(f["funded-total"]) - n(f["pool-held"]),
    perPeriod: n(f["per-period"]), periodLen: n(f["period-len"]), fundedThisPeriod: n(f["funded-this-period"]),
    burnHeight,
  };
}
