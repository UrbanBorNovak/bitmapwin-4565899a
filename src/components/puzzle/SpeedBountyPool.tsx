import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { joinSpeedBountyFn, speedBountyIsAdminFn, speedBountyStateFn, startNextRoundFn, submitDpsFn } from "@/lib/speed-bounty.functions";

type State = Awaited<ReturnType<typeof speedBountyStateFn>>;
type Dp = { xHex: string; tame: boolean; dHex: string };

export function SpeedBountyPool() {
  const getState = useServerFn(speedBountyStateFn);
  const join = useServerFn(joinSpeedBountyFn);
  const submit = useServerFn(submitDpsFn);
  const isAdmin = useServerFn(speedBountyIsAdminFn);
  const nextRound = useServerFn(startNextRoundFn);
  const [admin, setAdmin] = useState(false);
  const [st, setSt] = useState<State | null>(null);
  const [name, setName] = useState("");
  const [hunting, setHunting] = useState(false);
  const [mine, setMine] = useState({ steps: 0, ms: 0, sent: 0, accepted: 0 });
  const [msg, setMsg] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const queue = useRef<Dp[]>([]);
  const session = useRef<string | null>(null);
  const steps = useRef(0);

  const refresh = () => getState().then(setSt).catch(() => {});
  useEffect(() => {
    setName(localStorage.getItem("kangaroo-hunter") || "");
    refresh();
    isAdmin().then((r) => setAdmin(r.admin)).catch(() => setAdmin(false));
    const t = setInterval(refresh, 8000);
    return () => { clearInterval(t); worker.current?.terminate(); };
  }, []);

  useEffect(() => {
    if (!hunting) return;
    const t = setInterval(async () => {
      if (!session.current) return;
      const batch = queue.current.splice(0, 64);
      try {
        const r = await submit({ data: { session: session.current, steps: steps.current, dps: batch } });
        if (!r.ok) { setMsg(r.error); return; }
        setMine((m) => ({ ...m, sent: m.sent + batch.length, accepted: m.accepted + r.accepted }));
        if (r.solved) { stop(); setMsg(`TRAP CLOSED · winner ${r.winnerName}`); refresh(); }
      } catch { queue.current.unshift(...batch); }
    }, 3000);
    return () => clearInterval(t);
  }, [hunting]);

  async function start() {
    setMsg(null);
    localStorage.setItem("kangaroo-hunter", name);
    const r = await join({ data: { name } }).catch((e) => ({ ok: false as const, error: (e as Error).message }));
    if (!r.ok) { setMsg(r.error); return; }
    session.current = r.session; steps.current = 0; queue.current = [];
    setMine({ steps: 0, ms: 0, sent: 0, accepted: 0 });
    const w = new Worker(new URL("../../lib/kangaroo-pool-worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e) => {
      steps.current = e.data.steps;
      queue.current.push(...e.data.dps);
      setMine((m) => ({ ...m, steps: e.data.steps, ms: e.data.ms }));
    };
    w.postMessage({ type: "start", pubHex: r.bounty.pubHex, jumps: r.bounty.jumps, dpBits: r.bounty.dpBits, starts: r.starts });
    setHunting(true);
  }
  const [busy, setBusy] = useState(false);
  async function startNext() {
    if (busy) return;
    if (!confirm("Close the current round and open a fresh unfunded test bounty?")) return;
    stop(); setBusy(true);
    const r = await nextRound({ data: { expectCurrent: st?.bounty.id ?? "" } }).catch(() => ({ ok: false as const, error: "Admins only." }));
    setMsg(r.ok ? "NEW ROUND OPEN" : r.error);
    await refresh(); setBusy(false);
  }
  function stop() { worker.current?.terminate(); worker.current = null; setHunting(false); }

  const b = st?.bounty;
  const bits = b ? BigInt("0x" + b.hiHex).toString(2).length - 1 : 0;
  const expected = bits ? 2 * Math.sqrt(2 ** (bits - 1)) : 0;
  const rate = mine.ms ? mine.steps / (mine.ms / 1000) : 0;

  return (
    <section className="mt-6 rounded-md border border-border bg-card/60 p-5 backdrop-blur">
      <p className="text-xs text-muted-foreground">SHARED POOL · SERVER-ASSIGNED HUNTER OFFSETS</p>
      {!b ? <p className="mt-2 text-muted-foreground">Loading bounty…</p> : (
        <>
          <p className="mt-2 text-foreground">{b.label}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">PUBKEY {b.pubHex}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The key was made on the server and thrown away; only its public key was kept. No prize — this is a test.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Cell k="STATUS" v={b.status.toUpperCase()} />
            <Cell k="POOL DPs" v={(st?.totalDps ?? 0).toLocaleString()} />
            <Cell k="POOL HOPS" v={`${(st?.totalSteps ?? 0).toLocaleString()} / ~${Math.round(expected).toLocaleString()}`} />
            <Cell k="LIVE HUNTERS" v={String(st?.hunters ?? 0)} />
          </div>
          {b.status !== "open" ? b.status !== "solved" ? <p className="mt-4 text-muted-foreground">Round closed.</p> : (
            <p className="mt-4 text-accent">WINNER {b.winnerName} · key 0x{b.solvedKeyHex} · checked against the public key on the server</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={hunting} placeholder="hunter name"
                className="rounded border border-border bg-background px-3 py-2 text-foreground" maxLength={20} />
              {!hunting
                ? <button onClick={start} className="rounded bg-primary px-4 py-2 text-primary-foreground">[ JOIN THE HUNT ]</button>
                : <button onClick={stop} className="rounded border border-border px-4 py-2">[ STOP ]</button>}
            </div>
          )}
          {(hunting || mine.steps > 0) && (
            <p className="mt-3 text-xs text-muted-foreground">
              YOU · {mine.steps.toLocaleString()} hops · {Math.round(rate).toLocaleString()}/s · {mine.accepted} DPs verified of {mine.sent} sent
            </p>
          )}
          {msg && <p className="mt-3 text-accent">{msg}</p>}
          {admin && (
            <button onClick={startNext} disabled={busy} className="mt-4 rounded border border-primary px-4 py-2 text-primary">[ ADMIN · START NEXT ROUND ]</button>
          )}
          <div className="mt-5">
            <p className="text-xs text-muted-foreground">LEADERBOARD · RANKED BY SERVER-VERIFIED DPs</p>
            {(st?.board ?? []).length === 0 && <p className="mt-2 text-muted-foreground">No hunters yet.</p>}
            <ol className="mt-2 space-y-1">
              {(st?.board ?? []).map((r, i) => (
                <li key={r.name} className="flex justify-between border-b border-border/50 py-1">
                  <span>{i + 1}. {r.name} {r.live && <span className="text-accent">● LIVE</span>}{b.winnerName === r.name && " 🏆"}</span>
                  <span className="text-muted-foreground">{r.dps} DPs · {r.steps.toLocaleString()} hops</span>
                </li>
              ))}
            </ol>
          </div>
          {(st?.past ?? []).length > 0 && (
            <div className="mt-5">
              <p className="text-xs text-muted-foreground">PAST ROUNDS</p>
              <ol className="mt-2 space-y-1 text-xs">
                {st!.past.map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-border/50 py-1">
                    <span>{p.label}</span>
                    <span className="text-muted-foreground">
                      {p.status === "solved" ? `${p.winnerName} · 0x${p.solvedKeyHex}` : p.status.toUpperCase()}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return <div className="rounded border border-border px-3 py-2"><p className="text-[10px] text-muted-foreground">{k}</p><p className="text-foreground">{v}</p></div>;
}
