import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { resolveWallet } from "@/components/BuyButton";
import { useWalletSession } from "@/lib/wallet-session";
import { slabAlbumFn } from "@/lib/slab-album.functions";
import { fetchSlabGrade } from "@/lib/slab-block";
import { SLAB_POSTAGE, certFacts, slabCertHtml } from "@/lib/slab-cert";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";

const MAX_PREGRADE = 30;

/** Pick held BITMAPs, see their pre-grades, then inscribe one certificate child each. */
export function GradeQueue() {
  const session = useWalletSession();
  const address = session?.ordinalsAddress ?? null;
  const album = useServerFn(slabAlbumFn);
  const held = useQuery({
    queryKey: ["slab-album", address],
    queryFn: () => album({ data: { address: address! } }),
    enabled: !!address,
    staleTime: 60_000,
  });
  const graded = new Set((held.data?.slabs ?? []).filter((s) => s.parentProven).map((s) => s.h));
  const bitmaps = (held.data?.bitmaps ?? []).slice(0, MAX_PREGRADE);
  const pre = useQueries({
    queries: bitmaps.map((b) => ({ queryKey: ["slab-pre", b.h], queryFn: () => fetchSlabGrade(b.h), staleTime: Infinity })),
  });
  const [picked, setPicked] = useState<number[]>([]);
  const [queue, setQueue] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const active = queue.find((h) => !done.includes(h));
  const activeIdx = bitmaps.findIndex((b) => b.h === active);
  const activeGrade = activeIdx >= 0 ? pre[activeIdx]?.data : null;

  if (!address) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-mono text-xs uppercase tracking-widest">Grade my land</h2>
        <p className="mt-2 text-sm text-muted-foreground">Connect your wallet to see your BITMAPs and their pre-grades.</p>
        <button
          onClick={() => resolveWallet().catch((e) => toast.error((e as Error).message))}
          className="mt-3 rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground"
        >
          CONNECT WALLET
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-widest">Grade my land</h2>
        <Link to="/slabs/$address" params={{ address }} className="font-mono text-xs text-accent underline">MY ALBUM</Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Each grade is reinscribed onto the BITMAP's own sat, which returns to you in the same transaction. Future visual upgrades reach every slab automatically. Grading is free: no site fee and no extra postage, you only pay the Bitcoin miner fee. One wallet approval per BITMAP.
      </p>
      {held.isPending ? (
        <p className="font-mono text-xs text-muted-foreground">READING YOUR WALLET…</p>
      ) : bitmaps.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">NO BITMAPS FOUND IN THIS WALLET</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-auto">
          {bitmaps.map((b, i) => {
            const g = pre[i]?.data?.grade;
            const isGraded = graded.has(b.h);
            return (
              <li key={b.id} className="flex items-center justify-between gap-2 font-mono text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={isGraded || queue.length > 0}
                    checked={picked.includes(b.h)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, b.h] : p.filter((x) => x !== b.h)))}
                  />
                  {b.h}.bitmap
                </label>
                <span className="text-muted-foreground">{isGraded ? "GRADED" : g ? `${g.name} ${g.grade}` : "…"}</span>
              </li>
            );
          })}
        </ul>
      )}
      {queue.length === 0 ? (
        <button
          disabled={picked.length === 0}
          onClick={() => setQueue(picked)}
          className="w-full rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground disabled:opacity-40"
        >
          GRADE {picked.length || ""} · FREE · MINER FEE ONLY
        </button>
      ) : active === undefined ? (
        <p className="font-mono text-xs text-accent">ALL {queue.length} CERTIFICATES BROADCAST · THEY APPEAR IN YOUR ALBUM AFTER CONFIRMATION</p>
      ) : (
        <div className="space-y-2">
          <p className="font-mono text-xs">
            {done.length + 1} OF {queue.length} · {active}.bitmap
          </p>
          {activeGrade ? (
            <ShadowInscriber
              key={active}
              slug="land-slab"
              height={active}
              index={0}
              digest={`bw-slab-1-${active}`}
              claimParentsForHeight={active}
              reinscribeOnBitmap
              artifactLabel="GRADE STAMPED ONTO THE BITMAP'S OWN SAT"
              actionLabel="INSCRIBE CERTIFICATE"
              artifactVariants={[
                {
                  key: "cert",
                  label: "CERTIFICATE",
                  contentType: "text/html;charset=utf-8",
                  source: slabCertHtml(certFacts(active, activeGrade.txCount, activeGrade.hash, activeGrade.grade)),
                  postage: SLAB_POSTAGE,
                },
              ]}
              onRevealed={() => setDone((d) => [...d, active])}
            />
          ) : (
            <p className="font-mono text-xs text-muted-foreground">PREPARING GRADE…</p>
          )}
          <button onClick={() => setDone((d) => [...d, active])} className="font-mono text-xs text-muted-foreground underline">
            SKIP THIS BITMAP
          </button>
        </div>
      )}
    </section>
  );
}
