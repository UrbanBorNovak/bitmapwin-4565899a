import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { myGuardiansQuery } from "@/lib/bitmon-queries";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useWalletSession } from "@/lib/wallet-session";
import { collectForageFn } from "@/lib/guardian-agents.functions";
import { wireBrain, decideDrive, sensesAt, agentSlots, SYNAPSES, DRIVES, FORAGE_BIT } from "@/lib/guardian-brain";

export function GuardianAgents() {
  const [userId, setUserId] = useState<string | null>(null);
  const [minute, setMinute] = useState<number | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const tick = () => setMinute(Math.floor(Date.now() / 60000));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  const collect = useServerFn(collectForageFn);
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;
  async function forage(height: number) {
    if (!address) return toast.error("Connect a verified wallet to earn BIT");
    const r = await collect({ data: { height, address } });
    r.ok ? toast.success(`+${r.bit} BIT foraged by #${height}`) : toast.error(r.error);
  }
  const mine = useQuery(myGuardiansQuery(userId));
  const guardians = mine.data ?? [];
  const brains = useMemo(() => guardians.map((g) => ({ g, b: wireBrain(g.height) })), [guardians]);

  return (
    <section className="glass-panel rounded-[18px] border border-border p-4">
      <div className="font-mono text-[11px] tracking-widest text-signal">GUARDIAN AGENTS · LOCAL BRAIN</div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every Guardian you hold is one helper. Each runs a tiny fly-style brain with {SYNAPSES.toLocaleString()} synapses wired from its block, right in your browser — no AI credits used. In the Oasis they move around their own BITMAP by what they chose. When one forages, you can collect a little BIT once a day. They never trade or spend on their own.
      </p>
      {!userId && <p className="mt-3 text-xs text-muted-foreground">Sign in to wake your Guardians.</p>}
      {userId && mine.isSuccess && (
        <div className="mt-2 font-mono text-xs text-foreground">{agentSlots(guardians.length)} agent{guardians.length === 1 ? "" : "s"} available</div>
      )}
      {userId && mine.isSuccess && guardians.length === 0 && <p className="mt-2 text-xs text-muted-foreground">You don't hold a Guardian yet — summon one to get your first helper.</p>}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {minute !== null && brains.map(({ g, b }) => {
          const d = decideDrive(b, sensesAt(g.height, minute));
          const max = Math.max(1, ...DRIVES.map((k) => d.spikes[k]));
          return (
            <li key={g.height} className="rounded border border-border p-3">
              <div className="flex justify-between font-mono text-xs"><span className="text-primary">#{g.height}</span><span className="text-muted-foreground">{g.species}</span></div>
              <div className="mt-1 text-sm text-foreground">{d.drive.toUpperCase()}</div>
              <div className="text-xs text-muted-foreground">{d.why}</div>
              <div className="mt-2 flex gap-1">
                {DRIVES.map((k) => (
                  <div key={k} className="flex-1" title={`${k}: ${d.spikes[k]}`}>
                    <div className="h-1 rounded bg-signal" style={{ opacity: 0.15 + 0.85 * (d.spikes[k] / max) }} />
                    <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">{k}</div>
                  </div>
                ))}
              </div>
              {d.drive === "forage" && (
                <button type="button" onClick={() => forage(g.height)} className="mt-2 w-full rounded border border-primary px-2 py-1 font-mono text-[11px] text-primary hover:bg-primary/10">
                  COLLECT {FORAGE_BIT} BIT · ONCE A DAY
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
