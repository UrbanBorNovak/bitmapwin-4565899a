import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ClientOnly, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { OrbitControls } from "@react-three/drei";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { GuardianBody } from "@/components/bitmon/GuardianBody";
import { GUARDIAN_MASTER_DELEGATE_ID, DELEGATE_CONTENT_TYPE, MINT_TRIBUTE_ADDRESS, TRIBUTE_SATS, guardianMasterGeneratorHtml } from "@/lib/guardian-delegate";
import { UnfinishedInscriptions } from "@/components/territory/UnfinishedInscriptions";
import { ShadowInscriber, type ArtifactVariant } from "@/components/territory/ShadowInscriber";
import { SHORD_VAULT_DISABLED } from "@/lib/shord-flag";
import { ShieldedGuardianMint } from "@/components/bitmon/ShieldedGuardianMint";
import { InscriptionWatcher } from "@/components/bitmon/InscriptionWatcher";
import { RARITY_TONE, bip21, guardianArtifactSvg, guardianLevel, guardianShieldDigest, GUARDIAN_PRICE_SATS, type GuardianDna } from "@/lib/bitmon";
import { morphFromDna } from "@/lib/creature-morph";
import { blockSizeMapQuery } from "@/lib/block-bytes";
import { packParcels } from "@/components/TerritoryCanvas";

import { guardianDnaQuery, guardianQuery } from "@/lib/bitmon-queries";
import { checkSummonOrderFn, createSummonOrderFn, resumeSummonOrderFn } from "@/lib/bitmon.functions";
import { mintParentsFn } from "@/lib/ord-parents.functions";
import type { SummonOrder } from "@/lib/bitmon.server";
import { playSfx } from "@/lib/world-audio";

/** The Guardian's own BITMAP: its block's real transactions, one extruded parcel each, packed in block order. */
const PARCEL_TONES = ["#ffb45a", "#f7931a", "#e6810e", "#c96d08", "#a95a06"].map((c) => new THREE.Color(c));
const HOT = new THREE.Color("#7fe7ff");
const PULSE = 4;
type Hover = { index: number; size: number } | null;

