import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Blocks, Eye, Radio, Users } from "lucide-react";
import { StreamEventRow } from "@/components/StreamEventRow";
import { Button } from "@/components/ui/button";
import { territoryChronicleQuery } from "@/lib/territory-chronicle";

function ChronicleMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 bg-background px-4 py-4">
      <div className="flex items-center gap-2 text-signal">{icon}<span className="label text-[9px]">{label}</span></div>
      <p className="display mt-3 truncate text-2xl md:text-3xl" data-no-translate>{value}</p>
    </div>
  );
}

export function TerritoryChronicle({ height }: { height: number }) {
  const chronicle = useQuery(territoryChronicleQuery(height));
  const data = chronicle.data;

  return (
    <section id="chronicle" className="mt-8 scroll-mt-20 border border-border" aria-labelledby="territory-chronicle-title">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-4 md:px-6">
        <div>
          <p className="label text-bitcoin">04 / PERSISTED WORLD EVIDENCE</p>
          <h2 id="territory-chronicle-title" className="display mt-2 text-2xl md:text-3xl">TERRITORY CHRONICLE</h2>
        </div>
        <Link to="/passport" className="label text-bitcoin hover:text-foreground">OPEN PASSPORT →</Link>
      </header>

      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        <ChronicleMetric icon={<Eye className="size-4" />} label="TOTAL VISITS" value={chronicle.isPending ? "…" : String(data?.totalViews ?? 0)} />
        <ChronicleMetric icon={<Users className="size-4" />} label="UNIQUE VISITORS" value={chronicle.isPending ? "…" : String(data?.uniqueVisitors ?? 0)} />
        <ChronicleMetric icon={<Blocks className="size-4" />} label="BUILDS RECORDED" value={chronicle.isPending ? "…" : String(data?.buildRecords ?? 0)} />
        <ChronicleMetric icon={<Radio className="size-4" />} label="INSTALLS RECORDED" value={chronicle.isPending ? "…" : String(data?.installRecords ?? 0)} />
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="font-mono text-[10px] text-muted-foreground">
          {data?.lastViewedAt ? `LAST ARRIVAL · ${new Date(data.lastViewedAt).toLocaleDateString()}` : "NO ARRIVAL TIMESTAMP RECORDED"}
          {" · "}VISITOR IDENTITIES REMAIN PRIVATE
        </p>
      </div>

      {chronicle.isPending ? (
        <p className="p-5 font-mono text-xs text-muted-foreground">&gt; READING TERRITORY RECORD_</p>
      ) : chronicle.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="font-mono text-xs text-destructive">&gt; CHRONICLE TEMPORARILY UNAVAILABLE_</p>
          <Button type="button" variant="terminalGhost" size="sm" onClick={() => void chronicle.refetch()}>RETRY</Button>
        </div>
      ) : data?.events.length ? (
        <div>
          {data.events.map((event) => <StreamEventRow key={event.id} event={event} />)}
          {data.totalViews > data.events.filter((event) => event.eventType === "visit").length ? (
            <p className="border-t border-border px-4 py-3 font-mono text-[10px] text-muted-foreground">
              &gt; VISITOR TOTALS INCLUDE THE COMPLETE PRIVATE AGGREGATE; ONLY RECENT VERIFIED ARRIVALS APPEAR ABOVE_
            </p>
          ) : null}
        </div>
      ) : (
        <p className="p-5 font-mono text-xs text-muted-foreground">&gt; NO BUILDS OR INSTALLS HAVE BEEN RECORDED HERE YET_</p>
      )}
    </section>
  );
}