import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Bitcoin, Boxes, Compass, Crown, Globe, Hammer, Search, Shield, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import citadel from "@/assets/bitmap-citadel.jpg.asset.json";
import oasis from "@/assets/oasis-hero.jpg";
import guardians from "@/assets/mint-guardians.jpg";
import { parseOmnibar } from "@/components/home/OmnibarTerminal";
import { recentTradesQuery } from "@/lib/trade-store";
import { chainTipQuery } from "@/lib/block-props";
import { activeBuildersQuery, shortAddr } from "@/lib/forge-builders";

const pillars = [
  { label: "WORLD", name: "The Oasis", to: "/oasis", Icon: Globe },
  { label: "LAND", name: "Your territory", to: "/marketplace", Icon: Compass },
  { label: "EXPERIENCES", name: "Living worlds", to: "/experiences", Icon: Boxes },
  { label: "IDENTITY", name: "Your passport", to: "/passport", Icon: Shield },
  { label: "CREATION", name: "The Forge", to: "/forge", Icon: Hammer },
] as const;

export function RegalHomepage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [invalid, setInvalid] = useState(false);
  const tip = useQuery(chainTipQuery());
  const trades = useQuery({ ...recentTradesQuery(6), refetchInterval: 60_000 });
  const builders = useQuery(activeBuildersQuery);
  const refresh = () => { void tip.refetch(); void trades.refetch(); void builders.refetch(); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = parseOmnibar(search);
    if (!target) { setInvalid(true); return; }
    setInvalid(false);
    if (target.kind === "block") void navigate({ to: "/bitmap/$block", params: { block: String(target.height) } });
    else if (target.kind === "address") void navigate({ to: "/profile/$address", params: { address: target.address } });
    else window.open(`https://ordinals.com/inscription/${target.id}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="regal-home pb-16">
      <section className="regal-hero" aria-labelledby="realm-title">
        <img src={citadel.url} alt="Illustrated voxel citadel with gold-lit gates among mountain peaks" fetchPriority="high" />
        <div className="regal-hero-copy">
          <div className="regal-ornament"><Crown className="size-5" aria-hidden="true" /></div>
          <p className="mt-4 text-xs font-mono uppercase text-regal-gold">Bitcoin-native worlds</p>
          <h1 id="realm-title" className="regal-title mt-4">BitmapWin</h1>
          <p className="regal-title mt-4 text-2xl text-regal-paper">The internet, but with land.</p>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-regal-paper">Enter worlds built on Bitcoin blockspace.<br />Own the land. Shape its future. Leave your mark.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild className="regal-button"><Link to="/oasis"><Globe />Enter the Oasis<ArrowRight /></Link></Button>
            <Button asChild variant="outline" className="regal-button regal-button-outline"><Link to="/marketplace">Discover land<ArrowUpRight /></Link></Button>
          </div>
          <form className="regal-search" onSubmit={submit}>
            <Search className="ml-4 mt-3.5 size-4 shrink-0 text-regal-gold" aria-hidden="true" />
            <input aria-label="Search BITMAP, wallet or inscription" placeholder="Block, wallet address or inscription…" value={search} onChange={(e) => { setSearch(e.target.value); setInvalid(false); }} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-regal-paper outline-none placeholder:text-regal-muted" />
            <Button type="submit" variant="ghost" size="icon" className="m-1 shrink-0 text-regal-gold hover:bg-regal-panel hover:text-regal-paper" aria-label="Search"><ArrowRight /></Button>
          </form>
          {invalid && <p role="alert" className="mt-2 text-sm text-regal-paper">Enter a block number, Bitcoin address or inscription ID.</p>}
          <p className="mt-3 text-[10px] font-mono text-regal-muted">No wallet needed to explore · Ownership verified on Bitcoin</p>
        </div>
        <span className="absolute bottom-3 right-4 text-[9px] font-mono uppercase text-regal-muted">World concept illustration</span>
      </section>

      <nav aria-label="Ecosystem pillars" className="border-y border-regal-line bg-regal-panel">
        <div className="regal-content regal-pillar-grid">
          {pillars.map(({ label, name, to, Icon }) => <Link key={label} to={to} className="group flex min-w-0 items-center justify-center gap-3 border-regal-line px-3 py-5 hover:bg-regal-gold/5">
            <Icon className="size-5 shrink-0 text-regal-gold" strokeWidth={1.4} />
            <div className="min-w-0"><span className="text-[10px] font-mono text-regal-gold">{label}</span><p className="regal-title mt-1 text-sm group-hover:text-regal-gold">{name}</p></div>
          </Link>)}
        </div>
      </nav>

      <section className="regal-content py-10" aria-labelledby="world-news">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="text-[10px] font-mono uppercase text-regal-gold">Beyond the block</p><h2 id="world-news" className="regal-title mt-2 text-3xl">From the realm</h2></div>
          <Link to="/builds" className="flex items-center gap-2 text-xs text-regal-gold hover:text-regal-paper">Community builds<ArrowUpRight className="size-4" /></Link>
        </div>
        <div className="regal-news-layout">
          <Link to="/oasis" className="regal-glass regal-news-card group">
            <img src={oasis} alt="The Oasis voxel landscape" className="regal-news-image" loading="lazy" />
            <div className="p-6"><p className="text-[10px] font-mono uppercase text-regal-gold">◇ World spotlight</p><h3 className="regal-title mt-3 text-3xl">A world worth stepping into.</h3><p className="mt-3 text-sm leading-relaxed text-regal-muted">Explore BITMAP districts, discover community creations and find your place in the Oasis.</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-mono uppercase text-regal-gold">Explore the world<ArrowRight className="size-4" /></span></div>
          </Link>
          <div className="flex flex-col gap-4">
            <Link to="/mint" className="regal-glass regal-news-card flex items-center"><img src={guardians} alt="Voxel Guardian collection artwork" className="regal-small-image" loading="lazy" /><div className="min-w-0 p-4"><p className="text-[10px] font-mono uppercase text-regal-gold">◇ Identity</p><h3 className="regal-title mt-2 text-xl">Meet the Guardians</h3><p className="mt-2 text-xs leading-relaxed text-regal-muted">Block-derived creatures. Inscribed on Bitcoin.</p></div></Link>
            <Link to="/forge" className="regal-glass regal-news-card flex items-center"><img src={citadel.url} alt="Illustrated voxel architecture" className="regal-small-image" loading="lazy" /><div className="min-w-0 p-4"><p className="text-[10px] font-mono uppercase text-regal-gold">◇ Creation</p><h3 className="regal-title mt-2 text-xl">Build your legacy</h3><p className="mt-2 text-xs leading-relaxed text-regal-muted">Compose voxel structures in the Land Forge.</p></div></Link>
            <Link to="/experiences" className="flex flex-1 items-center justify-between gap-4 border-y border-regal-line py-5 text-regal-gold"><div><p className="text-[10px] font-mono uppercase">◇ Experiences</p><h3 className="regal-title mt-2 text-xl">More worlds await</h3></div><ArrowUpRight className="size-5 shrink-0" /></Link>
          </div>
          <aside className="regal-status border-y border-regal-line py-5" aria-labelledby="status-title">
            <div className="flex items-center justify-between"><h3 id="status-title" className="regal-title text-xl">Network & services</h3><Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh service status" title="Refresh status" className="text-regal-gold hover:bg-regal-panel hover:text-regal-paper"><RefreshCw className={`size-3.5 ${tip.isFetching || trades.isFetching || builders.isFetching ? "motion-safe:animate-spin" : ""}`} /></Button></div>
            <div className="regal-status-list mt-4">
              <StatusRow name="Bitcoin" detail={tip.data ? `Block ${tip.data.height.toLocaleString("en-US")}` : "mempool.space chain feed"} pending={tip.isPending} error={tip.isError} />
              <StatusRow name="BITMAP chronicle" detail="Indexed on-chain transfers" pending={trades.isPending} error={trades.isError} />
              <StatusRow name="Builder directory" detail="Published community pieces" pending={builders.isPending} error={builders.isError} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-regal-muted">Feed responses, not player counts or world-server health.</p>
            <Button asChild variant="outline" className="regal-button regal-button-outline mt-5 w-full"><Link to="/labs/l2-bridge">L2 connection hub<ArrowUpRight /></Link></Button>
          </aside>
        </div>
      </section>

      <section className="border-y border-regal-line bg-regal-panel/40 py-9">
        <div className="regal-content regal-feed-grid">
          <div><div className="flex items-center justify-between gap-4"><h2 className="regal-title text-2xl">The chain chronicle</h2><Link to="/history" className="text-xs text-regal-gold hover:text-regal-paper">View history ↗</Link></div><p className="mt-2 text-xs text-regal-muted">Recent indexed Bitcoin transfers · not editorial announcements</p>
            <div className="mt-5 divide-y divide-regal-line">
              {trades.isPending ? <p className="py-4 text-sm text-regal-muted">Reading chain records…</p> : trades.isError ? <p className="py-4 text-sm text-regal-muted">Chain records are temporarily unavailable.</p> : !trades.data?.length ? <p className="py-4 text-sm text-regal-muted">No indexed transfers to display.</p> : trades.data.slice(0, 4).map((trade) => <Link key={`${trade.txid}-${trade.bitmap_height}-${trade.hop}`} to="/bitmap/$block" params={{ block: String(trade.bitmap_height) }} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5"><Bitcoin className="size-4 text-regal-gold" /><div className="min-w-0"><p className="text-sm group-hover:text-regal-gold">{trade.bitmap_height.toLocaleString("en-US")}.bitmap</p><p className="mt-1 text-[10px] font-mono text-regal-muted">{trade.block_height == null ? "Confirmation not indexed" : `Bitcoin block ${trade.block_height.toLocaleString("en-US")}`}</p></div><ArrowUpRight className="size-4 text-regal-gold" /></Link>)}
            </div>
          </div>
          <div><h2 className="regal-title text-2xl">The makers</h2><p className="mt-2 text-xs text-regal-muted">From the public community build directory</p><div className="mt-5 divide-y divide-regal-line">
            {builders.isPending ? <p className="py-4 text-sm text-regal-muted">Reading published pieces…</p> : builders.isError ? <p className="py-4 text-sm text-regal-muted">Builder directory is temporarily unavailable.</p> : !builders.data?.length ? <p className="py-4 text-sm text-regal-muted">No published makers to display.</p> : builders.data.slice(0, 3).map((builder) => <Link key={builder.address} to="/forge" className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5"><Hammer className="size-4 text-regal-gold" /><div className="min-w-0"><p className="truncate text-sm group-hover:text-regal-gold">{builder.latest.name}</p><p className="mt-1 text-[10px] font-mono text-regal-muted">{shortAddr(builder.address)} · {builder.pieces.toLocaleString("en-US")} pieces</p></div><ArrowUpRight className="size-4 text-regal-gold" /></Link>)}
          </div></div>
        </div>
      </section>
      <div className="regal-content flex flex-wrap items-center justify-between gap-4 pt-8 text-xs text-regal-muted"><span className="flex items-center gap-2"><Bitcoin className="size-4 text-regal-gold" />Ownership on Bitcoin. Experiences in BitmapWin.</span><Link to="/ownership" className="text-regal-gold hover:text-regal-paper">Verify your land<ArrowUpRight className="ml-2 inline size-3.5" /></Link></div>
    </div>
  );
}

function StatusRow({ name, detail, pending, error }: { name: string; detail: string; pending: boolean; error: boolean }) {
  return <div className="border-b border-regal-line py-3"><div className="flex items-center justify-between gap-2"><span className="text-sm">{name}</span><span className={`text-[10px] font-mono ${pending || error ? "text-regal-muted" : "text-signal"}`}>◇ {pending ? "CHECKING" : error ? "UNAVAILABLE" : "RESPONDING"}</span></div><p className="mt-1.5 text-[11px] text-regal-muted">{detail}</p></div>;
}