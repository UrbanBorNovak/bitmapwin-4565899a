import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Activity, Blocks, BoxSelect, Compass, Crosshair, Hammer, KeyRound, LocateFixed, Map as MapIcon, MapPin, Minus, Plus, Radio, Search, Store, Globe2, Swords, Eye, Tag, Flame, Wallet, X } from "lucide-react";
import atlasHd from "@/assets/oasis-atlas-storybook.jpg";
import { AtlasRelief } from "@/components/AtlasRelief";
import { AtlasPlaceLabels } from "@/components/AtlasPlaceLabels";
import { AtlasTerrain, AtlasBeacon } from "@/components/AtlasTerrain";
import { AtlasFineDetail } from "@/components/AtlasFineDetail";
import { AtlasLivedIn } from "@/components/AtlasLivedIn";
import { AtlasFogOfWar } from "@/components/AtlasFogOfWar";

import { AtlasHeatmap } from "@/components/AtlasHeatmap";
import { Button } from "@/components/ui/button";
import { forgeBuildQuery } from "@/lib/forge";
import { getChainBlocks } from "@/lib/chain.functions";
import { worldStatsQuery, formatCount } from "@/lib/world-stats";
import { provenanceStreamQuery } from "@/lib/provenance-stream";
import { timeAgo } from "@/lib/bitmap";
import { atlasEra, atlasScale, atlasToBlock, ATLAS_SIDE, blockToAtlas, parseAtlasBlock } from "@/lib/atlas-geometry";
import { getAtlasClaims, getAtlasLandForAddress, getAtlasParcelization, getAtlasRegionStats, indexAtlasFrontier } from "@/lib/atlas-land.functions";
import { useWalletSession } from "@/lib/wallet-session";
import { colorForAddress } from "@/lib/map-owners";
import type { ProvenanceEvent } from "@/lib/passport";
import { sampleVisibleHeights, type AtlasClaim, type AtlasParcelization } from "@/lib/atlas-land";
import { atlasPlace, atlasDistrictStory, districtAt, districtBlockRange, districtChapter, findAtlasNamedPlace } from "@/lib/atlas-places";
import { landscapeFor, setLandChainTip } from "@/lib/land-biome";
import { useSeenCells } from "@/lib/oasis-discovery";

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const RAIL = [
  { to: "/oasis", label: "THE OASIS", icon: Globe2 }, { to: "/map", label: "MAP", icon: MapIcon },
  { to: "/marketplace", label: "MARKETPLACE", icon: Store }, { to: "/builds", label: "BUILDS", icon: Hammer },
  { to: "/leases", label: "LEASE", icon: KeyRound }, { to: "/extend", label: "EXTENDER", icon: Blocks },
  { to: "/stream", label: "STREAM", icon: Radio },
] as const;

type Place = { height: number; title: string; count: number; landmarks: number; events: ProvenanceEvent[]; x: number; y: number };
type Camera = { zoom: number; x: number; y: number };
type Cluster = { key: string; x: number; y: number; places: Place[] };

/**
 * ATLAS LAYERS — every recorded event belongs to exactly one layer, so the map
 * can be read one kind of history at a time instead of as one pile of pins.
 */
const LAYERS = [
  { key: "builds", label: "BUILDS", icon: Hammer, types: ["build", "deployment"], tone: "text-signal" },
  { key: "visits", label: "VISITS", icon: Eye, types: ["visit"], tone: "text-bitcoin" },
  { key: "duels", label: "DUELS", icon: Swords, types: ["combat"], tone: "text-destructive" },
  { key: "listings", label: "LISTINGS / LEASES", icon: Tag, types: ["trade", "lease", "listing", "offer", "bid"], tone: "text-foreground" },
] as const;
type LayerKey = (typeof LAYERS)[number]["key"];
const ALL_LAYERS: LayerKey[] = LAYERS.map((layer) => layer.key);

/**
 * TIME AS A CONTROL — history can be read as a window, not one flat pile.
 * Events inside the window show; the older half of that window reads as a
 * ghost pin, the freshest hours burn bright.
 */
const WINDOWS = [
  { key: "24h", label: "24H", hours: 24 },
  { key: "7d", label: "7 DAYS", hours: 24 * 7 },
  { key: "year", label: "THIS YEAR", hours: 24 * 365 },
  { key: "all", label: "SINCE GENESIS", hours: Number.POSITIVE_INFINITY },
] as const;
type WindowKey = (typeof WINDOWS)[number]["key"];
const windowHours = (key: WindowKey) => WINDOWS.find((item) => item.key === key)!.hours;

/** 1 = happening now, down to 0.25 for the oldest record still in the window. */
function freshness(events: ProvenanceEvent[], hours: number): number {
  const newest = events.reduce((max, event) => Math.max(max, new Date(event.occurredAt).getTime()), 0);
  if (!newest) return 0.35;
  const span = Number.isFinite(hours) ? hours * 3600_000 : 365 * 24 * 3600_000;
  const age = Math.max(0, Date.now() - newest);
  return Math.max(0.28, 1 - Math.min(1, age / span) * 0.72);
}

function eventLayer(event: ProvenanceEvent): LayerKey | null {
  const found = LAYERS.find((layer) => (layer.types as readonly string[]).includes(event.eventType));
  return found ? found.key : null;
}
const layerSpec = (key: LayerKey) => LAYERS.find((layer) => layer.key === key)!;

/** A build event turns its BITMAP into a landmark: a raised, hammer-marked pin. */
const isLandmark = (event: ProvenanceEvent) => event.eventType === "build";

function placesFrom(events: ProvenanceEvent[]): Place[] {
  const byHeight = new Map<number, Place>();
  for (const event of events) {
    if (event.bitmapHeight === null) continue;
    const found = byHeight.get(event.bitmapHeight);
    if (found) {
      found.count += 1; found.events.push(event);
      if (isLandmark(event)) { found.landmarks += 1; if (found.landmarks === 1) found.title = event.title; }
      continue;
    }
    const point = blockToAtlas(event.bitmapHeight);
    byHeight.set(event.bitmapHeight, { height: event.bitmapHeight, title: event.title, count: 1, landmarks: isLandmark(event) ? 1 : 0, events: [event], x: (point.x + 0.5) / ATLAS_SIDE, y: (point.y + 0.5) / ATLAS_SIDE });
  }
  return [...byHeight.values()].sort((a, b) => b.landmarks - a.landmarks || b.count - a.count);
}

