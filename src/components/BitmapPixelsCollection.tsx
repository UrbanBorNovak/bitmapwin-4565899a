import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterPortrait } from "@/components/game/CharacterPortrait";
import { readCharacter, saveCharacter } from "@/lib/character";
import {
  BITMAP_PIXELS_INSCRIPTION,
  getBitmapPixelsCollection,
  type BitmapPixel,
} from "@/lib/bitmap-pixels.functions";
import { setAvatarModelInscription, setAvatarSkinInscription } from "@/lib/map-identity";

const PAGE_SIZE = 24;
const contentUrl = (id: string) => `/api/public/inscription/${id}`;
const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-5)}`;

export function BitmapPixelsCollection() {
  const readCollection = useServerFn(getBitmapPixelsCollection);
  const collection = useQuery({
    queryKey: ["bitmap-pixels-collection", BITMAP_PIXELS_INSCRIPTION],
    queryFn: () => readCollection(),
    staleTime: Infinity,
    retry: 1,
  });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<BitmapPixel | null>(null);
  const [worn, setWorn] = useState<string | null>(null);

  const pixels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return collection.data?.pixels ?? [];
    return (collection.data?.pixels ?? []).filter(
      (pixel) => pixel.name.toLowerCase().includes(needle) || pixel.inscriptionId.includes(needle),
    );
  }, [collection.data, query]);
  const pageCount = Math.max(1, Math.ceil(pixels.length / PAGE_SIZE));
  const visible = pixels.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    if (!selected && collection.data?.pixels[0]) setSelected(collection.data.pixels[0]);
  }, [collection.data, selected]);

  const wear = (pixel: BitmapPixel) => {
    setAvatarModelInscription(null);
    setAvatarSkinInscription(pixel.inscriptionId);
    const character = readCharacter();
    if (character) saveCharacter({ ...character, avatarModel: null, avatarSkin: pixel.inscriptionId });
    setWorn(pixel.inscriptionId);
    setSelected(pixel);
  };

  return (
    <section className="inventory-terminal mt-10 border border-bitcoin/40 bg-card" data-no-translate>
      <header className="flex flex-col gap-4 border-b border-bitcoin/30 bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="size-2 animate-pulse bg-bitcoin" aria-hidden="true" />
          <div>
            <p className="font-mono text-[9px] uppercase text-bitcoin/70">ON-CHAIN COLLECTION // BLOCK 881,133</p>
            <h2 className="display mt-1 text-xl">BITMAP PIXELS COLLECTION</h2>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border border-border text-center font-mono text-[9px] uppercase">
          <div className="px-4 py-2"><span className="block text-muted-foreground">PIXELS</span><b className="text-foreground">{collection.data?.pixels.length ?? "—"}</b></div>
          <div className="px-4 py-2"><span className="block text-muted-foreground">3D RIGS</span><b className="text-foreground">1</b></div>
          <div className="px-4 py-2"><span className="block text-muted-foreground">SOURCE</span><b className="text-signal">BITCOIN</b></div>
        </div>
      </header>

      <div className="grid border-b border-border lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
        <div className="relative min-h-[360px] border-b border-border bg-background lg:border-b-0 lg:border-r">
          {selected ? <CharacterPortrait model={null} skin={selected.inscriptionId} className="h-[360px]" /> : null}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 border border-bitcoin/30 bg-background/90 p-3 backdrop-blur-sm">
            <p className="font-mono text-[9px] text-bitcoin">SELECTED // PIXEL {String(selected?.index ?? 0).padStart(3, "0")}</p>
            <p className="display mt-1 truncate text-lg">{selected?.name ?? "SCANNING COLLECTION"}</p>
            <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">{selected ? short(selected.inscriptionId) : BITMAP_PIXELS_INSCRIPTION}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-2 border border-border bg-background px-3 py-2 focus-within:border-bitcoin">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SEARCH PIXEL OR INSCRIPTION"
                aria-label="Search BITMAP Pixels"
                className="min-w-0 flex-1 bg-transparent font-mono text-[10px] uppercase outline-none placeholder:text-muted-foreground"
              />
            </label>
            {selected ? (
              <div className="flex gap-2">
                <Button className="btn-term" onClick={() => wear(selected)}>{worn === selected.inscriptionId ? "[ WEARING ]" : "[ WEAR IN OASIS ]"}</Button>
                <Button className="btn-term-ghost" asChild>
                  <a href={`https://ordinals.com/inscription/${selected.inscriptionId}`} target="_blank" rel="noreferrer" aria-label="Inspect selected inscription">
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="p-4">
            {collection.isLoading ? (
              <div className="flex min-h-64 items-center justify-center font-mono text-[10px] text-bitcoin">&gt; READING IMMUTABLE COLLECTION MANIFEST<span className="blink">_</span></div>
            ) : collection.isError ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
                <p className="font-mono text-[10px] text-muted-foreground">BITMAP PIXELS ARE TEMPORARILY UNAVAILABLE</p>
                <Button className="btn-term-ghost" onClick={() => void collection.refetch()}>[ RETRY SCAN ]</Button>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center font-mono text-[10px] text-muted-foreground">NO PIXEL MATCHES THIS SEARCH</div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                {visible.map((pixel) => {
                  const active = selected?.inscriptionId === pixel.inscriptionId;
                  return (
                    <button
                      key={pixel.inscriptionId}
                      type="button"
                      onClick={() => setSelected(pixel)}
                      className={`group relative min-w-0 border bg-background p-1.5 text-left transition-colors ${active ? "border-bitcoin" : "border-border hover:border-bitcoin/60"}`}
                      aria-label={`Preview ${pixel.name}`}
                    >
                      <span className="absolute left-2 top-2 z-10 bg-background/85 px-1 font-mono text-[8px] text-bitcoin">#{String(pixel.index).padStart(3, "0")}</span>
                      <span className="block aspect-square overflow-hidden bg-muted/30">
                        <img src={contentUrl(pixel.inscriptionId)} alt="" loading="lazy" className="h-full w-full object-contain [image-rendering:pixelated] transition-transform duration-150 group-hover:scale-105" />
                      </span>
                      <span className="mt-1.5 block truncate font-mono text-[9px] font-bold uppercase text-foreground">{pixel.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-3 border-t border-bitcoin/30 bg-muted/20 px-4 py-3 font-mono text-[9px] uppercase text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>MANIFEST {short(BITMAP_PIXELS_INSCRIPTION)} · IMMUTABLE</span>
        <div className="flex items-center gap-2">
          <Button className="btn-term-ghost" size="icon" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Previous page"><ChevronLeft className="size-3.5" /></Button>
          <span className="min-w-24 text-center">PAGE {page + 1} / {pageCount}</span>
          <Button className="btn-term-ghost" size="icon" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label="Next page"><ChevronRight className="size-3.5" /></Button>
        </div>
      </footer>
    </section>
  );
}