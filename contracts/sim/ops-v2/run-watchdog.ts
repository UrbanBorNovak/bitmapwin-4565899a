import { runStakeWatchdog } from "@/lib/stake-watchdog.server";
const r = await runStakeWatchdog();
console.log(JSON.stringify({ ok: r.ok, checked: r.checked, suspicious: r.suspicious, paused: r.paused, pauseTxid: r.pauseTxid, error: r.error, pool: r.pool, kinds: r.findings.map(f => f.kind + ":" + f.suspicious) }));
