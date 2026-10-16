import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { blockEvidenceUrl, claimLag, inscriptionEra, inscriptionEvidenceUrl, milestoneAt, nearbyMilestones } from "@/lib/archaeology-dossier";
import { officialTrait, traitsOf } from "@/lib/traits";
import { safeExternalUrl } from "@/lib/safe-url";

type Note = { id: string; trait_id: string; thesis: string; evidence_url: string; contributor_name: string; inscription_id: string };

function Evidence({ href, label }: { href: string; label: string }) {
  const safe = safeExternalUrl(href);
  if (!safe) return null;
  return <a href={safe} target="_blank" rel="noreferrer" className="label inline-flex items-center hover:text-bitcoin">{label}<ExternalLink className="ml-1 size-3" /></a>;
}

/** Era + milestone dossier for one BITMAP. Chain facts and community notes stay visibly separate. */
export function ArchaeologyDossier({ height, genesisHeight, inscriptionId }: { height: number; genesisHeight: number | null | undefined; inscriptionId?: string | null }) {
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
          {era && (
            <div className="mt-2 flex flex-wrap gap-3">
              <Evidence href={blockEvidenceUrl(Number(genesisHeight))} label="CLAIM BLOCK" />
              {inscriptionId && <Evidence href={inscriptionEvidenceUrl(inscriptionId)} label="INSCRIPTION" />}
            </div>
          )}
          {era && <p className="mt-2 font-mono text-[9px] text-muted-foreground">ERA NAMES ARE A BITMAPWIN CONVENTION; ONLY THE BLOCK NUMBER IS A CHAIN FACT.</p>}
        </div>
        <div className="bg-card p-4">
          <p className="label text-signal">CHAIN VERIFIED · LAND AGE AT CLAIM</p>
          <p className="display mt-2 text-xl" data-no-translate>{lag !== null ? lag.toLocaleString("en-US") : "—"}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">BLOCKS BETWEEN THIS BLOCK AND ITS .BITMAP CLAIM</p>
          <div className="mt-2"><Evidence href={blockEvidenceUrl(height)} label="THIS BLOCK" /></div>
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
        <div className="grid gap-px border-t border-bitcoin/60 bg-border md:grid-cols-2">
          <div className="bg-background p-4">
            <p className="label text-signal">CHAIN VERIFIED · BLOCK {milestone.height.toLocaleString("en-US")}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">This block exists at this height on Bitcoin mainnet.</p>
            <div className="mt-2"><Evidence href={blockEvidenceUrl(milestone.height)} label="MEMPOOL.SPACE" /></div>
          </div>
          <div className="bg-background p-4">
            <p className="label text-bitcoin">HISTORICAL INTERPRETATION · {milestone.title}</p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">{milestone.note}</p>
            <div className="mt-2"><Evidence href={milestone.source} label={`SOURCE · ${milestone.sourceLabel}`} /></div>
          </div>
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
                <div className="mt-2 flex flex-wrap gap-3"><Evidence href={n.evidence_url} label="COMMUNITY EVIDENCE" /><Evidence href={inscriptionEvidenceUrl(n.inscription_id)} label="INSCRIPTION" /></div>
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
