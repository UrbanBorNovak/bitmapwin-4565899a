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
import { ARCHETYPES, FORGE_MAX_BLOCKS, FORGE_SPAN, encodeBuild, encodeBuildBest, FORGE_UNPACK_JS, forgeInscriptionHtml, generateBuild, type ArchetypeId } from "@/lib/voxel-populate";
import { HOUSE_PREFABS, SPHERES, cellKey, normaliseModule, rotatePrefab, stampInto, tributeSplit, type Contributor, type Prefab, type Sphere } from "@/lib/forge-prefabs";
import { BLUEPRINTS, blueprintBlocks, nextDropAt, weekNumber, weeklyBlueprint } from "@/lib/forge-blueprints";
import { clipToParcel, inRect, parcelAt, parcelRects, type ParcelRect } from "@/lib/forge-parcels";
import { publishForgeModuleFn, stampForgeModuleFn } from "@/lib/forge-modules.functions";
import { supabase } from "@/integrations/supabase/client";
import { useWalletSession } from "@/lib/wallet-session";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { forgeRightsFn } from "@/lib/forge-rights.functions";
import { forgePieceFn } from "@/lib/forge-parts.functions";
import { collectionPiecesQuery } from "@/lib/forge-collection.functions";
import { DONATION_ADDRESS } from "@/lib/donations";
import { forgeAssemblyHtml, isInscriptionId, normPart, type AsmPart } from "@/lib/forge-assembly";
import { bakeGuardian } from "@/lib/forge-guardian-bake";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { OnchainGuardianBody } from "@/components/bitmon/OnchainGuardianBody";

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
type Tool = "stamp" | "block" | "box" | "erase" | "perch" | "parcel";
type Placement = { part: AsmPart; keys: string[] };

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

type ModuleRow = { id: string; name: string; author_address: string; blocks: TplBlock[]; bit_cost: number; tribute_sats: number; lineage: Contributor[]; uses: number };

