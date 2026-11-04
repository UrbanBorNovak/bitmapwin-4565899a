import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildRings, ringNeighbours, type RingPage } from "@/lib/webrings";

export const Route = createFileRoute("/webrings")({
  head: () => ({
    meta: [
      { title: "BITMAP Webrings — surf built Bitcoin land" },
      { name: "description", content: "A retro webring directory of BITMAPs whose holders saved a public page. Hop PREV, NEXT or RANDOM through each ring." },
      { property: "og:title", content: "BITMAP Webrings" },
      { property: "og:description", content: "Surf built BITMAPs ring by ring, the old-web way." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WebringsPage,
});

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

function WebringsPage() {
  const q = useQuery({ queryKey: ["webrings"], queryFn: fetchPages, staleTime: 60_000 });
  const rings = buildRings(q.data ?? []);
  const titles = new Map((q.data ?? []).map((p) => [p.height, p.title]));
  const [open, setOpen] = useState<string | null>(null);
  const [at, setAt] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-mono">
      <header className="mb-8 border border-border p-5 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">★ welcome to the ★</p>
        <h1 className="mt-2 font-display text-3xl text-primary">BITMAP WEBRING DIRECTORY</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Every ring is made from BITMAPs whose holders saved a public page. Members are ordered by block height and the ring loops around.
        </p>
      </header>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading rings…</p>}
      {q.error && <p className="text-sm text-destructive">Could not load rings.</p>}
      {q.data && rings.length === 0 && <p className="text-sm text-muted-foreground">No public BITMAP pages yet.</p>}

      <ul className="space-y-4">
        {rings.map((r) => {
          const cur: number = at[r.slug] ?? r.members[0] ?? 0;
          const nb = ringNeighbours(r.members, cur) ?? { prev: cur, next: cur };
          const go = (h: number) => setAt((s) => ({ ...s, [r.slug]: h }));
          return (
            <li key={r.slug} id={r.slug} className="border border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg text-foreground">{r.name}</h2>
                <span className="text-xs text-accent">{r.members.length} member{r.members.length === 1 ? "" : "s"}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.blurb}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <button className="border border-border px-2 py-1 hover:border-primary" onClick={() => go(nb.prev)}>◄ PREV</button>
                <Link to="/bitmap/$block" params={{ block: String(cur) }} className="border border-primary px-3 py-1 text-primary">
                  VISIT {cur}.bitmap{titles.get(cur) ? ` · ${titles.get(cur)}` : ""}
                </Link>
                <button className="border border-border px-2 py-1 hover:border-primary" onClick={() => go(nb.next)}>NEXT ►</button>
                <button
                  className="border border-border px-2 py-1 hover:border-primary"
                  onClick={() => navigate({ to: "/bitmap/$block", params: { block: String(r.members[Math.floor(Math.random() * r.members.length)] ?? cur) } })}
                >🎲 RANDOM</button>
                <button className="ml-auto text-muted-foreground underline" onClick={() => setOpen(open === r.slug ? null : r.slug)}>
                  {open === r.slug ? "hide hub" : "ring hub"}
                </button>
              </div>
              {open === r.slug && (
                <div className="mt-3 flex max-h-48 flex-wrap gap-1 overflow-auto">
                  {r.members.map((h) => (
                    <Link key={h} to="/bitmap/$block" params={{ block: String(h) }} className="border border-border px-1.5 py-0.5 text-[11px] hover:text-primary">
                      {h}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