function clusterPlaces(places: Place[], zoom: number): Cluster[] {
  const divisions = zoom < 1.7 ? 8 : zoom < 3.2 ? 18 : zoom < 6 ? 40 : zoom < 9 ? 128 : zoom < 13 ? 320 : 768;
  const groups = new Map<string, Cluster>();
  for (const place of places) {
    const key = `${Math.floor(place.x * divisions)}:${Math.floor(place.y * divisions)}`;
    const group = groups.get(key);
    if (group) { group.places.push(place); group.x = group.places.reduce((sum, item) => sum + item.x, 0) / group.places.length; group.y = group.places.reduce((sum, item) => sum + item.y, 0) / group.places.length; }
    else groups.set(key, { key, x: place.x, y: place.y, places: [place] });
  }
  return [...groups.values()];
}

function BiomeMesh({ tip }: { tip: number }) {
  return <div className="pointer-events-none absolute inset-0 grid grid-cols-8 grid-rows-8 opacity-15 mix-blend-soft-light">{Array.from({ length: 64 }, (_, index) => {
    const x = (index % 8) * 128 + 64; const y = Math.floor(index / 8) * 128 + 64;
    const era = atlasEra(atlasToBlock(x, y), tip);
    const tone = era.key === "frontier" ? "bg-signal/35" : era.key === "genesis" ? "bg-foreground/20" : era.key === "early" ? "bg-signal/15" : era.key === "unmined" ? "bg-background/65" : "bg-bitcoin/10";
    return <span key={index} className={`border border-foreground/5 ${tone}`} />;
  })}</div>;
}

/**
 * REGION CHAPTER · OWNER ANALYTICS — the district the camera is inside, its
 * atlas chapter, and the real spread of ownership across its 16,384 blocks.
 * Every number comes from the indexed inscription registry; nothing is modelled.
 */
function RegionPanel({
  district,
  range,
  stats,
  loading,
  focusHeight,
}: {
  district: ReturnType<typeof districtAt>;
  range: { lo: number; hi: number };
  stats: { indexed: number; valid: number; owners: number; unowned: number; top: Array<{ address: string; held: number }> } | undefined;
  loading: boolean;
  focusHeight: (height: number) => void;
}) {
  const story = atlasDistrictStory(district);
  const owners = stats?.owners ?? 0;
  const indexed = stats?.indexed ?? 0;
  const perOwner = owners > 0 ? indexed / owners : 0;
  const biggest = stats?.top[0];
  const concentration = indexed > 0 && biggest ? (biggest.held / indexed) * 100 : 0;
  return <section className="atlas-panel mt-2 p-3" aria-label="Region chapter and owner analytics">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="min-w-0">
        <p className="label text-signal">{districtChapter(district)} · REGION</p>
        <h2 className="font-mono text-sm font-bold uppercase text-foreground">{district.name}</h2>
        <p className="font-mono text-[9px] uppercase text-muted-foreground">{district.landmark} · {story.atmosphere}</p>
      </div>
      <p className="font-mono text-[9px] text-muted-foreground" data-no-translate>BLOCKS {range.lo.toLocaleString("en-US")} – {range.hi.toLocaleString("en-US")}</p>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{story.story[0]}</p>
    <dl className="mt-3 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
      <div className="bg-background p-2 text-center"><dd className="font-mono text-sm font-bold text-signal tabular-nums">{loading&&!stats?"…":owners.toLocaleString("en-US")}</dd><dt className="label mt-1">OWNER ADDRESSES</dt></div>
      <div className="bg-background p-2 text-center"><dd className="font-mono text-sm font-bold text-bitcoin tabular-nums">{loading&&!stats?"…":indexed.toLocaleString("en-US")}</dd><dt className="label mt-1">BITMAPS INDEXED</dt></div>
      <div className="bg-background p-2 text-center"><dd className="font-mono text-sm font-bold tabular-nums">{perOwner>0?perOwner.toFixed(1):"—"}</dd><dt className="label mt-1">AVG PER OWNER</dt></div>
      <div className="bg-background p-2 text-center"><dd className="font-mono text-sm font-bold tabular-nums">{concentration>0?`${concentration.toFixed(1)}%`:"—"}</dd><dt className="label mt-1">TOP HOLDER SHARE</dt></div>
    </dl>
    {stats&&stats.top.length>0&&<div className="mt-3">
      <p className="label text-bitcoin">BIGGEST HOLDERS IN THIS REGION</p>
      <ul className="mt-1.5 space-y-1">
        {stats.top.map((holder)=>{const share=indexed>0?(holder.held/indexed)*100:0;return <li key={holder.address} className="flex min-w-0 items-center gap-2">
          <Link to="/profile/$address" params={{address:holder.address}} className="min-w-0 flex-1 truncate font-mono text-[9px] text-signal hover:text-bitcoin" data-no-translate>{holder.address}</Link>
          <span aria-hidden className="hidden h-1 w-20 shrink-0 bg-border sm:block"><span className="block h-full bg-bitcoin" style={{width:`${Math.max(4,Math.min(100,share))}%`}}/></span>
          <span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground" data-no-translate>{holder.held.toLocaleString("en-US")} · {share.toFixed(1)}%</span>
        </li>;})}
      </ul>
    </div>}
    <div className="mt-3 flex flex-wrap gap-2">
      <Button asChild variant="terminalGhost" size="sm"><Link to="/map/district/$slug" params={{slug:district.slug}}>READ CHAPTER <ArrowRight/></Link></Button>
      <Button type="button" variant="terminalGhost" size="sm" onClick={()=>focusHeight(district.anchorHeight)}>ANCHOR BLOCK {district.anchorHeight.toLocaleString("en-US")}</Button>
    </div>
  </section>;
}




/** Every claimed parcel on a BITMAP, clickable, revealing the holder behind it. */
function ParcelClaims({ height, parcelization }: { height: number; parcelization: AtlasParcelization }) {
  const [picked, setPicked] = useState<number | null>(null);
  const parcels = parcelization.parcels;
  if (parcels.length === 0) return null;
  const active = parcels.find((parcel) => parcel.index === picked) ?? null;
  return <div className="mt-2 border-t border-signal/30 pt-2">
    <p className="label text-muted-foreground">PARCEL MAP · CLICK A PARCEL FOR ITS HOLDER</p>
    <div className="mt-1.5 flex flex-wrap gap-1">
      {parcels.map((parcel) => {
        const on = parcel.index === picked;
        return <button key={parcel.index} type="button" aria-pressed={on} onClick={() => setPicked(on ? null : parcel.index)} data-no-translate
          className={`border px-1 py-0.5 font-mono text-[9px] tabular-nums transition-colors ${on ? "border-bitcoin bg-bitcoin/20 text-bitcoin" : "border-signal/40 bg-background/70 text-signal hover:border-signal"}`}
          aria-label={`Parcel ${parcel.index} of ${height}.BITMAP`}>#{parcel.index}</button>;
      })}
    </div>
    {active && <div className="mt-2 border border-bitcoin/50 bg-bitcoin/5 p-2">
      <p className="label text-bitcoin" data-no-translate>PARCEL #{active.index}.{height}.BITMAP</p>
      <p className="mt-1 break-all font-mono text-[9px] text-foreground" data-no-translate>HOLDER {active.address ?? "UNKNOWN"}</p>
      <p className="break-all font-mono text-[9px] text-muted-foreground" data-no-translate>{active.inscriptionId}</p>
      {active.address && <Button asChild variant="terminalGhost" size="sm" className="mt-2 w-full"><Link to="/profile/$address" params={{ address: active.address }}>HOLDER PROFILE <ArrowRight /></Link></Button>}
    </div>}
    {parcelization.validParcels > parcels.length && <p className="mt-1 font-mono text-[9px] text-muted-foreground">SHOWING FIRST {parcels.length} OF {parcelization.validParcels} PARCELS</p>}
  </div>;
}

