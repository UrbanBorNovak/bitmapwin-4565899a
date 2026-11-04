import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildRings, ringNeighbours, type RingPage } from "@/lib/webrings";

async function fetchPages(): Promise<RingPage[]> {
  const out: RingPage[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("parcel_pages")
      .select("bitmap_height, build_kind, title")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) out.push({ height: Number(r.bitmap_height), kind: String(r.build_kind), title: r.title });
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/** Retro webring bar shown on BITMAP pages that are members of at least one ring. */
export function WebringWidget({ height }: { height: number }) {
  const q = useQuery({ queryKey: ["webrings"], queryFn: fetchPages, staleTime: 60_000 });
  const navigate = useNavigate();
  const rings = buildRings(q.data ?? []).filter((r) => r.members.includes(height));
  if (rings.length === 0) return null;
  const go = (h: number) => navigate({ to: "/bitmap/$block", params: { block: String(h) } });

  return (
    <section aria-label="Webrings" className="space-y-2 font-mono">
      {rings.map((r) => {
        const nb = ringNeighbours(r.members, height);
        if (!nb) return null;
        const others = r.members.filter((m) => m !== height);
        const rand = () => go(others[Math.floor(Math.random() * others.length)] ?? height);
        return (
          <div key={r.slug} className="border border-dashed border-primary/60 bg-card/60 p-3 text-center text-xs">
            <p className="uppercase tracking-[0.25em] text-muted-foreground">
              ★ this BITMAP is a member of the <span className="text-primary">{r.name}</span> ★
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button className="border border-border px-2 py-1 hover:border-primary" onClick={() => go(nb.prev)}>◄ PREV ({nb.prev})</button>
              <Link to="/webrings" hash={r.slug} className="border border-primary px-3 py-1 text-primary">RING HUB · {r.members.length}</Link>
              <button className="border border-border px-2 py-1 hover:border-primary" onClick={() => go(nb.next)}>NEXT ({nb.next}) ►</button>
              <button className="border border-border px-2 py-1 hover:border-primary disabled:opacity-40" disabled={others.length === 0} onClick={rand}>🎲 RANDOM</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
