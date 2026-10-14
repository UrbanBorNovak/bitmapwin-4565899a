import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { layoutFromSizeClasses } from "@/lib/bitmap-layout";
import { parcelName, parcelsQuery } from "@/lib/parcels";
import { getBitmapRegistryEntry } from "@/lib/oci.functions";
import { MAX_BITMAP } from "@/lib/oci";
import { useWalletSession } from "@/lib/wallet-session";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { shortenAddress } from "@/lib/registry";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";

type Search = { height?: number; selected?: number };

export const Route = createFileRoute("/parcel")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const h = Number(s.height), i = Number(s.selected);
    return {
      ...(Number.isInteger(h) && h >= 0 ? { height: h } : {}),
      ...(Number.isInteger(i) && i >= 0 ? { selected: i } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Parcel Studio — split a BITMAP into on-chain parcels | bitmapwin" },
      { name: "description", content: "See every transaction tile of a BITMAP, which are already inscribed on Bitcoin, and inscribe your own parcel as a true child." },
      { property: "og:title", content: "Parcel Studio — bitmapwin" },
      { property: "og:description", content: "Map, verify and inscribe the parcels of any BITMAP straight on Bitcoin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ParcelStudio,
});

type TileState = "valid" | "open" | "dup";

function ParcelStudio() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/parcel" });
  const wallet = useWalletSession();
  const [input, setInput] = useState(search.height !== undefined ? String(search.height) : "");
  const height = search.height ?? null;
  const selected = search.selected ?? null;
  const [hover, setHover] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "valid">("all");

  const sizes = useQuery({ ...blockSizeMapQuery(height ?? 0), enabled: height !== null });
  const oci = useQuery({
    queryKey: ["oci-entry", height],
    queryFn: () => getBitmapRegistryEntry({ data: { height: height! } }),
    enabled: height !== null && height <= MAX_BITMAP,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const districtId = (oci.data as { inscriptionId?: string | null } | undefined)?.inscriptionId ?? null;
  const scan = useQuery(parcelsQuery(height ?? 0, height !== null ? districtId : null));
  const addrs = wallet ? ([wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean) as string[]) : [];
  const owned = useQuery(heldHeightsQuery(addrs));
  const ownedHeights = (owned.data ?? []) as number[];
  const holdsDistrict = height !== null && ownedHeights.includes(height);

  const layout = useMemo(() => (sizes.data?.classes?.length ? layoutFromSizeClasses(sizes.data.classes) : null), [sizes.data]);
  const txCount = sizes.data?.txCount ?? sizes.data?.classes?.length ?? null;

  const byIndex = useMemo(() => {
    const m = new Map<number, { state: TileState; owner: string | null; id: string }>();
    for (const p of scan.data?.parcels ?? []) {
      const prev = m.get(p.index);
      if (p.valid) m.set(p.index, { state: "valid", owner: p.ownerAddress, id: p.inscriptionId });
      else if (!prev) m.set(p.index, { state: "dup", owner: p.ownerAddress, id: p.inscriptionId });
    }
    return m;
  }, [scan.data]);

  const validCount = [...byIndex.values()].filter((v) => v.state === "valid").length;
  const mine = wallet ? [...byIndex.entries()].filter(([, v]) => v.state === "valid" && v.owner && addrs.includes(v.owner)) : [];
  const stateOf = (i: number): TileState => (byIndex.get(i)?.state === "valid" ? "valid" : "open");
  const sel = selected !== null && txCount !== null && selected < txCount ? selected : null;
  const selInfo = sel !== null ? byIndex.get(sel) : undefined;
  const scanning = scan.isPending && !!districtId;

  const go = () => {
    const h = Number(input);
    if (Number.isInteger(h) && h >= 0) navigate({ search: { height: h } });
  };
  const pick = (i: number) => navigate({ search: (p) => ({ ...p, selected: i }) });

  const side = layout ? Math.max(layout.width, layout.height) : 1;
  const offY = layout ? (side - layout.height) / 2 : 0;
  const show = hover ?? sel;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="glass-panel mb-4 rounded-lg border border-border p-4">
        <p className="label text-accent">PARCEL STUDIO</p>
        <h1 className="display mt-1 text-2xl md:text-3xl">Split a BITMAP into its real on-chain parcels</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every transaction in a Bitcoin block is a parcel. It becomes yours only when the first child of the BITMAP named
          <span className="font-mono"> index.height.bitmap</span> is inscribed. Later copies never count.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="BITMAP number"
            inputMode="numeric"
            className="h-10 w-44 rounded border border-border bg-background px-3 font-mono text-sm"
            aria-label="BITMAP number"
          />
          <button type="button" onClick={go} className="btn-term h-10 px-4">OPEN</button>
          {ownedHeights.slice(0, 12).map((h) => (
            <button key={h} type="button" onClick={() => { setInput(String(h)); navigate({ search: { height: h } }); }}
              className={`label rounded border px-2 py-1 ${h === height ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-primary"}`}>
              {h}
            </button>
          ))}
        </div>
      </header>

      {height === null ? (
        <p className="label text-muted-foreground">ENTER A BITMAP NUMBER TO MAP ITS PARCELS.</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Stat k="BITMAP" v={`${height}.BITMAP`} />
            <Stat k="MAX PARCELS" v={txCount?.toLocaleString("en-US") ?? "…"} />
            <Stat k="INSCRIBED" v={scanning ? "SCANNING…" : validCount.toLocaleString("en-US")} cyan />
            <Stat k="OPEN" v={txCount !== null && !scanning ? (txCount - validCount).toLocaleString("en-US") : "…"} />
            <Stat k="YOUR WALLET" v={!wallet ? "NOT CONNECTED" : holdsDistrict ? "HOLDS BITMAP" : mine.length ? `${mine.length} PARCELS` : "NO RIGHTS"} orange={holdsDistrict} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="glass-panel rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="label">PARCEL MAP</span>
                <div className="flex gap-1">
                  {(["all", "open", "valid"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFilter(f)}
                      className={`label rounded border px-2 py-0.5 ${filter === f ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                      {f === "valid" ? "INSCRIBED" : f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {!layout ? (
                <div className="flex aspect-square items-center justify-center label text-muted-foreground">
                  {sizes.isError ? "BLOCK DATA BUSY — TRY AGAIN" : "READING BLOCK FROM BITCOIN…"}
                </div>
              ) : (
                <svg viewBox={`0 0 ${side} ${side}`} className="aspect-square w-full touch-manipulation" onMouseLeave={() => setHover(null)} role="img" aria-label={`Parcel map of ${height}.bitmap`}>
                  <rect width={side} height={side} className="fill-background" />
                  {layout.parcels.map((p, i) => {
                    const st = stateOf(i);
                    const dim = (filter === "open" && st !== "open") || (filter === "valid" && st !== "valid");
                    const cls = i === sel ? "fill-primary" : st === "valid" ? "fill-accent" : "fill-muted";
                    return (
                      <rect key={i} x={p.position.x + 0.06} y={p.position.y + offY + 0.06} width={Math.max(0.1, p.size - 0.12)} height={Math.max(0.1, p.size - 0.12)}
                        className={`${cls} cursor-pointer transition-opacity hover:opacity-70`} opacity={dim ? 0.15 : 1}
                        onMouseEnter={() => setHover(i)} onClick={() => pick(i)} />
                    );
                  })}
                </svg>
              )}
              <div className="mt-2 flex flex-wrap gap-3 label text-muted-foreground">
                <span><i className="mr-1 inline-block h-2 w-2 bg-accent" />INSCRIBED</span>
                <span><i className="mr-1 inline-block h-2 w-2 bg-muted" />OPEN</span>
                <span><i className="mr-1 inline-block h-2 w-2 bg-primary" />SELECTED</span>
                {show !== null && <span className="ml-auto text-foreground">#{show} · {stateOf(show) === "valid" ? "INSCRIBED" : "OPEN"}</span>}
              </div>
            </section>

            <aside className="glass-panel space-y-3 rounded-lg border border-border p-4">
              <p className="label">PARCEL INSPECTOR</p>
              {sel === null ? (
                <p className="text-sm text-muted-foreground">Tap a tile on the map to inspect that parcel.</p>
              ) : (
                <>
                  <p className="display text-xl" data-no-translate>{parcelName(sel, height)}</p>
                  <Row k="TRANSACTION" v={`#${sel} of ${txCount?.toLocaleString("en-US")}`} />
                  <Row k="STATUS" v={selInfo?.state === "valid" ? "INSCRIBED · VALID" : selInfo?.state === "dup" ? "ONLY LATE COPIES — STILL OPEN" : "OPEN"} />
                  {selInfo?.state === "valid" && (
                    <>
                      <Row k="HOLDER" v={selInfo.owner ? shortenAddress(selInfo.owner) : "—"} />
                      <a className="label block text-accent hover:underline" href={`https://ordinals.com/inscription/${selInfo.id}`} target="_blank" rel="noreferrer">VIEW PROOF ON ORDINALS ↗</a>
                      <Link to="/forge" search={{ height } as never} className="btn-term block w-full px-3 py-2 text-center">BUILD ON THIS PARCEL IN LAND FORGE</Link>
                    </>
                  )}
                  {selInfo?.state !== "valid" && (
                    !wallet ? (
                      <p className="label text-muted-foreground">CONNECT YOUR WALLET TO INSCRIBE THIS PARCEL.</p>
                    ) : !districtId ? (
                      <p className="label text-muted-foreground">{oci.isPending ? "FINDING THE BITMAP INSCRIPTION…" : "BITMAP INSCRIPTION NOT FOUND."}</p>
                    ) : !holdsDistrict ? (
                      <p className="text-sm text-muted-foreground">Only the wallet holding {height}.bitmap can inscribe a true child parcel — Bitcoin needs that wallet to sign the parent link.</p>
                    ) : (
                      <ShadowInscriber
                        key={`${height}-${sel}`}
                        slug={`parcel-${height}-${sel}`}
                        height={height}
                        index={sel}
                        digest={parcelName(sel, height)}
                        artifactLabel={`INSCRIBE ${parcelName(sel, height).toUpperCase()}`}
                        actionLabel="INSCRIBE PARCEL ON BITCOIN"
                        description={`A tiny text inscription "${parcelName(sel, height)}" created as a child of ${height}.bitmap. If nobody inscribed this index first, it becomes the valid parcel.`}
                        allowUpload={false}
                        claimParentsForHeight={height}
                        parentBitmapInscriptionId={districtId}
                        artifactVariants={[{ key: "claim", label: "PARCEL CLAIM", contentType: "text/plain;charset=utf-8", source: parcelName(sel, height) }]}
                      />
                    )
                  )}
                </>
              )}
              {mine.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="label mb-1">YOUR PARCELS HERE</p>
                  <div className="flex flex-wrap gap-1">
                    {mine.map(([i]) => (
                      <button key={i} type="button" onClick={() => pick(i)} className="label rounded border border-primary px-2 py-0.5 text-primary">#{i}</button>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ k, v, cyan, orange }: { k: string; v: string; cyan?: boolean; orange?: boolean }) {
  return (
    <div className="glass-panel rounded border border-border px-3 py-2">
      <p className="label text-muted-foreground">{k}</p>
      <p className={`font-mono text-sm ${cyan ? "text-accent" : orange ? "text-primary" : ""}`} data-no-translate>{v}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
      <span className="label text-muted-foreground">{k}</span>
      <span className="font-mono text-xs" data-no-translate>{v}</span>
    </div>
  );
}
