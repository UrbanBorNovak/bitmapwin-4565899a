import { useEffect, useState } from "react";
import { nearTier } from "@/lib/bitmap-lottery";
import { nearRecordsFn } from "@/lib/puzzle-record.functions";

const LADDER = [{ id: "SILVER", n: 5 }, { id: "GOLD", n: 6 }, { id: "DIAMOND", n: 7 }];

/** Community-wide best near miss, verified on the server from the key itself. */
export function CommunityRecord() {
  const [rec, setRec] = useState<{ best: { nibbles: number; hash: string; found_at: string } | null; counts: Record<number, number> } | null>(null);
  useEffect(() => {
    const load = () => nearRecordsFn().then(setRec).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  const best = rec?.best;
  const countAt = (n: number) => Object.entries(rec?.counts ?? {}).reduce((a, [k, v]) => (Number(k) >= n ? a + v : a), 0);
  return (
    <section className="mt-6 rounded border border-bitcoin/60 bg-card/60 p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label text-bitcoin">COMMUNITY RECORD · CLOSEST MATCH SO FAR</p>
        <p className="text-muted-foreground">{best ? new Date(best.found_at).toLocaleString() : "no record yet"}</p>
      </div>
      <p className="display mt-2 text-2xl text-bitcoin">{best ? `${nearTier(best.nibbles).id} · ${best.nibbles}/40` : "—"}</p>
      {best && <p className="mt-1 break-all" data-no-translate><span className="text-bitcoin">{best.hash.slice(0, best.nibbles)}</span><span className="text-muted-foreground">{best.hash.slice(best.nibbles)}</span></p>}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {LADDER.map((l) => {
          const hit = (best?.nibbles ?? 0) >= l.n;
          return (
            <div key={l.id} className={`rounded border p-2 text-center ${hit ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>
              <p>{l.id}</p><p className="text-[10px]">{l.n}+ chars · {countAt(l.n)} found</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Each record is checked by our server from the actual key. It shows the luckiest coincidence anyone has hit — it is not progress toward the prize key, and the full key needs all 40 characters.</p>
    </section>
  );
}
