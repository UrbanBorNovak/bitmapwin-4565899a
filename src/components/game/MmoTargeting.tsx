import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { groundY } from "@/lib/world-terrain";
import { damageBeast, liveBeasts } from "@/lib/world-entities";
import { FLOAT_MS, SOULSHOT_MP, SWING_MS, floats, mmoPlayer, pruneFloats, pushFloat, regen, rollSwing } from "@/lib/mmo-combat";
import { alive, approachPoint, cycleTarget, mmoTarget, setTarget } from "@/lib/mmo-target";

type Pose = { x: number; z: number; y: number; target: { x: number; z: number } | null };

/** TAB range in world units (about five BITMAPs). */
const TAB_RANGE = 0.5;

/**
 * Classic MMO markers: a pulsing ring where you clicked to walk, and a turning
 * reticle under the selected creature. Also runs TAB / ESC and auto-approach.
 */
export function MmoTargeting3D({ pose }: { pose: React.RefObject<Pose | null> }) {
  const dest = useRef<THREE.Mesh>(null);
  const reticle = useRef<THREE.Group>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const p = pose.current;
      if (e.key === "Tab" && p) {
        e.preventDefault();
        setTarget(cycleTarget(p, liveBeasts(), mmoTarget.beast, TAB_RANGE));
      } else if (e.key === "Escape" && mmoTarget.beast) {
        setTarget(null);
        mmoPlayer.autoAttack = false;
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [pose]);

  useFrame(({ clock }) => {
    const p = pose.current;
    const t = clock.elapsedTime;
    const b = mmoTarget.beast;
    if (b && !alive(b)) { setTarget(null); mmoPlayer.autoAttack = false; }
    const live = mmoTarget.beast;
    const now = performance.now();
    mmoPlayer.vitals = regen(mmoPlayer.vitals, Math.min(1 / 20, 0.05), mmoPlayer.sitting);
    if (p && live && mmoPlayer.autoAttack) {
      if (mmoPlayer.sitting) mmoPlayer.sitting = false;
      const goal = approachPoint(p, live);
      if (goal) p.target = goal;
      else if (now - mmoPlayer.lastSwing >= SWING_MS) {
        mmoPlayer.lastSwing = now;
        mmoPlayer.inCombatUntil = now + 5000;
        const sw = rollSwing(Math.random, mmoPlayer.soulshot, mmoPlayer.vitals.mp);
        if (sw.usedShot) mmoPlayer.vitals = { ...mmoPlayer.vitals, mp: mmoPlayer.vitals.mp - SOULSHOT_MP };
        const y = groundY(live.x, live.z) + live.bodyY * 2 + 0.004;
        if (sw.kind === "miss") pushFloat({ x: live.x, y, z: live.z, text: "MISS", kind: "miss" }, now);
        else {
          const r = damageBeast(live, sw.damage);
          pushFloat({ x: live.x, y, z: live.z, text: sw.kind === "crit" ? `CRITICAL ${r.damage}!` : `${r.damage}`, kind: sw.kind }, now);
          if (r.killed) mmoPlayer.autoAttack = false;
        }
      }
    }
    if (p && live && mmoTarget.approach) {
      const goal = approachPoint(p, live);
      if (goal) p.target = goal;
      else mmoTarget.approach = false;
    }
    const d = dest.current;
    if (d) {
      const goal = p?.target;
      d.visible = !!goal && !(live && mmoTarget.approach);
      if (goal) {
        d.position.set(goal.x, groundY(goal.x, goal.z) + 0.0006, goal.z);
        const k = 1 + ((t * 1.6) % 1) * 0.6;
        d.scale.setScalar(k);
        (d.material as THREE.MeshBasicMaterial).opacity = 0.9 - ((t * 1.6) % 1) * 0.7;
      }
    }
    const r = reticle.current;
    if (r) {
      r.visible = !!live;
      if (live) {
        const rad = Math.max(live.bodyRadius, 0.003) * 1.6;
        r.position.set(live.x, groundY(live.x, live.z) + 0.0008, live.z);
        r.scale.setScalar(rad);
        r.rotation.y = t * 1.4;
      }
    }
  });

  return (
    <>
      <mesh ref={dest} rotation-x={-Math.PI / 2} visible={false} renderOrder={5}>
        <ringGeometry args={[0.0022, 0.003, 32]} />
        <meshBasicMaterial color="#f7931a" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <group ref={reticle} visible={false}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation-x={-Math.PI / 2} rotation-z={(i * Math.PI) / 2} renderOrder={6}>
            <ringGeometry args={[0.85, 1, 12, 1, -0.45, 0.9]} />
            <meshBasicMaterial color="#ff4d4d" transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <FloatTexts />
    </>
  );
}

