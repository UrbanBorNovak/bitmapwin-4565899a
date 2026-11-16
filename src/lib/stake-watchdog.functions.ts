import { createServerFn } from "@tanstack/react-start";

export type WatchdogStatus =
  | { ok: true; ranAt: string; burnHeight: number; checked: number; suspicious: number; paused: boolean | null; pauseTxid: string | null; error: string | null;
      findings: { kind: string; suspicious: boolean; txid: string | null; height: number | null; detail: string }[] }
  | { ok: false; reason: string };

/** Latest watchdog result. Public: only on-chain facts (txids, BITMAP numbers), no wallet addresses. */
export const watchdogStatusFn = createServerFn({ method: "GET" }).handler(async (): Promise<WatchdogStatus> => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const r = await db.from("stake_pilot_watchdog_runs")
    .select("ran_at, burn_height, checked, suspicious, findings, contract_paused, pause_txid, error")
    .order("ran_at", { ascending: false }).limit(1).maybeSingle();
  if (r.error) return { ok: false, reason: "Watchdog log unavailable" };
  if (!r.data) return { ok: false, reason: "The watchdog has not run yet" };
  const findings = ((r.data.findings as any[]) ?? []).slice(0, 20).map((f) => ({
    kind: String(f.kind), suspicious: !!f.suspicious, txid: f.txid ?? null, height: f.height ?? null, detail: String(f.detail ?? ""),
  }));
  return { ok: true, ranAt: r.data.ran_at, burnHeight: r.data.burn_height, checked: r.data.checked, suspicious: r.data.suspicious,
    paused: r.data.contract_paused, pauseTxid: r.data.pause_txid, error: r.data.error ? "Last check could not finish" : null, findings };
});
