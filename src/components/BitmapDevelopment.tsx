import { useMemo, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parcelsQuery } from "@/lib/parcels";
import { shortId } from "@/lib/chain";
import { InscriptionContent } from "@/components/InscriptionContent";

/**
 * DEVELOPMENT — how a district actually grew. Every line is real: child
 * inscriptions and valid parcel claims come from the chain (ord recursive
 * endpoints), builds come from the structures players raised on this bitmap.
 * The children are also shown as what they are — a collection that belongs to
 * this district.
 */

type Series = { label: string; color: string; points: Array<{ t: number; v: number }> };

const buildsQuery = (height: number) =>
  queryOptions({
    queryKey: ["bitmap-build-timeline", height],
    staleTime: 60_000,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from("world_structures")
        .select("created_at")
        .eq("bitmap_height", height)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map((row) => new Date(row.created_at as string).getTime())
        .filter((t) => Number.isFinite(t));
    },
  });

function cumulative(times: number[], label: string, color: string): Series {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    label,
    color,
    points: sorted.map((t, i) => ({ t, v: i + 1 })),
  };
}

function DevelopmentChart({ series }: { series: Series[] }) {
  const w = 720;
  const h = 200;
  const pad = 8;

  const all = series.flatMap((s) => s.points);
  if (all.length === 0) {
    return (
      <p className="font-mono text-[11px] text-muted-foreground">
        &gt; NOTHING HAS BEEN INSCRIBED OR BUILT ON THIS DISTRICT YET — THE TIMELINE IS EMPTY
      </p>
    );
  }
  const minT = Math.min(...all.map((p) => p.t));
  const maxT = Math.max(...all.map((p) => p.t));
  const maxV = Math.max(...all.map((p) => p.v), 1);
  const spanT = Math.max(1, maxT - minT);

  const x = (t: number) => pad + ((t - minT) / spanT) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / maxV) * (h - pad * 2);

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[200px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="District development timeline"
      >
        {series.map((s) =>
          s.points.length === 0 ? null : (
            <path
              key={s.label}
              d={[
                `M${x(s.points[0]!.t).toFixed(1)},${y(0).toFixed(1)}`,
                ...s.points.map((p) => `L${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`),
              ].join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
            />
          ),
        )}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4" style={{ background: s.color }} />
            {s.label} {s.points.length}
          </span>
        ))}
        <span className="ml-auto">
          {new Date(minT).toISOString().slice(0, 10)} → {new Date(maxT).toISOString().slice(0, 10)}
        </span>
      </div>
    </div>
  );
}

export function BitmapDevelopment({
  height,
  districtInscriptionId,
}: {
  height: number;
  districtInscriptionId: string | null;
}) {
  const scan = useQuery(parcelsQuery(height, districtInscriptionId));
  const builds = useQuery(buildsQuery());
  const [showAll, setShowAll] = useState(false);

  const children = scan.data?.children ?? [];
  const parcels = scan.data?.parcels ?? [];

  const series = useMemo<Series[]>(() => {
    const childTimes = children
      .map((c) => (c.timestamp ? c.timestamp * 1000 : null))
      .filter((t): t is number => t !== null);
    const parcelTimes = parcels
      .filter((p) => p.valid)
      .map((p) => (p.timestamp ? p.timestamp * 1000 : null))
      .filter((t): t is number => t !== null);
    const out: Series[] = [];
    if (childTimes.length > 0) out.push(cumulative(childTimes, "CHILD INSCRIPTIONS", "oklch(0.82 0.098 213)"));
    if (parcelTimes.length > 0) out.push(cumulative(parcelTimes, "VALID PARCELS", "oklch(0.72 0.169 55)"));
    const buildTimes = (builds.data ?? [])
      .filter((entry) => entry.page.bitmapHeight === height && entry.page.updatedAt)
      .map((entry) => new Date(entry.page.updatedAt as string).getTime())
      .filter(Number.isFinite);
    if (buildTimes.length > 0)
      out.push(cumulative(buildTimes, "BUILDS RAISED", "oklch(0.92 0 0)"));
    return out;
  }, [children, parcels, builds.data]);

  const shown = showAll ? children : children.slice(0, 12);

  return (
    <section className="mt-6 border border-border" aria-label="District development and children collection">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-surface px-4 py-3">
        <h2 className="display text-base">DEVELOPMENT · {height}.BITMAP</h2>
        <span className="label text-muted-foreground">ON-CHAIN CHILDREN · PARCELS · BUILDS</span>
      </header>

      <div className="grid gap-2 p-4 sm:grid-cols-4">
        {[
          { label: "CHILDREN", value: String(children.length) },
          { label: "VALID PARCELS", value: String(parcels.filter((p) => p.valid).length) },
          { label: "MAX PARCELS", value: scan.data?.maxParcels === null || scan.data === undefined ? "—" : String(scan.data.maxParcels) },
          { label: "BUILDS RAISED", value: String((builds.data ?? []).filter((entry) => entry.page.bitmapHeight === height).length) },
        ].map((s) => (
          <div key={s.label} className="border border-border px-3 py-2">
            <p className="label text-muted-foreground">{s.label}</p>
            <p className="display mt-1 text-base">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-4">
        {scan.isPending && !districtInscriptionId ? (
          <p className="label text-muted-foreground">THIS BLOCK CARRIES NO BITMAP CLAIM YET</p>
        ) : scan.isPending ? (
          <p className="label text-muted-foreground">READING THE DISTRICT'S CHILDREN…</p>
        ) : (
          <DevelopmentChart series={series} />
        )}
      </div>

      <div className="border-t border-border px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="label text-muted-foreground">
            CHILDREN COLLECTION · {children.length} PIECE{children.length === 1 ? "" : "S"}
          </p>
          {children.length > 12 && (
            <button type="button" className="label text-bitcoin" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "[ SHOW LESS ]" : `[ SHOW ALL ${children.length} ]`}
            </button>
          )}
        </div>
        {children.length === 0 ? (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            &gt; NO CHILD INSCRIPTION CARRIES THIS DISTRICT YET
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {shown.map((c) => (
              <div key={c.inscriptionId} className="border border-border">
                <InscriptionContent
                  inscriptionId={c.inscriptionId}
                  contentType={c.contentType}
                  className="aspect-square w-full border-b border-border"
                  title={`Child of ${height}.bitmap`}
                />
                <div className="px-2 py-1">
                  <p className="display truncate text-[10px]">
                    {c.parcelIndex !== null ? `${c.parcelIndex}.${height}.BITMAP` : shortId(c.inscriptionId)}
                  </p>
                  <a
                    className="label text-muted-foreground hover:text-primary"
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
    </section>
  );
}
