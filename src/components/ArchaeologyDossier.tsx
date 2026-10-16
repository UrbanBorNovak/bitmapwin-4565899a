import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { claimLag, inscriptionEra, milestoneAt, nearbyMilestones } from "@/lib/archaeology-dossier";
import { officialTrait, traitsOf } from "@/lib/traits";

type Note = { id: string; trait_id: string; thesis: string; evidence_url: string; contributor_name: string; inscription_id: string };

/** Era + milestone dossier for one BITMAP. Chain facts and community notes stay visibly separate. */
export function ArchaeologyDossier({ height, genesisHeight }: { height: number; genesisHeight: number | null | undefined }) {
  const era = inscriptionEra(genesisHeight);
  const milestone = milestoneAt(height);
  const { prev, next } = nearbyMilestones(height);
  const lag = claimLag(height, genesisHeight);
  const traits = traitsOf(height);

  const notes = useQuery({
    queryKey: ["archaeology-notes-height", height],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bitmap_archaeology_nominations")
        .select("id, trait_id, thesis, evidence_url, contributor_name, inscription_id")
        .eq("bitmap_height", height)
        .eq("status", "accepted")
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Note[];
    },
    staleTime: 60_000,
  });

  return (
    <section className="border border-border bg-card" aria-label="Archaeology dossier">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="label">ARCHAEOLOGY DOSSIER</h2>
        <Link to="/archaeology" className="label text-bitcoin hover:text-foreground">FIELD MANUAL →</Link>
      </header>

      <div className="grid gap-px bg-border sm:grid-cols-3">
        <div className="bg-card p-4">
          <p className="label text-signal">CHAIN VERIFIED · INSCRIPTION ERA</p>
          <p className="display mt-2 text-xl text-bitcoin">{era ? era.label : genesisHeight === undefined ? "…" : "UNKNOWN"}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {era ? `CLAIM INSCRIBED IN BLOCK ${Number(genesisHeight).toLocaleString("en-US")} · ERA ${era.range}` : "NO VALID CLAIM BLOCK ON RECORD"}
          </p>
        </div>
        <div className="bg-card p-4">
          <p className="label">LAND AGE AT CLAIM</p>
          <p className="display mt-2 text-xl" data-no-translate>{lag !== null ? lag.toLocaleString("en-US") : "—"}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">BLOCKS BETWEEN THIS BLOCK AND ITS .BITMAP CLAIM</p>
        </div>
        <div className="bg-card p-4">
          <p className="label">BETWEEN MILESTONES</p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed">
            {prev ? <>AFTER <Link to="/bitmap/$block" params={{ block: String(prev.height) }} className="text-bitcoin hover:underline">{prev.title}</Link> (+{(height - prev.height).toLocaleString("en-US")})</> : "BEFORE ALL MILESTONES"}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed">
            {next ? <>BEFORE <Link to="/bitmap/$block" params={{ block: String(next.height) }} className="text-bitcoin hover:underline">{next.title}</Link> (−{(next.height - height).toLocaleString("en-US")})</> : "AFTER ALL MILESTONES"}
          </p>
        </div>
      </div>

      {milestone && (
        <div className="border-t border-bitcoin/60 bg-background p-4">
          <p className="label text-bitcoin">HISTORIC BLOCK · {milestone.title}</p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">{milestone.note}</p>
        </div>
      )}

      {traits.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          {traits.map((t) => (
            <Link key={t.id} to="/traits/$trait" params={{ trait: t.id }} className="label border border-border px-2 py-1 hover:border-bitcoin hover:text-bitcoin">{t.label}</Link>
          ))}
        </div>
      )}

      <div className="border-t border-border p-4">
        <p className="label text-bitcoin">COMMUNITY FIELD NOTES</p>
        {notes.data && notes.data.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {notes.data.map((n) => (
              <li key={n.id} className="border border-border p-3">
                <p className="label">{officialTrait(n.trait_id)?.label ?? n.trait_id} · RECORDED BY {n.contributor_name}</p>
                <p className="mt-2 break-words font-mono text-xs leading-relaxed text-muted-foreground">{n.thesis}</p>
                <a href={n.evidence_url} target="_blank" rel="noreferrer" className="label mt-2 inline-flex hover:text-bitcoin">EVIDENCE <ExternalLink className="ml-1 size-3" /></a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {notes.isLoading ? "> READING FIELD RECORD…" : "> NO ACCEPTED FIELD NOTES FOR THIS BITMAP YET."}
            {traits[0] && !notes.isLoading && (
              <> <Link to="/traits/$trait" params={{ trait: traits[0].id }} className="text-bitcoin hover:underline">NOMINATE IT →</Link></>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