function BitmapPedestal({ seed, accent, onHover }: { seed: number; accent: string; onHover: (h: Hover) => void }) {
  const { data } = useQuery({ ...blockSizeMapQuery(seed), enabled: seed >= 0 });
  const packed = useMemo(() => (data?.classes?.length ? packParcels(data.classes) : null), [data]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = packed?.parcels.length ?? 0;
  // per-parcel: x, z, footprint, height, radial delay
  const layout = useMemo(() => {
    if (!packed) return null;
    const k = 2 / packed.grid, half = packed.grid / 2;
    return packed.parcels.map((p) => {
      const x = (p.x + p.size / 2 - half) * k, z = (p.y + p.size / 2 - half) * k;
      return { x, z, w: p.size * k * 0.88, h: 0.02 + Math.min(0.25, p.size * p.size * 0.006), d: Math.hypot(x, z) / 1.45, size: p.size };
    });
  }, [packed]);
  const born = useRef(0);
  const hovered = useRef(-1);
  const o = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);
  useEffect(() => { born.current = -1; }, [layout]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m || !layout) return;
    const t = clock.elapsedTime;
    if (born.current < 0) born.current = t;
    const age = t - born.current;
    const wave = (t % PULSE) / PULSE * 1.6; // shockwave radius (0..1.6)
    if (age > 2.2 && hovered.current < 0 && Math.floor(t * 30) % 2) return; // settle: update at ~15 Hz
    layout.forEach((p, i) => {
      const rise = Math.min(1, Math.max(0, (age - p.d * 1.1) / 0.5));
      const e = 1 - Math.pow(1 - rise, 3);
      const ripple = Math.max(0, 1 - Math.abs(p.d * 1.45 - wave) * 6);
      const lift = i === hovered.current ? 1.8 : 1 + ripple * 0.6;
      const h = Math.max(0.001, p.h * e * lift);
      o.position.set(p.x, h / 2, p.z);
      o.scale.set(p.w, h, p.w);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      c.copy(PARCEL_TONES[Math.min(4, p.size - 1)]!);
      if (i === hovered.current) c.copy(HOT);
      else if (ripple > 0) c.lerp(HOT, ripple * 0.55);
      m.setColorAt(i, c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  const motes = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  const shock = useRef<THREE.Mesh>(null);
  const epochs = Math.max(1, Math.min(16, Math.floor(Math.max(0, 969_000 - seed) / 2016 / 8)));
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (motes.current) motes.current.rotation.y = t * 0.25;
    if (ring.current) ring.current.rotation.y = -t * 0.12;
    if (shock.current) {
      const k = (t % PULSE) / PULSE;
      shock.current.scale.setScalar(0.2 + k * 1.6);
      (shock.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    }
  });
  return (
    <group>
      <mesh position={[0, -0.08, 0]} receiveShadow><boxGeometry args={[2.1, 0.16, 2.1]} /><meshStandardMaterial color="#5a3104" roughness={0.8} /></mesh>
      {count ? (
        <instancedMesh
          key={count}
          ref={mesh}
          args={[undefined, undefined, count]}
          onPointerMove={(e) => { e.stopPropagation(); const i = e.instanceId ?? -1; if (i !== hovered.current) { hovered.current = i; onHover(i >= 0 && layout?.[i] ? { index: i, size: layout[i]!.size } : null); } }}
          onPointerOut={() => { hovered.current = -1; onHover(null); }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.45} metalness={0.2} emissive="#f7931a" emissiveIntensity={0.08} />
        </instancedMesh>
      ) : null}
      <mesh ref={shock} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.92, 1, 64]} />
        <meshBasicMaterial color="#7fe7ff" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <group ref={ring} position={[0, 0.005, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.62, 1.635, 96]} /><meshBasicMaterial color="#7fe7ff" transparent opacity={0.55} /></mesh>
        {Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2; const big = i % 9 === 0; return (
          <mesh key={i} position={[Math.sin(a) * 1.7, 0, Math.cos(a) * 1.7]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.008, 0.004, big ? 0.12 : 0.05]} /><meshBasicMaterial color={big ? "#f7931a" : "#7fe7ff"} />
          </mesh>
        ); })}
      </group>
      <Embers seed={seed} />
      <group ref={motes}>
        {Array.from({ length: epochs }, (_, i) => { const a = (i / epochs) * Math.PI * 2; return (
          <mesh key={i} position={[Math.sin(a) * 1.5, 0.5 + (i % 3) * 0.25, Math.cos(a) * 1.5]}><boxGeometry args={[0.05, 0.05, 0.05]} /><meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={2} /></mesh>
        ); })}
      </group>
      <pointLight position={[0, 0.3, 0]} color={accent} intensity={0.8} distance={3} />
    </group>
  );
}

/** Hash embers: orange sparks rising off the land, seeded by the block. */
function Embers({ seed, n = 140 }: { seed: number; n?: number }) {
  const geo = useMemo(() => {
    let a = (seed * 2654435761) >>> 0;
    const r = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
    const pos = new Float32Array(n * 3), meta = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 2; pos[i * 3 + 1] = r() * 2.4; pos[i * 3 + 2] = (r() - 0.5) * 2;
      meta[i * 2] = 0.15 + r() * 0.35; meta[i * 2 + 1] = r() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.userData["meta"] = meta;
    return g;
  }, [seed, n]);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const pos = geo.attributes["position"] as THREE.BufferAttribute;
    const meta = geo.userData["meta"] as Float32Array;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < n; i++) {
      arr[i * 3 + 1]! += meta[i * 2]! * dt;
      meta[i * 2 + 1]! += dt * 1.3;
      arr[i * 3]! += Math.sin(meta[i * 2 + 1]!) * dt * 0.05;
      if (arr[i * 3 + 1]! > 2.4) arr[i * 3 + 1] = 0;
    }
    pos.needsUpdate = true;
  });
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.035} color="#ffb45a" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

