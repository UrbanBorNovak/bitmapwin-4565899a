import { isLive, type AsmPlacement } from "@/lib/forge-assembly";
import { InfoTip } from "@/components/InfoTip";
import { createFileRoute } from "@tanstack/react-router";
import { OtherthingsBadge } from "@/components/OtherthingsBadge";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { PlacedModel } from "@/components/forge/PlacedModel";
import { ShadowInscriber } from "@/components/territory/ShadowInscriber";
import { FORGE_MASTER_DELEGATE_ID, delegateSavings, forgeDelegateMetadata } from "@/lib/forge-delegate";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { BLOCKS, type BlockId } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { RegistryDrawer } from "@/components/forge/RegistryDrawer";
import { ARCHETYPES, FORGE_MAX_BLOCKS, FORGE_RENDER_MAX, FORGE_SPAN, FORGE_SPAN_XL, type ForgeSpan, decodeBuild, encodeBuild, encodeBuildBest, FORGE_UNPACK_JS, forgeInscriptionHtml, generateBuild, type ArchetypeId } from "@/lib/voxel-populate";
import { forgeBuildQuery } from "@/lib/forge";
import { HOUSE_PREFABS, SPHERES, cellKey, normaliseModule, rotatePrefab, stampInto, tributeSplit, type Contributor, type Prefab, type Sphere } from "@/lib/forge-prefabs";
import { BLUEPRINTS, blueprintBlocks, nextDropAt, weekNumber, weeklyBlueprint, type Blueprint } from "@/lib/forge-blueprints";
import { BEHAVIOR_CARDS, KITS, isKit, kitManifest, type BehaviorCard } from "@/lib/forge-kits";
import { KitBox } from "@/components/forge/KitBox";
import { ProvenanceCard } from "@/components/forge/ProvenanceCard";
import { CommunityKitShelf, PackageKit, useCommunityKits } from "@/components/forge/PackageKit";
import { KitThumb } from "@/components/forge/KitThumb";
import { KitBehaviorPreview } from "@/components/forge/KitBehaviorPreview";
import { clipToParcel, inRect, parcelAt, parcelRects, type ParcelRect } from "@/lib/forge-parcels";
import { parcelOutpost } from "@/lib/parcel-foundry";
import { LAND_MASSES, terrainHeight, type LandMass } from "@/lib/forge-terrain";
import { publishForgeModuleFn, stampForgeModuleFn, stampHousePresetFn } from "@/lib/forge-modules.functions";
import { supabase } from "@/integrations/supabase/client";
import { useWalletSession } from "@/lib/wallet-session";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { landStatusQuery } from "@/lib/land-status";
import { forgeRightsFn } from "@/lib/forge-rights.functions";
import { forgePieceFn } from "@/lib/forge-parts.functions";
import { collectionPiecesQuery } from "@/lib/forge-collection.functions";
import { DONATION_ADDRESS } from "@/lib/donations";
import { forgeAssemblyHtml, isInscriptionId, MAX_ASM_PARTS, normPart, type AsmPart } from "@/lib/forge-assembly";
import { forgeBuildViews } from "@/lib/forge-testrun";
import { bakeGuardian } from "@/lib/forge-guardian-bake";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { OnchainGuardianBody } from "@/components/bitmon/OnchainGuardianBody";

