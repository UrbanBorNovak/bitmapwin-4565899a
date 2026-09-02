import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parcelName, parcelsQuery } from "@/lib/parcels";
import { shortId } from "@/lib/chain";
import { InscriptionContent } from "@/components/InscriptionContent";


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

  const max = scan.data?.maxParcels ?? txCount;
  const valid = (scan.data?.parcels ?? []).filter((p) => p.valid);
  const superseded = (scan.data?.parcels ?? []).length - valid.length;
  const shown = showAll ? valid : valid.slice(0, 24);

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
              <a
                key={p.inscriptionId}
                href={`https://ordinals.com/inscription/${p.inscriptionId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded border border-border p-2 hover:border-primary"
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
      </div>
    </section>
  );
}
