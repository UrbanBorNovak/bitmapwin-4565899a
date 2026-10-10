import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Gem } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { claimShardFn, getShardRaidFn } from "@/lib/shard-raid.functions";
import { markGathered, mountRev, mountState, setRaid, subscribeMount, toggleRide } from "@/lib/guardian-mount";
import { RAID_BIT_REWARD, raidEndsAt } from "@/lib/shard-raid";
import { useWalletSession } from "@/lib/wallet-session";

/** Shard Raid tracker: gather this hour's shards on inscribed Guardian BITMAPs, then ride. */
export function ShardRaidHud() {
  useSyncExternalStore(subscribeMount, mountRev, () => 0);
  const st = mountState();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [raidId, setRaidId] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useServerFn(getShardRaidFn);
  const claim = useServerFn(claimShardFn);
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSignedIn(Boolean(data.session));
    if (!data.session) return;
    try {
      const r = await load();
      setRaidId(r.raidId);
      setRaid(r.shards, r.gathered, r.mounts);
    } catch { /* retried on the next tick */ }
  }, [load]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Standing on a shard's BITMAP claims it.
  useEffect(() => {
    const h = st.standing;
    if (!signedIn || busy.current || !st.shards.includes(h) || st.gathered.includes(h)) return;
    busy.current = true;
    void claim({ data: { height: h, address } })
      .then((r) => {
        if (!r.ok) return setNote(r.error);
        markGathered(h);
        if (r.complete) {
          setNote(`RAID COMPLETE · ${st.shards[0]}.BITMAP GUARDIAN UNLOCKED AS MOUNT${r.bit ? ` · +${r.bit} BIT` : ""}${r.note ? ` · ${r.note}` : ""}`);
          void refresh();
        } else setNote(`SHARD GATHERED · ${h}.BITMAP`);
      })
      .catch(() => setNote("COULD NOT CLAIM — STEP OFF AND BACK ON"))
      .finally(() => {
        busy.current = false;
        window.setTimeout(() => setNote(null), 4000);
      });
  }, [st.standing, st.shards, st.gathered, signedIn, address, claim, refresh]);

  const left = raidId === null ? 0 : Math.max(0, Math.ceil((raidEndsAt(raidId) - Date.now()) / 60000));

  return (
    <div className="absolute left-3 top-24 z-[85] max-w-[260px] font-mono text-[11px]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="hud-panel hud-keep flex items-center gap-2 px-3 py-2 text-bitcoin hover:text-foreground">
        <Gem className="size-3.5" /> SHARD RAID {st.shards.length ? `${st.gathered.length}/${st.shards.length}` : ""}
      </button>
      {open ? (
        <div className="hud-panel mt-1 space-y-2 p-3">
          {signedIn === false ? (
            <Link to="/auth" className="text-bitcoin hover:text-foreground">SIGN IN TO RAID →</Link>
          ) : !st.shards.length ? (
            <p className="text-muted-foreground">NO INSCRIBED GUARDIANS YET — NO SHARDS THIS HOUR</p>
          ) : (
            <>
              <p className="text-muted-foreground">Stand on each inscribed Guardian's BITMAP to gather its shard. Full set: ride the {st.shards[0]}.BITMAP Guardian + {RAID_BIT_REWARD} BIT. New raid in {left} min.</p>
              <ul className="space-y-1">
                {st.shards.map((h) => (
                  <li key={h} className="flex items-center justify-between gap-2">
                    <span className={st.gathered.includes(h) ? "text-signal" : "text-foreground"}>{st.gathered.includes(h) ? "◆" : "◇"} {h}.BITMAP{h === st.shards[0] ? " · MOUNT" : ""}</span>
                    {st.gathered.includes(h) ? null : <Link to="/oasis" search={{ height: h }} className="text-bitcoin hover:text-foreground">GO →</Link>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {st.mounts.length ? (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="text-signal">YOUR MOUNTS</p>
              {st.mounts.map((h) => (
                <button key={h} type="button" onClick={() => toggleRide(h)} className={`block ${st.riding === h ? "text-bitcoin" : "text-foreground"} hover:text-bitcoin`}>
                  {st.riding === h ? "■ DISMOUNT" : "▶ RIDE"} {h}.BITMAP GUARDIAN
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {note ? <div className="hud-panel mt-1 px-3 py-2 text-bitcoin">{note}</div> : null}
    </div>
  );
}
