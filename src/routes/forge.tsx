import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";
import { FORGE_MASTER_DELEGATE_ID, delegateSavings, forgeDelegateMetadata } from "@/lib/forge-delegate";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { BLOCKS, type BlockId } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { ARCHETYPES, FORGE_MAX_BLOCKS, FORGE_SPAN, encodeBuild, forgeInscriptionHtml, generateBuild, type ArchetypeId } from "@/lib/voxel-populate";
import { HOUSE_PREFABS, SPHERES, cellKey, inscribedIdOf, normaliseModule, rotatePrefab, stampInto, tributeSplit, type Contributor, type Prefab, type Sphere } from "@/lib/forge-prefabs";
import { BLUEPRINTS, blueprintBlocks, nextDropAt, weekNumber, weeklyBlueprint } from "@/lib/forge-blueprints";
import { clipToParcel, inRect, parcelAt, parcelRects, type ParcelRect } from "@/lib/forge-parcels";
import { publishForgeModuleFn, stampForgeModuleFn } from "@/lib/forge-modules.functions";
import { supabase } from "@/integrations/supabase/client";
import { useWalletSession } from "@/lib/wallet-session";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { forgeRightsFn } from "@/lib/forge-rights.functions";

export const Route = createFileRoute("/forge")({
  validateSearch: (s: Record<string, unknown>): { height?: number } => {
    const h = Number(s["height"]);
    return Number.isInteger(h) && h >= 0 ? { height: h } : {};
  },
  head: () => ({
    meta: [
      { title: "Land Forge Studio — Build, Remix & Inscribe Your BITMAP" },
      { name: "description", content: "Drag-and-drop voxel studio for BITMAPs. Reuse community modules, pay their creators, and inscribe the finished build as a child on Bitcoin." },
      { property: "og:title", content: "Land Forge Studio — Composable On-Chain Builds" },
      { property: "og:description", content: "Build on top of each other's work. Every creator in your build gets paid in sats the moment you inscribe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgePage,
});

const HALF = FORGE_SPAN / 2;
const COLORS = Object.fromEntries(BLOCKS.map((b) => [b.id, new THREE.Color(b.top)]));
type Tool = "stamp" | "block" | "erase" | "parcel";

function ParcelFloor({ rects, focus, hoverIdx }: { rects: ParcelRect[]; focus: number | null; hoverIdx: number | null }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const base = new THREE.Color("#3a2a12"), hi = new THREE.Color("#f7931a"), hv = new THREE.Color("#00f0ff"), dim = new THREE.Color("#1d2230");
    rects.forEach((r, i) => {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      o.position.set((r.x0 + r.x1) / 2 - HALF, 0.02, (r.z0 + r.z1) / 2 - HALF);
      o.scale.set(Math.max(0.3, w - 0.15), 1, Math.max(0.3, d - 0.15));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, r.index === focus ? hi : r.index === hoverIdx ? hv : focus !== null ? dim : base);
    });
    m.count = rects.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [rects, focus, hoverIdx]);
  return (
    <instancedMesh key={rects.length} ref={ref} args={[undefined, undefined, Math.max(1, rects.length)]} raycast={() => null}>
      <boxGeometry args={[1, 0.04, 1]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

function Blocks({ blocks, onErase, erase, onSurface, onPlace }: { blocks: TplBlock[]; erase: boolean; onErase: (b: TplBlock) => void; onSurface: (cell: [number, number, number] | null) => void; onPlace: () => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    blocks.forEach((b, i) => {
      o.position.set(b.dx - HALF + 0.5, b.dy + 0.5, b.dz - HALF + 0.5);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, COLORS[b.k] ?? COLORS["stone"]!);
    });
    m.count = blocks.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [blocks]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, FORGE_MAX_BLOCKS + 400]}
      castShadow
      receiveShadow
      onPointerMove={(e) => {
        if (e.instanceId == null) return;
        e.stopPropagation();
        const b = blocks[e.instanceId];
        const n = e.face?.normal;
        if (!b || !n) return;
        // Snap onto the face under the cursor: the next cell along its normal.
        onSurface(erase ? [b.dx, b.dy, b.dz] : [b.dx + Math.round(n.x), Math.max(0, b.dy + Math.round(n.y)), b.dz + Math.round(n.z)]);
      }}
      onPointerLeave={() => onSurface(null)}
      onClick={(e) => {
        if (e.instanceId == null) return;
        e.stopPropagation();
        if (erase) { const b = blocks[e.instanceId]; if (b) onErase(b); return; }
        onPlace();
      }}
    >
      <boxGeometry args={[0.96, 0.96, 0.96]} />
      <meshStandardMaterial roughness={0.7} />
    </instancedMesh>
  );
}

function Ghost({ blocks, at, bad }: { blocks: TplBlock[]; at: [number, number, number]; bad: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    blocks.forEach((b, i) => {
      o.position.set(b.dx + at[0] - HALF + 0.5, b.dy + at[1] + 0.5, b.dz + at[2] - HALF + 0.5);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = blocks.length;
    m.instanceMatrix.needsUpdate = true;
  }, [blocks, at]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 900]} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={bad ? "#ff4d4d" : "#00f0ff"} transparent opacity={0.35} depthWrite={false} />
    </instancedMesh>
  );
}

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type ModuleRow = { id: string; name: string; author_address: string; blocks: TplBlock[]; bit_cost: number; tribute_sats: number; lineage: Contributor[]; uses: number; sphere: string };

function useCommunityModules() {
  return useQuery({
    queryKey: ["forge-modules"],
    staleTime: 60_000,
    queryFn: async (): Promise<Prefab[]> => {
      const { data } = await supabase.from("forge_modules").select("id, name, author_address, blocks, bit_cost, tribute_sats, lineage, uses, sphere").order("uses", { ascending: false }).limit(60);
      return ((data ?? []) as unknown as ModuleRow[]).map((r) => {
        const ins = inscribedIdOf(r.sphere);
        // Off-chain pieces are a free commons: no BIT, no sats, no paid lineage.
        return {
          id: r.id, name: r.name, sphere: "community" as Sphere, blocks: r.blocks, author: r.author_address,
          bitCost: ins ? r.bit_cost : 0, tributeSats: ins ? r.tribute_sats : 0, lineage: ins ? r.lineage ?? [] : [], inscriptionId: ins,
        };
      });
    },
  });
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function ForgePage() {
  const search = Route.useSearch();
  const wallet = useWalletSession();
  const [input, setInput] = useState(String(search.height ?? ""));
  const height = /^\d+$/.test(input) ? Number(input) : null;
  const { data: sizes } = useQuery({ ...blockSizeMapQuery(height ?? 0), enabled: height !== null });
  const txCount = sizes?.classes?.length ?? null;
  const rects = useMemo(() => parcelRects(sizes?.classes), [sizes]);
  const [focus, setFocus] = useState<number | null>(null);
  useEffect(() => setFocus(null), [height]);
  const focusRect = focus !== null ? rects[focus] ?? null : null;
  const addrs = wallet ? [wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean) as string[] : [];
  const owned = useQuery(heldHeightsQuery(addrs));
  const rightsFn = useServerFn(forgeRightsFn);
  const rights = useQuery({
    queryKey: ["forge-rights", height, wallet?.ordinalsAddress],
    enabled: height !== null && !!wallet,
    staleTime: 60_000,
    queryFn: () => rightsFn({ data: { height: height!, address: wallet!.ordinalsAddress } }),
  });
  const role = rights.data?.role ?? "none";
  const myParcels = rights.data?.parcels ?? [];
  useEffect(() => { if (role === "parcel" && myParcels.length && (focus === null || !myParcels.includes(focus))) setFocus(myParcels[0]!); }, [role, myParcels, focus]);
  // Reinscription spends the BITMAP's own sat, so only the BITMAP holder can sign it.
  const parcelTarget = role === "parcel" && focus !== null && myParcels.includes(focus) ? focus : undefined;
  const canInscribe = role === "bitmap" || parcelTarget !== undefined;
  const community = useCommunityModules();
  const stampFn = useServerFn(stampForgeModuleFn);
  const publishFn = useServerFn(publishForgeModuleFn);

  const [world, setWorld] = useState<Map<string, TplBlock>>(new Map());
  const [history, setHistory] = useState<Map<string, TplBlock>[]>([]);
  const [used, setUsed] = useState<Prefab[]>([]);
  const [sphere, setSphere] = useState<Sphere>("bricks");
  const [tool, setTool] = useState<Tool>("stamp");
  const [picked, setPicked] = useState<Prefab>(HOUSE_PREFABS[0]!);
  const [paint, setPaint] = useState<BlockId>("stone");
  const [turns, setTurns] = useState(0);
  const [layer, setLayer] = useState(0);
  const [hover, setHover] = useState<[number, number, number] | null>(null);
  const [guide, setGuide] = useState(true);
  const insValid = /^[a-f0-9]{64}i\d+$/.test(pub.ins);
  const [digest, setDigest] = useState<string | null>(null);
  const [pub, setPub] = useState({ name: "", bit: 10, sats: 1000 });
  const weekly = useMemo(() => weeklyBlueprint(), []);
  const [bpId, setBpId] = useState(weekly.id);
  const [bpStep, setBpStep] = useState(0);
  const [showBp, setShowBp] = useState(true);
  const bp = BLUEPRINTS.find((b) => b.id === bpId) ?? weekly;
  const sketch = useMemo(() => {
    const s = bp.steps[bpStep];
    if (!s) return [];
    return blueprintBlocks({ ...bp, steps: [s] }).filter((b) => !world.has(cellKey(b.dx, b.dy, b.dz))).slice(0, 900);
  }, [bp, bpStep, world]);
  const [dropIn, setDropIn] = useState("");
  useEffect(() => {
    const tick = () => { const ms = nextDropAt() - Date.now(); const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5); setDropIn(`${d}D ${h}H`); };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const blocks = useMemo(() => [...world.values()], [world]);
  const ghost = useMemo(() => {
    if (tool === "erase") return [];
    if (tool === "block") return [{ dx: 0, dy: 0, dz: 0, k: paint }];
    if (tool === "parcel") return [];
    return rotatePrefab(picked.blocks, turns);
  }, [tool, paint, picked, turns]);
  const hoverParcel = hover ? parcelAt(rects, hover[0], hover[2]) : null;
  const onTile = (x: number, z: number) => (focusRect ? inRect(focusRect, x, z) : !!parcelAt(rects, x, z));
  const ghostOut = !!(hover && (rects.length === 0 || ghost.some((b) => !onTile(b.dx + hover[0], b.dz + hover[2]))));
  const overLimit = blocks.length + (tool === "erase" ? 0 : ghost.length) > FORGE_MAX_BLOCKS;

  const commit = useCallback((next: Map<string, TplBlock>) => {
    setHistory((h) => [...h.slice(-30), world]);
    setWorld(next);
  }, [world]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "r" || e.key === "R") setTurns((t) => t + 1);
      if (e.key === "e" || e.key === "E") setLayer((l) => Math.min(FORGE_SPAN - 1, l + 1));
      if (e.key === "q" || e.key === "Q") setLayer((l) => Math.max(0, l - 1));
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const undo = () => setHistory((h) => { const last = h[h.length - 1]; if (last) setWorld(last); return h.slice(0, -1); });

  const place = async (): Promise<void> => {
    if (!hover) return;
    if (tool === "parcel") { const p = parcelAt(rects, hover[0], hover[2]); setFocus(p ? p.index : null); return; }
    if (tool === "erase") return;
    if (!rects.length) { toast.error("ENTER YOUR BITMAP NUMBER FIRST"); return; }
    if (!onTile(hover[0], hover[2])) { toast.error(focusRect ? `STAY INSIDE PARCEL #${focusRect.index}` : "NO PARCEL HERE — BUILD ONLY ON PARCEL TILES"); return; }
    if (overLimit) { toast.error(`BUILD LIMIT IS ${FORGE_MAX_BLOCKS} BLOCKS`); return; }
    if (tool === "stamp" && picked.author && (picked.bitCost ?? 0) > 0) {
      if (!wallet) { toast.error("CONNECT A WALLET TO USE PAID MODULES"); return; }
      const r = await stampFn({ data: { moduleId: picked.id, address: wallet.ordinalsAddress } }).catch(() => ({ ok: false as const, error: "SIGN IN TO USE PAID MODULES" }));
      if (!r.ok) { toast.error(r.error); return; }
      if (r.paid) toast.success(`PAID ${r.paid} BIT TO ${short(picked.author)}`);
    }
    const next = stampInto(world, ghost, hover[0], hover[1], hover[2]);
    for (const [k, b] of next) if (!world.has(k) && !onTile(b.dx, b.dz)) next.delete(k);
    commit(next);
    if (tool === "stamp" && picked.author && !used.some((u) => u.id === picked.id)) setUsed((u) => [...u, picked]);
  };

  // Tallest filled height per column, so pieces dropped on the floor stack on top automatically.
  const tops = useMemo(() => {
    const t = new Map<string, number>();
    for (const b of world.values()) { const k = `${b.dx},${b.dz}`; t.set(k, Math.max(t.get(k) ?? 0, b.dy + 1)); }
    return t;
  }, [world]);
  const onGround = (e: ThreeEvent<PointerEvent>) => {
    const x = Math.floor(e.point.x + HALF), z = Math.floor(e.point.z + HALF);
    if (x < 0 || z < 0 || x >= FORGE_SPAN || z >= FORGE_SPAN) return setHover(null);
    let y = layer;
    if (tool !== "erase") for (const b of ghost) y = Math.max(y, (tops.get(`${x + b.dx},${z + b.dz}`) ?? 0) - b.dy);
    setHover([x, Math.min(FORGE_SPAN - 1, y), z]);
  };

  const seed = (a: ArchetypeId) => {
    if (height === null) { toast.error("ENTER YOUR BITMAP NUMBER FIRST"); return; }
    const next = stampInto(new Map(), generateBuild(height, txCount, a), 0, 0, 0);
    for (const [k, b] of next) if (!onTile(b.dx, b.dz)) next.delete(k);
    commit(next);
  };

  const payouts = useMemo(() => tributeSplit(used.map((u) => u.lineage ?? [])), [used]);
  const payoutSats = payouts.reduce((n, p) => n + p.sats, 0);
  const lineage = used.map((u) => u.id.slice(0, 8)).join(",");
  const parcelBlocks = useMemo(() => (focusRect ? clipToParcel(blocks, focusRect) : blocks), [blocks, focusRect]);
  const html = useMemo(() => (height === null || !parcelBlocks.length ? "" : forgeInscriptionHtml(height, "studio", parcelBlocks, lineage, focusRect ?? undefined)), [height, parcelBlocks, lineage, focusRect]);
  const bytes = useMemo(() => new TextEncoder().encode(html).length, [html]);
  useEffect(() => {
    setDigest(null);
    if (!html) return;
    const t = setTimeout(() => void sha(`forge:${encodeBuild(blocks)}:${lineage}`).then(setDigest), 400);
    return () => clearTimeout(t);
  }, [html, blocks, lineage]);

  const publish = async (): Promise<void> => {
    if (!wallet) { toast.error("CONNECT A WALLET TO PUBLISH"); return; }
    if (blocks.length < 4) { toast.error("BUILD SOMETHING FIRST"); return; }
    if (blocks.length > 800) { toast.error("MODULES ARE CAPPED AT 800 BLOCKS — ERASE SOME FIRST"); return; }
    if (pub.ins && !insValid) { toast.error("THAT DOESN'T LOOK LIKE AN INSCRIPTION ID"); return; }
    const r = await publishFn({ data: {
      name: pub.name.trim() || "Untitled module", address: wallet.ordinalsAddress, blocks: normaliseModule(blocks),
      bitCost: insValid ? pub.bit : 0, tributeSats: insValid && pub.sats > 0 ? Math.max(546, pub.sats) : 0, parents: used.map((u) => u.id),
      inscriptionId: insValid ? pub.ins : null,
    } }).catch(() => ({ ok: false as const, error: "SIGN IN TO PUBLISH" }));
    if (!r.ok) { toast.error(r.error); return; }
    toast.success("MODULE PUBLISHED — OTHERS CAN NOW BUILD ON IT");
    void community.refetch();
  };

  const palette = sphere === "community" ? community.data ?? [] : HOUSE_PREFABS.filter((p) => p.sphere === sphere);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 font-mono">
      <p className="text-xs tracking-widest text-primary">LAND FORGE STUDIO · COMPOSABLE ON-CHAIN BUILDS</p>
      <h1 className="mt-2 font-display text-3xl text-foreground md:text-4xl">Build on Bitcoin. Build on each other.</h1>

      {guide && (
        <section className="mt-5 grid gap-3 rounded-lg border border-border bg-card/40 p-4 text-xs text-muted-foreground md:grid-cols-3">
          <div><p className="mb-1 text-primary">WHY IT LASTS</p>Your finished build is reinscribed onto the same sat as your BITMAP. It lives on Bitcoin, not on our servers — the newest build on that sat shows on ordinals.com, in the Oasis and on your BITMAP's page, older builds stay as its on-chain history, and it travels with the land when it sells.</div>
          <div><p className="mb-1 text-primary">HOW TO BUILD</p>Pick a piece, move over the grid, click to place. <b className="text-foreground">R</b> rotates, <b className="text-foreground">Q/E</b> change the floor level, <b className="text-foreground">Ctrl+Z</b> undoes. Start from your block's own seed, this week's blueprint, or from scratch.</div>
          <div><p className="mb-1 text-primary">WHO GETS PAID</p>Community pieces cost a small BIT fee to their maker each time you place them. When you inscribe, every maker in your build's family tree is paid in sats inside the same Bitcoin transaction. Publish your own pieces to earn too.</div>
          <button type="button" onClick={() => setGuide(false)} className="justify-self-start text-[10px] text-accent underline md:col-span-3">HIDE GUIDE</button>
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr_320px]">
        <aside className="space-y-3">
          <label className="block text-[11px] text-muted-foreground">
            YOUR BITMAP
            <input value={input} onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, ""))} placeholder="840000" className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground" />
          </label>
          {!wallet ? (
            <a href="/wallet" className="block rounded border border-primary bg-primary/10 px-2 py-1.5 text-center text-[11px] text-foreground">CONNECT WALLET TO BUILD YOUR LAND</a>
          ) : (
            <>
              {(owned.data?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="w-full text-[10px] text-muted-foreground">YOUR LAND · TAP TO BUILD</span>
                  {owned.data!.slice(0, 12).map((h) => (
                    <button key={h} type="button" onClick={() => setInput(String(h))} className={`rounded border px-2 py-0.5 text-[10px] ${height === h ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>{h}</button>
                  ))}
                </div>
              )}
              {height !== null && (
                <p className={`rounded border px-2 py-1 text-[10px] ${role === "bitmap" ? "border-primary text-primary" : role === "parcel" ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                  {rights.isLoading ? "CHECKING THE CHAIN…" : role === "bitmap" ? `✓ YOU HOLD ${height}.BITMAP` : role === "parcel" ? `✓ YOU HOLD PARCEL ${myParcels.map((p) => `#${p}`).join(", ")} · LOCKED TO YOUR TILE` : "PREVIEW ONLY · THIS WALLET DOESN'T HOLD THIS BITMAP"}
                </p>
              )}
            </>
          )}
          {rects.length > 0 && (
            <div className="rounded border border-primary/40 bg-card/40 p-2 text-[11px]">
              <p className="text-primary">BUILD TARGET</p>
              <p className="mt-1 text-muted-foreground">The floor shows this block's {rects.length.toLocaleString()} real transaction parcels. Use PARCEL and click a tile to build only on it.</p>
              <div className="mt-2 flex items-center gap-1">
                <button type="button" onClick={() => setFocus(null)} className={`rounded border px-2 py-0.5 text-[10px] ${focus === null ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>WHOLE BITMAP</button>
                <input type="number" min={0} max={rects.length - 1} value={focus ?? ""} placeholder="#" onChange={(e) => { const v = Number(e.target.value); setFocus(e.target.value === "" ? null : Math.max(0, Math.min(rects.length - 1, v))); }} className="w-20 rounded border border-border bg-background px-2 py-0.5 text-foreground" />
              </div>
              {focusRect && <p className="mt-1 text-accent">PARCEL {focusRect.index}.{height}.BITMAP · {focusRect.x1 - focusRect.x0}×{focusRect.z1 - focusRect.z0} CELLS</p>}
            </div>
          )}
          {tool === "block" && (
            <div className="grid grid-cols-4 gap-1">
              {BLOCKS.map((b) => (
                <button key={b.id} type="button" title={b.name} onClick={() => setPaint(b.id)} className={`h-8 rounded border ${paint === b.id ? "border-primary" : "border-border"}`} style={{ background: b.top }} />
              ))}
            </div>
          )}
          {tool === "stamp" && (
            <>
              <div className="flex flex-wrap gap-1">
                {SPHERES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSphere(s.id)} className={`rounded border px-2 py-0.5 text-[10px] ${sphere === s.id ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>{s.name}</button>
                ))}
              </div>
              <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
                {palette.length === 0 && <p className="text-[11px] text-muted-foreground">No community pieces yet. Build one and publish it to be the first maker.</p>}
                {palette.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPicked(p)} className={`w-full rounded border px-2 py-1.5 text-left text-[11px] ${picked.id === p.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    <span className="block text-foreground">{p.name}{p.inscriptionId && <span className="ml-1 rounded border border-accent px-1 text-[9px] text-accent">ON-CHAIN</span>}</span>
                    {p.blocks.length} blocks{p.author ? ` · ${short(p.author)}` : ""}{p.inscriptionId ? ` · ${p.bitCost ?? 0} BIT · ${p.tributeSats ?? 0} sats` : " · free"}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="rounded border border-accent/40 bg-card/40 p-2 text-[11px]">
            <div className="flex items-center justify-between"><span className="text-accent">BLUEPRINTS</span><span className="text-[10px] text-muted-foreground">NEXT DROP {dropIn}</span></div>
            <select value={bp.id} onChange={(e) => { setBpId(e.target.value); setBpStep(0); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground">
              {BLUEPRINTS.map((b) => <option key={b.id} value={b.id}>{b.id === weekly.id ? `★ WEEK ${weekNumber()} · ` : ""}{b.name}</option>)}
            </select>
            <p className="mt-1 text-muted-foreground">{bp.story}</p>
            <ol className="mt-2 space-y-1">
              {bp.steps.map((s, i) => (
                <li key={s.title} className={`rounded border px-2 py-1 ${i === bpStep ? "border-accent text-foreground" : i < bpStep ? "border-border text-muted-foreground line-through" : "border-border text-muted-foreground"}`}>
                  <b>{i + 1}. {s.title}</b> — {s.tip}
                </li>
              ))}
            </ol>
            <div className="mt-2 flex flex-wrap gap-1">
              <button type="button" onClick={() => setShowBp((v) => !v)} className="rounded border border-border px-2 py-0.5 text-[10px] text-foreground">{showBp ? "HIDE SKETCH" : "SHOW SKETCH"}</button>
              <button type="button" disabled={bpStep >= bp.steps.length} onClick={() => { commit(stampInto(world, blueprintBlocks({ ...bp, steps: [bp.steps[bpStep]!] }), 0, 0, 0)); setBpStep((s) => s + 1); }} className="rounded border border-accent px-2 py-0.5 text-[10px] text-accent disabled:opacity-40">BUILD STEP {Math.min(bpStep + 1, bp.steps.length)}</button>
              <button type="button" onClick={() => setBpStep((s) => Math.min(bp.steps.length, s + 1))} className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground">I BUILT IT</button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-muted-foreground">START FROM YOUR BLOCK'S SEED</p>
            <div className="flex flex-wrap gap-1">
              {ARCHETYPES.map((a) => (
                <button key={a.id} type="button" title={a.blurb} onClick={() => seed(a.id)} className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary">{a.name}</button>
              ))}
            </div>
          </div>
        </aside>

        <div className="relative h-[560px] overflow-hidden rounded-lg border border-border bg-card/40">
          <SafeCanvas shadows camera={{ position: [40, 38, 40], fov: 45 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[20, 40, 10]} intensity={1.2} castShadow />
            <Blocks blocks={blocks} erase={tool === "erase"} onErase={(b) => { const n = new Map(world); n.delete(cellKey(b.dx, b.dy, b.dz)); commit(n); }} onSurface={(c) => { if (c && tool !== "parcel") setHover(c); }} onPlace={() => void place()} />
            {hover && ghost.length > 0 && <Ghost blocks={ghost} at={hover} bad={overLimit || ghostOut} />}
            <ParcelFloor rects={rects} focus={focus} hoverIdx={hoverParcel?.index ?? null} />
            {showBp && sketch.length > 0 && <Ghost blocks={sketch} at={[0, 0, 0]} bad={false} />}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, layer, 0]} onPointerMove={onGround} onPointerLeave={() => setHover(null)} onClick={() => void place()} receiveShadow>
              <planeGeometry args={[FORGE_SPAN, FORGE_SPAN]} />
              <meshStandardMaterial color="#1b1f26" transparent opacity={layer ? 0.25 : 1} />
            </mesh>
            <gridHelper args={[FORGE_SPAN, FORGE_SPAN, "#2c3440", "#222831"]} position={[0, layer + 0.01, 0]} />
            <OrbitControls enablePan={false} makeDefault maxPolarAngle={Math.PI / 2.1} />
          </SafeCanvas>
          <div className="pointer-events-none absolute left-3 top-3 rounded border border-border bg-background/70 px-2 py-1 text-[11px] text-accent backdrop-blur">
            {height !== null ? `${height.toLocaleString()}.BITMAP · ` : ""}{(bytes / 1024).toFixed(1)} KB · ROT {(turns % 4) * 90}°{hoverParcel ? ` · TILE ${hoverParcel.index}.${height}` : ""}{focusRect ? ` · BUILDING ON PARCEL #${focusRect.index}` : ""}
          </div>
          <div className="pointer-events-none absolute right-3 top-3 w-36 rounded border border-border bg-background/70 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
            <div className="flex justify-between"><span>BLOCKS</span><span className={blocks.length > FORGE_MAX_BLOCKS * 0.85 ? "text-primary" : "text-accent"}>{blocks.length}/{FORGE_MAX_BLOCKS}</span></div>
            <div className="mt-1 h-1 overflow-hidden rounded bg-muted"><div className={`h-full ${blocks.length > FORGE_MAX_BLOCKS * 0.85 ? "bg-primary" : "bg-accent"}`} style={{ width: `${Math.min(100, (blocks.length / FORGE_MAX_BLOCKS) * 100)}%` }} /></div>
          </div>
          <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-1.5 px-2">
            <p className="pointer-events-none rounded bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
              {tool === "erase" ? "CLICK A BLOCK TO REMOVE IT" : tool === "parcel" ? "CLICK A TILE TO BUILD ONLY ON IT" : "POINT AT ANY SURFACE · CLICK TO PLACE · IT STACKS ON TOP"} · R ROTATE · CTRL+Z UNDO
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1 rounded-lg border border-border bg-background/80 p-1 backdrop-blur">
              {(["stamp", "block", "erase", "parcel"] as Tool[]).map((t) => (
                <button key={t} type="button" onClick={() => setTool(t)} className={`rounded px-2.5 py-1 text-[10px] ${tool === t ? "bg-primary/15 text-foreground ring-1 ring-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {t === "stamp" ? "PIECES" : t === "block" ? "BLOCK" : t === "erase" ? "ERASE" : "PARCEL"}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border" />
              <button type="button" onClick={() => setTurns((t) => t + 1)} className="rounded px-2 py-1 text-[10px] text-foreground hover:bg-muted">⟳ ROTATE</button>
              <button type="button" onClick={undo} className="rounded px-2 py-1 text-[10px] text-foreground hover:bg-muted">↶ UNDO</button>
              <button type="button" title="Floor level (Q/E) — only needed to build in mid-air" onClick={() => setLayer((l) => Math.max(0, l - 1))} className="rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted">−</button>
              <span className="text-[10px] text-muted-foreground">LVL {layer}</span>
              <button type="button" title="Floor level (Q/E) — only needed to build in mid-air" onClick={() => setLayer((l) => Math.min(FORGE_SPAN - 1, l + 1))} className="rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted">+</button>
              <button type="button" onClick={() => { commit(new Map()); setUsed([]); }} className="rounded px-2 py-1 text-[10px] text-destructive hover:bg-muted">CLEAR</button>
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded border border-border bg-card/40 p-3 text-[11px]">
            <p className="mb-2 text-primary">MAKERS IN THIS BUILD</p>
            {payouts.length === 0 ? (
              <p className="text-muted-foreground">Only free pieces so far. Community pieces you place show up here with their sat share.</p>
            ) : (
              <ul className="space-y-1">
                {payouts.map((p) => <li key={p.address} className="flex justify-between text-foreground"><span>{short(p.address)}</span><span className="text-accent">{p.sats.toLocaleString()} sats</span></li>)}
                <li className="flex justify-between border-t border-border pt-1 text-muted-foreground"><span>PAID ON INSCRIBE</span><span>{payoutSats.toLocaleString()} sats</span></li>
              </ul>
            )}
          </div>

          {height !== null && !canInscribe ? (
            <p className="rounded border border-border p-3 text-[11px] text-muted-foreground">
              {role === "parcel"
                ? `Pick one of your parcels (${myParcels.map((p) => `#${p}`).join(", ")}) to inscribe your build onto its own sat.`
                : "Inscribing unlocks once your connected wallet holds this BITMAP."}
            </p>
          ) : height !== null && digest && blocks.length > 0 ? (
            <div className="rounded border border-border bg-card/40 p-3">
              <ShadowInscriber
                key={digest}
                slug={`forge-${height}`}
                height={height}
                index={0}
                digest={digest}
                artifactLabel={parcelTarget !== undefined ? `REINSCRIBE YOUR BUILD ON PARCEL #${parcelTarget}'S SAT` : focusRect ? `REINSCRIBE PARCEL #${focusRect.index} BUILD ON THE BITMAP'S SAT` : "REINSCRIBE YOUR BUILD ON THE BITMAP'S SAT"}
                actionLabel="INSCRIBE ON BITCOIN"
                description={parcelTarget !== undefined ? `Your wallet must hold parcel #${parcelTarget} of ${height}.bitmap. The build is stamped onto your parcel's own sat and shows on its tile on the BITMAP and in the Oasis.${payoutSats ? ` ${payoutSats.toLocaleString()} sats go to the makers listed above in that same transaction.` : ""}` : `Your wallet must hold ${height}.bitmap. The build is stamped onto the very same sat as your BITMAP, which returns to you in the same transaction.${payoutSats ? ` ${payoutSats.toLocaleString()} sats go to the makers listed above in that same transaction.` : ""}`}
                allowUpload={false}
                claimParentsForHeight={height}
                reinscribeOnBitmap
                {...(parcelTarget !== undefined ? { parcelIndex: parcelTarget } : {})}
                artifactVariants={[
                  ...(FORGE_MASTER_DELEGATE_ID ? [{ key: "lean", label: "LEAN BUILD", contentType: "text/html;charset=utf-8", source: html, note: `Drawn by the shared on-chain Forge renderer — about ${delegateSavings(html, forgeDelegateMetadata(height, encodeBuild(parcelBlocks), lineage, focusRect ?? undefined)).saved.toLocaleString()} fewer bytes to pay for.`, delegate: FORGE_MASTER_DELEGATE_ID, metadata: forgeDelegateMetadata(height, encodeBuild(parcelBlocks), lineage, focusRect ?? undefined), ...(payouts.length ? { tributes: payouts } : {}) }] : []),
                  { key: "html", label: "3D BUILD", contentType: "text/html;charset=utf-8", source: html, note: "Self-rendering build, no outside code.", ...(payouts.length ? { tributes: payouts } : {}) },
                ]}
              />
            </div>
          ) : (
            <p className="rounded border border-border p-3 text-[11px] text-muted-foreground">Enter your BITMAP number and place some blocks to inscribe.</p>
          )}

          <div className="rounded border border-border bg-card/40 p-3 text-[11px]">
            <p className="mb-2 text-primary">PUBLISH AS A REUSABLE PIECE</p>
            <p className="mb-2 text-muted-foreground">Uninscribed pieces are free for everyone to use. To earn BIT and sats, inscribe your piece first and paste its inscription ID — only pieces on Bitcoin can charge.</p>
            <input value={pub.name} onChange={(e) => setPub({ ...pub, name: e.target.value.slice(0, 40) })} placeholder="Piece name" className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            <input value={pub.ins} onChange={(e) => setPub({ ...pub, ins: e.target.value.trim().toLowerCase() })} placeholder="Inscription ID (optional, unlocks royalties)" className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            <div className={`mb-2 grid grid-cols-2 gap-2 ${insValid ? "" : "opacity-40"}`}>
              <label className="text-muted-foreground">BIT / USE<input type="number" disabled={!insValid} min={0} max={500} value={insValid ? pub.bit : 0} onChange={(e) => setPub({ ...pub, bit: Math.max(0, Math.min(500, Number(e.target.value) || 0)) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground" /></label>
              <label className="text-muted-foreground">SATS / INSCRIBE<input type="number" disabled={!insValid} min={0} max={100000} value={insValid ? pub.sats : 0} onChange={(e) => setPub({ ...pub, sats: Math.max(0, Math.min(100000, Number(e.target.value) || 0)) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground" /></label>
            </div>
            <button type="button" onClick={() => void publish()} className="w-full rounded border border-primary bg-primary/10 px-2 py-1.5 text-foreground">{insValid ? "PUBLISH ON-CHAIN PIECE" : "PUBLISH FREE PIECE"}</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Want to walk it first? <a href={height !== null ? `/oasis?height=${height}` : "/oasis"} className="text-accent underline">Open the Oasis</a>.</p>
        </aside>
      </div>
    </main>
  );
}
