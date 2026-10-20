import { useState } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { BitmapTerritory3D } from "@/components/BitmapTerritory3D";
import { forgeBuildQuery } from "@/lib/forge";
import { getBitmapRegistryEntry } from "@/lib/oci.functions";
import { inscriptionChildrenQuery, parcelName, parcelsQuery, reinscriptionsQuery } from "@/lib/parcels";
import { shortId } from "@/lib/chain";

const ociQuery = (height: number) =>
  queryOptions({ queryKey: ["oci-entry", height], queryFn: () => getBitmapRegistryEntry({ data: { height } }), staleTime: 30 * 60_000, retry: 1 });

const OPEN_RE = ["the land was written over again", "a later hand traced the same sat", "the old ground was re-cut", "a fresh layer was pressed onto the stone", "the district's ink was renewed", "a second voice spoke over the first"];
const OPEN_CHILD = ["a small house rose beneath the banner", "a new piece was born of this land", "a descendant settled at the edge", "a child inscription took root", "a lantern was hung in the parent's name", "a traveller claimed kinship here"];
const MID = ["while the mempool slept", "under a {n}-sat sky", "as {n} lanterns flickered", "in the hour of the {w} wind", "beside the {w} well", "after {n} quiet confirmations"];
const END = ["and the first claim was never erased", "and the ground remembers both", "bound to the parent forever", "leaving a mark only the chain can read", "and the neighbours still tell of it", "so the district grew one story taller"];
const WORDS = ["amber", "cold", "north", "copper", "silent", "orange", "hollow", "salt", "iron", "glass"];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** Deterministic, per-inscription lore line: same id always gives the same text. */
function loreFor(id: string, kind: "RE" | "CHILD", block: number | null) {
  const h = hash(id);
  const pick = <T,>(a: T[], s: number): T => a[(h >>> s) % a.length] as T;
  const mid = pick(MID, 5).replace("{n}", String(((h >>> 9) % 97) + 3)).replace("{w}", pick(WORDS, 13));
  const end = block && block % 2016 < 144 ? "near the turning of a difficulty epoch" : pick(END, 17);
  return `${pick(kind === "RE" ? OPEN_RE : OPEN_CHILD, 1)} ${mid}, ${end}`;
}

const INITIAL = 5;

const when = (b: number | null) => (b ? `In block ${b.toLocaleString("en-US")}` : "Once");

/** Chain-backed additions to a place: the inscribed voxel build, parcels, and lore lines per reinscription/child. */
export function PlaceChainLore({ height }: { height: number }) {
  const [showAll, setShowAll] = useState(false);
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
    ...reList.map((r) => ({ id: r.inscriptionId, block: r.inscribedInBlock, kind: "REINSCRIPTION", text: loreFor(r.inscriptionId, "RE", r.inscribedInBlock) })),
    ...kidList.map((c) => ({ id: c.inscriptionId, block: c.inscribedInBlock, kind: "CHILD", text: loreFor(c.inscriptionId, "CHILD", c.inscribedInBlock) })),
  ].sort((a, b) => (b.block ?? 0) - (a.block ?? 0));
  const shown = showAll ? lore : lore.slice(0, INITIAL);

  return (
    <div className="mt-9 space-y-6">
      {lore.length > 0 && (
        <div className="space-y-3">
          <p className="label text-bitcoin">CHAPTERS WRITTEN ON-CHAIN · {lore.length} · NEWEST FIRST</p>
          {shown.map((l) => (
            <p key={l.id} className="text-base leading-7 text-foreground/85">
              {when(l.block)}, {l.text}.{" "}
              <a href={`https://ordinals.com/inscription/${l.id}`} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-signal hover:underline">
                {l.kind} {shortId(l.id)} ↗
              </a>
            </p>
          ))}
          {lore.length > INITIAL && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="btn-term-ghost">
              {showAll ? "[ SHOW LESS ]" : `[ SHOW ${lore.length - INITIAL} MORE ]`}
            </button>
          )}
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
