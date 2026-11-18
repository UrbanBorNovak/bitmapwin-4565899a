import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { groundY } from "@/lib/world-terrain";
import { liveBeasts } from "@/lib/world-entities";
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
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [pose]);

  useFrame(({ clock }) => {
    const p = pose.current;
    const t = clock.elapsedTime;
    const b = mmoTarget.beast;
    if (b && !alive(b)) setTarget(null);
    const live = mmoTarget.beast;
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
    </>
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
