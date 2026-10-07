import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STRIDE, type PlayerState } from "@/lib/player-state";
import { SKILL_EVENT, type ClassSkill } from "@/lib/oasis-classes";

type Fx = { id: number; kind: ClassSkill["effect"]["kind"]; born: number; life: number };

const COLORS = { heal: "#4ade80", strike: "#ff6a1f", speed: "#22d3ee", note: "#facc15" } as const;

/** Visible 3D animation for every class skill, anchored to the caster. */
export function SkillFx({ pose }: { pose: React.RefObject<PlayerState> }) {
  const [fx, setFx] = useState<Fx[]>([]);
  const next = useRef(0);

  useEffect(() => {
    const onSkill = (e: Event) => {
      const skill = (e as CustomEvent<ClassSkill>).detail;
      if (!skill) return;
      const life = skill.effect.kind === "speed" ? skill.effect.seconds * 1000 : 900;
      const id = ++next.current;
      setFx((cur) => [...cur.slice(-4), { id, kind: skill.effect.kind, born: performance.now(), life }]);
      window.setTimeout(() => setFx((cur) => cur.filter((f) => f.id !== id)), life + 50);
    };
    window.addEventListener(SKILL_EVENT, onSkill);
    return () => window.removeEventListener(SKILL_EVENT, onSkill);
  }, []);

  return (
    <>
      {fx.map((f) => (
        <SkillBurst key={f.id} fx={f} pose={pose} />
      ))}
    </>
  );
}

function SkillBurst({ fx, pose }: { fx: Fx; pose: React.RefObject<PlayerState> }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const pillar = useRef<THREE.Mesh>(null);
  const color = COLORS[fx.kind];

  useFrame(() => {
    const g = group.current;
    const me = pose.current;
    if (!g || !me) return;
    const t = Math.min(1, (performance.now() - fx.born) / fx.life);
    g.position.set(me.x, (me as { y?: number }).y ?? 0, me.z);
    const fade = 1 - t;
    if (ring.current) {
      const grow = fx.kind === "speed" ? 1.2 + Math.sin(t * 40) * 0.1 : 0.3 + t * (fx.kind === "strike" ? 4 : 2.4);
      ring.current.scale.setScalar(STRIDE * grow);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.85;
    }
    if (pillar.current) {
      pillar.current.scale.set(STRIDE * 0.9, STRIDE * (0.5 + t * 3), STRIDE * 0.9);
      pillar.current.position.y = STRIDE * (0.25 + t * 1.5);
      (pillar.current.material as THREE.MeshBasicMaterial).opacity = fade * 0.4;
    }
  });

  return (
    <group ref={group}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={STRIDE * 0.05}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial color={color} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {fx.kind === "heal" || fx.kind === "note" ? (
        <mesh ref={pillar}>
          <cylinderGeometry args={[1, 1, 1, 20, 1, true]} />
          <meshBasicMaterial color={color} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}