export const Route = createFileRoute("/forge")({
  validateSearch: (s: Record<string, unknown>): { height?: number; parcel?: number; proposal?: string } => {
    const h = Number(s["height"]);
    const p = Number(s["parcel"]);
    const out: { height?: number; parcel?: number; proposal?: string } = {};
    if (typeof s["proposal"] === "string" && /^[0-9a-f-]{36}$/i.test(s["proposal"])) out.proposal = s["proposal"];
    if (s["height"] !== undefined && Number.isInteger(h) && h >= 0) out.height = h;
    if (s["parcel"] !== undefined && Number.isInteger(p) && p >= 0) out.parcel = p;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Land Forge Studio — Build, Remix & Inscribe Your BITMAP" },
      { name: "description", content: "Design 3D voxel builds for your BITMAP. Stamp community pieces, preview your exact land boundaries, and inscribe the finished build on Bitcoin." },
      { property: "og:title", content: "Land Forge Studio — Composable On-Chain Builds" },
      { property: "og:description", content: "Design 3D voxel builds for your BITMAP. Stamp community pieces, preview your exact land boundaries, and inscribe the finished build on Bitcoin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgePage,
});

/** Studio canvas size: 64³ (original) or 128³ (XL recursive builds). Set by ForgePage each render; the 3D canvas remounts on change. */
let SPAN: ForgeSpan = FORGE_SPAN;
const half = () => SPAN / 2;
const COLORS = Object.fromEntries(BLOCKS.map((b) => [b.id, new THREE.Color(b.top)]));
type Tool = "stamp" | "block" | "box" | "erase" | "perch" | "parcel" | "move";
type Placement = AsmPlacement;
const TOOL_LABELS: Record<Tool, [string, string]> = { stamp: ["PIECE", "S"], move: ["MOVE", "M"], block: ["BLOCK", "B"], box: ["BOX", "W"], erase: ["ERASE", "X"], perch: ["GUARDIAN", "G"], parcel: ["PARCEL", "P"] };

function TabBar<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: [T, string][] }) {
  return (
    <div role="tablist" className="flex gap-0.5 rounded-md border border-border bg-card/40 p-0.5">
      {tabs.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)} className={`flex-1 rounded px-2 py-1.5 text-[10px] tracking-wider ${value === id ? "bg-primary/15 text-foreground ring-1 ring-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
      ))}
    </div>
  );
}


function ParcelFloor({ rects, focus, hoverIdx }: { rects: ParcelRect[]; focus: number | null; hoverIdx: number | null }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const base = new THREE.Color("#3a2a12"), hi = new THREE.Color("#f7931a"), hv = new THREE.Color("#00f0ff"), dim = new THREE.Color("#1d2230");
    rects.forEach((r, i) => {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      o.position.set((r.x0 + r.x1) / 2 - half(), 0.02, (r.z0 + r.z1) / 2 - half());
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

/** Decorative land mass under the canvas: a displaced grid mesh seeded by the block height. Never inscribed. */
function TerrainMass({ mass, height }: { mass: LandMass; height: number }) {
  const geo = useMemo(() => {
    if (mass === "flat") return null;
    const seg = SPAN; // one vertex per cell corner
    const g = new THREE.PlaneGeometry(SPAN * 1.7, SPAN * 1.7, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes["position"] as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const sand = new THREE.Color("#8a6a3a"), grass = new THREE.Color("#2e4a2a"), rock = new THREE.Color("#3a3f4a"), deep = new THREE.Color("#101820");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(mass, x + half(), z + half(), height, SPAN);
      pos.setY(i, h - 0.55);
      const c = h <= -4 ? deep : h <= -1 ? rock : mass === "island" ? sand : grass;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [mass, height]);
  if (!geo) return null;
  return (
    <group>
      <mesh geometry={geo} receiveShadow raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {mass === "island" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.4, 0]} raycast={() => null}>
          <planeGeometry args={[SPAN * 4, SPAN * 4]} />
          <meshStandardMaterial color="#0b2a3a" transparent opacity={0.85} roughness={0.3} metalness={0.4} />
        </mesh>
      )}
    </group>
  );
}

function Blocks({ blocks, onErase, erase, onSurface, onPlace }: { blocks: TplBlock[]; erase: boolean; onErase: (b: TplBlock) => void; onSurface: (cell: [number, number, number] | null) => void; onPlace: (cell?: [number, number, number]) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  // Right-sized capacity in 4,096 buckets: a remount only happens when the
  // build crosses a bucket, and the GPU never holds a 200k-instance buffer.
  const capacity = Math.min(FORGE_RENDER_MAX + 400, Math.max(4096, Math.ceil((blocks.length + 1) / 4096) * 4096));
  const big = blocks.length > 3000;
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    // Allocate instance colours up front so the shader compiles with them.
    if (!m.instanceColor) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
      (m.material as THREE.Material).needsUpdate = true;
    }
    const o = new THREE.Object3D();
    blocks.forEach((b, i) => {
      o.position.set(b.dx - half() + 0.5, b.dy + 0.5, b.dz - half() + 0.5);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, COLORS[b.k] ?? COLORS["stone"]!);
    });
    m.count = blocks.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [blocks, capacity]);
  return (
    <instancedMesh
      key={capacity}
      ref={ref}
      args={[undefined, undefined, capacity]}
      castShadow={!big}
      receiveShadow={!big}
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
        const b = blocks[e.instanceId];
        if (erase) { if (b) onErase(b); return; }
        const n = e.face?.normal;
        // Use the exact cell under this click, not the last hover state.
        onPlace(b && n ? [b.dx + Math.round(n.x), Math.max(0, b.dy + Math.round(n.y)), b.dz + Math.round(n.z)] : undefined);
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
      o.position.set(b.dx + at[0] - half() + 0.5, b.dy + at[1] + 0.5, b.dz + at[2] - half() + 0.5);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = blocks.length;
    m.instanceMatrix.needsUpdate = true;
  }, [blocks, at]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(900, blocks.length)]} key={Math.max(900, blocks.length)} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={bad ? "#ff4d4d" : "#00f0ff"} transparent opacity={0.35} depthWrite={false} />
    </instancedMesh>
  );
}

/** Wireframe footprint box + facing arrow around the ghost so builders see size and rotation before placing. */
function GhostBounds({ blocks, at, bad }: { blocks: TplBlock[]; at: [number, number, number]; bad: boolean }) {
  if (!blocks.length) return null;
  let x1 = 0, y1 = 0, z1 = 0;
  for (const b of blocks) { x1 = Math.max(x1, b.dx); y1 = Math.max(y1, b.dy); z1 = Math.max(z1, b.dz); }
  const w = x1 + 1, h = y1 + 1, d = z1 + 1;
  const c = bad ? "#ff4d4d" : "#00f0ff";
  const cx = at[0] - half() + w / 2, cz = at[2] - half() + d / 2;
  return (
    <group raycast={() => null}>
      <lineSegments position={[cx, at[1] + h / 2, cz]}>
        <edgesGeometry args={[new THREE.BoxGeometry(w + 0.05, h + 0.05, d + 0.05)]} />
        <lineBasicMaterial color={c} />
      </lineSegments>
      <mesh position={[cx, at[1] + 0.03, at[2] - half() + d + 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.6, 1.2, 3]} />
        <meshBasicMaterial color={c} />
      </mesh>
    </group>
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
  const [xl, setXl] = useState(false);
  const [mass, setMass] = useState<LandMass>("flat");
  SPAN = xl ? FORGE_SPAN_XL : FORGE_SPAN;
  const rects = useMemo(() => parcelRects(sizes?.classes, xl ? FORGE_SPAN_XL : FORGE_SPAN), [sizes, xl]);
  const [focus, setFocus] = useState<number | null>(search.parcel ?? null);
  const firstFocus = useRef(true);
  useEffect(() => { if (firstFocus.current) { firstFocus.current = false; return; } setFocus(null); }, [height, xl]);
  const focusRect = focus !== null ? rects[focus] ?? null : null;
  const addrs = wallet ? [wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean) as string[] : [];
  const owned = useQuery(heldHeightsQuery(addrs));
  const landStatus = useQuery(landStatusQuery(owned.data ?? []));
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
  useEffect(() => { if (role === "parcel") setXl(false); }, [role]);
  const parcelTarget = role === "parcel" && focus !== null && myParcels.includes(focus) ? focus : undefined;
  const canInscribe = role === "bitmap" || parcelTarget !== undefined;
  const community = useCommunityModules();
  const stampFn = useServerFn(stampForgeModuleFn);
  const presetFn = useServerFn(stampHousePresetFn);
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
  const [hover, setHoverRaw] = useState<[number, number, number] | null>(null);
  // Skip re-renders while the cursor stays on the same cell.
  const setHover = useCallback((c: [number, number, number] | null) => setHoverRaw((p) => (p && c && p[0] === c[0] && p[1] === c[1] && p[2] === c[2]) || (!p && !c) ? p : c), []);
  const [guide, setGuide] = useState(false);
  const [leftTab, setLeftTab] = useState<"kits" | "pieces" | "land">("kits");
  const [rightTab, setRightTab] = useState<"inscribe" | "publish">("inscribe");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const openPanel = (which: "left" | "right") => {
    if (which === "left") {
      const next = !leftOpen;
      setLeftOpen(next);
      if (next) setRightOpen(false);
    } else {
      const next = !rightOpen;
      setRightOpen(next);
      if (next) setLeftOpen(false);
    }
  };

  const [digest, setDigest] = useState<string | null>(null);
  const [pub, setPub] = useState({ name: "", bit: 10, sats: 1000 });
  const weekly = useMemo(() => weeklyBlueprint(), []);
  const [bpId, setBpId] = useState(weekly.id);
  const [bpStep, setBpStep] = useState(0);
  const [showBp, setShowBp] = useState(true);
  const communityKits = useCommunityKits();
  const playerKits = communityKits.data ?? [];
  const bp: Blueprint = KITS.find((k) => k.id === bpId) ?? playerKits.find((k) => k.id === bpId) ?? BLUEPRINTS.find((b) => b.id === bpId) ?? weekly;
  const kit = isKit(bp) ? bp : null;
  const [unboxed, setUnboxed] = useState<string[]>([]);
  const [auto, setAuto] = useState(false);
  const [testing, setTesting] = useState(false);
  const [off, setOff] = useState<BehaviorCard[]>([]);
  const sketch = useMemo(() => {
    const s = bp.steps[bpStep];
    if (!s) return [];
    return blueprintBlocks({ ...bp, steps: [s] }).filter((b) => !world.has(cellKey(b.dx, b.dy, b.dz))).slice(0, 900);
  }, [bp, bpStep, world]);
  // Behavior cards animate the placed blocks of their steps (only once those steps are built).
  const liveBehaviors = useMemo(() => {
    if (!kit) return [];
    return kit.behaviors.filter((b) => !off.includes(b.card) && b.steps.every((s) => s < bpStep)).map((b) => ({
      b,
      blocks: blueprintBlocks({ ...kit, steps: b.steps.map((i) => kit.steps[i]!) }).filter((x) => world.has(cellKey(x.dx, x.dy, x.dz))),
    })).filter((x) => x.blocks.length > 0);
  }, [kit, off, bpStep, world]);
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
  // Smart auto-load: the BITMAP's live on-chain build fills an empty canvas; otherwise we ask first.
  const chainQ = useQuery(forgeBuildQuery(height));
  const chainBuild = chainQ.data ?? null;
  const [pendingLoad, setPendingLoad] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const loadChainBuild = (force: boolean): void => {
    if (!chainBuild) return;
    const span = (chainBuild.span ?? FORGE_SPAN) as ForgeSpan;
    let decoded: TplBlock[] = [];
    try { decoded = decodeBuild(chainBuild.data, span); } catch { toast.error("COULD NOT READ THIS ON-CHAIN BUILD"); return; }
    if (!decoded.length) return;
    if (!force && world.size > 0) { setPendingLoad(chainBuild.inscriptionId); return; }
    setXl(span === FORGE_SPAN_XL);
    const next = new Map<string, TplBlock>();
    for (const b of decoded) next.set(cellKey(b.dx, b.dy, b.dz), b);
    setHistory((h) => [...h, world]);
    setWorld(next);
    setPendingLoad(null);
    loadedFor.current = chainBuild.inscriptionId;
    toast.success(`LOADED ${decoded.length.toLocaleString()} VOXELS FROM ${height}.BITMAP — REMIX AWAY`);
  };
  useEffect(() => {
    if (!chainBuild || loadedFor.current === chainBuild.inscriptionId) return;
    loadedFor.current = chainBuild.inscriptionId;
    loadChainBuild(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainBuild?.inscriptionId]);
  useEffect(() => { setPerch(null); setBoxStart(null); }, [height]);
  /** Agent build proposal (owner-only read via RLS) loaded straight onto the canvas for review. */
  const proposalLoaded = useRef<string | null>(null);
  useEffect(() => {
    const pid = search.proposal;
    if (!pid || proposalLoaded.current === pid) return;
    proposalLoaded.current = pid;
    void supabase.from("build_proposals").select("blocks, block_count, bitmap_height").eq("id", pid).maybeSingle().then(({ data }) => {
      if (!data) { toast.error("PROPOSAL NOT FOUND ON YOUR ACCOUNT"); return; }
      const rows = (data.blocks as unknown as [number, number, number, string][]) ?? [];
      const next = new Map<string, TplBlock>();
      for (const [x, y, z, k] of rows) next.set(cellKey(x, y, z), { dx: x, dy: y, dz: z, k: k as TplBlock["k"] });
      setXl(false);
      setHistory((h) => [...h, world]);
      setWorld(next);
      setPendingLoad(null);
      loadedFor.current = chainBuild?.inscriptionId ?? "__proposal__";
      toast.success(`LOADED AGENT PROPOSAL · ${next.size.toLocaleString()} VOXELS — REVIEW, EDIT, THEN INSCRIBE YOURSELF`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.proposal]);

  const collectionQ = useQuery(collectionPiecesQuery());
  const [makers, setMakers] = useState<Record<string, string>>({});
  const [siteTribute, setSiteTribute] = useState(false);
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

  // Test Run hides moving parts on screen only — inscriptions and publishing always use the full build.
  const views = useMemo(() => forgeBuildViews(world, liveBehaviors.map((lb) => lb.blocks), testing), [world, liveBehaviors, testing]);
  const blocks = views.shown;
  const allBlocks = views.payload;
  const ghost = useMemo(() => {
    if (tool === "erase" || tool === "parcel" || tool === "perch" || tool === "move") return [];
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
  // Anywhere on the BITMAP canvas; only an explicitly chosen parcel (parcel inscription) clips placement.
  const onTile = (x: number, z: number) => (focusRect ? inRect(focusRect, x, z) : Math.abs(x) < SPAN && Math.abs(z) < SPAN);
  const ghostOut = !!(hover && (ghost.some((b) => !onTile(b.dx + hover[0], b.dz + hover[2]))));
  // Voxels of referenced on-chain pieces live in their own inscriptions, so only loose blocks count.
  const pieceKeys = useMemo(() => new Set(placements.flatMap((p) => p.keys)), [placements]);
  const ownCount = useMemo(() => { let n = 0; for (const k of world.keys()) if (!pieceKeys.has(k)) n++; return n; }, [world, pieceKeys]);
  const ghostIsPiece = tool === "stamp" && picked.id.startsWith("ins:");
  const overLimit = ownCount + (tool === "erase" || ghostIsPiece ? 0 : ghost.length) > FORGE_MAX_BLOCKS;

  const commit = useCallback((next: Map<string, TplBlock>) => {
    setHistory((h) => [...h.slice(-30), world]);
    setWorld(next);
  }, [world]);

  const [fileOver, setFileOver] = useState(false);
  const loadVoxelFile = (file: File) => {
    void import("@/lib/voxel-import").then((m) => m.importVoxelFile(file, SPAN)).then((r) => {
      setPicked({ id: `file:${file.name}:${Date.now()}`, name: file.name.replace(/\.(bwvx|vox)$/i, ""), sphere: "bricks", blocks: r.blocks, author: null, bitCost: 0 });
      setTool("stamp"); setTurns(0);
      toast.success(`Imported ${r.blocks.length.toLocaleString()} blocks — click the land to place`, { description: r.note });
    }).catch((err) => toast.error("Import failed", { description: String(err?.message ?? err) }));
  };

  const buildStep = useCallback(() => {
    const s = bp.steps[bpStep];
    if (!s) { setAuto(false); return; }
    commit(stampInto(world, blueprintBlocks({ ...bp, steps: [s] }), 0, 0, 0));
    setBpStep((n) => n + 1);
  }, [bp, bpStep, world, commit]);
  const backStep = useCallback(() => {
    const s = bp.steps[bpStep - 1];
    if (!s) return;
    const next = new Map(world);
    for (const b of blueprintBlocks({ ...bp, steps: [s] })) next.delete(cellKey(b.dx, b.dy, b.dz));
    commit(next);
    setBpStep((n) => Math.max(0, n - 1));
  }, [bp, bpStep, world, commit]);
  useEffect(() => {
    if (!auto) return;
    if (bpStep >= bp.steps.length) { setAuto(false); toast.success(`${bp.name.toUpperCase()} ASSEMBLED`); return; }
    const t = setTimeout(buildStep, 1100);
    return () => clearTimeout(t);
  }, [auto, bpStep, bp, buildStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "r" || e.key === "R") setTurns((t) => t + 1);
      if (e.key === "e" || e.key === "E") setLayer((l) => Math.min(SPAN - 1, l + 1));
      if (e.key === "q" || e.key === "Q") setLayer((l) => Math.max(0, l - 1));
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === "b" || e.key === "B") setTool("block");
      if (e.key === "s" || e.key === "S") setTool("stamp");
      if (e.key === "x" || e.key === "X") setTool("erase");
      if (e.key === "p" || e.key === "P") setTool("parcel");
      if (e.key === "w" || e.key === "W") { setTool("box"); setBoxStart(null); }
      if (e.key === "g" || e.key === "G") setTool("perch");
      if (e.key === "m" || e.key === "M") setTool("move");
      if (e.key === "Escape") setBoxStart(null);
      if (/^[0-9]$/.test(e.key)) { const b = BLOCKS[(Number(e.key) + 9) % 10]; if (b) { setPaint(b.id); setTool("block"); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const undo = () => setHistory((h) => { const last = h[h.length - 1]; if (last) setWorld(last); return h.slice(0, -1); });

  const hoverNow = hover;
  const place = async (target?: [number, number, number] | null): Promise<void> => {
    const hover = target ?? hoverNow;
    if (!hover) return;
    if (target) setHover(target);
    if (tool === "parcel") { const p = parcelAt(rects, hover[0], hover[2]); setFocus(p ? p.index : null); return; }
    if (tool === "erase") return;
    if (tool === "perch") {
      if (!dnaQ.data) { toast.error("THIS BLOCK'S GUARDIAN IS STILL LOADING"); return; }
      setPerch(hover); toast.success("GUARDIAN PERCHED — IT WILL LIVE ON THIS BUILD"); return;
    }
        if (!onTile(hover[0], hover[2])) { toast.error(focusRect ? `STAY INSIDE PARCEL #${focusRect.index}` : "NO PARCEL HERE — BUILD ONLY ON PARCEL TILES"); return; }
    if (tool === "box") {
      if (!boxStart) { setBoxStart(hover); return; }
      let next = new Map(world);
      for (const b of boxGhost) if (onTile(b.dx, b.dz)) next.set(cellKey(b.dx, b.dy, b.dz), b);
      if (ownCount + boxGhost.length > FORGE_MAX_BLOCKS || next.size > FORGE_RENDER_MAX) { toast.error(`BUILD LIMIT IS ${FORGE_MAX_BLOCKS} BLOCKS`); next = world; }
      setBoxStart(null);
      if (next !== world) commit(next);
      return;
    }
    if (overLimit) { toast.error(`BUILD LIMIT IS ${FORGE_MAX_BLOCKS} BLOCKS`); return; }
    if (ghostIsPiece && livePlacements.length >= MAX_ASM_PARTS) { toast.error(`A RECURSIVE BUILD HOLDS UP TO ${MAX_ASM_PARTS} ON-CHAIN PIECES`); return; }
    if (tool === "stamp" && !picked.author && (picked.bitCost ?? 0) > 0) {
      if (!wallet) { toast.error(`CONNECT A WALLET — THIS PRESET COSTS ${picked.bitCost} BIT`); return; }
      const r = await presetFn({ data: { presetId: picked.id, address: wallet.ordinalsAddress } }).catch(() => ({ ok: false as const, error: "SIGN IN TO USE PREMIUM PRESETS" }));
      if (!r.ok) { toast.error(r.error); return; }
      if (r.paid) toast.success(`PAID ${r.paid} BIT — ${picked.name.toUpperCase()} PLACED`);
    }
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
      if (keys.length) setPlacements((p) => [...p.filter((x) => isLive(x, next)), { part: { id: picked.id.slice(4), x: hover[0], y: hover[1], z: hover[2], r: ((turns % 4) + 4) % 4 }, keys, refs: keys.map((k) => next.get(k)!) }]);
    }
    if (tool === "stamp" && picked.author && !used.some((u) => u.id === picked.id)) setUsed((u) => [...u, picked]);
  };

  /** Erasing one block of an inscribed piece removes the whole piece (it is placed by reference). */
  const eraseAt = (b: TplBlock) => {
    const key = cellKey(b.dx, b.dy, b.dz);
    const hit = placements.find((p) => isLive(p, world) && p.keys.includes(key));
    if (tool === "move") {
      if (!hit) { toast.error("ONLY ON-CHAIN PIECES CAN BE MOVED — CLICK ONE"); return; }
      const piece = chainPieces.find((c) => c.id === `ins:${hit.part.id}`);
      if (!piece) return;
      const n = new Map(world);
      for (const k of hit.keys) n.delete(k);
      setPlacements((p) => p.filter((x) => x !== hit));
      commit(n);
      setPicked(piece); setTurns(hit.part.r); setTool("stamp");
      toast.success("PIECE PICKED UP — CLICK ANYWHERE TO DROP IT");
      return;
    }
    const n = new Map(world);
    if (hit) { for (const k of hit.keys) n.delete(k); setPlacements((p) => p.filter((x) => x !== hit)); }
    else n.delete(key);
    commit(n);
  };

  // Drag a piece from the in-canvas tray: grab on press, drop where the pointer is released over the map.
  const [dragging, setDragging] = useState(false);
  const placeRef = useRef(place);
  placeRef.current = place;
  useEffect(() => {
    if (!dragging) return;
    const up = (e: PointerEvent) => {
      setDragging(false);
      if ((e.target as HTMLElement)?.tagName === "CANVAS") void placeRef.current();
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [dragging]);

  // Tallest filled height per column, so pieces dropped on the floor stack on top automatically.
  const tops = useMemo(() => {
    const t = new Map<string, number>();
    for (const b of world.values()) { const k = `${b.dx},${b.dz}`; t.set(k, Math.max(t.get(k) ?? 0, b.dy + 1)); }
    return t;
  }, [world]);
  const groundCell = (e: ThreeEvent<PointerEvent | MouseEvent>): [number, number, number] | null => {
    const x = Math.floor(e.point.x + half()), z = Math.floor(e.point.z + half());
    if (x < 0 || z < 0 || x >= SPAN || z >= SPAN) return null;
    let y = layer;
    if (tool === "perch") y = Math.max(y, tops.get(`${x},${z}`) ?? 0);
    else if (tool !== "erase" && !(tool === "box" && boxStart)) for (const b of ghost) y = Math.max(y, (tops.get(`${x + b.dx},${z + b.dz}`) ?? 0) - b.dy);
    else if (tool === "box" && boxStart) y = Math.max(layer, boxStart[1]);
    return [x, Math.min(SPAN - 1, y), z];
  };
  const onGround = (e: ThreeEvent<PointerEvent>) => setHover(groundCell(e));
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

  // Royalties: module lineage + 546 sats to the maker of each verified collection piece still in the build,
  // plus the optional 546-sat site tribute (counts toward the site fund).
  const payouts = useMemo(() => {
    const live = new Set(placements.filter((p) => isLive(p, world)).map((p) => p.part.id));
    const pieceMakers = [...live].map((id) => makers[id]).filter((a): a is string => !!a).map((address) => [{ address, sats: 546 }]);
    const site = siteTribute ? [[{ address: DONATION_ADDRESS, sats: 546 }]] : [];
    return tributeSplit([...used.map((u) => u.lineage ?? []), ...pieceMakers, ...site] as Parameters<typeof tributeSplit>[0]);
  }, [used, placements, world, makers, siteTribute]);
  const payoutSats = payouts.reduce((n, p) => n + p.sats, 0);
  const lineage = used.map((u) => u.id.slice(0, 8)).join(",");
  const parcelBlocks = useMemo(() => (focusRect ? clipToParcel(allBlocks, focusRect) : allBlocks), [allBlocks, focusRect]);
  const html = useMemo(() => (height === null || !parcelBlocks.length ? "" : forgeInscriptionHtml(height, "studio", parcelBlocks, lineage, focusRect ?? undefined)), [height, parcelBlocks, lineage, focusRect]);
  // Recursive assembly: inscribed pieces by reference + own blocks + the block's baked Guardian.
  const livePlacements = useMemo(() => placements.filter((p) => isLive(p, world)), [placements, world]);
  const asmHtml = useMemo(() => {
    if (height === null || (!xl && !livePlacements.length && !perch)) return "";
    if (xl && !livePlacements.length && !perch && !parcelBlocks.length) return "";
    const taken = new Set(livePlacements.flatMap((p) => p.keys));
    const own = parcelBlocks.filter((b) => !taken.has(cellKey(b.dx, b.dy, b.dz)));
    const guardian = perch && dnaQ.data ? { data: bakeGuardian(dnaQ.data), at: perch } : null;
    return forgeAssemblyHtml(height, livePlacements.map((p) => p.part), own, guardian, lineage, SPAN);
  }, [height, livePlacements, perch, parcelBlocks, dnaQ.data, lineage, xl]);
  const asmBytes = useMemo(() => new TextEncoder().encode(asmHtml).length, [asmHtml]);
  const bytes = useMemo(() => new TextEncoder().encode(html).length, [html]);
  useEffect(() => {
    setDigest(null);
    if (!html && !asmHtml) return;
    const t = setTimeout(() => void sha(`forge:${encodeBuild(allBlocks)}:${lineage}:${asmHtml.length}:${perch?.join(",") ?? ""}`).then(setDigest), 400);
    return () => clearTimeout(t);
  }, [html, asmHtml, allBlocks, lineage, perch]);

  const publish = async (): Promise<void> => {
    if (!wallet) { toast.error("CONNECT A WALLET TO PUBLISH"); return; }
    if (allBlocks.length < 4) { toast.error("BUILD SOMETHING FIRST"); return; }
    if (allBlocks.length > 2400) { toast.error("MODULES ARE CAPPED AT 2,400 BLOCKS — ERASE SOME FIRST"); return; }
    const r = await publishFn({ data: {
      name: pub.name.trim() || "Untitled module", address: wallet.ordinalsAddress, blocks: normaliseModule(allBlocks),
      bitCost: pub.bit, tributeSats: pub.sats > 0 ? Math.max(546, pub.sats) : 0, parents: used.map((u) => u.id),
      ...(wallet.paymentAddress ? { payoutAddress: wallet.paymentAddress } : {}),
    } }).catch(() => ({ ok: false as const, error: "SIGN IN TO PUBLISH" }));
    if (!r.ok) { toast.error(r.error); return; }
    toast.success("MODULE PUBLISHED — OTHERS CAN NOW BUILD ON IT");
    void community.refetch();
  };

  const palette = sphere === "community" ? community.data ?? [] : HOUSE_PREFABS.filter((p) => p.sphere === sphere);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 font-mono">
      <div className="mb-3"><OtherthingsBadge child="Builds" /></div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest text-primary">LAND FORGE STUDIO · COMPOSABLE ON-CHAIN BUILDS</p>
          <h1 className="mt-1 font-display text-2xl text-foreground md:text-3xl">Build on Bitcoin. Build on each other.</h1>
        </div>
        <button type="button" onClick={() => setGuide((g) => !g)} className="rounded border border-border px-3 py-1 text-[10px] text-muted-foreground hover:text-foreground">{guide ? "HIDE HOW IT WORKS" : "? HOW IT WORKS"}</button>
      </div>

      {guide && (
        <section className="mt-5 grid gap-3 rounded-lg border border-border bg-card/40 p-4 text-xs text-muted-foreground md:grid-cols-3">
          <div><p className="mb-1 text-primary">WHY IT LASTS</p>Your finished build is permanently etched onto your BITMAP's own sat. It lives on Bitcoin, not on our servers — the newest build on that sat shows on ordinals.com, in the Oasis and on your BITMAP's page, older builds stay as its on-chain history, and it travels with the land when it sells.</div>
          <div><p className="mb-1 text-primary">HOW TO BUILD</p>Pick a piece, move over the grid, click to place. <b className="text-foreground">R</b> rotates, <b className="text-foreground">Q/E</b> change the floor level, <b className="text-foreground">Ctrl+Z</b> undoes. Start from your block's own seed, this week's blueprint, or from scratch.</div>
          <div><p className="mb-1 text-primary">WHO GETS PAID</p>Community pieces cost a small BIT fee to their maker each time you place them. When you inscribe, every maker in your build's family tree is paid in sats inside the same Bitcoin transaction. Publish your own pieces to earn too.</div>
          <button type="button" onClick={() => setGuide(false)} className="justify-self-start text-[10px] text-accent underline md:col-span-3">HIDE GUIDE</button>
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[260px_1fr_320px]">
        <aside>
          <button type="button" onClick={() => openPanel("left")} aria-expanded={leftOpen} className="flex w-full items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2 text-[11px] text-foreground lg:hidden">
            <span>LAND · KITS · PIECES</span><span className="text-muted-foreground">{leftOpen ? "▲ HIDE" : "▼ SHOW"}</span>
          </button>
          <div className={`space-y-3 ${leftOpen ? "mt-3" : "hidden"} lg:mt-0 lg:block`}>
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
                  <span className="w-full text-[9px] text-muted-foreground"><span className="text-accent">▣</span> BUILT ON-CHAIN · <span className="text-primary">◆</span> GUARDIAN INSCRIBED</span>
                  {owned.data!.map((h) => {
                    const s = landStatus.data?.get(h);
                    return (
                      <button key={h} type="button" onClick={() => setInput(String(h))} title={[s?.build ? `Build ${s.build.voxels} voxels` : "No build yet", s?.guardian ? `Guardian ${s.guardian.species}` : "No inscribed Guardian"].join(" · ")} className={`rounded border px-2 py-0.5 text-[10px] ${height === h ? "border-primary text-foreground" : s?.build ? "border-accent/60 text-foreground" : "border-border text-muted-foreground"}`}>
                        {h}
                        {s?.build && <span className="ml-1 text-accent">▣{s.build.voxels}</span>}
                        {s?.guardian && <span className="ml-1 text-primary">◆</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {height !== null && landStatus.data?.get(height) && (
                <div className="rounded border border-accent/50 px-2 py-1 text-[10px]">
                  {landStatus.data.get(height)!.build && <p className="text-accent">▣ ALREADY BUILT · {landStatus.data.get(height)!.build!.voxels} VOXELS · <a className="underline" target="_blank" rel="noreferrer" href={`https://ordinals.com/inscription/${landStatus.data.get(height)!.build!.inscriptionId}`}>VIEW ↗</a></p>}
                  {landStatus.data.get(height)!.guardian && <p className="text-primary">◆ GUARDIAN · {landStatus.data.get(height)!.guardian!.species} · <a className="underline" target="_blank" rel="noreferrer" href={`https://ordinals.com/inscription/${landStatus.data.get(height)!.guardian!.inscriptionId}`}>VIEW ↗</a></p>}
                </div>
              )}
              {chainBuild && pendingLoad === chainBuild.inscriptionId && (
                <div className="rounded border border-accent px-2 py-1 text-[10px]">
                  <p className="text-accent">▣ ON-CHAIN BUILD FOUND · {chainBuild.blockCount.toLocaleString()} VOXELS</p>
                  <div className="mt-1 flex gap-1">
                    <button type="button" onClick={() => loadChainBuild(true)} className="rounded border border-primary bg-primary/10 px-2 py-0.5 text-foreground">LOAD ONTO CANVAS</button>
                    <button type="button" onClick={() => setPendingLoad(null)} className="rounded border border-border px-2 py-0.5 text-muted-foreground">DISMISS</button>
                  </div>
                </div>
              )}
              {height !== null && (
                <p className={`rounded border px-2 py-1 text-[10px] ${role === "bitmap" ? "border-primary text-primary" : role === "parcel" ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                  {rights.isLoading ? "CHECKING THE CHAIN…" : role === "bitmap" ? `✓ YOU HOLD ${height}.BITMAP` : role === "parcel" ? `✓ YOU HOLD PARCEL ${myParcels.map((p) => `#${p}`).join(", ")} · LOCKED TO YOUR TILE` : "PREVIEW ONLY · THIS WALLET DOESN'T HOLD THIS BITMAP"}
                </p>
              )}
            </>
          )}
          <TabBar value={leftTab} onChange={setLeftTab} tabs={[["kits", "KITS"], ["pieces", "PIECES"], ["land", "LAND"]]} />
          {leftTab === "land" && height !== null && role !== "parcel" && (
            <div className="rounded border border-accent/40 bg-card/40 p-2 text-[11px]">
              <p className="text-accent">CANVAS SIZE</p>
              <div className="mt-1 flex gap-1">
                {([FORGE_SPAN, FORGE_SPAN_XL] as const).map((n) => (
                  <button key={n} type="button" data-testid={`forge-span-${n}`} onClick={() => {
                    if (n === FORGE_SPAN && blocks.some((b) => b.dx >= FORGE_SPAN || b.dy >= FORGE_SPAN || b.dz >= FORGE_SPAN)) { toast.error("CLEAR BLOCKS OUTSIDE THE 64³ AREA FIRST"); return; }
                    setXl(n === FORGE_SPAN_XL);
                  }} className={`rounded border px-2 py-0.5 text-[10px] ${(n === FORGE_SPAN_XL) === xl ? "border-accent text-foreground" : "border-border text-muted-foreground"}`}>{n}³{n === FORGE_SPAN_XL ? " XL" : ""}</button>
                ))}
              </div>
              <p className="mt-1 text-muted-foreground">{xl ? "XL: 8× the space at half block size, same land footprint. Inscribes as a recursive build only." : "Original size. Works with every inscribe option."}</p>
            </div>
          )}
          {leftTab === "land" && (
          <div className="rounded border border-border bg-card/40 p-2 text-[11px]">
            <p className="text-accent">LAND MASS</p>
            <div className="mt-1 flex gap-1">
              {LAND_MASSES.map((m) => (
                <button key={m.id} type="button" title={m.blurb} data-testid={`forge-mass-${m.id}`} onClick={() => setMass(m.id)} className={`rounded border px-2 py-0.5 text-[10px] ${mass === m.id ? "border-accent text-foreground" : "border-border text-muted-foreground"}`}>{m.name}</button>
              ))}
            </div>
            <p className="mt-1 text-muted-foreground">{LAND_MASSES.find((m) => m.id === mass)?.blurb} Decorative only — costs no blocks and isn't inscribed.</p>
          </div>
          )}
          {leftTab === "land" && rects.length > 0 && (
            <div className="rounded border border-primary/40 bg-card/40 p-2 text-[11px]">
              <p className="text-primary">BUILD TARGET</p>
              <p className="mt-1 text-muted-foreground">The floor shows this block's {rects.length.toLocaleString()} real transaction parcels. Use PARCEL and click a tile to build only on it.</p>
              <div className="mt-2 flex items-center gap-1">
                <button type="button" onClick={() => setFocus(null)} className={`rounded border px-2 py-0.5 text-[10px] ${focus === null ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>WHOLE BITMAP</button>
                <input type="number" min={0} max={rects.length - 1} value={focus ?? ""} placeholder="#" onChange={(e) => { const v = Number(e.target.value); setFocus(e.target.value === "" ? null : Math.max(0, Math.min(rects.length - 1, v))); }} className="w-20 rounded border border-border bg-background px-2 py-0.5 text-foreground" />
              </div>
              {focusRect && <p className="mt-1 text-accent">PARCEL {focusRect.index}.{height}.BITMAP · {focusRect.x1 - focusRect.x0}×{focusRect.z1 - focusRect.z0} CELLS{focusRect.cells.size < (focusRect.x1 - focusRect.x0) * (focusRect.z1 - focusRect.z0) && ` · ${focusRect.cells.size} OWNED (SHARED CELLS GO TO THE LARGER TRANSACTION)`}</p>}
              {focusRect && height !== null && !xl && (() => {
                const o = parcelOutpost(height, focusRect);
                return (
                  <div className="mt-2 border-t border-border pt-2">
                    <p className="text-primary">PARCEL OUTPOST · {o.style.name}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Derived from this block and transaction number only — fitted to this tile's own ground. {o.blocks.length} blocks, free.</p>
                    <button type="button" disabled={!o.blocks.length} onClick={() => commit(stampInto(world, o.blocks, 0, 0, 0))} className="mt-1 rounded border border-primary bg-primary/10 px-2 py-1 text-[10px] text-foreground disabled:opacity-40">{o.blocks.length ? "PLACE OUTPOST" : "THIS PARCEL OWNS NO GROUND"}</button>
                  </div>
                );
              })()}
            </div>
          )}
          {leftTab === "pieces" && (
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
                    {p.name} · {p.blocks.length} voxels · {placements.filter((x) => `ins:${x.part.id}` === p.id && isLive(x, world)).length} placed
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 border-t border-border pt-2">
              <p className="flex items-center justify-between text-accent"><span>VERIFIED COMMUNITY · ON BITCOIN</span><span className="text-[10px] text-muted-foreground">{collectionQ.data?.length ?? "…"}</span></p>
              <p className="mt-1 text-[10px] text-muted-foreground">Only Land Forge inscriptions in the official collection appear here. Using one pays its creator (the first wallet it was inscribed to) 546 sats inside your inscription.</p>
              <div className="mt-1 max-h-48 space-y-1 overflow-y-auto">
                {collectionQ.isLoading && <p className="text-[10px] text-muted-foreground">READING THE COLLECTION FROM BITCOIN…</p>}
                {collectionQ.data?.map((c) => (
                  <button key={c.id} type="button" disabled={pieceBusy} onClick={() => void loadPiece(c.id, c.maker)} className="w-full rounded border border-border px-2 py-1 text-left text-[10px] text-muted-foreground hover:border-accent disabled:opacity-40">
                    <span className="block text-foreground">◆ {c.height !== null ? `${c.height}.BITMAP` : c.id.slice(0, 8)} · {c.voxels} voxels</span>
                    <span className="font-mono">{c.id.slice(0, 8)}…{c.id.slice(-4)}{c.maker ? ` · creator ${short(c.maker)} · 546 sats` : ""}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
              <input type="checkbox" checked={siteTribute} onChange={(e) => setSiteTribute(e.target.checked)} />
              ADD 546 SATS TO THE SITE FUND — COUNTS TOWARD DONOR STATUS ONCE CONFIRMED
            </label>
          </div>
          )}
          {leftTab === "land" && height !== null && (
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
          {leftTab === "pieces" && (
            <div className="rounded border border-border bg-card/40 p-2 text-[11px]">
              <p className="mb-1 text-accent">HOUSE & COMMUNITY PIECES</p>
              <div className="flex flex-wrap gap-1">
                {SPHERES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSphere(s.id)} className={`rounded border px-2 py-0.5 text-[10px] ${sphere === s.id ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>{s.name}</button>
                ))}
              </div>
              <div className="mt-2 max-h-[320px] space-y-1 overflow-y-auto pr-1">
                {palette.length === 0 && <p className="text-[11px] text-muted-foreground">No community pieces yet. Build one and publish it to be the first maker.</p>}
                {palette.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setPicked(p); setTool("stamp"); }} className={`w-full rounded border px-2 py-1.5 text-left text-[11px] ${picked.id === p.id && tool === "stamp" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    <span className="block text-foreground">{p.name}</span>
                    {p.blocks.length} blocks{p.author ? ` · ${short(p.author)} · ${p.bitCost ?? 0} BIT · ${p.tributeSats ?? 0} sats` : (p.bitCost ?? 0) > 0 ? "" : " · free"}{!p.author && (p.bitCost ?? 0) > 0 && <span className="ml-1 rounded border border-primary/60 px-1 text-primary">{p.bitCost} BIT</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          {leftTab === "kits" && (
          <div className="rounded border border-accent/40 bg-card/40 p-2 text-[11px]">
            <div className="flex items-center justify-between"><span className="text-accent">KITS · STEP-BY-STEP + PROGRAMMABLE</span><span className="text-[10px] text-muted-foreground">NEXT DROP {dropIn}</span></div>
            <div className="mt-1 grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto pr-1">
              {KITS.map((k, i) => {
                const active = k.id === bp.id;
                return (
                  <button key={k.id} type="button" onClick={() => { setBpId(k.id); setBpStep(0); setAuto(false); setTesting(false); }}
                    className={`group overflow-hidden rounded border text-left transition ${active ? "border-primary ring-1 ring-primary/50" : "border-border hover:border-accent/60"}`}>
                    <div className="relative bg-background/60">
                      <KitThumb bp={k} />
                      <span className="absolute left-1 top-1 rounded bg-background/80 px-1 font-mono text-[9px] text-primary">SET #{String(i + 1).padStart(3, "0")}</span>
                      <span className="absolute right-1 top-1 rounded bg-background/80 px-1 font-mono text-[9px] text-accent">{k.difficulty}</span>
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="truncate text-xs font-bold text-foreground sm:text-[10px]">{k.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground sm:text-[9px]">{k.steps.length} STEPS · {blueprintBlocks(k).length} BLOCKS · {k.behaviors.length} CARDS</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-accent">PLAYER KITS · PUBLISHED BY BUILDERS</div>
            <CommunityKitShelf kits={playerKits} activeId={bp.id} onPick={(id) => { setBpId(id); setBpStep(0); setAuto(false); setTesting(false); }} />
            <select value={bp.id} onChange={(e) => { setBpId(e.target.value); setBpStep(0); setAuto(false); setTesting(false); }} className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-foreground">
              <optgroup label="KITS · STEP-BY-STEP + PROGRAMMABLE">
                {KITS.map((k) => <option key={k.id} value={k.id}>▣ {k.name} · {k.difficulty}</option>)}
              </optgroup>
              <optgroup label="BLUEPRINTS">
                {BLUEPRINTS.map((b) => <option key={b.id} value={b.id}>{b.id === weekly.id ? `★ WEEK ${weekNumber()} · ` : ""}{b.name}</option>)}
              </optgroup>
            </select>
            {kit && !unboxed.includes(kit.id) ? (
              <KitBox key={kit.id} kit={kit} setNo={KITS.indexOf(kit) >= 0 ? KITS.indexOf(kit) + 1 : 900 + playerKits.indexOf(kit as never) + 1} onOpened={() => setUnboxed((u) => [...u, kit.id])} />
            ) : (<>
            <div className="mt-2 overflow-hidden rounded border border-border bg-background/60">
              <KitThumb bp={bp} upTo={Math.max(1, bpStep)} />
              <div className="border-t border-border px-2 py-0.5 font-mono text-[9px] text-muted-foreground">{bpStep === 0 ? "STEP 1 PREVIEW" : `YOUR PROGRESS · ${bpStep} OF ${bp.steps.length} STEPS`}</div>
            </div>
            <p className="mt-1 text-muted-foreground">{bp.story}</p>
            <div className="mt-2 flex items-center justify-between text-[10px]">
              <span className="text-accent">STEP {Math.min(bpStep + 1, bp.steps.length)} / {bp.steps.length}{bpStep >= bp.steps.length ? " · COMPLETE" : ""}</span>
              <span className="text-muted-foreground">{bp.steps[bpStep] ? `${blueprintBlocks({ ...bp, steps: [bp.steps[bpStep]!] }).length} BLOCKS THIS STEP` : ""}</span>
            </div>
            <div className="mt-1 flex gap-1 sm:gap-0.5">
              {bp.steps.map((s, i) => (
                <button key={s.title} type="button" title={`${i + 1}. ${s.title}`} aria-label={`Step ${i + 1}: ${s.title}`} onClick={() => setBpStep(i)}
                  className={`flex h-7 flex-1 items-center rounded transition sm:h-1.5 ${i < bpStep ? "bg-accent/25 sm:bg-accent" : i === bpStep ? "bg-primary/25 sm:bg-primary" : "bg-muted/50 sm:bg-muted"}`}>
                  <span className={`mx-auto h-1.5 w-full rounded-full sm:hidden ${i < bpStep ? "bg-accent" : i === bpStep ? "bg-primary" : "bg-muted"}`} />
                </button>
              ))}
            </div>
            <ol className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {bp.steps.map((s, i) => (
                <li key={s.title}>
                  <button type="button" onClick={() => setBpStep(i)} className={`w-full rounded border px-2 py-2 text-left sm:py-1 ${i === bpStep ? "border-accent text-foreground" : i < bpStep ? "border-border text-muted-foreground line-through" : "border-border text-muted-foreground"}`}>
                    {kit && kit.bags[i] !== kit.bags[i - 1] && <span className="mr-1 rounded border border-accent/60 px-1 font-mono text-[9px] text-accent">BAG {kit.bags[i]}</span>}<b>{i + 1}. {s.title}</b> — {s.tip}
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-1">
              <button type="button" onClick={() => setShowBp((v) => !v)} className="rounded border border-border px-2 py-2 text-xs text-foreground sm:py-0.5 sm:text-[10px]">{showBp ? "HIDE GUIDE" : "SHOW GUIDE"}</button>
              <button type="button" disabled={bpStep === 0} onClick={backStep} className="rounded border border-border px-2 py-2 text-xs text-muted-foreground disabled:opacity-40 sm:py-0.5 sm:text-[10px]">◀ BACK</button>
              <button type="button" disabled={bpStep >= bp.steps.length} onClick={buildStep} className="rounded border border-accent px-2 py-2 text-xs text-accent disabled:opacity-40 sm:py-0.5 sm:text-[10px]">PLACE STEP {Math.min(bpStep + 1, bp.steps.length)}</button>
              <button type="button" disabled={bpStep >= bp.steps.length} onClick={() => setAuto((a) => !a)} className="rounded border border-primary px-2 py-2 text-xs text-primary disabled:opacity-40 sm:py-0.5 sm:text-[10px]">{auto ? "❚❚ PAUSE" : "▶ AUTO-ASSEMBLE"}</button>
              <button type="button" onClick={() => setBpStep((s) => Math.min(bp.steps.length, s + 1))} className="col-span-2 rounded border border-border px-2 py-2 text-xs text-muted-foreground sm:col-span-1 sm:py-0.5 sm:text-[10px]">I BUILT IT</button>
            </div>
            {kit && (
              <div className="mt-3 border-t border-border pt-2">
                <div className="flex items-center justify-between"><span className="text-primary">BEHAVIOR CARDS</span>
                  <button type="button" disabled={!liveBehaviors.length && !testing} onClick={() => setTesting((t) => !t)} className="rounded border border-primary px-2 py-1.5 text-xs text-primary disabled:opacity-40 sm:py-0.5 sm:text-[10px]">{testing ? "■ STOP" : "▶ TEST RUN"}</button>
                </div>
                <div className="mt-1 grid grid-cols-1 gap-1">
                  {kit.behaviors.map((b) => {
                    const card = BEHAVIOR_CARDS.find((c) => c.id === b.card)!;
                    const on = !off.includes(b.card);
                    const ready = b.steps.every((s) => s < bpStep);
                    return (
                      <button key={b.card} type="button" onClick={() => setOff((o) => on ? [...o, b.card] : o.filter((x) => x !== b.card))}
                        className={`rounded border px-2 py-2 text-left text-xs sm:py-1 sm:text-[10px] ${on ? "border-primary/70 text-foreground" : "border-border text-muted-foreground"}`}>
                        <span className="flex justify-between"><b>{on ? "◉" : "○"} {card.name}</b><span className={ready ? "text-accent" : "text-muted-foreground"}>{ready ? "READY" : `AFTER STEP ${Math.max(...b.steps) + 1}`}</span></span>
                        <span className="text-muted-foreground">{card.blurb}</span>
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(kitManifest(kit, kit.behaviors.map((b) => b.card).filter((c) => !off.includes(c))), null, 2)); toast.success("KIT MANIFEST COPIED"); }} className="mt-1 w-full rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground">COPY KIT MANIFEST (JSON)</button>
              </div>
            )}
            </>)}
          </div>
          )}
          {leftTab === "pieces" && (
          <div className="rounded border border-border bg-card/40 p-2 text-[11px]">
            <p className="text-accent">START FROM YOUR BLOCK'S SEED</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {ARCHETYPES.map((a) => (
                <button key={a.id} type="button" title={a.blurb} onClick={() => seed(a.id)} className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary">{a.name}</button>
              ))}
            </div>
          </div>
          )}
          </div>
        </aside>

        <div
          data-testid="forge-dropzone"
          className="relative order-first h-[460px] overflow-hidden rounded-lg border border-border bg-card/40 lg:order-none lg:h-[620px]"
          onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setFileOver(true); } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false); }}
          onDrop={(e) => { e.preventDefault(); setFileOver(false); const f = e.dataTransfer.files?.[0]; if (f) loadVoxelFile(f); }}
        >
          {fileOver && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-accent bg-background/70 font-mono text-xs text-accent backdrop-blur-sm">
              DROP A 3D BLOCK FILE (.BWVX OR .VOX) TO LOAD AS A PIECE
            </div>
          )}
          {tool === "stamp" && hover && (
            <div className="pointer-events-none absolute right-2 top-2 z-10 rounded border border-border bg-background/80 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur">
              <span className={overLimit || ghostOut ? "text-destructive" : "text-accent"}>{overLimit || ghostOut ? "CLIPS EDGE" : "FITS"}</span> · {picked.name.toUpperCase()} · ROT {(((turns % 4) + 4) % 4) * 90}°{!picked.author && (picked.bitCost ?? 0) > 0 ? ` · ${picked.bitCost} BIT` : ""} · R ROTATE · CLICK PLACE
            </div>
          )}
          <SafeCanvas key={SPAN} shadows camera={{ position: xl ? [80, 76, 80] : [40, 38, 40], fov: 45 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[20, 40, 10]} intensity={1.2} castShadow />
            <Blocks blocks={blocks} erase={tool === "erase" || tool === "move"} onErase={eraseAt} onSurface={(c) => { if (c && tool !== "parcel") setHover(c); }} onPlace={(c) => void place(c)} />
            {hover && ghost.length > 0 && boxGhost.length === 0 && <><Ghost blocks={ghost} at={hover} bad={overLimit || ghostOut} /><GhostBounds blocks={ghost} at={hover} bad={overLimit || ghostOut} /></>}
            {boxGhost.length > 0 && <Ghost blocks={boxGhost} at={[0, 0, 0]} bad={ownCount + boxGhost.length > FORGE_MAX_BLOCKS} />}
            {perch && dnaQ.data && (
              <group position={[perch[0] - half() + 0.5, perch[1], perch[2] - half() + 0.5]} scale={0.36}>
                <OnchainGuardianBody dna={dnaQ.data} />
              </group>
            )}
            <PlacedModel height={height} span={SPAN} />
            <TerrainMass mass={mass} height={height ?? 0} />
            <ParcelFloor rects={rects} focus={focus} hoverIdx={hoverParcel?.index ?? null} />
            {showBp && sketch.length > 0 && <Ghost blocks={sketch} at={[0, 0, 0]} bad={false} />}
            {testing && liveBehaviors.map((lb) => <KitBehaviorPreview key={lb.b.card} behavior={lb.b} blocks={lb.blocks} />)}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, layer, 0]} onPointerMove={onGround} onPointerLeave={() => setHover(null)} onClick={(e) => { const c = groundCell(e); if (c) void place(c); }} receiveShadow>
              <planeGeometry args={[SPAN, SPAN]} />
              <meshStandardMaterial color="#1b1f26" transparent opacity={layer ? 0.25 : 1} />
            </mesh>
            <gridHelper args={[SPAN, SPAN, "#2c3440", "#222831"]} position={[0, layer + 0.01, 0]} />
            <OrbitControls enablePan={false} makeDefault maxPolarAngle={Math.PI / 2.1} />
          </SafeCanvas>
          <div className="pointer-events-none absolute left-3 top-3 rounded border border-border bg-background/70 px-2 py-1 text-[11px] text-accent backdrop-blur">
            {height !== null ? `${height.toLocaleString()}.BITMAP · ` : ""}{(bytes / 1024).toFixed(1)} KB · ROT {(turns % 4) * 90}°{hoverParcel ? ` · TILE ${hoverParcel.index}.${height}` : ""}{focusRect ? ` · BUILDING ON PARCEL #${focusRect.index}` : ""}
          </div>
          <div className="pointer-events-none absolute right-3 top-3 w-36 rounded border border-border bg-background/70 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
            <div className="flex justify-between"><span>BLOCKS</span><span data-testid="forge-own-count" className={ownCount > FORGE_MAX_BLOCKS * 0.85 ? "text-primary" : "text-accent"}>{ownCount}/{FORGE_MAX_BLOCKS}</span></div>
            <div className="mt-1 h-1 overflow-hidden rounded bg-muted"><div className={`h-full ${ownCount > FORGE_MAX_BLOCKS * 0.85 ? "bg-primary" : "bg-accent"}`} style={{ width: `${Math.min(100, (ownCount / FORGE_MAX_BLOCKS) * 100)}%` }} /></div>
            <div className="mt-1.5 flex justify-between"><span>PIECES</span><span data-testid="forge-piece-count" className={livePlacements.length >= MAX_ASM_PARTS ? "text-primary" : "text-accent"}>{livePlacements.length}/{MAX_ASM_PARTS}</span></div>
            {blocks.length > ownCount && <div className="text-right">+{blocks.length - ownCount} on-chain vox</div>}
          </div>
          <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-1.5 px-2">
            {chainPieces.length > 0 && (tool === "stamp" || tool === "move") && (
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-primary/40 bg-background/80 p-1 backdrop-blur">
                {chainPieces.map((p) => (
                  <button key={p.id} type="button" title="Drag onto the map, or click then click the map"
                    onPointerDown={(e) => { e.preventDefault(); setPicked(p); setTool("stamp"); setDragging(true); }}
                    className={`shrink-0 cursor-grab touch-none rounded border px-2 py-1 text-left text-[10px] active:cursor-grabbing ${picked.id === p.id && tool === "stamp" ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>
                    <span className="block">{p.name}</span>
                    <span>{p.blocks.length} vox · {placements.filter((x) => `ins:${x.part.id}` === p.id && isLive(x, world)).length} placed</span>
                  </button>
                ))}
              </div>
            )}
            <p className="pointer-events-none rounded bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
              {tool === "move" ? "CLICK A PLACED ON-CHAIN PIECE TO PICK IT UP" : tool === "erase" ? "CLICK A BLOCK TO REMOVE IT" : tool === "parcel" ? "CLICK A TILE TO BUILD ONLY ON IT" : tool === "box" ? (boxStart ? "CLICK THE OPPOSITE CORNER TO FILL · ESC CANCELS" : "CLICK ONE CORNER OF A WALL, FLOOR OR BOX") : tool === "perch" ? "CLICK WHERE YOUR GUARDIAN SHOULD LIVE" : "POINT AT ANY SURFACE · CLICK TO PLACE · IT STACKS ON TOP"}
            </p>
            {(tool === "block" || tool === "box") && (
              <div className="flex flex-wrap justify-center gap-1 rounded-lg border border-border bg-background/80 p-1 backdrop-blur">
                {BLOCKS.map((b, i) => (
                  <button key={b.id} type="button" title={`${b.name} (${(i + 1) % 10})`} onClick={() => setPaint(b.id)} className={`h-6 w-6 rounded-sm border ${paint === b.id ? "border-primary ring-2 ring-primary" : "border-border"}`} style={{ background: b.top }} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-1 rounded-lg border border-border bg-background/85 p-1 backdrop-blur">
              <div className="flex gap-0.5 rounded-md bg-muted/40 p-0.5">
                {(["stamp", "move", "block", "box", "erase", "perch", "parcel"] as Tool[]).map((t) => {
                  const [label, key] = TOOL_LABELS[t];
                  return (
                    <button key={t} type="button" title={`${label} (${key})`} onClick={() => { setTool(t); setBoxStart(null); }} className={`rounded px-2.5 py-1 text-[10px] ${tool === t ? "bg-primary/20 text-foreground ring-1 ring-primary" : "text-muted-foreground hover:text-foreground"}`}>
                      {label}<span className="ml-1 hidden text-muted-foreground sm:inline">{key}</span>
                    </button>
                  );
                })}
              </div>
              <span className="mx-1 h-4 w-px bg-border" />
              <button type="button" title="Rotate (R)" onClick={() => setTurns((t) => t + 1)} className="rounded px-2 py-1 text-[10px] text-foreground hover:bg-muted">⟳ {(((turns % 4) + 4) % 4) * 90}°</button>
              <button type="button" title="Undo (Ctrl+Z)" onClick={undo} className="rounded px-2 py-1 text-[10px] text-foreground hover:bg-muted">↶ UNDO</button>
              <RegistryDrawer height={height} canPlace={role === "bitmap"} />
              <label data-testid="forge-import" className="cursor-pointer rounded px-2 py-1 text-[10px] text-foreground hover:bg-muted">
                ⇪ IMPORT .BWVX/.VOX
                <input type="file" accept=".bwvx,.vox" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) loadVoxelFile(file);
                }} />
              </label>
              <InfoTip text="BWVX is the Bitcoin voxel format: lightweight 3D blocks small enough to store directly on Bitcoin. .VOX is the common MagicaVoxel 3D file. Both load as buildable pieces." label="What are .BWVX and .VOX?" />
              <div className="flex items-center rounded border border-border" title="Floor level (Q/E) — only needed to build in mid-air">
                <button type="button" onClick={() => setLayer((l) => Math.max(0, l - 1))} className="px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">−</button>
                <span className="px-1 text-[10px] text-muted-foreground">LVL {layer}</span>
                <button type="button" onClick={() => setLayer((l) => Math.min(SPAN - 1, l + 1))} className="px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted">+</button>
              </div>
              <button type="button" onClick={() => { if (world.size === 0 || window.confirm("Clear the whole build?")) { commit(new Map()); setUsed([]); } }} className="rounded px-2 py-1 text-[10px] text-destructive hover:bg-muted">CLEAR</button>
            </div>
          </div>
        </div>

        <aside>
          <button type="button" onClick={() => openPanel("right")} aria-expanded={rightOpen} className="flex w-full items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2 text-[11px] text-foreground lg:hidden">
            <span>INSCRIBE · PUBLISH & EARN</span><span className="text-muted-foreground">{rightOpen ? "▲ HIDE" : "▼ SHOW"}</span>
          </button>
          <div className={`space-y-3 ${rightOpen ? "mt-3" : "hidden"} lg:mt-0 lg:block`}>
          <TabBar value={rightTab} onChange={setRightTab} tabs={[["inscribe", "INSCRIBE"], ["publish", "PUBLISH & EARN"]]} />
          {rightTab === "inscribe" && (<>
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
                    <button type="button" data-testid="forge-glb" className="rounded border border-border px-2 py-0.5 hover:bg-card" onClick={() => void import("@/lib/bwvx-export").then((m) => m.downloadBuildGlb(parcelBlocks, `bitmap-${height}`)).then((r) => toast.success(`.GLB saved · ${r.boxes} boxes · ${(r.bytes / 1024).toFixed(1)} KB`)).catch((e) => toast.error(String(e?.message ?? e)))}>DOWNLOAD .GLB</button>
                    <button type="button" data-testid="forge-bwvx" className="rounded border border-border px-2 py-0.5 hover:bg-card" onClick={() => void import("@/lib/bwvx-export").then((m) => m.downloadBwvx(parcelBlocks, `bitmap-${height}`, SPAN)).then((r) => toast.success(`.BWVX saved · ${r.bytes.toLocaleString()} B`)).catch((e) => toast.error(String(e?.message ?? e)))}>DOWNLOAD .BWVX</button><InfoTip text="BWVX is the Bitcoin voxel format: lightweight 3D blocks small enough to store directly on Bitcoin." />
                  </div>
                );
              })()}
              <ProvenanceCard
                height={height}
                blocks={parcelBlocks.length}
                parents={[
                  ...used.map((u) => ({ label: u.name, kind: "Community piece", creator: u.author ?? null, ref: u.id })),
                  ...[...new Set(livePlacements.map((p) => p.part.id))].map((id) => ({ label: chainPieces.find((c) => c.id === `ins:${id}`)?.name ?? `${id.slice(0, 8)}…`, kind: "Inscribed piece", creator: makers[id] ?? null, ref: id })),
                ]}
                payouts={payouts}
              />
              <ShadowInscriber
                key={digest}
                slug={`forge-${height}`}
                height={height}
                index={0}
                digest={digest}
                artifactLabel={parcelTarget !== undefined ? `ETCH YOUR BUILD ONTO PARCEL #${parcelTarget}'S OWN SAT` : focusRect ? `ETCH PARCEL #${focusRect.index} BUILD ONTO THE BITMAP'S OWN SAT` : "ETCH YOUR BUILD ONTO THE BITMAP'S OWN SAT"}
                actionLabel="INSCRIBE ON BITCOIN"
                description={parcelTarget !== undefined ? `Your wallet must hold parcel #${parcelTarget} of ${height}.bitmap. The build is stamped onto your parcel's own sat and shows on its tile on the BITMAP and in the Oasis.${payoutSats ? ` ${payoutSats.toLocaleString()} sats go to the makers listed above in that same transaction.` : ""}` : `Your wallet must hold ${height}.bitmap. The build is stamped onto the very same sat as your BITMAP, which returns to you in the same transaction.${payoutSats ? ` ${payoutSats.toLocaleString()} sats go to the makers listed above in that same transaction.` : ""}`}
                allowUpload={false}
                claimParentsForHeight={height}
                reinscribeOnBitmap
                {...(parcelTarget !== undefined ? { parcelIndex: parcelTarget } : {})}
                artifactVariants={[
                  ...(asmHtml ? [{ key: "asm", label: xl ? "XL RECURSIVE BUILD · 128³" : livePlacements.length ? "RECURSIVE BUILD" : "BUILD + GUARDIAN", contentType: "text/html;charset=utf-8", source: asmHtml, note: `${livePlacements.length} inscribed piece${livePlacements.length === 1 ? "" : "s"} pulled live from Bitcoin${perch ? " · your Guardian perched on top" : ""} · ${(asmBytes / 1024).toFixed(1)} KB.`, ...(payouts.length ? { tributes: payouts } : {}) }] : []),
                  ...(xl ? [] : FORGE_MASTER_DELEGATE_ID ? (() => { const best = encodeBuildBest(parcelBlocks); const meta = forgeDelegateMetadata(height, best.data, lineage, focusRect ?? undefined, best.format); return [{ key: "lean", label: "LEAN BUILD", contentType: "text/html;charset=utf-8", source: html, note: `Drawn by the shared on-chain Forge renderer (${best.format}) — about ${delegateSavings(html, meta).saved.toLocaleString()} fewer bytes to pay for.`, delegate: FORGE_MASTER_DELEGATE_ID, metadata: meta, ...(payouts.length ? { tributes: payouts } : {}) }]; })() : []),
                  ...(xl ? [] : [{ key: "html", label: "3D BUILD", contentType: "text/html;charset=utf-8", source: html, note: "Self-rendering build, no outside code.", ...(payouts.length ? { tributes: payouts } : {}) }]),
                ]}
              />
            </div>
          ) : (
            <p className="rounded border border-border p-3 text-[11px] text-muted-foreground">Enter your BITMAP number and place some blocks to inscribe.</p>
          )}

          </>)}
          {rightTab === "publish" && (
          <div className="rounded border border-border bg-card/40 p-3 text-[11px]">
            <p className="mb-2 text-primary">PUBLISH AS A REUSABLE PIECE</p>
            <p className="mb-2 text-muted-foreground">Others can drop it into their own builds. You earn BIT each time it's placed and sats each time a build using it is inscribed — and so do the makers of the pieces you used.</p>
            <input value={pub.name} onChange={(e) => setPub({ ...pub, name: e.target.value.slice(0, 40) })} placeholder="Piece name" className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-foreground" />
            <div className="mb-2 grid grid-cols-2 gap-2">
              <label className="text-muted-foreground">BIT / USE<input type="number" min={0} max={500} value={pub.bit} onChange={(e) => setPub({ ...pub, bit: Math.max(0, Math.min(500, Number(e.target.value) || 0)) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground" /></label>
              <label className="text-muted-foreground">SATS / INSCRIBE<input type="number" min={0} max={100000} value={pub.sats} onChange={(e) => setPub({ ...pub, sats: Math.max(0, Math.min(100000, Number(e.target.value) || 0)) })} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground" /></label>
            </div>
            {wallet && <p className="mb-2 text-[10px] text-muted-foreground">SAT ROYALTIES PAID TO <span className="text-accent">{short(wallet.paymentAddress || wallet.ordinalsAddress)}</span>{wallet.paymentAddress ? " (PAYMENT ADDRESS)" : ""}</p>}
            <button type="button" onClick={() => void publish()} className="w-full rounded border border-primary bg-primary/10 px-2 py-1.5 text-foreground">PUBLISH PIECE</button>
            <div className="mt-3 border-t border-border pt-2">
              <PackageKit blocks={[...world.values()]} wallet={wallet} onPublished={(id) => { setBpId(id); setBpStep(0); setLeftTab("kits"); }} />
            </div>
          </div>
          )}
          <p className="text-[11px] text-muted-foreground">Want to walk it first? <a href={height !== null ? `/oasis?height=${height}` : "/oasis"} className="text-accent underline">Open the Oasis</a>.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