function InspectorForge({ height }: { height: number }) {
  const { data: b } = useQuery(forgeBuildQuery(height));
  if (!b?.inscriptionId) return null;
  return <div className="mt-3 border border-bitcoin/60 bg-bitcoin/10 p-2"><div className="flex items-center gap-2"><Hammer className="size-4 shrink-0 text-bitcoin"/><p className="label text-bitcoin">INSCRIBED BUILD · {b.blockCount} VOXELS</p></div><div className="mt-2 h-44 overflow-hidden border border-border bg-background"><iframe title="Inscribed build" src={`https://ordinals.com/preview/${b.inscriptionId}`} className="h-full w-full" sandbox="allow-scripts" loading="lazy"/></div><a href={`https://ordinals.com/inscription/${b.inscriptionId}`} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-[9px] text-muted-foreground" data-no-translate>{b.inscriptionId}</a></div>;
}

function Inspector({ place, tip, close, dropInto, claim, parcelization }: { place: Place; tip: number; close: () => void; dropInto: (height: number) => void; claim?: AtlasClaim | undefined; parcelization?: AtlasParcelization | undefined }) {
  const point = blockToAtlas(place.height); const era = atlasEra(place.height, tip); const identity = atlasPlace(place.height); const landscape = landscapeFor(place.height);
  return <div className="atlas-panel min-w-0 p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="label text-bitcoin">SELECTED BITMAP</p><h2 className="mt-1 font-mono text-lg font-bold tabular-nums" data-no-translate>{place.height.toLocaleString("en-US")}.BITMAP</h2></div><Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close selected BITMAP"><X /></Button></div>
    <div className="mt-3 border-l-2 border-bitcoin pl-3"><p className="font-mono text-sm font-bold text-foreground">{identity.localName}</p><p className="mt-1 font-mono text-[9px] uppercase text-muted-foreground">{identity.address} · {identity.name}</p></div>
    <dl className="mt-3 grid grid-cols-2 gap-px border border-border bg-border text-[10px]">
      <div className="col-span-2 bg-background p-2"><dt className="label">DISTRICT LANDMARK</dt><dd className="mt-1 font-mono text-bitcoin">{identity.landmark}</dd></div>
      <div className="bg-background p-2"><dt className="label">COORDINATES</dt><dd className="mt-1 font-mono text-signal" data-no-translate>{point.x.toString().padStart(4,"0")} : {point.y.toString().padStart(4,"0")}</dd></div>
      <div className="bg-background p-2"><dt className="label">ERA</dt><dd className="mt-1 font-mono text-bitcoin">{era.label}</dd></div>
      <div className="col-span-2 bg-background p-2"><dt className="label">BIOME</dt><dd className="mt-1 font-mono">{era.biome}</dd></div>
      <div className="col-span-2 bg-background p-2"><dt className="label">LANDSCAPE</dt><dd className="mt-1 font-mono text-bitcoin">{landscape.name}</dd><dd className="mt-1 font-mono text-[9px] text-muted-foreground">{landscape.blurb}</dd></div>
      <div className="col-span-2 bg-background p-2"><dt className="label">LAND PERKS · ACTIVE WHILE YOU STAND HERE</dt><dd className="mt-1 space-y-1">{landscape.perks.map((perk) => (<span key={perk.key} className="block font-mono text-[9px]"><span className="text-signal">{perk.name}</span> <span className="text-muted-foreground">{perk.effect}</span></span>))}</dd></div>
    </dl>
    {claim&&<div className="mt-3 border border-bitcoin/50 bg-bitcoin/5 p-2"><p className="label text-bitcoin">CLAIMED LAND {claim.isValid?"· VALID":"· CONTESTED"}</p><p className="mt-1 truncate font-mono text-[9px] text-muted-foreground" data-no-translate>HOLDER {claim.ownerAddress??"UNKNOWN"}</p><p className="truncate font-mono text-[9px] text-muted-foreground" data-no-translate>{claim.inscriptionId}</p></div>}
    {parcelization&&parcelization.validParcels>0&&<div className="mt-3 border border-signal/60 bg-signal/10 p-2"><div className="flex items-center gap-2"><BoxSelect className="size-4 shrink-0 text-signal"/><p className="label text-signal">PARCELIZED BITMAP</p></div><dl className="mt-2 grid grid-cols-3 gap-px bg-border text-center"><div className="bg-background p-2"><dt className="label text-muted-foreground">PARCELS</dt><dd className="font-mono text-sm text-signal">{parcelization.validParcels}</dd></div><div className="bg-background p-2"><dt className="label text-muted-foreground">HOLDERS</dt><dd className="font-mono text-sm">{parcelization.holders||"—"}</dd></div><div className="bg-background p-2"><dt className="label text-muted-foreground">CAPACITY</dt><dd className="font-mono text-sm">{parcelization.maxParcels??"—"}</dd></div></dl>{parcelization.owners.length>0&&<div className="mt-2 border-t border-signal/30 pt-2"><p className="label text-muted-foreground">CLAIMED PARCELS · WHO OWNS THEM</p><ul className="mt-1 space-y-1">{parcelization.owners.map((owner,index)=>(<li key={owner.address??`unknown-${index}`} className="min-w-0"><div className="flex items-baseline justify-between gap-2"><span className="min-w-0 flex-1 truncate font-mono text-[9px] text-foreground" data-no-translate>{owner.address?`${owner.address.slice(0,8)}…${owner.address.slice(-6)}`:"UNKNOWN HOLDER"}</span><span className="shrink-0 font-mono text-[9px] text-signal">{owner.parcels} PARCEL{owner.parcels===1?"":"S"}</span></div><p className="break-words font-mono text-[9px] text-muted-foreground" data-no-translate>#{owner.indexes.join(" #")}{owner.parcels>owner.indexes.length?" …":""}</p></li>))}</ul></div>}<ParcelClaims height={place.height} parcelization={parcelization}/>{parcelization.truncated&&<p className="mt-2 font-mono text-[9px] text-muted-foreground">PARTIAL CHILD SCAN · MORE PARCELS MAY EXIST</p>}</div>}

    <InspectorForge height={place.height}/>
    {place.landmarks>0&&<div className="mt-3 flex items-center gap-2 border border-signal/60 bg-signal/10 p-2"><Hammer className="size-4 shrink-0 text-signal"/><div className="min-w-0"><p className="label text-signal">LANDMARK · {place.landmarks} BUILD{place.landmarks===1?"":"S"}</p><p className="truncate font-mono text-[9px] text-muted-foreground">{place.events.find((event)=>event.eventType==="build")?.summary||"Built history stands on this land"}</p></div></div>}
    <div className="mt-3 border-t border-border pt-3"><p className="label">VERIFIED HISTORY · {place.count}</p>{place.events.slice(0,3).map((event) => <div key={event.id} className="mt-2"><p className="truncate font-mono text-[10px] uppercase">{event.title}</p><p className="font-mono text-[9px] text-muted-foreground">{timeAgo(event.occurredAt)} · {event.proofLevel}</p></div>)}</div>
    <div className="mt-4 grid grid-cols-2 gap-2"><Button asChild variant="terminal"><Link to="/bitmap/$block" params={{ block: String(place.height) }}>OPEN LAND</Link></Button><Button type="button" variant="terminalGhost" onClick={()=>dropInto(place.height)}>DROP IN 3D</Button><Button asChild variant="terminal" className="col-span-2"><Link to="/map/place/$block" params={{ block: String(place.height) }}>PLACE STORY · {identity.localName} <ArrowRight /></Link></Button><Button asChild variant="terminalGhost" className="col-span-2"><Link to="/map/district/$slug" params={{ slug: identity.slug }}>DISTRICT STORY <ArrowRight /></Link></Button></div>
  </div>;
}

export function AtlasExplorer({ initialHeight }: { initialHeight?: number }) {
  const surfaceRef = useRef<HTMLDivElement | null>(null); const pointers = useRef(new Map<number,{x:number;y:number}>()); const drag = useRef<{x:number;y:number;camera:Camera}|null>(null); const pinch = useRef<{distance:number;centerX:number;centerY:number;camera:Camera}|null>(null); const cameraRef = useRef<Camera>({ zoom: 1, x: 0, y: 0 }); const cameraFrame = useRef<number | null>(null); const pendingCamera = useRef<Camera | null>(null);
  const fetchBlocks = useServerFn(getChainBlocks);
  const chain = useQuery({ queryKey:["chain","tip","atlas"], queryFn:()=>fetchBlocks({data:{pages:3,scan:false}}), staleTime:25_000, refetchInterval:30_000 });
  const stats = useQuery(worldStatsQuery()); const stream = useQuery(provenanceStreamQuery("all",80));
  const [camera,setCameraState]=useState<Camera>({zoom:1,x:0,y:0}); const [selected,setSelected]=useState<Place|null>(null); const [query,setQuery]=useState(initialHeight === undefined ? "" : String(initialHeight)); const [message,setMessage]=useState("");
  const [layers,setLayers]=useState<LayerKey[]>(ALL_LAYERS); const [dropIn,setDropIn]=useState<number|null>(null); const [landOn,setLandOn]=useState(true);
  const [timeWindow,setTimeWindow]=useState<WindowKey>("7d"); const [heatOn,setHeatOn]=useState(false); const [mineOn,setMineOn]=useState(true); const [parcelsOn,setParcelsOn]=useState(true);
  const seenCells=useSeenCells();
  const wallet=useWalletSession(); const ordinals=wallet?.ordinalsAddress??"";
  const fetchMyLand=useServerFn(getAtlasLandForAddress);
  const myLand=useQuery({queryKey:["atlas","my-land",ordinals],queryFn:()=>fetchMyLand({data:{address:ordinals}}),enabled:ordinals!=="",staleTime:120_000});
  const myHeights=useMemo(()=>new Set((myLand.data?.claims??[]).map((claim)=>claim.height)),[myLand.data]);
  const navigate=useNavigate();
  const hours=windowHours(timeWindow);
  const visibleEvents=useMemo(()=>(stream.data??[]).filter((event)=>{ if(Number.isFinite(hours)&&Date.now()-new Date(event.occurredAt).getTime()>hours*3600_000) return false; const key=eventLayer(event);return key===null?layers.length===ALL_LAYERS.length:layers.includes(key);}),[stream.data,layers,hours]);
  const toggleLayer=(key:LayerKey)=>setLayers((current)=>current.includes(key)?current.filter((item)=>item!==key):[...current,key]);
  const places=useMemo(()=>placesFrom(visibleEvents),[visibleEvents]); const clusters=useMemo(()=>clusterPlaces(places,camera.zoom),[places,camera.zoom]); const recentBlocks=Array.isArray(chain.data)?chain.data:[]; const tipHeight=recentBlocks.length?Math.max(...recentBlocks.map((block)=>block.height)):0; const totals=stats.data?.totals;
  // REAL CLAIMED LAND — the indexed inscription and holder behind each sampled
  // block in view, so the atlas shows land even with no recent activity.
  const fetchClaims=useServerFn(getAtlasClaims); const runFrontier=useServerFn(indexAtlasFrontier);
  const viewWindow=useMemo(()=>({zoom:Math.round(camera.zoom*2)/2,x:Math.round(camera.x*40)/40,y:Math.round(camera.y*40)/40}),[camera.zoom,camera.x,camera.y]);
  // The selected BITMAP is always read, even when the sampling grid skips it.
  const sampled=useMemo(()=>{const heights=tipHeight?sampleVisibleHeights(viewWindow,14,ATLAS_SIDE,tipHeight,atlasToBlock):[];if(selected&&!heights.includes(selected.height))heights.push(selected.height);return heights;},[viewWindow,tipHeight,selected]);
  const land=useQuery({queryKey:["atlas","claims",viewWindow.zoom,viewWindow.x,viewWindow.y,tipHeight,selected?.height??-1],queryFn:()=>fetchClaims({data:{heights:sampled}}),enabled:sampled.length>0,staleTime:120_000});
  const claims=useMemo(()=>{const map=new Map<number,AtlasClaim>();for(const claim of land.data?.claims??[])map.set(claim.height,claim);return map;},[land.data]);
  // Selected land first, so opening a BITMAP always scans its parcels.
  const parcelCandidates=useMemo(()=>{const valid=[...claims.values()].filter((claim)=>claim.isValid);const selectedClaim=selected?valid.find((claim)=>claim.height===selected.height):undefined;const ordered=selectedClaim?[selectedClaim,...valid.filter((claim)=>claim.height!==selectedClaim.height)]:valid;return ordered.slice(0,16).map((claim)=>({height:claim.height,inscriptionId:claim.inscriptionId}));},[claims,selected]);
  const fetchParcelization=useServerFn(getAtlasParcelization);
  const parcelLayer=useQuery({queryKey:["atlas","parcelized",parcelCandidates.map((item)=>`${item.height}:${item.inscriptionId}`).join(",")],queryFn:()=>fetchParcelization({data:{claims:parcelCandidates}}),enabled:parcelsOn&&camera.zoom>=4&&parcelCandidates.length>0,staleTime:300_000});
  const parcelized=useMemo(()=>new Map((parcelLayer.data?.parcelized??[]).filter((item)=>item.validParcels>0).map((item)=>[item.height,item])),[parcelLayer.data]);
  // REGION ANALYTICS — the district under the camera, and how many distinct
  // owner addresses actually hold indexed BITMAPs inside it.
  const focusDistrict=useMemo(()=>{const cx=((.5-camera.x)/camera.zoom)*ATLAS_SIDE;const cy=((.5-camera.y)/camera.zoom)*ATLAS_SIDE;return districtAt(cx,cy);},[camera.x,camera.y,camera.zoom]);
  const districtRange=useMemo(()=>districtBlockRange(focusDistrict),[focusDistrict]);
  const fetchRegion=useServerFn(getAtlasRegionStats);
  const region=useQuery({queryKey:["atlas","region",districtRange.lo],queryFn:()=>fetchRegion({data:districtRange}),enabled:camera.zoom>=2.6,staleTime:600_000});
  const districtStats=useMemo(()=>region.data?{[focusDistrict.index]:{indexed:region.data.indexed,owners:region.data.owners}}:{},[region.data,focusDistrict.index]);
  const frontierRun=useRef(0);

  useEffect(()=>{ if(tipHeight) setLandChainTip(tipHeight); },[tipHeight]);
  useEffect(()=>{ if(!tipHeight) return; if(Date.now()-frontierRun.current<60_000) return; frontierRun.current=Date.now();
    runFrontier({data:{chainTip:tipHeight,batch:12}}).then((result)=>{ if(result?.indexed) land.refetch(); }).catch(()=>{}); },[tipHeight,runFrontier,land]);
  const setCamera=useCallback((next:Camera)=>{ const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,next.zoom)); const value={zoom,x:Math.min(0,Math.max(1-zoom,next.x)),y:Math.min(0,Math.max(1-zoom,next.y))}; cameraRef.current=value; pendingCamera.current=value; if(cameraFrame.current!==null)return; cameraFrame.current=requestAnimationFrame(()=>{cameraFrame.current=null;const pending=pendingCamera.current;if(pending){pendingCamera.current=null;setCameraState(pending);}}); },[]);
  useEffect(()=>()=>{if(cameraFrame.current!==null)cancelAnimationFrame(cameraFrame.current);},[]);
  const focusHeight=useCallback((height:number, preferredZoom=6)=>{ const point=blockToAtlas(height); const zoom=Math.max(cameraRef.current.zoom,preferredZoom); setCamera({zoom,x:.5-((point.x+.5)/ATLAS_SIDE)*zoom,y:.5-((point.y+.5)/ATLAS_SIDE)*zoom}); const known=places.find((place)=>place.height===height); setSelected(known??{height,title:`${height}.BITMAP`,count:0,landmarks:0,events:[],x:(point.x+.5)/ATLAS_SIDE,y:(point.y+.5)/ATLAS_SIDE}); setQuery(String(height)); },[places,setCamera]);
  useEffect(()=>{ if(initialHeight!==undefined) focusHeight(initialHeight,6); },[initialHeight,focusHeight]);
  useEffect(()=>{ const el=surfaceRef.current; if(!el)return; const wheel=(event:WheelEvent)=>{ event.preventDefault(); const rect=el.getBoundingClientRect(); const px=(event.clientX-rect.left)/rect.width; const py=(event.clientY-rect.top)/rect.height; const current=cameraRef.current; const dy=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?100:1); const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current.zoom*Math.exp(-dy*.0015))); const ratio=zoom/current.zoom; setCamera({zoom,x:px-(px-current.x)*ratio,y:py-(py-current.y)*ratio}); }; el.addEventListener("wheel",wheel,{passive:false}); return()=>el.removeEventListener("wheel",wheel); },[setCamera]);
  const zoomAtCenter=(factor:number)=>{ const current=cameraRef.current; const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current.zoom*factor)); const ratio=zoom/current.zoom; setCamera({zoom,x:.5-(.5-current.x)*ratio,y:.5-(.5-current.y)*ratio}); };
  const dropInto=useCallback((height:number)=>{ setDropIn(height); const point=blockToAtlas(height); const start=cameraRef.current.zoom; const startedAt=performance.now();
    const step=()=>{ const progress=Math.min(1,(performance.now()-startedAt)/900); const eased=1-Math.pow(1-progress,3); const zoom=start+(MAX_ZOOM-start)*eased; setCamera({zoom,x:.5-((point.x+.5)/ATLAS_SIDE)*zoom,y:.5-((point.y+.5)/ATLAS_SIDE)*zoom}); if(progress<1) requestAnimationFrame(step); else navigate({to:"/oasis",search:{height}}); };
    requestAnimationFrame(step); },[navigate,setCamera]);
  const jump=(event:React.FormEvent)=>{ event.preventDefault(); const height=parseAtlasBlock(query,tipHeight||1_048_575); const named=height===null?findAtlasNamedPlace(query):null; if(height===null&&!named){setMessage("ENTER A MINED BLOCK, DISTRICT, OR LANDMARK");return;} setMessage(""); focusHeight(height??named?.anchorHeight??0); };
  const pointerDown=(event:React.PointerEvent)=>{ event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY}); if(pointers.current.size===1){drag.current={x:event.clientX,y:event.clientY,camera:cameraRef.current};pinch.current=null;}else if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];if(a&&b){pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),centerX:(a.x+b.x)/2,centerY:(a.y+b.y)/2,camera:cameraRef.current};drag.current=null;}} };
  const pointerMove=(event:React.PointerEvent)=>{ const previous=pointers.current.get(event.pointerId); if(!previous)return; pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY}); const rect=surfaceRef.current?.getBoundingClientRect(); if(!rect)return; if(pointers.current.size===2&&pinch.current){const [a,b]=[...pointers.current.values()];if(!a||!b)return;const distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));const centerX=(a.x+b.x)/2;const centerY=(a.y+b.y)/2;const px=(pinch.current.centerX-rect.left)/rect.width;const py=(pinch.current.centerY-rect.top)/rect.height;const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,pinch.current.camera.zoom*(distance/pinch.current.distance)));const ratio=zoom/pinch.current.camera.zoom;setCamera({zoom,x:px-(px-pinch.current.camera.x)*ratio+(centerX-pinch.current.centerX)/rect.width,y:py-(py-pinch.current.camera.y)*ratio+(centerY-pinch.current.centerY)/rect.height});}else if(pointers.current.size===1&&drag.current){setCamera({...drag.current.camera,x:drag.current.camera.x+(event.clientX-drag.current.x)/rect.width,y:drag.current.camera.y+(event.clientY-drag.current.y)/rect.height});} };
  const pointerUp=(event:React.PointerEvent)=>{ pointers.current.delete(event.pointerId); pinch.current=null; const remaining=[...pointers.current.values()][0]; drag.current=remaining?{x:remaining.x,y:remaining.y,camera:cameraRef.current}:null; };
  return <div className="atlas-terminal mx-auto max-w-[1800px] px-2 py-3 md:px-4 md:py-5">
    <div className="grid gap-px bg-border lg:grid-cols-[auto_minmax(0,1fr)_320px]">
      <nav aria-label="World sections" className="atlas-panel flex gap-px overflow-x-auto p-1 lg:w-[188px] lg:flex-col lg:overflow-visible">{RAIL.map(({to,label,icon:Icon})=><Link key={to} to={to} className="label flex shrink-0 items-center gap-2 border border-transparent px-3 py-3 text-muted-foreground hover:border-border-strong hover:text-foreground aria-[current=page]:border-bitcoin aria-[current=page]:bg-bitcoin aria-[current=page]:text-primary-foreground" activeProps={{"aria-current":"page"}}><Icon className="size-4"/><span className="whitespace-nowrap">{label}</span></Link>)}</nav>
      <main className="min-w-0">
        <form onSubmit={jump} className="mb-2 flex min-w-0 gap-2"><label className="relative min-w-0 flex-1"><span className="sr-only">Jump to block, district, or landmark</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="BLOCK, DISTRICT, OR LANDMARK" className="h-10 w-full border border-input bg-background pl-10 pr-3 font-mono text-xs outline-none focus:border-bitcoin"/></label><Button type="submit" variant="terminal"><LocateFixed/>JUMP</Button></form>
        {message&&<p className="mb-2 font-mono text-[10px] text-destructive">{message}</p>}
        <section ref={surfaceRef} aria-label="Interactive Bitcoin land atlas" className="atlas-storybook relative h-[64vh] min-h-[480px] touch-none select-none overflow-hidden border border-bitcoin/35 bg-background shadow-[0_18px_60px_-28px_var(--color-bitcoin)] cursor-grab active:cursor-grabbing md:h-[72vh]" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <div className="absolute inset-0 origin-top-left will-change-transform [backface-visibility:hidden]" style={{transform:`translate3d(${camera.x*100}%,${camera.y*100}%,0) scale(${camera.zoom})`}}>
            <img src={atlasHd} alt="Highly detailed hand-painted Oasis atlas over the Bitcoin block spatial index" draggable={false} width={1920} height={1200} fetchPriority="high" style={{filter:camera.zoom>5?`saturate(1.08) contrast(${(0.94+Math.min(0.16,(camera.zoom-5)*0.02)).toFixed(3)}) brightness(1.03)`:undefined}} className="absolute inset-0 size-full object-cover [image-rendering:auto] saturate-[1.05] contrast-[.94] brightness-[1.04]"/>
            <div aria-hidden className="atlas-storybook__wash pointer-events-none absolute inset-0" />
            <BiomeMesh tip={tipHeight}/>
             <AtlasRelief tip={tipHeight} recentBlocks={recentBlocks}/>
             <AtlasTerrain zoom={camera.zoom} tip={tipHeight}/>
             <AtlasFineDetail camera={camera} tip={tipHeight}/>
             <AtlasLivedIn camera={camera} tip={tipHeight}/>

             {heatOn&&<AtlasHeatmap events={stream.data??[]}/>} 
             <AtlasFogOfWar currentHeight={initialHeight}/>
            {clusters.map((cluster)=>{ const single=cluster.places.length===1; const place=cluster.places[0]; const landmark=single&&place&&place.landmarks>0; return <button key={cluster.key} type="button" onPointerDown={(event)=>event.stopPropagation()} onClick={()=>{if(single&&place){setSelected(place);focusHeight(place.height,Math.max(4,camera.zoom));}else{const zoom=Math.min(MAX_ZOOM,camera.zoom*2);setCamera({zoom,x:.5-cluster.x*zoom,y:.5-cluster.y*zoom});}}} style={{left:`${cluster.x*100}%`,top:`${cluster.y*100}%`,transform:`translate3d(-50%,-50%,0) scale(${1/camera.zoom})`,opacity:freshness(cluster.places.flatMap((item)=>item.events),hours)}} className={`group absolute grid place-items-center rounded-full border border-background/70 font-mono font-bold backdrop-blur-[1px] transition-[opacity,filter] hover:brightness-125 ${landmark?"size-7 bg-signal/75 text-background shadow-[0_0_18px_var(--color-signal)]":"size-6 bg-bitcoin/70 text-bitcoin-foreground shadow-[0_0_16px_var(--color-bitcoin)]"}`} aria-label={single&&place?`${place.height}.BITMAP, ${place.landmarks>0?`${place.landmarks} landmark builds, `:""}${place.count} verified records`:`Cluster of ${cluster.places.length} BITMAPs`}><span aria-hidden className={`absolute inset-[-5px] rounded-full opacity-20 ${landmark?"bg-signal":"bg-bitcoin"}`}/>{single&&place?(place.landmarks>0?<Hammer className="relative size-3.5"/>:<span className="relative size-1.5 rounded-full bg-bitcoin-foreground"/>):<span className="relative text-[8px]">{cluster.places.length}</span>}</button>;})}
            {landOn&&camera.zoom>=2.8&&[...claims.values()].filter((claim)=>!places.some((place)=>place.height===claim.height)).slice(0,120).map((claim)=>{const point=blockToAtlas(claim.height);return <button key={claim.height} type="button" onPointerDown={(event)=>event.stopPropagation()} onClick={()=>focusHeight(claim.height,Math.max(5,camera.zoom))} style={{left:`${((point.x+.5)/ATLAS_SIDE)*100}%`,top:`${((point.y+.5)/ATLAS_SIDE)*100}%`,transform:`translate(-50%,-50%) scale(${1/camera.zoom})`,backgroundColor:claim.ownerAddress?colorForAddress(claim.ownerAddress):"var(--color-muted-foreground)"}} className="absolute size-1.5 rotate-45 border border-background/50 opacity-60 shadow-sm transition-all hover:scale-[2] hover:opacity-100" aria-label={`${claim.height}.BITMAP claimed land`}/>;})}
             {parcelsOn&&camera.zoom>=4&&[...parcelized.values()].map((item)=>{const point=blockToAtlas(item.height);return <button key={`parcelized-${item.height}`} type="button" onPointerDown={(event)=>event.stopPropagation()} onClick={()=>focusHeight(item.height,Math.max(7,camera.zoom))} style={{left:`${((point.x+.5)/ATLAS_SIDE)*100}%`,top:`${((point.y+.5)/ATLAS_SIDE)*100}%`,transform:`translate(-50%,-50%) scale(${1/camera.zoom})`}} className="absolute grid size-5 grid-cols-2 gap-px border border-signal bg-background/80 p-0.5 shadow-[0_0_14px_var(--color-signal)] transition-transform hover:scale-125" aria-label={`${item.height}.BITMAP parcelized into ${item.validParcels} valid parcels`}><span className="bg-signal/80"/><span className="bg-signal/40"/><span className="bg-signal/40"/><span className="bg-signal/80"/></button>;})}
            {mineOn&&[...myHeights].slice(0,200).map((height)=>{const point=blockToAtlas(height);return <button key={`mine-${height}`} type="button" onPointerDown={(event)=>event.stopPropagation()} onClick={()=>focusHeight(height,Math.max(5,camera.zoom))} style={{left:`${((point.x+.5)/ATLAS_SIDE)*100}%`,top:`${((point.y+.5)/ATLAS_SIDE)*100}%`,transform:`translate(-50%,-50%) scale(${1/camera.zoom})`}} className="absolute size-3 rotate-45 border-2 border-bitcoin bg-bitcoin/35 shadow-[0_0_12px_var(--color-bitcoin)] transition-transform hover:scale-150" aria-label={`Your land, ${height}.BITMAP`}/>;})}
            {mineOn&&selected===null&&[...myHeights][0]!==undefined&&<AtlasBeacon height={[...myHeights][0]!} zoom={camera.zoom}/>}
            {selected&&<span aria-hidden style={{left:`${selected.x*100}%`,top:`${selected.y*100}%`,transform:`translate(-50%,-50%) scale(${1/camera.zoom})`}} className="pointer-events-none absolute size-11 rounded-full border border-signal/80 shadow-[0_0_20px_var(--color-signal)] before:absolute before:inset-2 before:rounded-full before:border before:border-signal/40"/>}
            {dropIn!==null&&<div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/55 backdrop-blur-[1px]"><p className="border border-signal bg-background/90 px-4 py-2 font-mono text-[10px] uppercase text-signal" data-no-translate>DROPPING INTO {dropIn.toLocaleString("en-US")}.BITMAP…</p></div>}
          </div>
          {camera.zoom>4&&<div aria-hidden className="atlas-grain pointer-events-none absolute inset-0" style={{opacity:Math.min(0.55,(camera.zoom-4)*0.075)}}/>}
          <AtlasPlaceLabels camera={camera} stats={districtStats}/>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3"><div className="pointer-events-auto flex border border-border bg-background/90 backdrop-blur"><Button type="button" variant="ghost" size="icon" onClick={()=>zoomAtCenter(1.5)} aria-label="Zoom in"><Plus/></Button><Button type="button" variant="ghost" size="icon" onClick={()=>zoomAtCenter(1/1.5)} aria-label="Zoom out"><Minus/></Button><Button type="button" variant="ghost" size="icon" onClick={()=>setCamera({zoom:1,x:0,y:0})} aria-label="Show whole world"><Crosshair/></Button></div><p className="border border-border bg-background/90 px-3 py-2 font-mono text-[9px] text-signal backdrop-blur" data-no-translate>{atlasScale(camera.zoom)} · {camera.zoom.toFixed(1)}×</p></div>
          <div className="pointer-events-none absolute bottom-3 left-3 border border-border bg-background/90 px-3 py-2 font-mono text-[9px] backdrop-blur"><p className="text-muted-foreground">HILBERT 1024² · TIP {tipHeight?tipHeight.toLocaleString("en-US"):"…"}</p><p className="mt-1 text-signal" data-no-translate>{selected?`${atlasPlace(selected.height).localName} · ${selected.height.toLocaleString("en-US")}`:"DRAG · SCROLL · PINCH"}</p><p className="mt-1 text-foreground" data-no-translate>{seenCells.length.toLocaleString("en-US")} CHARTED</p></div>
          <div className="absolute bottom-3 right-3 hidden h-24 w-36 overflow-hidden border border-border bg-background/90 sm:block"><img src={atlasHd} alt="Atlas mini-map" loading="lazy" width={1920} height={1200} className="size-full object-cover opacity-80"/><AtlasFogOfWar currentHeight={initialHeight}/><span className="absolute border border-signal bg-signal/10" style={{left:`${(-camera.x/camera.zoom)*100}%`,top:`${(-camera.y/camera.zoom)*100}%`,width:`${100/camera.zoom}%`,height:`${100/camera.zoom}%`}}/><Compass className="absolute right-1 top-1 size-4 text-bitcoin"/></div>
        </section>
        <div className="atlas-panel mt-2 flex flex-wrap items-center gap-2 px-3 py-2" role="group" aria-label="Time window"><span className="label text-bitcoin">TIME</span>{WINDOWS.map((item)=>{const on=timeWindow===item.key;return <button key={item.key} type="button" aria-pressed={on} onClick={()=>setTimeWindow(item.key)} className={`border px-2 py-1 font-mono text-[9px] uppercase transition-colors ${on?"border-bitcoin bg-bitcoin/10 text-bitcoin":"border-border text-muted-foreground hover:border-bitcoin/40"}`}>{item.label}</button>;})}<span className="ml-auto flex flex-wrap gap-2"><button type="button" aria-pressed={heatOn} onClick={()=>setHeatOn((on)=>!on)} className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase transition-colors ${heatOn?"border-bitcoin bg-bitcoin/10 text-bitcoin":"border-border text-muted-foreground hover:border-bitcoin/40"}`}><Flame className="size-3"/>24H HEAT</button><button type="button" aria-pressed={mineOn} disabled={ordinals===""} onClick={()=>setMineOn((on)=>!on)} className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase transition-colors disabled:opacity-40 ${mineOn&&ordinals!==""?"border-bitcoin bg-bitcoin/10 text-bitcoin":"border-border text-muted-foreground hover:border-bitcoin/40"}`}><Wallet className="size-3"/>MY LAND {ordinals!==""?myHeights.size:""}</button>{ordinals!==""&&myHeights.size>0&&<button type="button" onClick={()=>{const first=[...myHeights][0]; if(first!==undefined) focusHeight(first,6);}} className="flex items-center gap-1.5 border border-signal/60 px-2 py-1 font-mono text-[9px] uppercase text-signal transition-colors hover:bg-signal/10"><Activity className="size-3"/>YOU ARE HERE</button>}</span></div>
        <div className="atlas-panel mt-2 flex flex-wrap items-center gap-2 px-3 py-2" role="group" aria-label="Atlas layers"><span className="label text-bitcoin">LAYERS</span>{LAYERS.map((layer)=>{const on=layers.includes(layer.key);const Icon=layer.icon;return <button key={layer.key} type="button" aria-pressed={on} onClick={()=>toggleLayer(layer.key)} className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase transition-colors ${on?`border-bitcoin bg-bitcoin/10 ${layer.tone}`:"border-border text-muted-foreground hover:border-bitcoin/40"}`}><Icon className="size-3"/>{layer.label}</button>;})}<button type="button" aria-pressed={landOn} onClick={()=>setLandOn((on)=>!on)} className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase transition-colors ${landOn?"border-bitcoin bg-bitcoin/10 text-bitcoin":"border-border text-muted-foreground hover:border-bitcoin/40"}`}><MapPin className="size-3"/>CLAIMED LAND</button><button type="button" aria-pressed={parcelsOn} onClick={()=>setParcelsOn((on)=>!on)} className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase transition-colors ${parcelsOn?"border-signal bg-signal/10 text-signal":"border-border text-muted-foreground hover:border-signal/40"}`}><BoxSelect className="size-3"/>PARCELIZED {parcelized.size||""}</button><span className="ml-auto font-mono text-[9px] text-muted-foreground" data-no-translate>{claims.size} CLAIMS · {places.length} PLACES · {visibleEvents.length} RECORDS</span></div>
        {camera.zoom>=2.6&&<RegionPanel district={focusDistrict} range={districtRange} stats={region.data} loading={region.isFetching} focusHeight={focusHeight}/>}
        <div className="atlas-panel mt-2 flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 font-mono text-[9px] text-muted-foreground"><span className="text-bitcoin">MAP KEY</span><span>⌁ TX TOPOGRAPHY</span><span>┈ BLOCK-AGE CONTOUR</span><span className="text-signal">· LIVE FRONTIER</span><span>● VERIFIED HISTORY</span><span className="text-signal">⚒ LANDMARK</span><span>◆ CLAIMED LAND</span><span className="text-signal">▦ PARCELIZED</span><span className="text-bitcoin">◈ YOUR LAND</span><span>◌ GHOST · OLDER RECORD</span><span>▱ LAND SEAM</span><span>⌂ HAMLET · ZOOM IN</span></div>

      </main>
      <aside className="hidden min-w-0 auto-rows-min content-start gap-3 lg:grid">
        {selected?<Inspector place={selected} tip={tipHeight} close={()=>setSelected(null)} dropInto={dropInto} claim={claims.get(selected.height)} parcelization={parcelized.get(selected.height)}/>:<div className="atlas-panel p-4"><h1 className="display text-2xl"><span className="text-bitcoin">THE</span> OASIS</h1><p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">A spatial index of Bitcoin land</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Every mined block is a place. Nearby heights stay nearby; verified history appears where it happened.</p><dl className="mt-4 grid grid-cols-3 gap-px border border-border bg-border"><div className="bg-background p-2 text-center"><dd className="font-mono text-xs font-bold text-bitcoin">{tipHeight?formatCount(tipHeight):"…"}</dd><dt className="label mt-1">PLACES</dt></div><div className="bg-background p-2 text-center"><dd className="font-mono text-xs font-bold">{totals?formatCount(totals.builds):"…"}</dd><dt className="label mt-1">BUILDS</dt></div><div className="bg-background p-2 text-center"><dd className="font-mono text-xs font-bold">{places.length}</dd><dt className="label mt-1">ACTIVE</dt></div></dl><Button asChild variant="terminal" className="mt-4 w-full"><Link to="/oasis">EXPLORE 3D <ArrowRight/></Link></Button></div>}
        <div className="atlas-panel p-4"><p className="label text-bitcoin">ERA BIOMES</p>{["GENESIS · ANCIENT RUINS","EARLY · TEMPERATE ISLANDS","HALVINGS · CHANGING CLIMATES","TIP · LIVING FRONTIER"].map((label)=><p key={label} className="mt-3 font-mono text-[10px] text-muted-foreground">{label}</p>)}</div>
      </aside>
    </div>
    {selected&&<div className="fixed inset-x-0 bottom-0 z-50 max-h-[72vh] overflow-y-auto border-t border-bitcoin bg-background p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] lg:hidden"><Inspector place={selected} tip={tipHeight} close={()=>setSelected(null)} dropInto={dropInto} claim={claims.get(selected.height)} parcelization={parcelized.get(selected.height)}/></div>}
    <section className="atlas-panel mt-3" aria-label="Live activity"><div className="flex items-stretch overflow-x-auto"><p className="label flex shrink-0 items-center gap-2 border-r border-border px-4 py-3 text-bitcoin"><span className="size-2 rounded-full bg-bitcoin"/>LIVE ACTIVITY</p>{(stream.data??[]).slice(0,8).map((event)=><button key={event.id} type="button" disabled={event.bitmapHeight===null} onClick={()=>event.bitmapHeight!==null&&focusHeight(event.bitmapHeight)} className="min-w-[210px] shrink-0 border-r border-border px-4 py-3 text-left hover:bg-bitcoin/5"><p className="truncate font-mono text-[10px] uppercase">{event.title}</p><p className="font-mono text-[9px] text-muted-foreground">{event.bitmapHeight===null?"WORLD":`${event.bitmapHeight.toLocaleString("en-US")}.BITMAP`} · {timeAgo(event.occurredAt)}</p></button>)}</div></section>
  </div>;
}