// Server-only watchdog run for the testnet soft-stake pilot. Reads the pilot
// contract's calls from the Hiro testnet API, compares them with the oracle's
// signing log and pauses the contract when something does not match.
import { HIRO_TESTNET, PILOT_STAKE, PILOT_TOKEN } from "@/lib/stacks-pilot";
import { assertTestnetContract, compareAttestations, reconcilePool, shouldPause, WATCHDOG_ARMED_FROM, type ContractTx, type Finding, type PoolSummary, type PoolTx } from "@/lib/stake-watchdog";

const PAGE = 50;
const MAX_PAGES = 40;

async function hiro(path: string) {
  const r = await fetch(`${HIRO_TESTNET}${path}`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`hiro ${r.status}`);
  return r.json();
}
function toTx(t: any, pending: boolean): ContractTx | null {
  if (t?.tx_type !== "contract_call" || t?.contract_call?.contract_id !== PILOT_STAKE) return null;
  const s = String(t.tx_status ?? "");
  return {
    txid: String(t.tx_id), fn: String(t.contract_call.function_name), sender: String(t.sender_address),
    status: pending || s === "pending" ? "pending" : s === "success" ? "success" : "failed",
    burnHeight: pending ? null : Number(t.burn_block_height ?? 0),
    args: (t.contract_call.function_args ?? []).map((a: any) => String(a?.repr ?? "")),
  };
}

/** Every pilot call since the watchdog was armed, plus the mempool. Throws if the history cannot be read completely. */
async function contractCalls(): Promise<ContractTx[]> {
  const out: ContractTx[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const d = await hiro(`/extended/v1/address/${PILOT_STAKE}/transactions?limit=${PAGE}&offset=${page * PAGE}`);
    const rows: any[] = d?.results ?? [];
    for (const t of rows) { const x = toTx(t, false); if (x) out.push(x); }
    const oldest = Math.min(...rows.map((t) => Number(t.burn_block_height ?? 0)));
    if (rows.length < PAGE || oldest < WATCHDOG_ARMED_FROM) {
      const m = await hiro(`/extended/v1/tx/mempool?address=${PILOT_STAKE}&limit=${PAGE}`);
      for (const t of m?.results ?? []) { const x = toTx(t, true); if (x) out.push(x); }
      return out;
    }
  }
  throw new Error("contract history too long to read in one run");
}

async function contractPaused(): Promise<boolean | null> {
  try {
    const { fetchCallReadOnlyFunction, cvToJSON } = await import("@stacks/transactions");
    const [contractAddress, contractName] = PILOT_STAKE.split(".") as [string, string];
    const cv = await fetchCallReadOnlyFunction({ contractAddress, contractName, functionName: "status", functionArgs: [], senderAddress: contractAddress, network: "testnet" });
    const j = cvToJSON(cv) as any;
    const v = j?.value?.paused?.value ?? j?.value?.value?.paused?.value;
    return typeof v === "boolean" ? v : null;
  } catch (e) { console.error("watchdog status", e); return null; }
}

export const POOL_ASSET = `${PILOT_TOKEN}::tsbtc`;

async function poolBalance(): Promise<bigint> {
  const d = await hiro(`/extended/v1/address/${PILOT_STAKE}/balances`);
  return BigInt(String(d?.fungible_tokens?.[POOL_ASSET]?.balance ?? "0"));
}

/** Full confirmed history of the pool with token transfers. Throws if it cannot be read completely. */
async function poolHistory(): Promise<PoolTx[]> {
  const out: PoolTx[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const d = await hiro(`/extended/v1/address/${PILOT_STAKE}/transactions_with_transfers?limit=${PAGE}&offset=${page * PAGE}`);
    const rows: any[] = d?.results ?? [];
    for (const r of rows) {
      const t = r?.tx ?? {};
      const pilot = t?.tx_type === "contract_call" && t?.contract_call?.contract_id === PILOT_STAKE;
      out.push({
        txid: String(t.tx_id), status: t.tx_status === "success" ? "success" : "failed",
        fn: pilot ? String(t.contract_call.function_name) : null, sender: String(t.sender_address ?? ""),
        transfers: (r?.ft_transfers ?? []).map((x: any) => ({ asset: String(x.asset_identifier), amount: String(x.amount ?? "0"), sender: x.sender ?? null, recipient: x.recipient ?? null })),
      });
    }
    if (rows.length < PAGE) return out;
  }
  throw new Error("pool history too long to read in one run");
}