function useCommunityModules() {
  return useQuery({
    queryKey: ["forge-modules"],
    staleTime: 60_000,
    queryFn: async (): Promise<Prefab[]> => {
      const { data } = await supabase.from("forge_modules").select("id, name, author_address, blocks, bit_cost, tribute_sats, lineage, uses").order("uses", { ascending: false }).limit(60);
      return ((data ?? []) as unknown as ModuleRow[]).map((r) => ({
        id: r.id, name: r.name, sphere: "community" as Sphere, blocks: r.blocks, author: r.author_address,
        bitCost: r.bit_cost, tributeSats: r.tribute_sats, lineage: r.lineage ?? [],
      }));
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

  // On-chain pieces: imported by inscription id, placed by reference (not copied) in a recursive assembly.
  const pieceFn = useServerFn(forgePieceFn);
  const [pieceId, setPieceId] = useState("");
  const [pieceBusy, setPieceBusy] = useState(false);
  const [chainPieces, setChainPieces] = useState<Prefab[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [boxStart, setBoxStart] = useState<[number, number, number] | null>(null);
  const [perch, setPerch] = useState<[number, number, number] | null>(null);
  const dnaQ = useQuery({ ...guardianDnaQuery(height ?? 0), enabled: height !== null });
  useEffect(() => { setPerch(null); setBoxStart(null); }, [height]);
  const collectionQ = useQuery(collectionPiecesQuery());
  const [makers, setMakers] = useState<Record<string, string>>({});
  const [siteTribute, setSiteTribute] = useState(true);
  const loadPiece = async (given?: string, maker?: string | null): Promise<void> => {
    const id = (given ?? pieceId).trim();
    if (!isInscriptionId(id)) { toast.error("PASTE A FULL INSCRIPTION ID (…i0)"); return; }
    setPieceBusy(true);
    const r = await pieceFn({ data: { id } }).catch(() => ({ ok: false as const, error: "COULD NOT REACH BITCOIN — TRY AGAIN" }));
    setPieceBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    const p: Prefab = { id: `ins:${id}`, name: `◆ ${id.slice(0, 8)}…${id.slice(-4)}`, sphere: "community" as Sphere, blocks: normPart(r.blocks) } as Prefab;
    setChainPieces((c) => [p, ...c.filter((x) => x.id !== p.id)].slice(0, 12));
    if (maker) setMakers((m) => ({ ...m, [id]: maker }));
    setPicked(p); setTool("stamp"); setPieceId("");
    toast.success(`LOADED ${r.blocks.length} VOXELS FROM BITCOIN — CLICK TO SNAP IT IN`);
  };

  const blocks = useMemo(() => [...world.values()], [world]);
  const ghost = useMemo(() => {
    if (tool === "erase" || tool === "parcel" || tool === "perch") return [];
    if (tool === "block" || tool === "box") return [{ dx: 0, dy: 0, dz: 0, k: paint }];
    return rotatePrefab(picked.blocks, turns);
  }, [tool, paint, picked, turns]);
  const boxGhost = useMemo(() => {
    if (tool !== "box" || !boxStart || !hover) return [];
    const out: TplBlock[] = [];
    const [x0, x1] = [Math.min(boxStart[0], hover[0]), Math.max(boxStart[0], hover[0])];
    const [y0, y1] = [Math.min(boxStart[1], hover[1]), Math.max(boxStart[1], hover[1])];
    const [z0, z1] = [Math.min(boxStart[2], hover[2]), Math.max(boxStart[2], hover[2])];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) out.push({ dx: x, dy: y, dz: z, k: paint });
    return out.slice(0, FORGE_MAX_BLOCKS);
  }, [tool, boxStart, hover, paint]);
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
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === "b" || e.key === "B") setTool("block");
      if (e.key === "s" || e.key === "S") setTool("stamp");
      if (e.key === "x" || e.key === "X") setTool("erase");
      if (e.key === "p" || e.key === "P") setTool("parcel");
      if (e.key === "w" || e.key === "W") { setTool("box"); setBoxStart(null); }
      if (e.key === "g" || e.key === "G") setTool("perch");
      if (e.key === "Escape") setBoxStart(null);
      if (/^[0-9]$/.test(e.key)) { const b = BLOCKS[(Number(e.key) + 9) % 10]; if (b) { setPaint(b.id); setTool("block"); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const undo = () => setHistory((h) => { const last = h[h.length - 1]; if (last) setWorld(last); return h.slice(0, -1); });

  const place = async (): Promise<void> => {
    if (!hover) return;
    if (tool === "parcel") { const p = parcelAt(rects, hover[0], hover[2]); setFocus(p ? p.index : null); return; }
    if (tool === "erase") return;
    if (tool === "perch") {
      if (!dnaQ.data) { toast.error("THIS BLOCK'S GUARDIAN IS STILL LOADING"); return; }
      setPerch(hover); toast.success("GUARDIAN PERCHED — IT WILL LIVE ON THIS BUILD"); return;
    }
    if (!rects.length) { toast.error("ENTER YOUR BITMAP NUMBER FIRST"); return; }
    if (!onTile(hover[0], hover[2])) { toast.error(focusRect ? `STAY INSIDE PARCEL #${focusRect.index}` : "NO PARCEL HERE — BUILD ONLY ON PARCEL TILES"); return; }
    if (tool === "box") {
      if (!boxStart) { setBoxStart(hover); return; }
      let next = new Map(world);
      for (const b of boxGhost) if (onTile(b.dx, b.dz)) next.set(cellKey(b.dx, b.dy, b.dz), b);
      if (next.size > FORGE_MAX_BLOCKS) { toast.error(`BUILD LIMIT IS ${FORGE_MAX_BLOCKS} BLOCKS`); next = world; }
      setBoxStart(null);
      if (next !== world) commit(next);
      return;
    }
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
    if (tool === "stamp" && picked.id.startsWith("ins:")) {
      const keys = [...next.keys()].filter((k) => !world.has(k));
      if (keys.length) setPlacements((p) => [...p, { part: { id: picked.id.slice(4), x: hover[0], y: hover[1], z: hover[2], r: ((turns % 4) + 4) % 4 }, keys }]);
    }
    if (tool === "stamp" && picked.author && !used.some((u) => u.id === picked.id)) setUsed((u) => [...u, picked]);
  };

  /** Erasing one block of an inscribed piece removes the whole piece (it is placed by reference). */
  const eraseAt = (b: TplBlock) => {
    const key = cellKey(b.dx, b.dy, b.dz);
    const hit = placements.find((p) => p.keys.includes(key));
    const n = new Map(world);
    if (hit) { for (const k of hit.keys) n.delete(k); setPlacements((p) => p.filter((x) => x !== hit)); }
    else n.delete(key);
    commit(n);
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
    if (tool === "perch") y = Math.max(y, tops.get(`${x},${z}`) ?? 0);
    else if (tool !== "erase" && !(tool === "box" && boxStart)) for (const b of ghost) y = Math.max(y, (tops.get(`${x + b.dx},${z + b.dz}`) ?? 0) - b.dy);
    else if (tool === "box" && boxStart) y = Math.max(layer, boxStart[1]);
    setHover([x, Math.min(FORGE_SPAN - 1, y), z]);
  };
  const autoPerch = () => {
    let best: [number, number, number] | null = null;
    for (const [k, t] of tops) { const [x, z] = k.split(",").map(Number); if (!best || t > best[1]) best = [x!, t, z!]; }
    setPerch(best ?? [32, 0, 32]);
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
  // Recursive assembly: inscribed pieces by reference + own blocks + the block's baked Guardian.
  const livePlacements = useMemo(() => placements.filter((p) => p.keys.some((k) => world.has(k))), [placements, world]);
  const asmHtml = useMemo(() => {
    if (height === null || (!livePlacements.length && !perch)) return "";
    const taken = new Set(livePlacements.flatMap((p) => p.keys));
    const own = parcelBlocks.filter((b) => !taken.has(cellKey(b.dx, b.dy, b.dz)));
    const guardian = perch && dnaQ.data ? { data: bakeGuardian(dnaQ.data), at: perch } : null;
    return forgeAssemblyHtml(height, livePlacements.map((p) => p.part), own, guardian, lineage);
  }, [height, livePlacements, perch, parcelBlocks, dnaQ.data, lineage]);
  const asmBytes = useMemo(() => new TextEncoder().encode(asmHtml).length, [asmHtml]);
  const bytes = useMemo(() => new TextEncoder().encode(html).length, [html]);
  useEffect(() => {
    setDigest(null);
    if (!html && !asmHtml) return;
    const t = setTimeout(() => void sha(`forge:${encodeBuild(blocks)}:${lineage}:${asmHtml.length}:${perch?.join(",") ?? ""}`).then(setDigest), 400);
    return () => clearTimeout(t);
  }, [html, asmHtml, blocks, lineage, perch]);

  const publish = async (): Promise<void> => {
    if (!wallet) { toast.error("CONNECT A WALLET TO PUBLISH"); return; }
    if (blocks.length < 4) { toast.error("BUILD SOMETHING FIRST"); return; }
    if (blocks.length > 800) { toast.error("MODULES ARE CAPPED AT 800 BLOCKS — ERASE SOME FIRST"); return; }
    const r = await publishFn({ data: {
      name: pub.name.trim() || "Untitled module", address: wallet.ordinalsAddress, blocks: normaliseModule(blocks),
      bitCost: pub.bit, tributeSats: pub.sats > 0 ? Math.max(546, pub.sats) : 0, parents: used.map((u) => u.id),
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
          <div className="rounded border border-primary/40 bg-card/40 p-2 text-[11px]">
            <p className="text-primary">ON-CHAIN PIECES</p>
            <p className="mt-1 text-muted-foreground">Paste the inscription ID of any Land Forge build. It snaps in by reference — your inscription points at it instead of paying for its blocks again.</p>
            <div className="mt-2 flex gap-1">
              <input value={pieceId} onChange={(e) => setPieceId(e.target.value.trim())} onKeyDown={(e) => { if (e.key === "Enter") void loadPiece(); }} placeholder="f6b0…i0" className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-foreground" />
              <button type="button" disabled={pieceBusy} onClick={() => void loadPiece()} className="rounded border border-primary bg-primary/10 px-2 py-1 text-[10px] text-foreground disabled:opacity-40">{pieceBusy ? "…" : "LOAD"}</button>
            </div>
            {chainPieces.length > 0 && (
              <div className="mt-2 space-y-1">
                {chainPieces.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setPicked(p); setTool("stamp"); }} className={`w-full rounded border px-2 py-1 text-left text-[10px] ${picked.id === p.id && tool === "stamp" ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>
                    {p.name} · {p.blocks.length} voxels · {placements.filter((x) => `ins:${x.part.id}` === p.id && x.keys.some((k) => world.has(k))).length} placed
                  </button>
                ))}
              </div>
            )}
          </div>
          {height !== null && (
            <div className="rounded border border-accent/40 bg-card/40 p-2 text-[11px]">
              <p className="text-accent">GUARDIAN PERCH</p>
              <p className="mt-1 text-muted-foreground">{dnaQ.data ? "Your block's Guardian lives on the build, in the same inscription, drawn from its on-chain design." : "Loading this block's Guardian…"}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <button type="button" onClick={() => setTool("perch")} className={`rounded border px-2 py-0.5 text-[10px] ${tool === "perch" ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>PLACE (G)</button>
                <button type="button" disabled={!dnaQ.data} onClick={autoPerch} className="rounded border border-border px-2 py-0.5 text-[10px] text-foreground disabled:opacity-40">ON TOP</button>
                {perch && <button type="button" onClick={() => setPerch(null)} className="rounded border border-border px-2 py-0.5 text-[10px] text-destructive">REMOVE</button>}
              </div>
            </div>
          )}
          {(tool === "block" || tool === "box") && (
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
                    <span className="block text-foreground">{p.name}</span>
                    {p.blocks.length} blocks{p.author ? ` · ${short(p.author)} · ${p.bitCost ?? 0} BIT · ${p.tributeSats ?? 0} sats` : " · free"}
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
            <Blocks blocks={blocks} erase={tool === "erase"} onErase={eraseAt} onSurface={(c) => { if (c && tool !== "parcel") setHover(c); }} onPlace={() => void place()} />
            {hover && ghost.length > 0 && boxGhost.length === 0 && <Ghost blocks={ghost} at={hover} bad={overLimit || ghostOut} />}
            {boxGhost.length > 0 && <Ghost blocks={boxGhost} at={[0, 0, 0]} bad={blocks.length + boxGhost.length > FORGE_MAX_BLOCKS} />}
            {perch && dnaQ.data && (
              <group position={[perch[0] - HALF + 0.5, perch[1], perch[2] - HALF + 0.5]} scale={0.36}>
                <OnchainGuardianBody dna={dnaQ.data} />
              </group>
            )}
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
              {tool === "erase" ? "CLICK A BLOCK TO REMOVE IT" : tool === "parcel" ? "CLICK A TILE TO BUILD ONLY ON IT" : tool === "box" ? (boxStart ? "CLICK THE OPPOSITE CORNER TO FILL · ESC CANCELS" : "CLICK ONE CORNER OF A WALL, FLOOR OR BOX") : tool === "perch" ? "CLICK WHERE YOUR GUARDIAN SHOULD LIVE" : "POINT AT ANY SURFACE · CLICK TO PLACE · IT STACKS ON TOP"} · R ROTATE · CTRL+Z UNDO
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1 rounded-lg border border-border bg-background/80 p-1 backdrop-blur">
              {(["stamp", "block", "box", "erase", "perch", "parcel"] as Tool[]).map((t) => (
                <button key={t} type="button" onClick={() => { setTool(t); setBoxStart(null); }} className={`rounded px-2.5 py-1 text-[10px] ${tool === t ? "bg-primary/15 text-foreground ring-1 ring-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {t === "stamp" ? "PIECES (S)" : t === "block" ? "BLOCK (B)" : t === "box" ? "BOX (W)" : t === "erase" ? "ERASE (X)" : t === "perch" ? "GUARDIAN (G)" : "PARCEL (P)"}
                </button>
              ))}
              {(tool === "block" || tool === "box") && (
                <>
                  <span className="mx-1 h-4 w-px bg-border" />
                  {BLOCKS.map((b, i) => (
                    <button key={b.id} type="button" title={`${b.name} (${(i + 1) % 10})`} onClick={() => setPaint(b.id)} className={`h-5 w-5 rounded-sm border ${paint === b.id ? "border-primary ring-1 ring-primary" : "border-border"}`} style={{ background: b.top }} />
                  ))}
                </>
              )}
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
              {(() => {
                const raw = atob(encodeBuild(blocks)).length;
                const best = encodeBuildBest(blocks);
                const packed = atob(best.data).length;
                const sats = (b: number) => Math.ceil(b / 4) * 5;
                return (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 font-mono text-[11px]">
                    <span>
                      <span className="text-muted-foreground">BLOCK DATA </span>{raw.toLocaleString()} B → <span className="text-primary">{packed.toLocaleString()} B {best.format}</span>
                      {raw > packed ? <span className="text-muted-foreground"> · saves ~{(sats(raw) - sats(packed)).toLocaleString()} sats at 5 sat/vB</span> : null}
                    </span>
                    <button type="button" className="rounded border border-border px-2 py-0.5 hover:bg-card" onClick={() => void navigator.clipboard.writeText(FORGE_UNPACK_JS).then(() => toast.success("Unpacker copied — thank you for building!"))}>COPY UNPACKER JS</button>
                  </div>
                );
              })()}
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
                  ...(asmHtml ? [{ key: "asm", label: livePlacements.length ? "RECURSIVE BUILD" : "BUILD + GUARDIAN", contentType: "text/html;charset=utf-8", source: asmHtml, note: `${livePlacements.length} inscribed piece${livePlacements.length === 1 ? "" : "s"} pulled live from Bitcoin${perch ? " · your Guardian perched on top" : ""} · ${(asmBytes / 1024).toFixed(1)} KB.`, ...(payouts.length ? { tributes: payouts } : {}) }] : []),
                  ...(FORGE_MASTER_DELEGATE_ID ? (() => { const best = encodeBuildBest(parcelBlocks); const meta = forgeDelegateMetadata(height, best.data, lineage, focusRect ?? undefined, best.format); return [{ key: "lean", label: "LEAN BUILD", contentType: "text/html;charset=utf-8", source: html, note: `Drawn by the shared on-chain Forge renderer (${best.format}) — about ${delegateSavings(html, meta).saved.toLocaleString()} fewer bytes to pay for.`, delegate: FORGE_MASTER_DELEGATE_ID, metadata: meta, ...(payouts.length ? { tributes: payouts } : {}) }]; })() : []),
                  { key: "html", label: "3D BUILD", contentType: "text/html;charset=utf-8", source: html, note: "Self-rendering build, no outside code.", ...(payouts.length ? { tributes: payouts } : {}) },
                ]}
              />
            </div>
          ) : (
            <p className="rounded border border-border p-3 text-[11px] text-muted-foreground">Enter your BITMAP number and place some blocks to inscribe.</p>
          )}

          <div className="rounded border border-border bg-card/40 p-3 text-[11px]">
            <p className="mb-2 text-primary">PUBLISH AS A REUSABLE PIECE</p>
            <p className="mb-2 text-muted-foreground">Others can drop it into their own builds. You earn BIT each time it's placed and sats each time a build using it is inscribed — and so do the makers of the pieces you used.</p>
            <input value={pub.name} onChange={(e) => setPub({ ...pub, name: e.target.value.slice(0, 40) })} placeholder="Piece name" className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            <div className="mb-2 grid grid-cols-2 gap-2">
              <label className="text-muted-foreground">BIT / USE<input type="number" min={0} max={500} value={pub.bit} onChange={(e) => setPub({ ...pub, bit: Math.max(0, Math.min(500, Number(e.target.value) || 0)) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground" /></label>
              <label className="text-muted-foreground">SATS / INSCRIBE<input type="number" min={0} max={100000} value={pub.sats} onChange={(e) => setPub({ ...pub, sats: Math.max(0, Math.min(100000, Number(e.target.value) || 0)) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground" /></label>
            </div>
            <button type="button" onClick={() => void publish()} className="w-full rounded border border-primary bg-primary/10 px-2 py-1.5 text-foreground">PUBLISH PIECE</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Want to walk it first? <a href={height !== null ? `/oasis?height=${height}` : "/oasis"} className="text-accent underline">Open the Oasis</a>.</p>
        </aside>
      </div>
    </main>
  );
}
