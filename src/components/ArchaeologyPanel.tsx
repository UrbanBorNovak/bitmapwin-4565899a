import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Pickaxe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthSession, accountLabel } from "@/lib/auth";
import { archaeologyNominationsQuery } from "@/lib/archaeology";
import { nominateBitmapArchaeologyFn } from "@/lib/archaeology.functions";
import type { OfficialTraitDefinition } from "@/lib/traits";

export function ArchaeologyPanel({ trait }: { trait: OfficialTraitDefinition }) {
  const { user, loading } = useAuthSession();
  const queryClient = useQueryClient();
  const nominations = useQuery(archaeologyNominationsQuery(trait.id));
  const nominate = useServerFn(nominateBitmapArchaeologyFn);
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState("");
  const [thesis, setThesis] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [contributorName, setContributorName] = useState("");
  const submission = useMutation({
    mutationFn: () => nominate({ data: {
      traitId: trait.id,
      bitmapHeight: Number(height),
      thesis,
      evidenceUrl,
      contributorName,
    } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bitmap-archaeology", trait.id] });
      setHeight(""); setThesis(""); setEvidenceUrl(""); setOpen(false);
      toast.success("FIELD NOTE SUBMITTED FOR REVIEW");
    },
    onError: (error: Error) => toast.error(error.message.toUpperCase()),
  });
  const featured = (nominations.data ?? []).filter((item) => item.status === "accepted").slice(0, 3);
  const mine = (nominations.data ?? []).filter((item) => item.status !== "accepted");

  function submit(event: FormEvent) {
    event.preventDefault();
    submission.mutate();
  }

  return (
    <section className="mt-8 border border-border bg-card">
      <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between md:p-6">
        <div>
          <p className="label text-signal">BITMAP ARCHAEOLOGY · FIELD RECORD</p>
          <h2 className="display mt-2 text-2xl">THREE DISCOVERIES FROM THE CHAIN</h2>
          <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
            Verified block and inscription facts sit apart from attributed community interpretation. Archaeological significance never implies market value.
          </p>
        </div>
        {!loading && (user ? (
          <Button type="button" variant="terminalGhost" onClick={() => setOpen((value) => !value)}><Pickaxe /> NOMINATE A BITMAP</Button>
        ) : (
          <Button asChild variant="terminalGhost"><Link to="/auth" search={{ next: `/traits/${trait.id}` }}>SIGN IN TO NOMINATE</Link></Button>
        ))}
      </header>

      {featured.length ? (
        <div className="grid md:grid-cols-3">
          {featured.map((item, index) => (
            <article key={item.id} className="border-b border-border p-5 md:border-b-0 md:[&:not(:first-child)]:border-l">
              <div className="flex items-center justify-between gap-2">
                <span className="label text-signal">CHAIN VERIFIED</span>
                <span className="label text-muted-foreground">FIELD {String(index + 1).padStart(2, "0")}</span>
              </div>
              <Link to="/bitmap/$block" params={{ block: String(item.bitmapHeight) }} className="display mt-3 block text-xl hover:text-bitcoin">{item.bitmapHeight}.BITMAP</Link>
              <p className="label mt-4 text-bitcoin">COMMUNITY FIELD NOTE</p>
              <p className="mt-2 break-words font-mono text-xs leading-relaxed text-muted-foreground">{item.thesis}</p>
              <p className="label mt-4">RECORDED BY {item.contributorName}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="label hover:text-bitcoin">EVIDENCE <ExternalLink className="ml-1 inline size-3" /></a>
                <a href={`https://ordinals.com/inscription/${item.inscriptionId}`} target="_blank" rel="noreferrer" className="label hover:text-bitcoin">INSCRIPTION <ExternalLink className="ml-1 inline size-3" /></a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="p-6 md:p-8">
          <p className="display text-lg">NO ACCEPTED FIELD RECORDS YET</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">&gt; NOMINATE THE FIRST EVIDENCE-BACKED {trait.label} BITMAP.</p>
        </div>
      )}

      {user && open && (
        <form onSubmit={submit} className="grid gap-4 border-t border-border p-5 md:grid-cols-2 md:p-6">
          <label className="label">BITMAP HEIGHT<input required inputMode="numeric" value={height} onChange={(event) => setHeight(event.target.value.replace(/\D/g, ""))} className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-xs text-foreground" placeholder="156700" /></label>
          <label className="label">YOUR DISPLAY NAME<input required minLength={2} maxLength={40} value={contributorName} onChange={(event) => setContributorName(event.target.value)} className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-xs text-foreground" placeholder={accountLabel(user)} /></label>
          <label className="label md:col-span-2">COMMUNITY FIELD NOTE<textarea required minLength={30} maxLength={1200} value={thesis} onChange={(event) => setThesis(event.target.value)} className="mt-2 min-h-28 w-full resize-y border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground" placeholder="Describe why this BITMAP belongs in the archaeological record. Separate interpretation from what the evidence proves." /></label>
          <label className="label md:col-span-2">EVIDENCE URL<input required type="url" pattern="https://.*" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} className="mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-xs text-foreground" placeholder="https://…" /></label>
          <div className="md:col-span-2"><Button type="submit" variant="terminal" disabled={submission.isPending}>{submission.isPending ? "SUBMITTING…" : "SUBMIT FOR REVIEW"}</Button></div>
        </form>
      )}

      {user && mine.length > 0 && (
        <div className="border-t border-border p-5 md:p-6">
          <p className="label">YOUR SUBMISSIONS</p>
          <div className="mt-3 space-y-2">
            {mine.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border border-border px-3 py-2"><span className="font-mono text-xs">{item.bitmapHeight}.BITMAP</span><span className={item.status === "pending" ? "label text-bitcoin" : "label text-destructive"}>{item.status === "pending" ? "UNDER REVIEW" : "REJECTED"}</span>{item.reviewNote && <p className="w-full font-mono text-[10px] text-muted-foreground">{item.reviewNote}</p>}</div>)}
          </div>
        </div>
      )}
    </section>
  );
}