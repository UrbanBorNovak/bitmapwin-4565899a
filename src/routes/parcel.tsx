import { useEffect, useMemo, useState } from "react";
import { estimateCart, PARCEL_CART_MAX, PARCEL_SITE_FEE, toggleCart } from "@/lib/parcel-cart";
import { DONATION_ADDRESS } from "@/lib/donations";
import { liveFeeRate } from "@/lib/shadow-inscribe";

type CartQueue = { order: number[]; step: number; done: number[]; confirmed: boolean };
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { layoutFromSizeClasses } from "@/lib/bitmap-layout";
import { parcelRects } from "@/lib/forge-parcels";
import { parcelName, parcelsQuery } from "@/lib/parcels";
import { getBitmapRegistryEntry } from "@/lib/oci.functions";
import { getForgeLandFn } from "@/lib/forge.functions";
import { MAX_BITMAP } from "@/lib/oci";
import { useWalletSession } from "@/lib/wallet-session";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { shortenAddress } from "@/lib/registry";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";

type Search = { height?: number; selected?: number };

export const Route = createFileRoute("/parcel")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const h = Number(s["height"]), i = Number(s["selected"]);
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
  const [cart, setCart] = useState<number[]>([]);
  const [multi, setMulti] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [queue, setQueue] = useState<CartQueue | null>(null);
  const [feeMode, setFeeMode] = useState<"1" | "live" | "custom">("live");
  const [customFee, setCustomFee] = useState("1");
  const [liveRate, setLiveRate] = useState<number | null>(null);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("bitmapwin:inscribe-fee") ?? "null") as { mode?: string; custom?: string } | null;
      if (s?.mode === "1" || s?.mode === "live" || s?.mode === "custom") setFeeMode(s.mode);
      if (s?.custom) setCustomFee(s.custom);
    } catch { /* ignore */ }
    void liveFeeRate().then(setLiveRate).catch(() => {});
  }, []);
  useEffect(() => { setCart([]); setQueue(null); setAgreed(false); }, [height]);
  useEffect(() => { setAgreed(false); }, [cart, feeMode, customFee]);

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
  const land = useQuery({
    queryKey: ["forge-land", height],
    queryFn: () => getForgeLandFn({ data: { height: height! } }),
    enabled: height !== null,
    staleTime: 5 * 60_000,
    retry: 1,
  });
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
  const rejectedBuild = sel !== null ? (land.data?.rejected ?? []).find((r) => r.index === sel) : undefined;
  const rects = useMemo(() => parcelRects(sizes.data?.classes), [sizes.data]);
  const selRect = sel !== null ? (rects[sel] ?? null) : null;
  const noGround = selRect !== null && selRect.cells.size === 0;

  const go = () => {
    const h = Number(input);
    if (Number.isInteger(h) && h >= 0) navigate({ search: { height: h } });
  };
  const pick = (i: number) => navigate({ search: (p) => ({ ...p, selected: i }) });

  const canInscribe = !!wallet && !!districtId && holdsDistrict;
  const feeRate = feeMode === "1" ? 1 : feeMode === "custom" ? Math.max(1, Number(customFee) || 1) : liveRate ?? 1;
  const est = estimateCart(cart, height ?? 0, feeRate);
  const current = queue ? queue.order[queue.step] ?? null : null;
  const startQueue = () => {
    // The inscriber reads this saved choice, so each job is priced at the rate reviewed here.
    try { localStorage.setItem("bitmapwin:inscribe-fee", JSON.stringify({ mode: feeMode, custom: String(feeRate) })); } catch { /* ignore */ }
    setMulti(false);
    setQueue({ order: [...cart], step: 0, done: [], confirmed: false });
  };
  const advance = (q: CartQueue, done: number[]) => setQueue({ ...q, done, step: q.step + 1, confirmed: false });
  const markDone = (i: number) => setQueue((q) => (q ? { ...q, done: [...q.done, i], step: q.step + 1, confirmed: false } : q));
  const skipCurrent = () => queue && advance(queue, queue.done);
  const stopQueue = () => queue && setQueue({ ...queue, step: queue.order.length, confirmed: false });

  const side = layout ? Math.max(layout.width, layout.height) : 1;
  const offY = layout ? (side - layout.height) / 2 : 0;
  const show = hover ?? sel;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="bg-card/60 backdrop-blur mb-4 rounded-lg border border-border p-4">
        <p className="label text-signal">PARCEL STUDIO</p>
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
            <section className="bg-card/60 backdrop-blur rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="label">PARCEL MAP</span>
                <div className="flex gap-1">
                  {(["all", "open", "valid"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFilter(f)}
                      className={`label rounded border px-2 py-0.5 ${filter === f ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>
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
                    const cls = i === sel ? "fill-primary" : cart.includes(i) ? "fill-primary/50" : st === "valid" ? "fill-signal" : "fill-muted-foreground/25";
                    return (
                      <rect key={i} x={p.position.x + 0.06} y={p.position.y + offY + 0.06} width={Math.max(0.1, p.size - 0.12)} height={Math.max(0.1, p.size - 0.12)}
                        className={`${cls} cursor-pointer transition-opacity hover:opacity-70`} opacity={dim ? 0.15 : 1}
                        onMouseEnter={() => setHover(i)} onClick={() => {
                          if (multi && canInscribe && queue === null && st === "open") setCart((c) => toggleCart(c, i));
                          pick(i);
                        }} />
                    );
                  })}
                </svg>
              )}
              <div className="mt-2 flex flex-wrap gap-3 label text-muted-foreground">
                <span><i className="mr-1 inline-block h-2 w-2 bg-signal" />INSCRIBED</span>
                <span><i className="mr-1 inline-block h-2 w-2 bg-muted-foreground/25" />OPEN</span>
                <span><i className="mr-1 inline-block h-2 w-2 bg-primary" />SELECTED</span>
                {show !== null && <span className="ml-auto text-foreground">#{show} · {stateOf(show) === "valid" ? "INSCRIBED" : "OPEN"}</span>}
              </div>
            </section>

            <aside className="bg-card/60 backdrop-blur space-y-3 rounded-lg border border-border p-4">
              <p className="label">PARCEL INSPECTOR</p>
              {sel === null ? (
                <p className="text-sm text-muted-foreground">Tap a tile on the map to inspect that parcel.</p>
              ) : (
                <>
                  <p className="display text-xl" data-no-translate>{parcelName(sel, height)}</p>
                  <Row k="TRANSACTION" v={`#${sel} of ${txCount?.toLocaleString("en-US")}`} />
                  <Row k="STATUS" v={selInfo?.state === "valid" ? "INSCRIBED · VALID" : selInfo?.state === "dup" ? "ONLY LATE COPIES — STILL OPEN" : "OPEN"} />
                  {selRect && (
                    <Row k="GROUND" v={noGround ? "NONE — DENSE BLOCK" : `${selRect.cells.size} SQUARE${selRect.cells.size === 1 ? "" : "S"}`} />
                  )}
                  {noGround && (
                    <div className="rounded-md border border-destructive/60 bg-destructive/10 p-3">
                      <p className="label text-destructive">NO GROUND — DENSE BLOCK</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        This block packs so many transactions that every square of ground near this parcel's exact
                        position is owned by a neighbouring parcel. Each square belongs to exactly one holder, and
                        parcels are never moved away from their true block position — so this parcel owns no buildable
                        ground in the world.
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The parcel deed itself is untouched and still proves its place in the block; it simply has no
                        land to build on here.
                      </p>
                    </div>
                  )}
                  {selInfo?.state === "valid" && (
                    <>
                      <Row k="HOLDER" v={selInfo.owner ? shortenAddress(selInfo.owner) : "—"} />
                      <a className="label block text-signal hover:underline" href={`https://ordinals.com/inscription/${selInfo.id}`} target="_blank" rel="noreferrer">VIEW PROOF ON ORDINALS ↗</a>
                      <Link to="/forge" search={{ height } as never} className="btn-term block w-full px-3 py-2 text-center">BUILD ON THIS PARCEL IN LAND FORGE</Link>
                      {rejectedBuild && (
                        <div className="rounded-md border border-destructive/60 bg-destructive/10 p-3">
                          <p className="label text-destructive">BUILD NOT SHOWN — COORDINATES MISMATCH</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            The newest build inscribed on this parcel claims tile{" "}
                            <span className="text-foreground" data-no-translate>
                              {rejectedBuild.claimed[0]},{rejectedBuild.claimed[1]} → {rejectedBuild.claimed[2]},{rejectedBuild.claimed[3]}
                            </span>
                            , but the block's transaction layout gives this parcel the verified tile{" "}
                            <span className="text-foreground" data-no-translate>
                              {rejectedBuild.derived[0]},{rejectedBuild.derived[1]} → {rejectedBuild.derived[2]},{rejectedBuild.derived[3]}
                            </span>
                            . Tile bounds come from the block itself, so this build will not appear in the world.
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Re-inscribe the build with the verified tile coordinates to fix it.
                          </p>
                          <a
                            className="label mt-1 block text-signal hover:underline"
                            href={`https://ordinals.com/inscription/${rejectedBuild.inscriptionId}`}
                            target="_blank"
                            rel="noreferrer"
                            data-no-translate
                          >
                            VIEW REJECTED BUILD ↗
                          </a>
                        </div>
                      )}
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
                      <button type="button" disabled={queue !== null} onClick={() => setCart((c) => toggleCart(c, sel))} className="btn-term block w-full px-3 py-2 text-center disabled:opacity-40">
                        {cart.includes(sel) ? "REMOVE FROM CART" : cart.length >= PARCEL_CART_MAX ? `CART FULL (${PARCEL_CART_MAX})` : "ADD TO CART"}
                      </button>
                    )
                  )}
                </>
              )}

              {canInscribe && (
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <p className="label">PARCEL CART · {cart.length}/{PARCEL_CART_MAX}</p>
                    <button type="button" onClick={() => setMulti((m) => !m)} disabled={queue !== null}
                      className={`label rounded border px-2 py-0.5 ${multi ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                      {multi ? "MULTI-SELECT ON" : "MULTI-SELECT"}
                    </button>
                  </div>
                  {multi && queue === null && <p className="label text-muted-foreground">TAP OPEN TILES TO ADD OR REMOVE THEM.</p>}
                  {cart.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No parcels yet. Add open tiles to inscribe several in a row.</p>
                  ) : (
                    <>
                      <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                        {cart.map((i, n) => {
                          const done = queue?.done.includes(i);
                          const now = queue && queue.order[queue.step] === i;
                          return (
                            <button key={i} type="button" disabled={queue !== null} onClick={() => setCart((c) => c.filter((x) => x !== i))}
                              className={`label rounded border px-2 py-0.5 ${done ? "border-signal text-signal" : now ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 text-primary"}`}
                              title={queue ? undefined : "Remove"}>
                              {n + 1}. #{i}{done ? " ✓" : queue ? "" : " ×"}
                            </button>
                          );
                        })}
                      </div>

                      {queue === null && (
                        <>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="label text-muted-foreground">FEE</span>
                            {(["1", "live", "custom"] as const).map((m) => (
                              <button key={m} type="button" onClick={() => setFeeMode(m)}
                                className={`label rounded border px-2 py-0.5 ${feeMode === m ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>
                                {m === "1" ? "1 SAT/VB" : m === "live" ? `LIVE${liveRate ? ` ${liveRate}` : ""}` : "CUSTOM"}
                              </button>
                            ))}
                            {feeMode === "custom" && (
                              <input value={customFee} onChange={(e) => setCustomFee(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="Custom fee rate in sats per vbyte"
                                className="h-6 w-14 rounded border border-border bg-background px-1 font-mono text-xs" />
                            )}
                          </div>
                          <Row k="FEE RATE" v={`${feeRate} sat/vB`} />
                          <Row k="EST. SIZE" v={`~${est.vbytes.toLocaleString("en-US")} vB`} />
                          <Row k="EST. MINER FEES" v={`~${est.feeSats.toLocaleString("en-US")} sats`} />
                          <Row k="POSTAGE (STAYS ON YOUR PARCELS)" v={`${est.postageSats.toLocaleString("en-US")} sats`} />
                          <Row k="SITE FEE (ONCE PER CREATION)" v={`${est.siteFeeSats.toLocaleString("en-US")} sats`} />
                          <Row k="EST. TOTAL" v={`~${est.totalSats.toLocaleString("en-US")} sats`} />
                          <p className="text-xs text-muted-foreground">
                            Estimate only — each inscription shows its exact price before you pay. {cart.length} separate wallet payments and {cart.length} parent signatures. Someone else may claim a tile first; late copies never count.
                          </p>
                          <label className="flex items-start gap-2 text-xs">
                            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
                            <span>I reviewed these {cart.length} parcels and the estimated ~{est.totalSats.toLocaleString("en-US")} sats.</span>
                          </label>
                          <div className="flex gap-2">
                            <button type="button" disabled={!agreed} onClick={startQueue} className="btn-term flex-1 px-3 py-2 disabled:opacity-40">START INSCRIBING</button>
                            <button type="button" onClick={() => { setCart([]); setAgreed(false); }} className="label rounded border border-border px-3 text-muted-foreground">CLEAR</button>
                          </div>
                        </>
                      )}

                      {queue !== null && current !== null && (
                        <div className="space-y-2 rounded border border-primary/50 p-2">
                          <p className="label text-primary">INSCRIPTION {queue.step + 1} OF {queue.order.length}</p>
                          <p className="display text-lg" data-no-translate>{parcelName(current, height)}</p>
                          <Row k="EST. COST" v={`~${estimateCart([current], height, feeRate, queue.done.length === 0).totalSats.toLocaleString("en-US")} sats`} />
                          {queue.done.length === 0 && <p className="label text-primary">INCLUDES THE ONE-TIME 546-SAT SITE FEE — LATER PARCELS IN THIS RUN SKIP IT</p>}
                          {!queue.confirmed ? (
                            <>
                              <p className="text-xs text-muted-foreground">Nothing is signed until you confirm. Your wallet will then ask for the payment and the parent signature.</p>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setQueue({ ...queue, confirmed: true })} className="btn-term flex-1 px-3 py-2">CONFIRM &amp; SIGN #{current}</button>
                                <button type="button" onClick={skipCurrent} className="label rounded border border-border px-3 text-muted-foreground">SKIP</button>
                              </div>
                            </>
                          ) : (
                            <ShadowInscriber
                              key={`${height}-${current}`}
                              slug={`parcel-${height}-${current}`}
                              height={height}
                              index={current}
                              digest={parcelName(current, height)}
                              artifactLabel={`INSCRIBE ${parcelName(current, height).toUpperCase()}`}
                              actionLabel="INSCRIBE PARCEL ON BITCOIN"
                              description={`A tiny text inscription "${parcelName(current, height)}" created as a child of ${height}.bitmap. If nobody inscribed this index first, it becomes the valid parcel.`}
                              allowUpload={false}
                              claimParentsForHeight={height}
                              parentBitmapInscriptionId={districtId!}
                              artifactVariants={[{ key: "claim", label: "PARCEL CLAIM", contentType: "text/plain;charset=utf-8", source: parcelName(current, height), ...(queue.done.length === 0 ? { tribute: { address: DONATION_ADDRESS, sats: PARCEL_SITE_FEE } } : {}) }]}
                              onRevealed={() => markDone(current)}
                            />
                          )}
                          <button type="button" onClick={stopQueue} className="label text-muted-foreground hover:text-primary">STOP AFTER THIS ONE</button>
                        </div>
                      )}

                      {queue !== null && current === null && (
                        <div className="space-y-2">
                          <p className="label text-signal">DONE · {queue.done.length} OF {queue.order.length} SENT TO BITCOIN</p>
                          <p className="text-xs text-muted-foreground">They show as inscribed once confirmed and rescanned.</p>
                          <button type="button" onClick={() => { setCart(cart.filter((i) => !queue.done.includes(i))); setQueue(null); setAgreed(false); void scan.refetch(); }} className="btn-term w-full px-3 py-2">CLOSE</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
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
    <div className="bg-card/60 backdrop-blur rounded border border-border px-3 py-2">
      <p className="label text-muted-foreground">{k}</p>
      <p className={`font-mono text-sm ${cyan ? "text-signal" : orange ? "text-primary" : ""}`} data-no-translate>{v}</p>
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
