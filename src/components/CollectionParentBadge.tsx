import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_PARENT_ID, MASTER_PARENT_NUMBER, MASTER_DELEGATE_NUMBER, provenChildren } from "@/lib/collection-parent";

type Line = { what: string; status: "PROVEN" | "PLANNED"; note: string };
const LINES: Line[] = [
  { what: "GUARDIANS", status: "PROVEN", note: "Summoned Guardians are inscribed with this parent; children are listed on Bitcoin." },
  { what: "VOXEL BUILDS", status: "PROVEN", note: "" }, // status shown per live counts below
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
      const { data } = await supabase.from("bitmap_forge_builds").select("inscription_id, bitmap_height").limit(30);
      const rows = data ?? [];
      const kids = new Set(q.data ?? []);
      // BITMAP lineage: a Tag 3 parent whose content is exactly "<height>.bitmap".
      const lineage = await Promise.all(rows.map(async (r) => {
        try {
          const ps = ((await (await fetch(`https://ordinals.com/r/parents/${r.inscription_id}`)).json()) as { ids?: string[] }).ids ?? [];
          for (const pid of ps) if (pid !== MASTER_PARENT_ID && (await (await fetch(`https://ordinals.com/content/${pid}`)).text()).trim() === `${r.bitmap_height}.bitmap`) return true;
        } catch { /* unchecked = not proven */ }
        return false;
      }));
      return { total: rows.length, members: rows.filter((r) => kids.has(r.inscription_id)).length, lineage: lineage.filter(Boolean).length };
    },
  });
  const buildNote = builds.data
    ? `${builds.data.members}/${builds.data.total} listed builds are children of this parent; ${builds.data.lineage}/${builds.data.total} name their own <height>.bitmap as parent. Only these live checks count — a mint can go out without either parent if it was unavailable.`
    : "Checking which verified builds are children of this parent…";
  return (
    <div className="rounded-md border border-border bg-card p-3 font-mono text-[11px]">
      <p className="text-primary">COLLECTION PARENT · #{MASTER_PARENT_NUMBER.toLocaleString("en-US")}</p>
      <a href={`https://ordinals.com/inscription/${MASTER_PARENT_ID}`} target="_blank" rel="noreferrer" className="break-all text-muted-foreground hover:text-accent">{MASTER_PARENT_ID}</a>
      <p className="mt-1 text-accent">{q.isLoading ? "CHECKING BITCOIN…" : n == null ? "COULD NOT CHECK BITCOIN RIGHT NOW" : `✓ ${n} CHILDREN PROVEN ON-CHAIN`}</p>
      <ul className="mt-2 space-y-1">
        {LINES.map((l) => (
          <li key={l.what} className={highlight === l.what ? "text-foreground" : "text-muted-foreground"}>
            {(() => { const st = l.what !== "VOXEL BUILDS" ? l.status : !builds.data ? "CHECKING" : builds.data.total > 0 && builds.data.members === builds.data.total && builds.data.lineage === builds.data.total ? "PROVEN" : builds.data.members || builds.data.lineage ? "PARTLY PROVEN" : "NOT PROVEN"; return <span className={st === "PROVEN" ? "text-accent" : "text-primary"}>[{st}]</span>; })()} {l.what} — {l.what === "VOXEL BUILDS" ? buildNote : l.note}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-muted-foreground">#{MASTER_DELEGATE_NUMBER.toLocaleString("en-US")} is the Guardian viewer (delegate), not a parent. Marketplace grouping is not verified — each marketplace decides for itself.</p>
    </div>
  );
}
