import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ARTISTS, PIXELS, STARRED_SERIES, filterPixels, starsOf } from "@/lib/bitmap-pixels-catalog";
import { BITERNAM_CREW, CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
import { PixelFace } from "@/components/game/PixelFace";
import { PixelAvatar3D } from "@/components/biternam/PixelAvatar3D";

export const Route = createFileRoute("/biternam_/pixels")({
  head: () => {
    const title = "BITMAP Pixels Avatar Market — Biternam";
    const description = "Browse all 4,320 BITMAP Pixels avatar inscriptions across 174 series, with the skins worn by the Biternam cast starred.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  component: PixelsMarket,
});

const PAGE = 12; // each card is a live 3D view; browsers cap WebGL contexts (~16)
const nameOf = (id: string) => BITERNAM_CREW.find((c) => c.id === id)?.name ?? id.toUpperCase();

function PixelsMarket() {
  const [q, setQ] = useState("");
  const [artist, setArtist] = useState("");
  const [starred, setStarred] = useState(false);
  const [page, setPage] = useState(0);
  const list = useMemo(() => filterPixels(PIXELS, q, artist, starred), [q, artist, starred]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice(page * PAGE, page * PAGE + PAGE);
  const reset = () => setPage(0);
  const cast = Object.keys(CREW_PIXEL_AVATAR).filter((k) => BITERNAM_CREW.some((c) => c.id === k));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <Link to="/biternam" className="font-mono text-xs text-muted-foreground hover:text-foreground">← BITERNAM HUB</Link>
      <h1 className="mt-2 font-display text-3xl">BITMAP Pixels Avatar Market</h1>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{PIXELS.length.toLocaleString()} inscriptions · {ARTISTS.length} series · view & buy on ordinals markets</p>

      <section className="mt-6">
        <h2 className="font-mono text-xs uppercase text-bitcoin">★ Starred cast</h2>
        <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
          {cast.map((k) => (
            <button key={k} onClick={() => { const s = STARRED_SERIES[k]; if (s) { setArtist(s); setStarred(false); reset(); } }}
              className="glass-panel flex w-24 shrink-0 flex-col items-center rounded border border-border p-2 hover:border-bitcoin">
              <PixelFace inscriptionId={CREW_PIXEL_AVATAR[k]!} label={nameOf(k)} className="h-12 w-12" />
              <span className="mt-1 truncate font-mono text-[10px]">{nameOf(k)}</span>
              {STARRED_SERIES[k] && <span className="font-mono text-[9px] text-signal">series →</span>}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Search name, #, series, id"
          className="rounded border border-border bg-background px-3 py-1.5 font-mono text-xs" />
        <select value={artist} onChange={(e) => { setArtist(e.target.value); reset(); }} className="rounded border border-border bg-background px-2 py-1.5 font-mono text-xs">
          <option value="">All series</option>
          {ARTISTS.map((a) => <option key={a.artist} value={a.artist}>{a.artist} ({a.count})</option>)}
        </select>
        <button onClick={() => { setStarred((s) => !s); reset(); }} className={`rounded border px-3 py-1.5 font-mono text-xs ${starred ? "border-bitcoin text-bitcoin" : "border-border"}`}>★ Starred only</button>
        <span className="font-mono text-xs text-muted-foreground">{list.length.toLocaleString()} results</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((p) => {
          const stars = starsOf(p.artist);
          return (
            <article key={p.id} className="glass-panel overflow-hidden rounded border border-border">
              <PixelAvatar3D inscriptionId={p.id} label={p.name} />
              <div className="p-2 font-mono text-[10px]">
                <div className="text-muted-foreground">#{p.number}</div>
                <div className="truncate text-xs">{p.name}</div>
                <div className="truncate text-muted-foreground">{p.artist}</div>
                {stars.length > 0 && <div className="truncate text-bitcoin">★ {stars.map(nameOf).join(", ")}</div>}
                <div className="mt-1 flex gap-2">
                  <a href={`https://ordinals.com/inscription/${p.id}`} target="_blank" rel="noreferrer" className="text-signal hover:underline">ord</a>
                  <a href={`https://magiceden.io/ordinals/item-details/${p.id}`} target="_blank" rel="noreferrer" className="text-bitcoin hover:underline">market</a>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 font-mono text-xs">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-3 py-1 disabled:opacity-40">PREV</button>
        <span>{page + 1} / {pages}</span>
        <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-3 py-1 disabled:opacity-40">NEXT</button>
      </div>
    </main>
  );
}
