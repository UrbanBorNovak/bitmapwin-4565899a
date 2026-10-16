import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LoopNavigator } from "@/components/LoopNavigator";
import { StreamEventRow } from "@/components/StreamEventRow";
import { StreamConstellation } from "@/components/StreamConstellation";
import { provenanceStreamQuery } from "@/lib/provenance-stream";
const FILTERS = ["all", "world", "chain", "account", "build", "stamp"] as const;
const LIMITS = [40, 80, 150, 300] as const;
export const Route = createFileRoute("/stream")({
  head: () => ({ meta: [
    { title: "World Stream — Verified BitmapWin History" },
    { name: "description", content: "A live feed of verified visits, persistent builds, deployments, trades, leases, combat, and stamps across BitmapWin." },
    { property: "og:title", content: "BitmapWin World Stream" },
    { property: "og:description", content: "Watch verifiable history move across the living Bitcoin land world." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: StreamPage,
});
function StreamPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(80);
  const stream = useQuery(provenanceStreamQuery(filter, limit));
  return <main className="mx-auto max-w-[1200px] px-4 py-10 md:px-8 md:py-14"><p className="label text-bitcoin">HISTORY IN MOTION</p><h1 className="display mt-3 text-4xl md:text-6xl">WORLD STREAM</h1><p className="mt-4 max-w-2xl text-sm text-muted-foreground">Real actions, connected to their proof. Watch each event grow onto its BITMAP and link to the wallets that made it.</p><div className="mt-6"><LoopNavigator active="provenance" /></div>
    <div className="mt-8 flex gap-1 overflow-x-auto pb-2" role="tablist">{FILTERS.map((id) => <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={filter === id ? "btn-term shrink-0" : "btn-term-ghost shrink-0"}>[ {id.toUpperCase()} ]</button>)}
      <span className="flex-1" />
      {LIMITS.map((n) => <button key={n} type="button" onClick={() => setLimit(n)} aria-pressed={limit === n} className={limit === n ? "btn-term shrink-0" : "btn-term-ghost shrink-0"}>[ {n} ]</button>)}
      <button type="button" onClick={() => setView("graph")} className={view === "graph" ? "btn-term shrink-0" : "btn-term-ghost shrink-0"}>[ CONSTELLATION ]</button>
      <button type="button" onClick={() => setView("list")} className={view === "list" ? "btn-term shrink-0" : "btn-term-ghost shrink-0"}>[ LIST ]</button></div>
    {stream.isPending ? <p className="mt-3 border border-border p-5 font-mono text-xs text-muted-foreground">&gt; READING WORLD HISTORY…</p>
      : !stream.data?.length ? <p className="mt-3 border border-border p-5 font-mono text-xs text-muted-foreground">&gt; THE STREAM IS QUIET — ENTER THE OASIS AND MAKE HISTORY_</p>
      : view === "graph" ? <div className="mt-3"><StreamConstellation events={stream.data} height={520} /></div>
      : <section className="mt-3 border border-border" aria-live="polite">{stream.data.map((e) => <StreamEventRow key={e.id} event={e}/>)}</section>}
  </main>;
}
