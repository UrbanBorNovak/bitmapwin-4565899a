import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Box, Boxes, ExternalLink, Eye, Hammer, Search, Users, X } from "lucide-react";
import { BlockMosaic } from "@/components/BlockMosaic";
import { BuilderName } from "@/components/BuilderName";
import { ClubBadge } from "@/components/ClubBadge";
import { PublicBuildViewer } from "@/components/builds/PublicBuildViewer";
import { WorldsDirectory } from "@/components/worlds/WorldsDirectory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BUILD_KIND_LABELS } from "@/lib/build-sdk";
import { buildsQuery, forgeDirectoryQuery, type BuildEntry, type ForgeDirEntry } from "@/lib/builds";
import { inscriptionImageUrl, profilesQuery } from "@/lib/profiles";

export const Route = createFileRoute("/builds")({
  head: () => ({
    meta: [
      { title: "Community Builds — On-Chain Voxels & Live 3D BITMAP Worlds" },
      { name: "description", content: "Browse inscribed Land Forge voxel builds and live 3D Extenders on BITMAP land, inspect them in 3D, and enter them in the Oasis." },
      { property: "og:title", content: "Community Builds — On-Chain Voxels & Live 3D BITMAP Worlds" },
      { property: "og:description", content: "Inscribed voxel builds and live 3D experiences built on Bitcoin land." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityBuildsPage,
});

type TypeFilter = "all" | "forge" | "extender" | "worlds";
type SortMode = "newest" | "visited" | "voxels";
const PAGE_SIZE = 24;

type Item = {
  key: string;
  height: number;
  kind: "forge" | "extender";
  title: string;
  at: number;
  views: number;
  visitors: number;
  voxels: number;
  forge: ForgeDirEntry | null;
  build: BuildEntry | null;
};

const ts = (v: string | null | undefined) => { const n = v ? Date.parse(v) : 0; return Number.isFinite(n) ? n : 0; };

function CommunityBuildsPage() {
  const builds = useQuery(buildsQuery());
  const forge = useQuery(forgeDirectoryQuery());
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<Item | null>(null);

  const addresses = useMemo(() => Array.from(new Set((builds.data ?? []).map((e) => e.page.ownerAddress).filter(Boolean))), [builds.data]);
  const profiles = useQuery({ ...profilesQuery(addresses), enabled: addresses.length > 0 });

  const items = useMemo<Item[]>(() => {
    const byHeight = new Map((builds.data ?? []).map((b) => [b.page.bitmapHeight, b] as const));
    const out: Item[] = (forge.data ?? []).map((f) => {
      const b = byHeight.get(f.height) ?? null;
      return { key: `f-${f.height}`, height: f.height, kind: "forge", title: b?.page.title || `${f.height}.BITMAP`, at: ts(f.verifiedAt), views: b?.totalViews ?? 0, visitors: b?.uniqueVisitors ?? 0, voxels: f.blocks, forge: f, build: b };
    });
    for (const b of builds.data ?? []) {
      out.push({ key: `e-${b.page.bitmapHeight}`, height: b.page.bitmapHeight, kind: "extender", title: b.page.title || `${b.page.bitmapHeight}.BITMAP`, at: ts(b.page.updatedAt), views: b.totalViews, visitors: b.uniqueVisitors, voxels: 0, forge: null, build: b });
    }
    return out;
  }, [builds.data, forge.data]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items
      .filter((i) => type === "all" || i.kind === type)
      .filter((i) => {
        if (!term) return true;
        const owner = i.build?.page.ownerAddress ?? "";
        const name = owner ? profiles.data?.get(owner)?.displayName ?? "" : "";
        return [i.height, i.title, owner, name, i.forge?.archetype ?? "", ...(i.build?.extenderNames ?? [])].some((v) => String(v).toLowerCase().includes(term));
      })
      .sort((a, b) => sort === "visited" ? b.views - a.views : sort === "voxels" ? b.voxels - a.voxels : b.at - a.at || b.height - a.height);
  }, [items, type, query, sort, profiles.data]);

  useEffect(() => setVisible(PAGE_SIZE), [type, query, sort]);

  const worldHeights = useMemo(() => Array.from(new Set(items.map((i) => i.height))), [items]);
  const forgeCount = forge.data?.length ?? 0;
  const voxels = (forge.data ?? []).reduce((s, f) => s + f.blocks, 0);
  const extCount = builds.data?.length ?? 0;
  const visits = (builds.data ?? []).reduce((s, b) => s + b.totalViews, 0);
  const pending = builds.isPending || forge.isPending;

  return (
    <main className="mx-auto max-w-[1600px] px-3 py-6 sm:px-5 md:py-10">
      <header className="border border-border bg-card/60 backdrop-blur-md p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="label text-bitcoin">DISCOVER · BUILT ON BITCOIN LAND</div>
            <h1 className="display mt-2 text-4xl sm:text-5xl">COMMUNITY BUILDS</h1>
            <p className="mt-2 max-w-xl font-mono text-xs leading-6 text-muted-foreground">INSCRIBED VOXEL STRUCTURES AND LIVE 3D EXPERIENCES. INSPECT ANY BUILD, THEN WALK INTO ITS BITMAP.</p>
          </div>
          <Button asChild size="lg" className="h-12">
            <Link to="/forge"><Hammer /> LAUNCH LAND FORGE</Link>
          </Button>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          <Metric label="ON-CHAIN BUILDS" value={forgeCount} tone="signal" />
          <Metric label="INSCRIBED VOXELS" value={voxels} tone="signal" />
          <Metric label="3D EXTENDERS" value={extCount} tone="bitcoin" />
          <Metric label="VISITS" value={visits} tone="bitcoin" />
        </dl>
      </header>

      <div className="sticky top-16 z-20 mt-4 border border-border bg-background/90 p-2 backdrop-blur-md">
        <div className="grid gap-2 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="flex gap-1" role="tablist" aria-label="Build type">
            {([["all", "ALL"], ["forge", "ON-CHAIN FORGE"], ["extender", "3D EXTENDERS"], ["worlds", "INSCRIBED WORLDS"]] as const).map(([v, l]) => (
              <Button key={v} type="button" size="sm" role="tab" aria-selected={type === v} variant={type === v ? "default" : "ghost"} onClick={() => setType(v)}>{l}</Button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="SEARCH BITMAP, TITLE, EXTENDER OR BUILDER" aria-label="Search builds" className="h-9 w-full border border-input bg-card pl-10 pr-10 font-mono text-xs text-foreground outline-none focus:border-bitcoin" />
            {query ? <Button type="button" size="icon" variant="ghost" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-0 top-0 h-9"><X /></Button> : null}
          </div>
          <div className="flex gap-1">
            {([["newest", "NEWEST"], ["visited", "MOST VISITED"], ["voxels", "VOXELS"]] as const).map(([v, l]) => (
              <Button key={v} type="button" size="sm" variant={sort === v ? "secondary" : "ghost"} onClick={() => setSort(v)}>{l}</Button>
            ))}
          </div>
        </div>
      </div>

      {type === "worlds" ? (
        <WorldsDirectory heights={worldHeights} />
      ) : <>
      <div className="mt-4 flex items-center justify-between">
        <span className="label text-muted-foreground">{filtered.length.toLocaleString("en-US")} BUILDS</span>
      </div>

      {filtered.length ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.slice(0, visible).map((item) => (
              <BuildCard key={item.key} item={item} profile={item.build?.page.ownerAddress ? profiles.data?.get(item.build.page.ownerAddress) ?? null : null} onOpen={() => setOpen(item)} />
            ))}
          </div>
          {visible < filtered.length ? (
            <div className="mt-6 flex justify-center">
              <Button type="button" variant="outline" onClick={() => setVisible((c) => c + PAGE_SIZE)}>LOAD MORE</Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-3 grid min-h-48 place-items-center border border-dashed border-border px-5 text-center">
          <p className="label text-muted-foreground">{pending ? "READING BUILDS FROM CHAIN…" : "NO BUILDS MATCH THESE FILTERS"}</p>
        </div>
      )}
      </>}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
          {open ? <Inspector item={open} /> : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "signal" | "bitcoin" }) {
  return (
    <div className="bg-card p-3">
      <dt className="label text-muted-foreground">{label}</dt>
      <dd className={`display mt-1 text-xl sm:text-2xl ${tone === "signal" ? "text-signal" : "text-bitcoin"}`}>{value.toLocaleString("en-US")}</dd>
    </div>
  );
}

function Thumb({ item }: { item: Item }) {
  const banner = item.build?.page.bannerInscriptionId;
  if (banner) return <img src={inscriptionImageUrl(banner)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />;
  return <div className="h-full [&>div]:h-full [&_svg]:h-full [&_svg]:w-full"><BlockMosaic height={item.height} /></div>;
}

function BuildCard({ item, profile, onOpen }: { item: Item; profile: NonNullable<Parameters<typeof BuilderName>[0]["profile"]> | null; onOpen: () => void }) {
  const owner = item.build?.page.ownerAddress;
  const isForge = item.kind === "forge";
  return (
    <article className="group overflow-hidden border border-border bg-card/70 backdrop-blur transition-colors hover:border-signal">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Inspect ${item.height}.BITMAP`}>
        <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-background">
          <Thumb item={item} />
          <span className={`label absolute left-2 top-2 border bg-background/90 px-2 py-1 ${isForge ? "border-signal text-signal" : "border-bitcoin text-bitcoin"}`}>
            {isForge ? `ON-CHAIN · ${item.voxels.toLocaleString("en-US")} VOXELS` : item.build?.hasActiveExtender ? "LIVE 3D EXTENDER" : BUILD_KIND_LABELS[item.build!.page.buildKind]}
          </span>
          <span className="label absolute bottom-2 right-2 flex items-center gap-1 border border-border bg-background/90 px-2 py-1"><Eye className="size-3" /> {item.views.toLocaleString("en-US")}</span>
        </div>
        <div className="p-3">
          <h3 className="display truncate text-base">{item.title}</h3>
          <p className="label mt-1 truncate text-muted-foreground">
            {item.height}.BITMAP{isForge && item.forge?.archetype ? ` · ${item.forge.archetype.toUpperCase()}` : item.build?.extenderNames[0] ? ` · ${item.build.extenderNames[0]}` : ""}
          </p>
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <div className="label min-w-0 truncate text-muted-foreground">
          {owner ? <Link to="/profile/$address" params={{ address: owner }} className="hover:text-bitcoin"><BuilderName address={owner} profile={profile} avatar /></Link> : isForge ? "VERIFIED BY BITCOIN" : "PUBLIC DEPLOYMENT"}
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/oasis" search={{ height: item.height }}>ENTER <ArrowUpRight /></Link>
        </Button>
      </div>
    </article>
  );
}

function Inspector({ item }: { item: Item }) {
  const isForge = item.kind === "forge";
  const id = item.forge?.inscriptionId;
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 pr-12">
        <div className="min-w-0">
          <div className={`label ${isForge ? "text-signal" : "text-bitcoin"}`}>{isForge ? "INSCRIBED LAND FORGE BUILD" : "LIVE 3D EXPERIENCE"}</div>
          <DialogTitle className="display mt-1 text-2xl sm:text-3xl">{item.title}</DialogTitle>
          <DialogDescription className="label mt-1 text-muted-foreground">
            {item.height}.BITMAP{isForge ? ` · ${item.voxels.toLocaleString("en-US")} VOXELS` : ""}
          </DialogDescription>
        </div>
        <ClubBadge height={item.height} asLink={false} />
      </div>

      {isForge && id ? (
        <div className="aspect-[16/10] w-full bg-background">
          <iframe src={`https://ordinals.com/preview/${id}`} title={`${item.height}.BITMAP build`} sandbox="allow-scripts" className="h-full w-full border-0" loading="lazy" />
        </div>
      ) : item.build ? (
        <PublicBuildViewer key={item.height} page={item.build.page} />
      ) : null}

      <div className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
        <Stat icon={<Eye />} label="VIEWS" value={item.views.toLocaleString("en-US")} />
        <Stat icon={<Users />} label="VISITORS" value={item.visitors.toLocaleString("en-US")} />
        <Stat icon={<Boxes />} label="VOXELS" value={isForge ? item.voxels.toLocaleString("en-US") : "—"} />
        <Stat icon={<Box />} label="SAT" value={item.forge?.sat ?? "—"} />
      </div>

      {id ? (
        <div className="border-b border-border px-4 py-3">
          <div className="label text-muted-foreground">INSCRIPTION PROOF</div>
          <a href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 break-all font-mono text-xs text-signal hover:underline">{id} <ExternalLink className="size-3 shrink-0" /></a>
        </div>
      ) : null}

      <div className="grid gap-px bg-border sm:grid-cols-3">
        <Button asChild size="lg" className="h-12 rounded-none">
          <Link to="/oasis" search={{ height: item.height }}><ArrowUpRight /> ENTER IN OASIS</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 rounded-none border-0">
          <Link to="/bitmap/$block" params={{ block: String(item.height) }}><Box /> OPEN BITMAP</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 rounded-none border-0">
          <Link to="/forge"><Hammer /> BUILD IN FORGE</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <div className="flex items-center gap-2 text-signal [&_svg]:size-3.5">{icon}<span className="label">{label}</span></div>
      <div className="display mt-1 truncate text-lg">{value}</div>
    </div>
  );
}
