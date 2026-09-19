import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { inscriptionChildrenQuery, parcelName, parcelsQuery } from "@/lib/parcels";
import { shortId } from "@/lib/chain";
import { InscriptionContent } from "@/components/InscriptionContent";
import { shortenAddress } from "@/lib/registry";

/** Rendered children of a single parcel inscription (grandchildren of the district). */
function ParcelChildren({ inscriptionId, label }: { inscriptionId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const children = useQuery({ ...inscriptionChildrenQuery(open ? inscriptionId : null) });

  return (
    <div className="border-t border-border px-2 py-1.5">
      <button
        type="button"
        className="label text-muted-foreground hover:text-primary"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "[ HIDE CHILDREN ]" : "[ SHOW CHILDREN ]"}
      </button>
      {open && (
        <div className="mt-2">
          {children.isPending && <p className="label text-muted-foreground">SCANNING CHILDREN…</p>}
          {children.isError && <p className="label text-muted-foreground">CHILD SCAN UNAVAILABLE</p>}
          {children.data && children.data.length === 0 && (
            <p className="label text-muted-foreground">NO CHILD INSCRIPTION UNDER {label}</p>
          )}
          {children.data && children.data.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {children.data.map((c) => (
                <div key={c.inscriptionId} className="rounded border border-border">
                  <InscriptionContent
                    inscriptionId={c.inscriptionId}
                    contentType={c.contentType}
                    interactive
                    className="aspect-square w-full border-b border-border"
                    title={`Child of ${label}`}
                  />
                  <div className="flex items-baseline justify-between gap-2 px-2 py-1">
                    <span className="display truncate text-[11px]">{shortId(c.inscriptionId)}</span>
                    <a
                      className="label shrink-0 text-muted-foreground hover:text-primary"
                      href={`https://ordinals.com/inscription/${c.inscriptionId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {(c.contentType ?? "UNKNOWN").split(";")[0]!.toUpperCase()} ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



/**
 * Parcel Theory panel for a district bitmap: the transactions of the block are
 * parcels of the district. They only become individual when inscribed as the
 * first valid child named `{tx-index}.{block-height}.bitmap`.
 */
export function ParcelPanel({
  height,
  districtInscriptionId,
  txCount,
}: {
  height: number;
  districtInscriptionId: string | null;
  txCount: number | null;
}) {
  const scan = useQuery(parcelsQuery(height, districtInscriptionId));
  const [showAll, setShowAll] = useState(false);
  const [showAllChildren, setShowAllChildren] = useState(false);

  const max = scan.data?.maxParcels ?? txCount;
  const valid = (scan.data?.parcels ?? []).filter((p) => p.valid);
  const superseded = (scan.data?.parcels ?? []).length - valid.length;
  const shown = showAll ? valid : valid.slice(0, 24);

  const holders = useMemo(() => {
    const byAddress = new Map<string, number>();
    for (const parcel of valid) {
      if (!parcel.ownerAddress) continue;
      byAddress.set(parcel.ownerAddress, (byAddress.get(parcel.ownerAddress) ?? 0) + 1);
    }
    return [...byAddress.entries()]
      .map(([address, count]) => ({
        address,
        count,
        share: valid.length > 0 ? (count / valid.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.address.localeCompare(b.address));
  }, [valid]);

  const resolvedParcels = holders.reduce((sum, holder) => sum + holder.count, 0);
  const largestShare = holders[0]?.share ?? 0;

  const children = scan.data?.children ?? [];
  const shownChildren = showAllChildren ? children : children.slice(0, 12);
  const parcelIndexById = new Map(
    children.filter((c) => c.parcelIndex !== null).map((c) => [c.inscriptionId, c.parcelIndex!]),
  );

  return (
    <section className="mt-8 rounded-lg border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-6 py-3">
        <span className="label">PARCELS — DISTRICT {height}.BITMAP</span>
        <span className="label">
          {max !== null ? `MAX ${max.toLocaleString("en-US")}` : "MAX —"} ·{" "}
          {scan.isPending && districtInscriptionId
            ? "SCANNING CHILDREN…"
            : `${valid.length.toLocaleString("en-US")} INSCRIBED`}
        </span>
      </header>

      <div className="space-y-4 px-6 py-5">
        <p className="max-w-[80ch] font-mono text-xs text-muted-foreground">
          &gt; TRANSACTIONS OF THIS BLOCK ARE PARCELS OF THE DISTRICT. BY DEFAULT THEY STAY PART OF IT — INSCRIBING A
          PARCEL DETACHES IT AND RENDERS IT INDIVIDUAL. A VALID PARCEL IS THE FIRST CHILD INSCRIPTION OF THIS DISTRICT
          NAMED{" "}
          <span className="text-primary">
            {"{TX-INDEX}"}.{height}.BITMAP
          </span>{" "}
          — E.G. {parcelName(0, height).toUpperCase()} FOR TRANSACTION 0.
        </p>

        {valid.length > 0 && (
          <div className="border border-border bg-surface" aria-label="Parcel holder register">
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h3 className="display text-lg text-bitcoin">BITMAP STAKEHOLDERS</h3>
                <p className="label mt-1 text-muted-foreground">LIVE PARCEL HOLDER REGISTER</p>
              </div>
              <span className="label text-signal">ON-CHAIN VERIFIED</span>
            </header>

            <dl className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-4">
              <HolderStat k="HOLDERS" v={holders.length.toLocaleString("en-US")} />
              <HolderStat k="PARCELS HELD" v={`${resolvedParcels}/${valid.length}`} />
              <HolderStat k="TOP SHARE" v={`${largestShare.toFixed(1)}%`} />
              <HolderStat
                k="DISTRIBUTION"
                v={holders.length <= 1 ? "SOLE HOLDER" : largestShare >= 50 ? "CONCENTRATED" : "DISTRIBUTED"}
              />
            </dl>

            {holders.length > 0 ? (
              <ol className="divide-y divide-border">
                {holders.map((holder, index) => (
                  <li key={holder.address} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                    <span className="display text-center text-lg text-bitcoin" aria-label={`Rank ${index + 1}`}>
                      {index < 3 ? ["Ⅰ", "Ⅱ", "Ⅲ"][index] : String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <Link
                          to="/profile/$address"
                          params={{ address: holder.address }}
                          className="font-mono text-xs text-foreground hover:text-bitcoin"
                          data-no-translate
                        >
                          {shortenAddress(holder.address)}
                        </Link>
                        <span className="label text-muted-foreground">
                          {holder.share >= 50 ? "ANCHOR HOLDER" : holder.share >= 20 ? "MAJOR HOLDER" : "PARCEL HOLDER"}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full bg-border" aria-hidden="true">
                        <div className="h-full bg-bitcoin" style={{ width: `${Math.max(2, holder.share)}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <strong className="display block text-xl text-bitcoin">{holder.share.toFixed(1)}%</strong>
                      <span className="label text-muted-foreground">
                        {holder.count} {holder.count === 1 ? "PARCEL" : "PARCELS"}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-4 font-mono text-xs text-muted-foreground">
                &gt; PARCELS FOUND — CURRENT HOLDERS ARE STILL RESOLVING
              </p>
            )}

            <p className="border-t border-border px-4 py-3 font-mono text-[10px] text-muted-foreground">
              PARCEL SHARE = EACH ADDRESS&apos; SHARE OF VALID INSCRIBED PARCELS. IT RECOGNIZES STAKE IN THE DISTRICT&apos;S
              PARCEL LAYER; IT DOES NOT TRANSFER OWNERSHIP OF THE PARENT BITMAP.
            </p>
          </div>
        )}

        {!districtInscriptionId && (
          <p className="font-mono text-xs text-muted-foreground">
            &gt; DISTRICT IS UNCLAIMED — NO PARENT INSCRIPTION, SO NO PARCEL CAN MAINTAIN PROVENANCE YET
            <span className="blink">_</span>
          </p>
        )}

        {scan.isError && (
          <p className="font-mono text-xs text-muted-foreground">&gt; PARCEL SCAN UNAVAILABLE RIGHT NOW</p>
        )}

        {districtInscriptionId && !scan.isPending && valid.length === 0 && !scan.isError && (
          <p className="font-mono text-xs text-muted-foreground">
            &gt; NO PARCEL DETACHED FROM THIS DISTRICT YET<span className="blink">_</span>
          </p>
        )}

        {shown.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <div key={p.inscriptionId} className="rounded border border-border">
                <a
                  href={`https://ordinals.com/inscription/${p.inscriptionId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-2 hover:text-primary"
                >
                  <InscriptionContent
                    inscriptionId={p.inscriptionId}
                    className="h-14 w-14 shrink-0 border border-border"
                    title={parcelName(p.index, height)}
                  />
                  <span className="min-w-0">
                    <span className="display block truncate text-sm">
                      {parcelName(p.index, height).toUpperCase()}
                    </span>
                    <span className="label block text-muted-foreground">
                      #{p.inscriptionNumber.toLocaleString("en-US")} · {shortId(p.inscriptionId)}
                    </span>
                  </span>
                </a>
                <ParcelChildren
                  inscriptionId={p.inscriptionId}
                  label={parcelName(p.index, height).toUpperCase()}
                />
              </div>
            ))}

          </div>
        )}


        {valid.length > 24 && (
          <button className="btn-term-ghost" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "[ SHOW LESS ]" : `[ SHOW ALL ${valid.length.toLocaleString("en-US")} PARCELS ]`}
          </button>
        )}

        {(superseded > 0 || scan.data?.truncated) && (
          <p className="label text-muted-foreground">
            {superseded > 0 ? `${superseded} LATER DUPLICATE CLAIM(S) INVALID` : ""}
            {superseded > 0 && scan.data?.truncated ? " · " : ""}
            {scan.data?.truncated ? `SCANNED FIRST ${scan.data.childrenScanned} CHILD INSCRIPTIONS` : ""}
          </p>
        )}

        {children.length > 0 && (
          <div className="space-y-3 border-t border-border pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="label">CHILD INSCRIPTIONS — RENDERED ON CHAIN</span>
              <span className="label text-muted-foreground">
                {children.length.toLocaleString("en-US")} FOUND
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shownChildren.map((c) => (
                <div key={c.inscriptionId} className="rounded border border-border">
                  <InscriptionContent
                    inscriptionId={c.inscriptionId}
                    contentType={c.contentType}
                    interactive
                    className="aspect-square w-full border-b border-border"
                    title={`Child inscription ${c.inscriptionId}`}
                  />
                  <div className="flex items-baseline justify-between gap-2 px-2 py-1.5">
                    <span className="display truncate text-xs">
                      {parcelIndexById.has(c.inscriptionId)
                        ? parcelName(parcelIndexById.get(c.inscriptionId)!, height).toUpperCase()
                        : shortId(c.inscriptionId)}
                    </span>
                    <a
                      className="label shrink-0 text-muted-foreground hover:text-primary"
                      href={`https://ordinals.com/inscription/${c.inscriptionId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {(c.contentType ?? "UNKNOWN").split(";")[0]!.toUpperCase()} ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
            {children.length > 12 && (
              <button className="btn-term-ghost" onClick={() => setShowAllChildren((v) => !v)}>
                {showAllChildren
                  ? "[ SHOW LESS ]"
                  : `[ SHOW ALL ${children.length.toLocaleString("en-US")} CHILDREN ]`}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function HolderStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-3 py-3">
      <dt className="label text-muted-foreground">{k}</dt>
      <dd className="display mt-1 text-base text-foreground" data-no-translate>{v}</dd>
    </div>
  );
}
