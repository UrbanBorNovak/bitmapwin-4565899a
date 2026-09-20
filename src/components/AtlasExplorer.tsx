import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Blocks, Compass, Crosshair, Hammer, KeyRound, LocateFixed, Map as MapIcon, MapPin, Minus, Plus, Radio, Search, Store, Globe2, Swords, Eye, Tag, X } from "lucide-react";
import atlasHd from "@/assets/oasis-atlas-hd.jpg";
import { AtlasRelief } from "@/components/AtlasRelief";
import { Button } from "@/components/ui/button";
import { getChainBlocks } from "@/lib/chain.functions";
import { worldStatsQuery, formatCount } from "@/lib/world-stats";
import { provenanceStreamQuery } from "@/lib/provenance-stream";
import { timeAgo } from "@/lib/bitmap";
import { atlasEra, atlasScale, atlasToBlock, ATLAS_SIDE, blockToAtlas, parseAtlasBlock } from "@/lib/atlas-geometry";
import { getAtlasClaims, indexAtlasFrontier } from "@/lib/atlas-land.functions";
import { colorForAddress } from "@/lib/map-owners";
import type { ProvenanceEvent } from "@/lib/passport";
import { sampleVisibleHeights, type AtlasClaim } from "@/lib/atlas-land";

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
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
  const divisions = zoom < 1.7 ? 8 : zoom < 3.2 ? 18 : zoom < 6 ? 40 : 128;
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

function Inspector({ place, tip, close, dropInto, claim }: { place: Place; tip: number; close: () => void; dropInto: (height: number) => void; claim?: AtlasClaim | undefined }) {
  const point = blockToAtlas(place.height); const era = atlasEra(place.height, tip);
  return <div className="min-w-0 border border-bitcoin/60 bg-background/95 p-4 shadow-2xl backdrop-blur-md">
    <div className="flex items-start justify-between gap-3"><div><p className="label text-bitcoin">SELECTED BITMAP</p><h2 className="mt-1 font-mono text-lg font-bold tabular-nums" data-no-translate>{place.height.toLocaleString("en-US")}.BITMAP</h2></div><Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close selected BITMAP"><X /></Button></div>
    <dl className="mt-3 grid grid-cols-2 gap-px border border-border bg-border text-[10px]">
      <div className="bg-background p-2"><dt className="label">COORDINATES</dt><dd className="mt-1 font-mono text-signal" data-no-translate>{point.x.toString().padStart(4,"0")} : {point.y.toString().padStart(4,"0")}</dd></div>
      <div className="bg-background p-2"><dt className="label">ERA</dt><dd className="mt-1 font-mono text-bitcoin">{era.label}</dd></div>
      <div className="col-span-2 bg-background p-2"><dt className="label">BIOME</dt><dd className="mt-1 font-mono">{era.biome}</dd></div>
    </dl>
    {claim&&<div className="mt-3 border border-bitcoin/50 bg-bitcoin/5 p-2"><p className="label text-bitcoin">CLAIMED LAND {claim.isValid?"· VALID":"· CONTESTED"}</p><p className="mt-1 truncate font-mono text-[9px] text-muted-foreground" data-no-translate>HOLDER {claim.ownerAddress??"UNKNOWN"}</p><p className="truncate font-mono text-[9px] text-muted-foreground" data-no-translate>{claim.inscriptionId}</p></div>}

    {place.landmarks>0&&<div className="mt-3 flex items-center gap-2 border border-signal/60 bg-signal/10 p-2"><Hammer className="size-4 shrink-0 text-signal"/><div className="min-w-0"><p className="label text-signal">LANDMARK · {place.landmarks} BUILD{place.landmarks===1?"":"S"}</p><p className="truncate font-mono text-[9px] text-muted-foreground">{place.events.find((event)=>event.eventType==="build")?.summary||"Built history stands on this land"}</p></div></div>}
    <div className="mt-3 border-t border-border pt-3"><p className="label">VERIFIED HISTORY · {place.count}</p>{place.events.slice(0,3).map((event) => <div key={event.id} className="mt-2"><p className="truncate font-mono text-[10px] uppercase">{event.title}</p><p className="font-mono text-[9px] text-muted-foreground">{timeAgo(event.occurredAt)} · {event.proofLevel}</p></div>)}</div>
    <div className="mt-4 grid grid-cols-2 gap-2"><Button asChild variant="terminal"><Link to="/bitmap/$block" params={{ block: String(place.height) }}>OPEN LAND</Link></Button><Button type="button" variant="terminalGhost" onClick={()=>dropInto(place.height)}>DROP IN 3D</Button></div>
  </div>;
}