const FLOAT_COLOR: Record<string, string> = { hit: "text-foreground", crit: "text-primary", miss: "text-muted-foreground", heal: "text-signal" };

/** Rising combat numbers above struck creatures. */
function FloatTexts() {
  const [, tick] = useState(0);
  useFrame(() => {
    pruneFloats(performance.now());
    tick((n) => (n + 1) % 1000);
  });
  const now = performance.now();
  return (
    <>
      {floats.map((f) => {
        const k = (now - f.at) / FLOAT_MS;
        return (
          <Html key={f.id} position={[f.x, f.y + k * 0.004, f.z]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
            <div className={`whitespace-nowrap font-mono font-bold ${FLOAT_COLOR[f.kind]} ${f.kind === "crit" ? "text-base" : "text-sm"}`} style={{ opacity: 1 - k, textShadow: "0 1px 2px hsl(0 0% 0% / 0.9)" }}>
              {f.text}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function useTicker(ms: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

function Bar({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-5 text-muted-foreground">{label}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden border border-border bg-background/60">
        <div className={`h-full ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right tabular-nums">{Math.floor(value).toLocaleString("en-US")}/{max.toLocaleString("en-US")}</span>
    </div>
  );
}

/** Top-left status window: level, CP / HP / MP and stance. */
export function MmoPlayerHud() {
  useTicker(200);
  const v = mmoPlayer.vitals;
  const combat = mmoPlayer.autoAttack || performance.now() < mmoPlayer.inCombatUntil;
  return (
    <div className="hud-panel pointer-events-none absolute left-[calc(50%-23rem)] top-16 z-[60] w-56 px-2.5 py-2 font-mono text-[10px]">
      <div className="mb-1 flex justify-between">
        <span className="text-foreground">LV {v.level}</span>
        <span className={combat ? "text-destructive" : mmoPlayer.sitting ? "text-signal" : "text-muted-foreground"}>
          {combat ? "⚔ IN COMBAT" : mmoPlayer.sitting ? "RESTING" : "PEACEFUL"}
        </span>
      </div>
      <div className="space-y-1">
        <Bar label="CP" value={v.cp} max={v.maxCp} cls="bg-primary" />
        <Bar label="HP" value={v.hp} max={v.maxHp} cls="bg-destructive" />
        <Bar label="MP" value={v.mp} max={v.maxMp} cls="bg-signal" />
      </div>
    </div>
  );
}

/** Top-centre target window: name, hostility and a live health bar. */
export function MmoTargetHud() {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 150);
    return () => window.clearInterval(id);
  }, []);
  const b = mmoTarget.beast;
  if (!alive(b)) return null;
  const pct = Math.max(0, Math.min(100, (b.hp / b.maxHp) * 100));
  return (
    <div className="hud-panel pointer-events-auto absolute left-1/2 top-16 z-[60] w-64 -translate-x-1/2 px-3 py-2 font-mono text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className={b.hostile ? "text-destructive" : "text-signal"}>
          {b.hostile ? "HOSTILE" : "PASSIVE"} · <span className="text-foreground">{b.label.toUpperCase()}</span>
        </span>
        <button type="button" aria-label="Clear target" className="text-muted-foreground hover:text-foreground" onClick={() => setTarget(null)}>×</button>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden border border-border bg-background/60">
        <div className={`h-full transition-[width] duration-150 ${b.hostile ? "bg-destructive" : "bg-signal"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-muted-foreground">
        <span>HP {b.hp.toLocaleString("en-US")} / {b.maxHp.toLocaleString("en-US")}</span>
        <span>TAB next · ESC clear</span>
      </div>
    </div>
  );
}