/** Idle life: breathing, a slow head-sway and a crouch-and-rise on every surge. */
function Breathing({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime, k = (t % PULSE) / PULSE;
    const surge = k < 0.12 ? Math.sin((k / 0.12) * Math.PI) : 0;
    const breath = Math.sin(t * 1.6) * 0.018;
    g.current.scale.set(1 + breath * 0.6, 1 + breath - surge * 0.05, 1 + breath * 0.6);
    g.current.rotation.y = Math.sin(t * 0.45) * 0.12;
    g.current.rotation.z = Math.sin(t * 0.7) * 0.02;
    g.current.position.y = surge * 0.04;
  });
  return <group ref={g}>{children}</group>;
}

/** Lens flash: a full-frame additive veil that pops on every surge. */
function SurgeFlash() {
  const m = useRef<THREE.Mesh>(null);
  useFrame(({ clock, camera }) => {
    if (!m.current) return;
    const k = (clock.elapsedTime % PULSE) / PULSE;
    m.current.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.5));
    m.current.quaternion.copy(camera.quaternion);
    (m.current.material as THREE.MeshBasicMaterial).opacity = k < 0.08 ? 0.22 * (1 - k / 0.08) : 0;
  });
  return (
    <mesh ref={m} renderOrder={999}>
      <planeGeometry args={[4, 4]} />
      <meshBasicMaterial color="#cfefff" transparent opacity={0} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

const SHOTS = {
  HERO: { pos: [1.6, 0.9, 2.4], auto: true },
  MAP: { pos: [0.01, 4.2, 0.01], auto: false },
  DETAIL: { pos: [0.9, 1.3, 1.4], auto: true },
} as const;
type Shot = keyof typeof SHOTS;

function CameraRig({ shot }: { shot: Shot }) {
  const until = useRef(0);
  const target = useMemo(() => new THREE.Vector3(...SHOTS[shot].pos), [shot]);
  useEffect(() => { until.current = -1; }, [shot]);
  useFrame(({ camera, clock }) => {
    if (until.current < 0) until.current = clock.elapsedTime + 1.1;
    if (clock.elapsedTime < until.current) {
      camera.position.lerp(target, 0.09);
      camera.lookAt(0, shot === "DETAIL" ? 0.2 : -0.2, 0);
    }
  });
  return null;
}

function ParcelHud({ height, hover }: { height: number; hover: Hover }) {
  const { data, isError } = useQuery(blockSizeMapQuery(height));
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 font-mono text-[10px]" data-no-translate>
      {hover ? <p className="text-signal">TX #{hover.index.toLocaleString()} · SIZE CLASS {hover.size} / 8</p> : null}
      <p className="text-bitcoin">
        {data?.classes?.length ? `${height}.BITMAP · ${data.classes.length.toLocaleString()} REAL TX PARCELS` : isError ? "PARCELS UNAVAILABLE" : "READING PARCELS…"}
      </p>
    </div>
  );
}

function SurgeHud() {
  const [n, setN] = useState(0);
  const [hot, setHot] = useState(false);
  useEffect(() => {
    const id = setInterval(() => { setN((v) => v + 1); setHot(true); setTimeout(() => setHot(false), 600); }, 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-none absolute left-2 top-2 font-mono text-[10px]">
      <p className={hot ? "text-signal" : "text-muted-foreground"}>⚡ DNA RESONANCE {hot ? "· SURGE" : "· CHARGING"}</p>
      <p className="text-bitcoin" data-no-translate>MUTATION CYCLE #{n}</p>
    </div>
  );
}

export function GuardianTurntable({ dna, className = "h-56" }: { dna: Pick<GuardianDna, "species" | "rarity" | "body" | "accent"> & { height?: number }; className?: string }) {
  const [shot, setShot] = useState<Shot>("HERO");
  const [hover, setHover] = useState<Hover>(null);
  return (
    <div className={`${className} relative w-full border border-border bg-background`}>
      <ClientOnly fallback={<div className="grid size-full place-items-center font-mono text-[10px] text-muted-foreground">LOADING…</div>}>
        <SafeCanvas dpr={[1, 1.5]} camera={{ position: [2.4, 1.9, 2.8], fov: 38 }} gl={{ powerPreference: "low-power" }}>
          <fog attach="fog" args={["#050505", 4, 9]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 2]} intensity={1.4} />
          <pointLight position={[0, 1, 2]} intensity={0.6} color={dna.accent} />
          <group position={[0, -0.8, 0]}>
            <Breathing>
              <GuardianBody species={dna.species} rarity={dna.rarity} body={dna.body} accent={dna.accent} height={dna.height} />
            </Breathing>
            <BitmapPedestal seed={dna.height ?? 0} accent={dna.accent} onHover={setHover} />
          </group>
          <SurgeFlash />
          <CameraRig shot={shot} />
          <OrbitControls enablePan={false} autoRotate={SHOTS[shot].auto && !hover} autoRotateSpeed={1.6} minDistance={1.2} maxDistance={6} />
        </SafeCanvas>
      </ClientOnly>
      <SurgeHud />
      {dna.height != null ? <ParcelHud height={dna.height} hover={hover} /> : null}
      <div className="absolute right-2 top-2 flex gap-1 font-mono text-[9px]">
        {(Object.keys(SHOTS) as Shot[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setShot(k)}
            className={`border px-1.5 py-0.5 ${shot === k ? "border-signal text-signal" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number | string }) {
  return (
    <div className="border border-border px-2 py-1.5">
      <p className="font-mono text-[9px] text-muted-foreground">{k}</p>
      <p className="font-mono text-sm text-foreground">{v}</p>
    </div>
  );
}

export function SummonGuardianDialog({ height, open, onOpenChange }: { height: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const dna = useQuery({ ...guardianDnaQuery(height), enabled: open });
  const awake = useQuery({ ...guardianQuery(height), enabled: open });
  const createOrder = useServerFn(createSummonOrderFn);
  const checkParents = useServerFn(mintParentsFn);
  const checkOrder = useServerFn(checkSummonOrderFn);
  const resumeOrder = useServerFn(resumeSummonOrderFn);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [order, setOrder] = useState<SummonOrder | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [bitmapIdInput, setBitmapIdInput] = useState("");
  const [needBitmapId, setNeedBitmapId] = useState(false);
  const [parentBitmapId, setParentBitmapId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [mintMode, setMintMode] = useState<"public" | "shielded">(SHORD_VAULT_DISABLED ? "public" : "shielded");

  useEffect(() => {
    if (!open) return;
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, [open]);

  // If this player already has an open invoice (paid or unpaid), pick up where
  // they left off instead of offering a fresh summon.
  useEffect(() => {
    if (!open || signedIn !== true || order || awake.data) return;
    resumeOrder({ data: { height } })
      .then((existing) => {
        if (existing) setOrder(existing);
      })
      .catch(() => {
        /* no session or network hiccup — the summon button still works */
      });
  }, [open, signedIn, order, awake.data, resumeOrder, height]);

  useEffect(() => {
    if (!order) return setQr(null);
    // qrcode pulls in pngjs (Node streams) and crashes SSR at module load —
    // load it only in the browser, inside this effect.
    let alive = true;
    import("qrcode")
      .then((m) => m.default.toDataURL(bip21(order.payTo, order.amountSats, `GUARDIAN ${height}`), { margin: 1, width: 240 }))
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(null); });
    return () => { alive = false; };
  }, [order, height]);

  useEffect(() => {
    if (!open || !order || order.status === "settled" || order.status === "expired" || order.status === "taken") return;
    const tick = async () => {
      try {
        const res = await checkOrder({ data: { orderId: order.id } });
        if (res.order) setOrder(res.order);
        if (res.awakened) {
          setCelebrate(true);
          playSfx("levelup");
          qc.invalidateQueries({ queryKey: ["guardian", height] });
          qc.invalidateQueries({ queryKey: ["guardians", "all"] });
        }
      } catch {
        /* network hiccup — keep polling */
      }
    };
    const id = window.setInterval(tick, 15_000);
    void tick();
    return () => window.clearInterval(id);
  }, [open, order, checkOrder, qc, height]);

  const start = async () => {
    setBusy(true);
    setDenied(null);
    try {
      // Stop before any payment unless the connected wallet holds <height>.bitmap.
      const { resolveWallet } = await import("@/components/BuyButton");
      const wallet = await resolveWallet();
      const manual = bitmapIdInput.trim().toLowerCase();
      if (manual && !/^[0-9a-f]{64}i\d+$/.test(manual)) {
        setDenied("THAT IS NOT A VALID INSCRIPTION ID (64 HEX CHARACTERS + i0). NOTHING WAS PAID.");
        setNeedBitmapId(true);
        return;
      }
      const check = await checkParents({
        data: { height, holderAddress: wallet.ordinalsAddress, ...(manual ? { bitmapInscriptionId: manual } : {}) },
      });
      if (!check.bitmapParentId) {
        // The LiveOCI resolver finds the BITMAP itself; only ask for a paste when it truly can't.
        setNeedBitmapId(check.notes.some((n) => /COULD NOT FIND|IS NOT \d+\.BITMAP|EARLIER/.test(n)));
        setDenied(
          `${check.notes.join(" · ")} — YOUR CONNECTED ORDINALS WALLET MUST HOLD ${height}.BITMAP. NOTHING WAS PAID.`,
        );
        return;
      }
      setParentBitmapId(check.bitmapParentId);
      if (!check.masterInscriptionId) {
        setDenied("THE COLLECTION PARENT IS UNAVAILABLE RIGHT NOW — TRY AGAIN SHORTLY. NOTHING WAS PAID.");
        return;
      }
      const res = await createOrder({ data: { height } });
      if (res.denied) setDenied(res.denied);
      else setOrder(res.order);
    } catch (e) {
      setDenied(e instanceof Error ? e.message : "COULD NOT START THE SUMMON");
    } finally {
      setBusy(false);
    }
  };

  const [revealedId, setRevealedId] = useState<string | null>(null);
  const d = dna.data;
  const already = awake.data;
  const summonTxid = already?.txid ?? (celebrate ? order?.txid : null);
  const guardianArtifact = d && summonTxid ? guardianArtifactSvg(d, summonTxid) : null;
  const guardianDigest = d && summonTxid ? guardianShieldDigest(d, summonTxid) : null;
  const artifactVariants: ArtifactVariant[] | null =
    d && summonTxid && GUARDIAN_MASTER_DELEGATE_ID
      ? [
          {
            key: "delegate",
            label: "◈ TINY DELEGATE MINT",
            contentType: DELEGATE_CONTENT_TYPE,
            source: guardianMasterGeneratorHtml(),
            delegate: GUARDIAN_MASTER_DELEGATE_ID,
            tribute: { address: MINT_TRIBUTE_ADDRESS, sats: TRIBUTE_SATS },
            note: `ALMOST ZERO BYTES: DRAWN BY THE MASTER GENERATOR, WHICH CHECKS ITS BITMAP PARENT AND A ${TRIBUTE_SATS.toLocaleString()}-SAT TRIBUTE INSIDE THIS SAME TRANSACTION`,
          },
        ]
      : null;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-widest">
            {celebrate ? "GUARDIAN AWAKENED" : `BLOCK-DNA GUARDIAN · ${height}.BITMAP`}
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            Read from this block's real hash, transactions, size and era. The same block always makes the same Guardian.
          </DialogDescription>
        </DialogHeader>

        {dna.isError ? <p className="font-mono text-xs text-destructive">COULD NOT READ THIS BLOCK FROM THE BITCOIN NETWORK.</p> : null}
        {!d ? <p className="font-mono text-xs text-signal">READING BLOCK DNA…</p> : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={celebrate ? "animate-pulse" : ""}>
              <GuardianTurntable dna={d} />
            </div>
            <div className="space-y-3">
              <div>
                <p className={`font-mono text-[11px] ${RARITY_TONE[d.rarity]}`}>{d.rarity} · ERA {d.epoch}</p>
                <p className="font-display text-2xl text-foreground">{morphFromDna(d).name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{d.species} LINE · {morphFromDna(d).plan} · {morphFromDna(d).code}</p>
                <p className="font-mono text-[11px] text-signal">ABILITY · {d.ability}</p>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <Stat k="HP" v={d.hp} /><Stat k="BITE" v={d.bite} /><Stat k="SPEED" v={d.speed} /><Stat k="ARMOR" v={d.armor} />
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">LEVEL {guardianLevel(d)} · DNA {d.dnaHash}</p>
            </div>
          </div>
        )}

        <UnfinishedInscriptions />
        <div className="border-t border-border pt-4">
          {already || celebrate ? (
            <div className="space-y-2">
              <p className="font-mono text-xs text-bitcoin">THIS GUARDIAN IS AWAKE AND PATROLS {height}.BITMAP IN THE OASIS.</p>
              <div className="border border-signal/60 p-2">
                <p className="font-mono text-[11px] text-bitcoin">✓ STEP 1 · AWAKE IN THE OASIS (CONFIRMED)</p>
                {already?.inscriptionId ? (
                  <p className="font-mono text-[11px] text-bitcoin">✓ STEP 2 · INSCRIBED ON BITCOIN AS A CHILD OF {height}.BITMAP · PART OF THE COLLECTION</p>
                ) : (
                  <>
                    <p className="font-mono text-[11px] text-signal">{celebrate || revealedId ? "→ STEP 2 · INSCRIPTION SENT · WAITING FOR CONFIRMATION" : "→ STEP 2 · INSCRIBE"} — ON-CHAIN CHILD OF {height}.BITMAP · {TRIBUTE_SATS.toLocaleString()}-SAT TRIBUTE TO THE TREASURY INSIDE THE REVEAL</p>
                    {!revealedId ? (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        THE SUMMON WOKE IT IN THE APP ONLY. TO JOIN THE COLLECTION AND BE LISTABLE, THE {height}.BITMAP HOLDER INSCRIBES A CHILD OF THAT BITMAP BELOW (TO MY WALLET) OR WITH THE HOLDER SUMMON ON THE MINT PAGE.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              {already ? <p className="font-mono text-[10px] text-muted-foreground">SUMMONED BY {already.owner.slice(0, 8)}…{already.owner.slice(-6)} · TX {already.txid.slice(0, 10)}…</p> : null}
              <Link to="/oasis" search={{ height }} className="inline-block border border-bitcoin px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background">SEE IT IN THE OASIS →</Link>
              {already?.inscriptionId ? (
                <InscriptionWatcher inscriptionId={already.inscriptionId} height={height} />
              ) : revealedId ? (
                <InscriptionWatcher inscriptionId={revealedId} height={height} />
              ) : guardianArtifact && guardianDigest ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMintMode("public")}
                      className={`flex-1 border px-2 py-1.5 font-mono text-[10px] ${mintMode === "public" ? "border-bitcoin text-bitcoin" : "border-border text-muted-foreground"}`}>
                      ◆ TO MY WALLET
                    </button>
{!SHORD_VAULT_DISABLED && (
                    <button type="button" onClick={() => setMintMode("shielded")}
                      className={`flex-1 border px-2 py-1.5 font-mono text-[10px] ${mintMode === "shielded" ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>
                      ◇ EXPERIMENT · SHIELDED DMT
                    </button>
                    )}
                  </div>
                  {mintMode === "public" || SHORD_VAULT_DISABLED ? (
                    <ShadowInscriber
                      slug={`guardian-${height}`}
                      height={height}
                      index={0}
                      digest={guardianDigest}
                      artifactSvg={guardianArtifact}
                      {...(artifactVariants ? { artifactVariants } : {})}
                      artifactLabel="GUARDIAN ORDINAL"
                      actionLabel="◆ INSCRIBE THIS GUARDIAN"
                      description="THE GUARDIAN IS ALREADY SUMMONED. THIS OPTIONAL SECOND STEP PAYS THE LIVE BITCOIN MINER COST FOR A PUBLIC ORDINAL THAT CONTAINS NO WALLET OR ACCOUNT IDENTITY. THE INSCRIBED SAT LANDS IN YOUR OWN WALLET."
                      allowUpload={false}
                      claimParentsForHeight={height}
                      {...(parentBitmapId || bitmapIdInput.trim()
                        ? { parentBitmapInscriptionId: parentBitmapId ?? bitmapIdInput.trim().toLowerCase() }
                        : {})}
                      onRevealed={(revealTxid) => setRevealedId(`${revealTxid}i0`)}
                      autoStart={celebrate}
                      autoReveal

                    />
                  ) : (
                    <ShieldedGuardianMint height={height} digest={guardianDigest} artifactSvg={guardianArtifact} {...(artifactVariants ? { artifactVariants } : {})} />

                  )}
                </div>
              ) : null}
            </div>
          ) : order ? (
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              {qr ? <img src={qr} alt="Bitcoin payment QR code" className="size-44 bg-foreground p-1" /> : <div className="size-44 border border-border" />}
              <div className="space-y-2 font-mono text-[11px]">
                <p className="text-muted-foreground">SEND EXACTLY</p>
                <p className="text-xl text-bitcoin">{order.amountSats.toLocaleString()} SATS</p>
                <p className="break-all text-foreground">{order.payTo}</p>
                <p className="text-muted-foreground">
                  {GUARDIAN_PRICE_SATS.toLocaleString()} SUMMON + {(order.amountSats - GUARDIAN_PRICE_SATS).toLocaleString()} ID SATS · 100% TO THE BITMAPWIN TREASURY · NETWORK FEE PAID BY YOUR WALLET
                </p>
                <button type="button" className="border border-border px-2 py-1 hover:border-signal" onClick={() => navigator.clipboard?.writeText(order.payTo)}>COPY ADDRESS</button>
                <p className={order.status === "seen" ? "text-signal" : "text-muted-foreground"}>
                  {order.status === "pending" && "WATCHING THE BLOCKCHAIN FOR YOUR PAYMENT…"}
                  {order.status === "seen" && "PAYMENT SEEN · AWAKENS AFTER 1 CONFIRMATION"}
                  {order.status === "expired" && "INVOICE EXPIRED — START AGAIN"}
                  {order.status === "taken" && "ANOTHER SUMMON LANDED FIRST FOR THIS BLOCK."}
                </p>
                {order.status === "pending" || order.status === "seen" ? (
                  <div aria-label="Progress to on-chain confirmation">
                    <div className="h-1.5 w-full overflow-hidden border border-border">
                      <div className={`h-full transition-all duration-700 ${order.status === "seen" ? "w-2/3 bg-signal animate-pulse" : "w-1/3 bg-bitcoin"}`} />
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                      <span className="text-bitcoin">INVOICE</span>
                      <span className={order.status === "seen" ? "text-signal" : ""}>MEMPOOL</span>
                      <span>1 CONF · AWAKE</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : signedIn === false ? (
            <Link to="/auth" className="font-mono text-xs text-bitcoin">SIGN IN TO SUMMON →</Link>
          ) : (
            <div className="space-y-2">
              <button type="button" disabled={busy || !d} onClick={start} className="border border-bitcoin bg-bitcoin px-4 py-2 font-mono text-xs text-background disabled:opacity-50">
                {busy ? "CHECKING HOLDER…" : `SUMMON FOR ${GUARDIAN_PRICE_SATS.toLocaleString()} SATS`}
              </button>
              <p className="font-mono text-[10px] text-muted-foreground">ONLY THE VERIFIED HOLDER OF THIS BITMAP CAN SUMMON. ONE GUARDIAN PER BLOCK, EVER.</p>
              {denied ? <p className="font-mono text-[11px] text-destructive">{denied}</p> : null}
              {needBitmapId ? (
                <label className="block space-y-1">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    PARENT {height}.BITMAP INSCRIPTION ID — WE CHECK ITS CONTENT ON CHAIN AND THAT IT SITS IN YOUR WALLET
                  </span>
                  <input
                    value={bitmapIdInput}
                    onChange={(e) => setBitmapIdInput(e.target.value)}
                    placeholder="txid…i0"
                    maxLength={80}
                    spellCheck={false}
                    className="w-full border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground focus:border-signal focus:outline-none"
                  />
                </label>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SummonGuardianButton({ height, className = "" }: { height: number; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`border border-bitcoin px-3 py-2 font-mono text-xs text-bitcoin hover:bg-bitcoin hover:text-background ${className}`}>
        ◆ BLOCK-DNA GUARDIAN
      </button>
      {open ? <SummonGuardianDialog height={height} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
