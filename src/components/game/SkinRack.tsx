import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BITMAP_PIXELS_INSCRIPTION,
  getBitmapPixelsCollection,
} from "@/lib/bitmap-pixels.functions";

const PAGE_SIZE = 24;
const contentUrl = (id: string) => `/api/public/inscription/${id}`;

export function SkinRack({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (id: string | null) => void;
}) {
  const readCollection = useServerFn(getBitmapPixelsCollection);
  const collection = useQuery({
    queryKey: ["bitmap-pixels-collection", BITMAP_PIXELS_INSCRIPTION],
    queryFn: () => readCollection(),
    staleTime: Infinity,
    retry: 1,
  });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const pixels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return collection.data?.pixels ?? [];
    return (collection.data?.pixels ?? []).filter(
      (pixel) => pixel.name.toLowerCase().includes(needle) || pixel.inscriptionId.includes(needle),
    );
  }, [collection.data, query]);
  const pageCount = Math.max(1, Math.ceil(pixels.length / PAGE_SIZE));
  const visible = pixels.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selected = collection.data?.pixels.find((pixel) => pixel.inscriptionId === value);

  useEffect(() => setPage(0), [query]);

  return (
    <div data-no-translate>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="label">SKIN — COMPLETE BITMAP PIXELS COLLECTION</span>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {collection.data ? `${collection.data.pixels.length} UNIQUE ON-CHAIN SKINS` : "READING ON-CHAIN MANIFEST"}
          </p>
        </div>
        <Button type="button" className={value === null ? "btn-term" : "btn-term-ghost"} onClick={() => onPick(null)}>
          [ STOCK SKIN ]
        </Button>
      </div>

      <label className="mt-3 flex items-center gap-2 border border-border bg-background px-3 py-2 focus-within:border-bitcoin">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SEARCH SKIN OR INSCRIPTION"
          aria-label="Search BITMAP Pixel skins"
          className="min-w-0 flex-1 bg-transparent font-mono text-[10px] uppercase outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="mt-2 min-h-[28rem] border border-border bg-background p-2">
        {collection.isLoading ? (
          <div className="flex h-[27rem] items-center justify-center font-mono text-[10px] text-bitcoin">
            &gt; LOADING ALL SKINS<span className="blink">_</span>
          </div>
        ) : collection.isError ? (
          <div className="flex h-[27rem] flex-col items-center justify-center gap-3 text-center">
            <p className="font-mono text-[10px] text-muted-foreground">SKINS ARE TEMPORARILY UNAVAILABLE</p>
            <Button type="button" className="btn-term-ghost" onClick={() => void collection.refetch()}>
              [ RETRY ]
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-[27rem] items-center justify-center font-mono text-[10px] text-muted-foreground">
            NO SKINS MATCH THIS SEARCH
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {visible.map((pixel) => {
              const active = value === pixel.inscriptionId;
              return (
                <Button
                  key={pixel.inscriptionId}
                  type="button"
                  variant="ghost"
                  onClick={() => onPick(pixel.inscriptionId)}
                  className={`group relative h-auto min-w-0 flex-col items-stretch border bg-background p-1.5 text-left ${
                    active ? "border-bitcoin bg-bitcoin/10" : "border-border hover:border-bitcoin/60"
                  }`}
                  aria-label={`Wear ${pixel.name}`}
                >
                  <span className="absolute left-2 top-2 z-10 bg-background/85 px-1 font-mono text-[8px] text-bitcoin">
                    #{String(pixel.index).padStart(3, "0")}
                  </span>
                  <span className="block aspect-square w-full overflow-hidden bg-muted/30">
                    <img
                      src={contentUrl(pixel.inscriptionId)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain [image-rendering:pixelated] transition-transform duration-150 group-hover:scale-105"
                    />
                  </span>
                  <span className="mt-1.5 block w-full truncate font-mono text-[9px] font-bold uppercase text-foreground">
                    {pixel.name}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border border-border px-2 py-1.5">
        <p className="min-w-0 truncate font-mono text-[10px] uppercase text-bitcoin">
          {value === null ? "STOCK SKIN SELECTED" : selected?.name ?? "CUSTOM SKIN SELECTED"}
        </p>
        <div className="ml-2 flex shrink-0 items-center gap-2 font-mono text-[9px] text-muted-foreground">
          <Button
            type="button"
            className="btn-term-ghost"
            size="icon"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            aria-label="Previous skins"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span>PAGE {page + 1} / {pageCount}</span>
          <Button
            type="button"
            className="btn-term-ghost"
            size="icon"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            aria-label="Next skins"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}