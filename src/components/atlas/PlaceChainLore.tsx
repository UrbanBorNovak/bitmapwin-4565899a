import { ClientOnly, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { BitmapTerritory3D } from "@/components/BitmapTerritory3D";
import { forgeBuildQuery } from "@/lib/forge";
import { getBitmapRegistryEntry } from "@/lib/oci.functions";
import { inscriptionChildrenQuery, parcelName, parcelsQuery, reinscriptionsQuery } from "@/lib/parcels";
import { shortId } from "@/lib/chain";

const ociQuery = (height: number) =>
  queryOptions({ queryKey: ["oci-entry", height], queryFn: () => getBitmapRegistryEntry({ data: { height } }), staleTime: 30 * 60_000, retry: 1 });

const LORE_RE = [
  "the land was written over again, and the old ground learned a new shape",
  "a second hand traced the same sat, and the district kept both memories",
  "the stones were re-cut by a later builder, without erasing the first claim",
];
const LORE_CHILD = [
  "a small house was raised beneath the district's banner",
  "a new piece was born of this land and carries its name",
  "a descendant inscription settled here, bound to the parent forever",
];

const when = (b: number | null) => (b ? `In block ${b.toLocaleString("en-US")}` : "Once");

/** Chain-backed additions to a place: the inscribed voxel build, parcels, and lore lines per reinscription/child. */
export function PlaceChainLore({ height }: { height: number }) {
  const oci = useQuery(ociQuery(height));
  const id = oci.data?.inscriptionId ?? null;
  const build = useQuery(forgeBuildQuery(height));
  const re = useQuery(reinscriptionsQuery(id));
  const kids = useQuery(inscriptionChildrenQuery(id));
  const parcels = useQuery(parcelsQuery(height, id));
  const reList = re.data?.reinscriptions ?? [];
  const kidList = kids.data ?? [];
  const parcelList = (parcels.data as { parcels?: { index: number; inscriptionId: string }[] } | undefined)?.parcels ?? [];
  const lore = [
    ...reList.map((r, i) => ({ id: r.inscriptionId, block: r.inscribedInBlock, kind: "REINSCRIPTION", text: LORE_RE[i % LORE_RE.length] })),
    ...kidList.map((c, i) => ({ id: c.inscriptionId, block: c.inscribedInBlock, kind: "CHILD", text: LORE_CHILD[i % LORE_CHILD.length] })),
  ].sort((a, b) => (a.block ?? 0) - (b.block ?? 0));

  return (
    <div className="mt-9 space-y-6">
      {lore.length > 0 && (
        <div className="space-y-3">
          <p className="label text-bitcoin">CHAPTERS WRITTEN ON-CHAIN</p>
          {lore.map((l) => (
            <p key={l.id} className="text-base leading-7 text-foreground/85">
              {when(l.block)}, {l.text}.{" "}
              <a href={`https://ordinals.com/inscription/${l.id}`} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-signal hover:underline">
                {l.kind} {shortId(l.id)} ↗
              </a>
            </p>
          ))}
        </div>
      )}

      <div className="border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <p className="label text-signal">{build.data ? "INSCRIBED VOXEL BUILD" : "BITMAP LAND"}</p>
          {build.data && <span className="font-mono text-[10px] text-bitcoin">{shortId(build.data.inscriptionId)}</span>}
        </div>
        <div className="mx-auto mt-3 max-w-md">
          <ClientOnly fallback={<div className="aspect-square w-full border border-border" />}>
            <BitmapTerritory3D height={height} />
          </ClientOnly>
        </div>
        {!build.data && !build.isLoading && <p className="mt-2 font-mono text-[10px] text-muted-foreground">NO LAND FORGE BUILD INSCRIBED YET</p>}
      </div>

      <div>
        <p className="label text-signal">PARCELS · {parcelList.length.toLocaleString("en-US")} CLAIMED</p>
        {parcels.isLoading && id && <p className="mt-2 font-mono text-[10px] text-muted-foreground">SCANNING PARCELS…</p>}
        {parcelList.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {parcelList.slice(0, 60).map((p) => (
              <li key={p.inscriptionId}>
                <a href={`https://ordinals.com/inscription/${p.inscriptionId}`} target="_blank" rel="noreferrer" className="block border border-border px-2 py-1 font-mono text-[10px] hover:border-bitcoin">
                  {parcelName(p.index, height)}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          !parcels.isLoading && <p className="mt-2 font-mono text-[10px] text-muted-foreground">NO PARCELS INSCRIBED YET</p>
        )}
        <Link to="/bitmap/$block" params={{ block: String(height) }} className="btn-term-ghost mt-3 inline-block">[ FULL BITMAP RECORD → ]</Link>
      </div>
    </div>
  );
}