export function AtlasExplorer({ initialHeight }: { initialHeight?: number }) {
  const surfaceRef = useRef<HTMLDivElement | null>(null); const pointers = useRef(new Map<number,{x:number;y:number}>()); const drag = useRef<{x:number;y:number;camera:Camera}|null>(null); const pinch = useRef<{distance:number;centerX:number;centerY:number;camera:Camera}|null>(null); const cameraRef = useRef<Camera>({ zoom: 1, x: 0, y: 0 });
  const fetchBlocks = useServerFn(getChainBlocks);
  const chain = useQuery({ queryKey:["chain","tip","atlas"], queryFn:()=>fetchBlocks({data:{pages:3,scan:false}}), staleTime:25_000, refetchInterval:30_000 });
  const stats = useQuery(worldStatsQuery()); const stream = useQuery(provenanceStreamQuery("all",80));
  const [camera,setCameraState]=useState<Camera>({zoom:1,x:0,y:0}); const [selected,setSelected]=useState<Place|null>(null); const [query,setQuery]=useState(initialHeight === undefined ? "" : String(initialHeight)); const [message,setMessage]=useState("");
  const [layers,setLayers]=useState<LayerKey[]>(ALL_LAYERS); const [dropIn,setDropIn]=useState<number|null>(null);
  const navigate=useNavigate();
  const visibleEvents=useMemo(()=>(stream.data??[]).filter((event)=>{const key=eventLayer(event);return key===null?layers.length===ALL_LAYERS.length:layers.includes(key);}),[stream.data,layers]);
  const toggleLayer=(key:LayerKey)=>setLayers((current)=>current.includes(key)?current.filter((item)=>item!==key):[...current,key]);
  const places=useMemo(()=>placesFrom(visibleEvents),[visibleEvents]); const clusters=useMemo(()=>clusterPlaces(places,camera.zoom),[places,camera.zoom]); const recentBlocks=Array.isArray(chain.data)?chain.data:[]; const tipHeight=recentBlocks.length?Math.max(...recentBlocks.map((block)=>block.height)):0; const totals=stats.data?.totals;
  const setCamera=useCallback((next:Camera)=>{ const value={zoom:Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,next.zoom)),x:Math.min(0,Math.max(1-Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,next.zoom)),next.x)),y:Math.min(0,Math.max(1-Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,next.zoom)),next.y))}; cameraRef.current=value; setCameraState(value); },[]);
  const focusHeight=useCallback((height:number, preferredZoom=6)=>{ const point=blockToAtlas(height); const zoom=Math.max(cameraRef.current.zoom,preferredZoom); setCamera({zoom,x:.5-((point.x+.5)/ATLAS_SIDE)*zoom,y:.5-((point.y+.5)/ATLAS_SIDE)*zoom}); const known=places.find((place)=>place.height===height); setSelected(known??{height,title:`${height}.BITMAP`,count:0,landmarks:0,events:[],x:(point.x+.5)/ATLAS_SIDE,y:(point.y+.5)/ATLAS_SIDE}); setQuery(String(height)); },[places,setCamera]);
  useEffect(()=>{ if(initialHeight!==undefined) focusHeight(initialHeight,6); },[initialHeight,focusHeight]);
  useEffect(()=>{ const el=surfaceRef.current; if(!el)return; const wheel=(event:WheelEvent)=>{ event.preventDefault(); const rect=el.getBoundingClientRect(); const px=(event.clientX-rect.left)/rect.width; const py=(event.clientY-rect.top)/rect.height; const current=cameraRef.current; const dy=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?100:1); const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current.zoom*Math.exp(-dy*.0015))); const ratio=zoom/current.zoom; setCamera({zoom,x:px-(px-current.x)*ratio,y:py-(py-current.y)*ratio}); }; el.addEventListener("wheel",wheel,{passive:false}); return()=>el.removeEventListener("wheel",wheel); },[setCamera]);
  const zoomAtCenter=(factor:number)=>{ const current=cameraRef.current; const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current.zoom*factor)); const ratio=zoom/current.zoom; setCamera({zoom,x:.5-(.5-current.x)*ratio,y:.5-(.5-current.y)*ratio}); };
  const dropInto=useCallback((height:number)=>{ setDropIn(height); const point=blockToAtlas(height); const start=cameraRef.current.zoom; const startedAt=performance.now();
    const step=()=>{ const progress=Math.min(1,(performance.now()-startedAt)/900); const eased=1-Math.pow(1-progress,3); const zoom=start+(MAX_ZOOM-start)*eased; setCamera({zoom,x:.5-((point.x+.5)/ATLAS_SIDE)*zoom,y:.5-((point.y+.5)/ATLAS_SIDE)*zoom}); if(progress<1) requestAnimationFrame(step); else navigate({to:"/oasis",search:{height}}); };
    requestAnimationFrame(step); },[navigate,setCamera]);
  const jump=(event:React.FormEvent)=>{ event.preventDefault(); const height=parseAtlasBlock(query,tipHeight||1_048_575); if(height===null){setMessage("ENTER A MINED BLOCK HEIGHT");return;} setMessage(""); focusHeight(height); };
  const pointerDown=(event:React.PointerEvent)=>{ event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY}); if(pointers.current.size===1){drag.current={x:event.clientX,y:event.clientY,camera:cameraRef.current};pinch.current=null;}else if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];if(a&&b){pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),centerX:(a.x+b.x)/2,centerY:(a.y+b.y)/2,camera:cameraRef.current};drag.current=null;}} };
  const pointerMove=(event:React.PointerEvent)=>{ const previous=pointers.current.get(event.pointerId); if(!previous)return; pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY}); const rect=surfaceRef.current?.getBoundingClientRect(); if(!rect)return; if(pointers.current.size===2&&pinch.current){const [a,b]=[...pointers.current.values()];if(!a||!b)return;const distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));const centerX=(a.x+b.x)/2;const centerY=(a.y+b.y)/2;const px=(pinch.current.centerX-rect.left)/rect.width;const py=(pinch.current.centerY-rect.top)/rect.height;const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,pinch.current.camera.zoom*(distance/pinch.current.distance)));const ratio=zoom/pinch.current.camera.zoom;setCamera({zoom,x:px-(px-pinch.current.camera.x)*ratio+(centerX-pinch.current.centerX)/rect.width,y:py-(py-pinch.current.camera.y)*ratio+(centerY-pinch.current.centerY)/rect.height});}else if(pointers.current.size===1&&drag.current){setCamera({...drag.current.camera,x:drag.current.camera.x+(event.clientX-drag.current.x)/rect.width,y:drag.current.camera.y+(event.clientY-drag.current.y)/rect.height});} };
  const pointerUp=(event:React.PointerEvent)=>{ pointers.current.delete(event.pointerId); pinch.current=null; const remaining=[...pointers.current.values()][0]; drag.current=remaining?{x:remaining.x,y:remaining.y,camera:cameraRef.current}:null; };
  return <div className="mx-auto max-w-[1800px] px-2 py-3 md:px-4 md:py-5">
    <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_320px]">
      <nav aria-label="World sections" className="flex gap-2 overflow-x-auto border border-border bg-surface/60 p-2 lg:w-[188px] lg:flex-col lg:overflow-visible">{RAIL.map(({to,label,icon:Icon})=><Link key={to} to={to} className="label flex shrink-0 items-center gap-2 px-3 py-3 text-muted-foreground hover:bg-bitcoin/10 hover:text-bitcoin aria-[current=page]:bg-bitcoin/10 aria-[current=page]:text-bitcoin" activeProps={{"aria-current":"page"}}><Icon className="size-4"/><span className="whitespace-nowrap">{label}</span></Link>)}</nav>
      <main className="min-w-0">
        <form onSubmit={jump} className="mb-2 flex min-w-0 gap-2"><label className="relative min-w-0 flex-1"><span className="sr-only">Jump to block height</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="JUMP TO BLOCK OR 716693.BITMAP" inputMode="numeric" className="h-10 w-full border border-input bg-background pl-10 pr-3 font-mono text-xs outline-none focus:border-bitcoin"/></label><Button type="submit" variant="terminal"><LocateFixed/>JUMP</Button></form>
        {message&&<p className="mb-2 font-mono text-[10px] text-destructive">{message}</p>}
        <section ref={surfaceRef} aria-label="Interactive Bitcoin land atlas" className="relative h-[64vh] min-h-[480px] touch-none select-none overflow-hidden border border-border bg-background cursor-grab active:cursor-grabbing md:h-[72vh]" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <div className="absolute inset-0 origin-top-left will-change-transform" style={{transform:`translate(${camera.x*100}%,${camera.y*100}%) scale(${camera.zoom})`}}>
            <img src={atlasHd} alt="Highly detailed painted Oasis atlas over the Bitcoin block spatial index" draggable={false} width={1920} height={1200} fetchPriority="high" className="absolute inset-0 size-full object-cover [image-rendering:auto]"/>
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,var(--background)_145%)] opacity-35 mix-blend-multiply" />
            <BiomeMesh tip={tipHeight}/>
             <AtlasRelief tip={tipHeight} recentBlocks={recentBlocks}/>
            {clusters.map((cluster)=>{ const single=cluster.places.length===1; const place=cluster.places[0]; return <button key={cluster.key} type="button" onPointerDown={(event)=>event.stopPropagation()} onClick={()=>{if(single&&place){setSelected(place);focusHeight(place.height,Math.max(4,camera.zoom));}else{const zoom=Math.min(MAX_ZOOM,camera.zoom*2);setCamera({zoom,x:.5-cluster.x*zoom,y:.5-cluster.y*zoom});}}} style={{left:`${cluster.x*100}%`,top:`${cluster.y*100}%`,transform:`translate(-50%,-50%) scale(${1/camera.zoom})`}} className={`absolute grid min-h-9 min-w-9 place-items-center border-2 border-background px-2 font-mono text-[10px] font-bold shadow-lg ${single&&place&&place.landmarks>0?"bg-signal text-background shadow-[0_0_14px_var(--color-signal)]":"bg-bitcoin text-bitcoin-foreground"}`} aria-label={single&&place?`${place.height}.BITMAP, ${place.landmarks>0?`${place.landmarks} landmark builds, `:""}${place.count} verified records`:`Cluster of ${cluster.places.length} BITMAPs`}>{single&&place?<>{place.landmarks>0?<Hammer className="size-4"/>:<MapPin className="size-4"/>}<span className="sr-only">{place.height}</span></>:cluster.places.length}</button>;})}
            {selected&&<span aria-hidden style={{left:`${selected.x*100}%`,top:`${selected.y*100}%`,transform:`translate(-50%,-50%) scale(${1/camera.zoom})`}} className="pointer-events-none absolute size-14 rounded-full border-2 border-signal shadow-[0_0_18px_var(--color-signal)]"/>}
            {dropIn!==null&&<div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/55 backdrop-blur-[1px]"><p className="border border-signal bg-background/90 px-4 py-2 font-mono text-[10px] uppercase text-signal" data-no-translate>DROPPING INTO {dropIn.toLocaleString("en-US")}.BITMAP…</p></div>}
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3"><div className="pointer-events-auto flex border border-border bg-background/90 backdrop-blur"><Button type="button" variant="ghost" size="icon" onClick={()=>zoomAtCenter(1.5)} aria-label="Zoom in"><Plus/></Button><Button type="button" variant="ghost" size="icon" onClick={()=>zoomAtCenter(1/1.5)} aria-label="Zoom out"><Minus/></Button><Button type="button" variant="ghost" size="icon" onClick={()=>setCamera({zoom:1,x:0,y:0})} aria-label="Show whole world"><Crosshair/></Button></div><p className="border border-border bg-background/90 px-3 py-2 font-mono text-[9px] text-signal backdrop-blur" data-no-translate>{atlasScale(camera.zoom)} · {camera.zoom.toFixed(1)}×</p></div>
          <div className="pointer-events-none absolute bottom-3 left-3 border border-border bg-background/90 px-3 py-2 font-mono text-[9px] backdrop-blur"><p className="text-muted-foreground">HILBERT 1024² · TIP {tipHeight?tipHeight.toLocaleString("en-US"):"…"}</p><p className="mt-1 text-signal" data-no-translate>{selected?`BLOCK ${selected.height.toLocaleString("en-US")}`:"DRAG · SCROLL · PINCH"}</p></div>
          <div className="absolute bottom-3 right-3 hidden h-24 w-36 overflow-hidden border border-border bg-background/90 sm:block"><img src={atlasHd} alt="Atlas mini-map" loading="lazy" width={1920} height={1200} className="size-full object-cover opacity-80"/><span className="absolute border border-signal bg-signal/10" style={{left:`${(-camera.x/camera.zoom)*100}%`,top:`${(-camera.y/camera.zoom)*100}%`,width:`${100/camera.zoom}%`,height:`${100/camera.zoom}%`}}/><Compass className="absolute right-1 top-1 size-4 text-bitcoin"/></div>
        </section>
        <div className="mt-2 flex flex-wrap items-center gap-2 border border-border bg-surface/60 px-3 py-2" role="group" aria-label="Atlas layers"><span className="label text-bitcoin">LAYERS</span>{LAYERS.map((layer)=>{const on=layers.includes(layer.key);const Icon=layer.icon;return <button key={layer.key} type="button" aria-pressed={on} onClick={()=>toggleLayer(layer.key)} className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase transition-colors ${on?`border-bitcoin bg-bitcoin/10 ${layer.tone}`:"border-border text-muted-foreground hover:border-bitcoin/40"}`}><Icon className="size-3"/>{layer.label}</button>;})}<span className="ml-auto font-mono text-[9px] text-muted-foreground" data-no-translate>{places.length} PLACES · {visibleEvents.length} RECORDS</span></div>
        <div className="mt-2 flex flex-wrap gap-2 border border-border bg-surface/60 px-3 py-2 font-mono text-[9px] text-muted-foreground"><span className="text-bitcoin">LEGEND</span><span>▲ TX RELIEF</span><span>▦ BITMAP SIZE DENSITY</span><span className="text-signal">〰 BLOCK-AGE RIVERS</span><span className="text-signal">● LIVE FRONTIER</span><span>■ VERIFIED HISTORY</span><span className="text-signal">⚒ LANDMARK BUILD</span><span>FOG = UNMINED</span></div>
      </main>
      <aside className="hidden min-w-0 auto-rows-min content-start gap-3 lg:grid">
        {selected?<Inspector place={selected} tip={tipHeight} close={()=>setSelected(null)} dropInto={dropInto}/>:<div className="border border-bitcoin/60 bg-surface/60 p-4"><h1 className="display text-2xl"><span className="text-bitcoin">THE</span> OASIS</h1><p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">A spatial index of Bitcoin land</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Every mined block is a place. Nearby heights stay nearby; verified history appears where it happened.</p><dl className="mt-4 grid grid-cols-3 gap-px border border-border bg-border"><div className="bg-background p-2 text-center"><dd className="font-mono text-xs font-bold text-bitcoin">{tipHeight?formatCount(tipHeight):"…"}</dd><dt className="label mt-1">PLACES</dt></div><div className="bg-background p-2 text-center"><dd className="font-mono text-xs font-bold">{totals?formatCount(totals.builds):"…"}</dd><dt className="label mt-1">BUILDS</dt></div><div className="bg-background p-2 text-center"><dd className="font-mono text-xs font-bold">{places.length}</dd><dt className="label mt-1">ACTIVE</dt></div></dl><Button asChild variant="terminal" className="mt-4 w-full"><Link to="/oasis">EXPLORE 3D <ArrowRight/></Link></Button></div>}
        <div className="border border-border bg-surface/60 p-4"><p className="label text-bitcoin">ERA BIOMES</p>{["GENESIS · ANCIENT RUINS","EARLY · TEMPERATE ISLANDS","HALVINGS · CHANGING CLIMATES","TIP · LIVING FRONTIER"].map((label)=><p key={label} className="mt-3 font-mono text-[10px] text-muted-foreground">{label}</p>)}</div>
      </aside>
    </div>
    {selected&&<div className="fixed inset-x-0 bottom-0 z-50 max-h-[72vh] overflow-y-auto border-t border-bitcoin bg-background/98 p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] shadow-2xl lg:hidden"><Inspector place={selected} tip={tipHeight} close={()=>setSelected(null)} dropInto={dropInto}/></div>}
    <section className="mt-3 border border-border bg-surface/60" aria-label="Live activity"><div className="flex items-stretch overflow-x-auto"><p className="label flex shrink-0 items-center gap-2 border-r border-border px-4 py-3 text-bitcoin"><span className="size-2 rounded-full bg-bitcoin"/>LIVE ACTIVITY</p>{(stream.data??[]).slice(0,8).map((event)=><button key={event.id} type="button" disabled={event.bitmapHeight===null} onClick={()=>event.bitmapHeight!==null&&focusHeight(event.bitmapHeight)} className="min-w-[210px] shrink-0 border-r border-border px-4 py-3 text-left hover:bg-bitcoin/5"><p className="truncate font-mono text-[10px] uppercase">{event.title}</p><p className="font-mono text-[9px] text-muted-foreground">{event.bitmapHeight===null?"WORLD":`${event.bitmapHeight.toLocaleString("en-US")}.BITMAP`} · {timeAgo(event.occurredAt)}</p></button>)}</div></section>
  </div>;
}