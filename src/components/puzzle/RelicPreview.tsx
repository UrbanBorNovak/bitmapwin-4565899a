import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
const RelicBadge3D = lazy(() => import("./RelicBadge3D"));
import { useQuery } from "@tanstack/react-query";
import type { NearMiss } from "@/lib/bitmap-lottery";
import { nearProofFn } from "@/lib/puzzle-record.functions";
import { getForgeBuildFn } from "@/lib/forge.functions";
import { inhabitedQuery } from "@/lib/inhabited.functions";
import { RELIC_MIN_CHARS, qualifiesForRelic, relicDraft, relicSigningBlockers, DEMO_RELIC, draftSigningBlockers } from "@/lib/puzzle-relic";

const ORD = "https://ordinals.com";

/** One relic preview per qualifying near miss this session. Preview only; signing is off. */
export function RelicPreview({ nears }: { nears: NearMiss[] }) {
  const [demo, setDemo] = useState(false);
  const finds = nears.filter((x) => qualifiesForRelic(x.nibbles));
  return (
    <section className="mt-6 rounded border border-bitcoin/50 bg-card/60 p-4 text-xs">
      <p className="label text-bitcoin">NEAR-MISS RELICS · PREVIEW</p>
      <p className="mt-1 text-muted-foreground">Every find with {RELIC_MIN_CHARS}+ matching characters gets a relic preview. It keeps the exact match count and can add a BITMAP, its land build and its inscribed Guardian. Inscribing is switched off for now.</p>
      {finds.length === 0
        ? <p className="mt-3 text-muted-foreground">No qualifying find this session yet.</p>
        : <div className="mt-3 space-y-3">{finds.map((f) => <RelicCard key={f.hash} find={f} />)}</div>}
      <button onClick={() => setDemo((v) => !v)} className="mt-3 rounded border border-accent px-3 py-1 text-accent">{demo ? "[ HIDE DEMO BADGE ]" : "[ SHOW DEMO BADGE ]"}</button>
      {demo && <DemoCard />}
    </section>
  );
}

function RelicCard({ find }: { find: NearMiss }) {
  const [input, setInput] = useState("");
  const height = /^\d{1,7}$/.test(input) ? Number(input) : null;
  const proof = useQuery({
    queryKey: ["near-proof", find.hash],
    queryFn: () => nearProofFn({ data: { hash: find.hash } }),
    refetchInterval: (q) => (q.state.data?.verified ? false : 10_000),
  });
  const build = useQuery({ queryKey: ["forge-build", height], queryFn: () => getForgeBuildFn({ data: { height: height! } }), enabled: height != null, staleTime: 5 * 60_000 });
  const inhabited = useQuery({ ...inhabitedQuery(), enabled: height != null });
  const guardian = height != null ? inhabited.data?.get(height) ?? null : null;
  const p = proof.data ?? { verified: false, nibbles: null, foundAt: null };
  const b = build.data ? { inscriptionId: build.data.inscriptionId, blockCount: build.data.blockCount } : null;
  const draft = relicDraft(find, p, { height, build: b, guardian });
  const blockers = relicSigningBlockers(p, find);

  return (
    <div className="rounded border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="display text-xl text-bitcoin">{draft.match}</p>
        <p className={draft.proof === "server-verified" ? "text-accent" : "text-muted-foreground"}>
          {proof.isLoading ? "CHECKING PROOF…" : draft.proof === "server-verified" ? `PROOF VERIFIED · ${new Date(p.foundAt!).toLocaleString()}` : "PROOF PENDING"}
        </p>
      </div>
      <p className="mt-1 break-all font-mono" data-no-translate><span className="text-bitcoin">{find.hash.slice(0, find.nibbles)}</span><span className="text-muted-foreground">{find.hash.slice(find.nibbles)}</span></p>

      <ClientOnly fallback={<div className="mt-3 h-64 rounded border border-border" />}>
        <Suspense fallback={<div className="mt-3 h-64 rounded border border-border" />}>
          <div className="mt-3"><RelicBadge3D draft={draft} /></div>
        </Suspense>
      </ClientOnly>
      <p className="mt-1 text-[10px] text-muted-foreground">Tilt with your pointer · click to flip.</p>

      <label className="mt-3 flex flex-wrap items-center gap-2">
        <span className="label text-muted-foreground">BITMAP</span>
        <input value={input} onChange={(e) => setInput(e.target.value.trim())} inputMode="numeric" placeholder="block height, e.g. 840000" className="w-48 rounded border border-border bg-background px-2 py-1 text-foreground" />
        {height != null && <span data-no-translate>{height}.bitmap</span>}
      </label>

      {height != null && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-border p-2">
            <p className="label text-muted-foreground">LAND BUILD</p>
            {build.isLoading ? <p>Reading chain…</p> : b
              ? <a href={`${ORD}/inscription/${b.inscriptionId}`} target="_blank" rel="noreferrer" className="text-accent underline">{b.blockCount.toLocaleString("en-US")} blocks · view inscription</a>
              : <p className="text-muted-foreground">No inscribed build on this BITMAP.</p>}
          </div>
          <div className="rounded border border-border p-2">
            <p className="label text-muted-foreground">GUARDIAN</p>
            {inhabited.isLoading ? <p>Reading chain…</p> : guardian
              ? <a href={`${ORD}/inscription/${guardian}`} target="_blank" rel="noreferrer" className="text-accent underline" data-no-translate>{guardian.slice(0, 10)}…</a>
              : <p className="text-muted-foreground">No inscribed Guardian on this BITMAP.</p>}
          </div>
        </div>
      )}

      <details className="mt-2">
        <summary className="label cursor-pointer text-muted-foreground">RELIC DATA</summary>
        <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-[10px]" data-no-translate>{JSON.stringify(draft, null, 2)}</pre>
      </details>

      <button disabled className="mt-3 rounded border border-border px-3 py-1 text-muted-foreground opacity-50">[ INSCRIBE RELIC · DISABLED ]</button>
      <ul className="mt-1 list-disc pl-4 text-[10px] text-muted-foreground">{blockers.map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}

/** Sample badge, kept apart from real finds: never saved, never proof-checked, never signable. */
function DemoCard() {
  return (
    <div className="mt-3 rounded border border-dashed border-accent p-3" data-relic-demo>
      <p className="label text-accent">DEMO · SAMPLE DATA · NOT A REAL FIND</p>
      <p className="mt-1 text-muted-foreground">This badge uses made-up values so you can try it. It is not in your finds and can't be inscribed.</p>
      <ClientOnly fallback={<div className="mt-3 h-64 rounded border border-border" />}>
        <Suspense fallback={<div className="mt-3 h-64 rounded border border-border" />}>
          <div className="mt-3"><RelicBadge3D draft={DEMO_RELIC} /></div>
        </Suspense>
      </ClientOnly>
      <p className="mt-1 text-[10px] text-muted-foreground">Tilt with your pointer · click to flip.</p>
      <ul className="mt-2 list-disc pl-4 text-[10px] text-muted-foreground">{draftSigningBlockers(DEMO_RELIC).map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}
