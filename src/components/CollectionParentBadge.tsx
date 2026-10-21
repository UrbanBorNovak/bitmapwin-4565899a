import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_PARENT_ID, MASTER_PARENT_NUMBER, MASTER_DELEGATE_NUMBER, provenChildren } from "@/lib/collection-parent";

type Line = { what: string; status: "PROVEN" | "PLANNED"; note: string };
const LINES: Line[] = [
  { what: "GUARDIANS", status: "PROVEN", note: "Summoned Guardians are inscribed with this parent; children are listed on Bitcoin." },
  { what: "VOXEL BUILDS", status: "PROVEN", note: "" },
  { what: "MARAUDER RELICS", status: "PLANNED", note: "No relic is inscribed yet. Planned parents: this collection + <height>.bitmap." },
];

/** Shows only parentage Bitcoin can prove right now; everything else is labelled planned. */
export function CollectionParentBadge({ highlight }: { highlight?: string }) {
  const q = useQuery({ queryKey: ["collection-parent", MASTER_PARENT_ID], queryFn: () => provenChildren(), staleTime: 300_000 });
  const n = q.data?.length;
  // Builds count as members only when their inscription id is a live child of the master.
  const builds = useQuery({
    queryKey: ["collection-parent-builds", n], enabled: !!q.data,
    queryFn: async () => {
      const { data } = await supabase.from("bitmap_forge_builds").select("inscription_id");
      const ids = (data ?? []).map((r) => r.inscription_id);
      const kids = new Set(q.data ?? []);
      return { total: ids.length, members: ids.filter((i) => kids.has(i)).length };
    },
  });
  const buildNote = builds.data
    ? `${builds.data.members} of ${builds.data.total} verified builds are on-chain children of this parent; each build's own <height>.bitmap parent is checked when it is verified. A mint can still go out without the collection parent if it is unavailable — those are not counted.`
    : "Checking which verified builds are children of this parent…";
  return (
    <div className="rounded-md border border-border bg-card p-3 font-mono text-[11px]">
      <p className="text-primary">COLLECTION PARENT · #{MASTER_PARENT_NUMBER.toLocaleString()}</p>
      <a href={`https://ordinals.com/inscription/${MASTER_PARENT_ID}`} target="_blank" rel="noreferrer" className="break-all text-muted-foreground hover:text-accent">{MASTER_PARENT_ID}</a>
      <p className="mt-1 text-accent">{q.isLoading ? "CHECKING BITCOIN…" : n == null ? "COULD NOT CHECK BITCOIN RIGHT NOW" : `✓ ${n} CHILDREN PROVEN ON-CHAIN`}</p>
      <ul className="mt-2 space-y-1">
        {LINES.map((l) => (
          <li key={l.what} className={highlight === l.what ? "text-foreground" : "text-muted-foreground"}>
            <span className={l.status === "PROVEN" ? "text-accent" : "text-primary"}>[{l.status}]</span> {l.what} — {l.what === "VOXEL BUILDS" ? buildNote : l.note}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-muted-foreground">#{MASTER_DELEGATE_NUMBER.toLocaleString()} is the Guardian viewer (delegate), not a parent. Marketplace grouping is not verified — each marketplace decides for itself.</p>
    </div>
  );
}
