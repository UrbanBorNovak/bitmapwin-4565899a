import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import catalog from "@/lib/vendor/inscribed-spaces-catalog.json";

type Space = { n: number; title: string; creator: string; id: string; bitmap: number | null };
const SPACES = (catalog as Space[]).slice().sort((a, b) => b.n - a.n);
const ORD = "https://ordinals.com";

/** Historical Inscribed.space worlds — archive only, never rendered in the Oasis. */
export function InscribedSpacesArchive() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Space | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^#/, "");
    if (!s) return SPACES;
    return SPACES.filter((x) => String(x.n) === s || x.title.toLowerCase().includes(s) || x.creator.toLowerCase().includes(s));
  }, [q]);

  return (
    <section className="mt-12">
      <p className="label text-bitcoin">04 · HISTORICAL 3D WORLDS</p>
      <h2 className="display mt-2 text-xl md:text-2xl">INSCRIBED.SPACE ARCHIVE</h2>
      <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
        {SPACES.length} early recursive 3D worlds inscribed on Bitcoin (2023–2024), from the inscribed.space explorer. Links point straight to ordinals.com. Titles and creators are the explorer's attribution, not chain facts; the inscription id is. These worlds are kept here as history and are not placed in the Oasis.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="SEARCH TITLE, CREATOR OR #NUMBER"
        className="mt-4 w-full max-w-md border border-border bg-card px-3 py-2 font-mono text-xs"
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((s) => (
          <article key={s.id} className="flex flex-col border border-border bg-card">
            <button type="button" onClick={() => setOpen(s)} className="aspect-video overflow-hidden bg-background">
              <img src={`https://inscribed.space/explore/spaces/${s.n}.png`} alt={s.title} loading="lazy" className="h-full w-full object-cover" />
            </button>
            <div className="flex flex-1 flex-col p-3">
              <p className="label text-signal">SPACE #{s.n}</p>
              <h3 className="display mt-1 text-sm" data-no-translate>{s.title}</h3>
              <p className="font-mono text-[10px] text-muted-foreground" data-no-translate>{s.creator}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setOpen(s)} className="btn-term-ghost text-[10px]">ENTER 3D →</button>
                <a href={`${ORD}/inscription/${s.id}`} target="_blank" rel="noreferrer" className="label border border-border px-2 py-1 hover:border-bitcoin">L1 ↗</a>
                <a href={`${ORD}/content/${s.id}`} target="_blank" rel="noreferrer" className="label border border-border px-2 py-1 hover:border-bitcoin">RAW ↗</a>
                {s.bitmap != null && (
                  <Link to="/bitmap/$block" params={{ block: String(s.bitmap) }} className="label border border-bitcoin px-2 py-1 text-bitcoin">{s.bitmap}.BITMAP</Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-3 backdrop-blur" role="dialog" aria-label={open.title}>
          <div className="flex items-center justify-between gap-3 pb-2">
            <p className="label truncate">SPACE #{open.n} · <span data-no-translate>{open.title}</span></p>
            <button type="button" onClick={() => setOpen(null)} className="btn-term-ghost">CLOSE ✕</button>
          </div>
          <iframe
            title={open.title}
            src={`${ORD}/content/${open.id}`}
            sandbox="allow-scripts"
            allow="fullscreen"
            className="w-full flex-1 border border-border"
          />
        </div>
      )}
    </section>
  );
}
