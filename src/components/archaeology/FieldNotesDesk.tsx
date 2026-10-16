import { useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuthSession, accountLabel } from "@/lib/auth";
import { ALL_OFFICIAL_TRAITS, officialTrait } from "@/lib/traits";
import { nominateBitmapArchaeologyFn } from "@/lib/archaeology.functions";
import { MILESTONES, blockEvidenceUrl, inscriptionEvidenceUrl } from "@/lib/archaeology-dossier";
import { safeExternalUrl } from "@/lib/safe-url";

type Note = { id: string; trait_id: string; bitmap_height: number; inscription_id: string; thesis: string; evidence_url: string; contributor_name: string; created_at: string };

function Ext({ href, label }: { href: string; label: string }) {
  const safe = safeExternalUrl(href);
  if (!safe) return null;
  return <a href={safe} target="_blank" rel="noreferrer" className="label inline-flex items-center hover:text-bitcoin">{label}<ExternalLink className="ml-1 size-3" /></a>;
}

/** Global archive of accepted community field notes, a central nomination desk and the reference record. */
export function FieldNotesDesk() {
  const { user, loading } = useAuthSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [traitFilter, setTraitFilter] = useState("");
  const notes = useQuery({
    queryKey: ["archaeology-notes-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bitmap_archaeology_nominations")
        .select("id, trait_id, bitmap_height, inscription_id, thesis, evidence_url, contributor_name, created_at")
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Note[];
    },
    staleTime: 60_000,
  });
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (notes.data ?? []).filter((n) =>
      (!traitFilter || n.trait_id === traitFilter) &&
      (!s || String(n.bitmap_height) === s || n.contributor_name.toLowerCase().includes(s) || n.thesis.toLowerCase().includes(s)));
  }, [notes.data, search, traitFilter]);

  const nominate = useServerFn(nominateBitmapArchaeologyFn);
  const [form, setForm] = useState({ traitId: ALL_OFFICIAL_TRAITS[0]?.id ?? "", height: "", thesis: "", evidenceUrl: "", name: "" });
  const submit = useMutation({
    mutationFn: () => nominate({ data: { traitId: form.traitId, bitmapHeight: Number(form.height), thesis: form.thesis, evidenceUrl: form.evidenceUrl, contributorName: form.name } }),
    onSuccess: () => {
      toast.success("FIELD NOTE SUBMITTED FOR REVIEW");
      setForm((f) => ({ ...f, height: "", thesis: "", evidenceUrl: "" }));
      void qc.invalidateQueries({ queryKey: ["bitmap-archaeology"] });
    },
    onError: (e: Error) => toast.error(e.message.toUpperCase()),
  });
  const onSubmit = (e: FormEvent) => { e.preventDefault(); submit.mutate(); };
  const input = "mt-2 w-full border border-border bg-background px-3 py-2 font-mono text-xs text-foreground";

  return (
    <section className="mt-12 space-y-10">
      {/* 01 Archive */}
      <div>
        <p className="label text-bitcoin">01 · FIELD NOTES ARCHIVE</p>
        <h2 className="display mt-2 text-xl md:text-2xl">EVERY ACCEPTED COMMUNITY RECORD</h2>
        <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
          Reviewed notes across all official traits. The BITMAP and its inscription are chain facts; the note is the contributor's attributed interpretation.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SEARCH HEIGHT, CONTRIBUTOR OR TEXT" className="min-w-[240px] flex-1 border border-border bg-background px-3 py-2 font-mono text-xs" />
          <select value={traitFilter} onChange={(e) => setTraitFilter(e.target.value)} className="border border-border bg-background px-3 py-2 font-mono text-xs">
            <option value="">ALL TRAITS</option>
            {ALL_OFFICIAL_TRAITS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        {notes.isError ? (
          <p className="mt-4 font-mono text-[11px] text-destructive">ARCHIVE UNAVAILABLE — <button className="underline" onClick={() => void notes.refetch()}>RETRY</button></p>
        ) : filtered.length > 0 ? (
          <ul className="mt-4 grid gap-px border border-border bg-border md:grid-cols-2">
            {filtered.map((n) => (
              <li key={n.id} className="bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link to="/bitmap/$block" params={{ block: String(n.bitmap_height) }} className="display text-lg text-bitcoin hover:underline">{n.bitmap_height}.BITMAP</Link>
                  <Link to="/traits/$trait" params={{ trait: n.trait_id }} className="label hover:text-bitcoin">{officialTrait(n.trait_id)?.label ?? n.trait_id}</Link>
                </div>
                <p className="label mt-3 text-signal">COMMUNITY INTERPRETATION · {n.contributor_name}</p>
                <p className="mt-1 break-words font-mono text-xs leading-relaxed text-muted-foreground">{n.thesis}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Ext href={n.evidence_url} label="EVIDENCE" />
                  <Ext href={inscriptionEvidenceUrl(n.inscription_id)} label="INSCRIPTION" />
                  <Ext href={blockEvidenceUrl(n.bitmap_height)} label="BLOCK" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 border border-dashed border-border p-6">
            <p className="display text-lg">{notes.isLoading ? "READING FIELD RECORD…" : (notes.data?.length ? "NO NOTES MATCH THIS FILTER" : "NO ACCEPTED FIELD NOTES YET")}</p>
            {!notes.isLoading && !notes.data?.length && <p className="mt-2 font-mono text-xs text-muted-foreground">&gt; THE ARCHIVE IS EMPTY. BE THE FIRST TO FILE AN EVIDENCE-BACKED NOTE BELOW.</p>}
          </div>
        )}
      </div>

      {/* 02 Desk */}
      <div className="border border-border bg-card">
        <header className="border-b border-border p-5">
          <p className="label text-bitcoin">02 · NOMINATION DESK</p>
          <h2 className="display mt-2 text-xl">FILE A FIELD NOTE FOR ANY BITMAP</h2>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">The BITMAP must exist in the index. Every note is reviewed; at most three are featured per trait.</p>
        </header>
        {loading ? null : user ? (
          <form onSubmit={onSubmit} className="grid gap-4 p-5 md:grid-cols-3">
            <label className="label">TRAIT
              <select value={form.traitId} onChange={(e) => setForm({ ...form, traitId: e.target.value })} className={input}>
                {ALL_OFFICIAL_TRAITS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="label">BITMAP HEIGHT<input required inputMode="numeric" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value.replace(/\D/g, "") })} className={input} placeholder="57043" /></label>
            <label className="label">DISPLAY NAME<input required minLength={2} maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder={accountLabel(user)} /></label>
            <label className="label md:col-span-3">FIELD NOTE (30–1200 CHARS)<textarea required minLength={30} maxLength={1200} value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} className={`${input} min-h-28`} placeholder="What the evidence proves, then your interpretation — kept clearly apart." /></label>
            <label className="label md:col-span-2">EVIDENCE URL (HTTPS)<input required type="url" pattern="https://.*" value={form.evidenceUrl} onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })} className={input} placeholder="https://mempool.space/block/…" /></label>
            <div className="flex items-end"><Button type="submit" variant="terminal" disabled={submit.isPending} className="w-full">{submit.isPending ? "SUBMITTING…" : "SUBMIT FOR REVIEW"}</Button></div>
          </form>
        ) : (
          <div className="p-5"><Button asChild variant="terminalGhost"><Link to="/auth" search={{ next: "/archaeology?tab=ledger" }}>SIGN IN TO NOMINATE</Link></Button></div>
        )}
      </div>

      {/* 03 Reference record */}
      <div>
        <p className="label text-bitcoin">03 · REFERENCE RECORD</p>
        <h2 className="display mt-2 text-xl md:text-2xl">THE GOLD STANDARD FORMAT</h2>
        <p className="mt-2 max-w-3xl font-mono text-[11px] leading-relaxed text-muted-foreground">
          Each milestone pairs a chain fact (the block, checkable on any explorer) with a sourced historical interpretation. Field notes should follow the same split.
        </p>
        <div className="mt-4 grid gap-px border border-border bg-border md:grid-cols-2 xl:grid-cols-3">
          {MILESTONES.map((m) => (
            <article key={m.height} className="bg-card p-4">
              <p className="label text-signal">CHAIN FACT · BLOCK {m.height.toLocaleString("en-US")}</p>
              <Link to="/bitmap/$block" params={{ block: String(m.height) }} className="display mt-1 block text-base hover:text-bitcoin">{m.title}</Link>
              <p className="label mt-3 text-bitcoin">INTERPRETATION</p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">{m.note}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Ext href={blockEvidenceUrl(m.height)} label="MEMPOOL.SPACE" />
                <Ext href={m.source} label={m.sourceLabel} />
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* 04 Methodology */}
      <div className="grid gap-px border border-border bg-border md:grid-cols-2">
        <div className="bg-card p-5">
          <p className="label text-signal">ACCEPTED EVIDENCE</p>
          <ul className="mt-3 space-y-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <li>› Block, transaction or inscription pages on mempool.space / ordinals.com</li>
            <li>› BIPs, Bitcoin Wiki, archived forum and mailing-list posts</li>
            <li>› Published, citable research (Patoshi analysis, pool attributions)</li>
          </ul>
        </div>
        <div className="bg-card p-5">
          <p className="label text-destructive">REJECTED</p>
          <ul className="mt-3 space-y-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <li>› Price talk or claims that significance implies value</li>
            <li>› Unsourced rumours, screenshots without a source</li>
            <li>› Ownership or identity claims about holders</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