/** Balance read before and after the history; if it moved in between, skip this run instead of guessing. */
async function checkPool(): Promise<{ findings: Finding[]; summary: PoolSummary | null }> {
  const before = await poolBalance();
  const history = await poolHistory();
  const after = await poolBalance();
  if (before !== after) return { findings: [{ kind: "pool-moving", suspicious: false, detail: "The pool balance changed during the check; it will be reconciled on the next run." }], summary: null };
  return reconcilePool(history, after, PILOT_STAKE, POOL_ASSET);
}

export type WatchdogRun = { ok: boolean; burnHeight: number; checked: number; suspicious: number; findings: Finding[]; paused: boolean | null; pauseTxid: string | null; error: string | null; pool: PoolSummary | null };

export async function runStakeWatchdog(): Promise<WatchdogRun> {
  assertTestnetContract(PILOT_STAKE);
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { testnetBurnHeight, broadcastPilotPause } = await import("@/lib/stacks-pilot.server");
  let burnHeight = 0;
  const record = async (r: WatchdogRun) => {
    const ins = await db.from("stake_pilot_watchdog_runs").insert({
      burn_height: r.burnHeight, checked: r.checked, suspicious: r.suspicious, findings: r.findings as never,
      contract_paused: r.paused, pause_txid: r.pauseTxid, error: r.error, pool: r.pool as never,
    });
    if (ins.error) console.error("watchdog log", ins.error);
    return r;
  };
  try {
    burnHeight = await testnetBurnHeight();
    const [txs, log, hour, paused, pool] = await Promise.all([
      contractCalls(),
      db.from("stake_pilot_attestations").select("stx_address, height, weight, epoch, issued").gte("issued", WATCHDOG_ARMED_FROM - 10),
      db.from("stake_pilot_attestations").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 3600_000).toISOString()),
      contractPaused(),
      checkPool(),
    ]);
    if (log.error || hour.error) throw new Error("signing log unavailable");
    const findings = [...compareAttestations(txs, log.data ?? [], hour.count ?? 0), ...pool.findings];
    const suspicious = findings.filter((f) => f.suspicious).length;
    // A pause sent in the last 30 minutes that has not landed yet is still in flight.
    // Only a pause still pending in the mempool counts; a landed or dropped one never blocks a new pause.
    const recent = await db.from("stake_pilot_watchdog_runs").select("pause_txid").not("pause_txid", "is", null)
      .gte("ran_at", new Date(Date.now() - 1800_000).toISOString()).order("ran_at", { ascending: false }).limit(1);
    let inFlight = false;
    const lastPause = recent.data?.[0]?.pause_txid;
    if (lastPause && paused !== true) {
      try { inFlight = String((await hiro(`/extended/v1/tx/0x${lastPause.replace(/^0x/, "")}`))?.tx_status) === "pending"; } catch { inFlight = false; }
    }
    let pauseTxid: string | null = null; let error: string | null = null;
    if (shouldPause(findings, paused, inFlight)) {
      try { pauseTxid = await broadcastPilotPause(); } catch (e) { error = e instanceof Error ? e.message : "pause failed"; console.error("watchdog pause", e); }
    }
    return await record({ ok: !error, burnHeight, checked: txs.length, suspicious, findings, paused, pauseTxid, error, pool: pool.summary });
  } catch (e) {
    // Could not compare: record it, never pretend the pilot is clean.
    return await record({ ok: false, burnHeight, checked: 0, suspicious: 0, findings: [], paused: null, pauseTxid: null, error: e instanceof Error ? e.message : "watchdog failed", pool: null });
  }
}
