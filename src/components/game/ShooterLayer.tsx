import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STRIDE, type PlayerState } from "@/lib/player-state";
import { ATTACK_RANGE } from "@/lib/map-presence";
import type { MapCursor } from "@/lib/map-presence";
import { playSfx, unlockAudio } from "@/lib/world-audio";
import { WEAPONS, WeaponModel, useWeaponMaterials, type WeaponKind } from "./weapons";
import {
  damageBeast,
  liveBeasts,
  liveVeins,
  mineVoxel,
  type BeastEntity,
  type OreVein,
  type OreVoxel,
} from "@/lib/world-entities";
import { addItem, grantXp, skillLevel } from "@/lib/world-skills";

/**
 * WEAPONS IN THE WORLD — carry a Mosin Nagant, a revolver, a whip or a pickaxe.
 *
 * Hitscan strikes from the live camera. A strike can land on another visitor
 * (only inside the shared melee-range rule the world already enforces, so no
 * client can invent long-range damage against a person), on wildlife, which
 * carries its own health, or — with the pickaxe — on a gold vein, which gives up
 * one voxel per swing until the seam is empty. Downing an animal or breaking ore
 * pays experience into the visitor's own skills. The carried model is drawn in
 * front of the camera in first person; in third person the avatar holds it.
 */

export const SHOT_DAMAGE = 12;

export type ShooterStats = {
  weapon: WeaponKind;
  ammo: number;
  magazine: number;
  reloading: boolean;
  score: number;
  kills: number;
  targets: number;
  note: string | null;
};

type Tracer = { id: number; from: THREE.Vector3; to: THREE.Vector3; born: number };
type Burst = { id: number; at: THREE.Vector3; born: number };


export function ShooterLayer({
  active,
  firstPerson,
  weapon,
  pose,
  cursors,
  bitcoin,
  onShootPeer,
  onStats,
}: {
  active: boolean;
  /** only the first-person view draws the carried model in front of the camera */
  firstPerson: boolean;
  weapon: WeaponKind;
  pose: React.RefObject<PlayerState>;
  cursors: MapCursor[];
  bitcoin: string;
  /** land a strike on another visitor through the world's shared combat rules */
  onShootPeer: (id: string) => void;
  onStats: (stats: ShooterStats) => void;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;
  const spec = WEAPONS[weapon];

  const [ammo, setAmmo] = useState(spec.magazine);
  const [reloading, setReloading] = useState(false);
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [tracers, setTracers] = useState<Tracer[]>([]);
  const [flash, setFlash] = useState(0);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextBurst = useRef(0);
  const [lash, setLash] = useState(0);

  const lastFire = useRef(0);
  const nextTracer = useRef(0);
  const heldRef = useRef<THREE.Group>(null);
  const recoil = useRef(0);
  const materials = useWeaponMaterials();

  // swapping weapons hands you a full load
  useEffect(() => {
    setAmmo(spec.magazine);
    setReloading(false);
  }, [spec.magazine, weapon]);

  useFrame((_, delta) => {
    if (!active) return;
    const now = performance.now();
    if (flash && now - flash > 70) setFlash(0);
    setTracers((current) => (current.length && now - current[0]!.born > 120 ? current.slice(1) : current));
    setBursts((current) => (current.length && now - current[0]!.born > 620 ? current.slice(1) : current));

    const next = Math.max(0, recoil.current - delta * 3.4);
    if (next !== recoil.current) {
      recoil.current = next;
      setLash((current) => (Math.abs(current - next) > 0.06 || next === 0 ? next : current));
    }

    // keep the carried model glued to the view, with a kick after each strike
    const held = heldRef.current;
    if (held && firstPerson) {
      const kick = recoil.current;
      held.position.copy(camera.position);
      held.quaternion.copy(camera.quaternion);
      const long = weapon === "mosin" || weapon === "pickaxe";
      held.translateX(STRIDE * (long ? 0.34 : 0.26));
      held.translateY(-STRIDE * (long ? 0.3 : 0.26) - kick * STRIDE * 0.08);
      held.translateZ(-STRIDE * (long ? 0.55 : 0.4) + kick * STRIDE * 0.22);
      held.rotateX(kick * (weapon === "whip" ? -0.3 : 0.22));
    }
  });

  const flashNote = useCallback((message: string) => {
    setNote(message);
    window.setTimeout(() => setNote((current) => (current === message ? null : current)), 1300);
  }, []);

  const reload = useCallback(() => {
    if (spec.magazine === 0) return;
    if (reloading || ammo === spec.magazine) return;
    setReloading(true);
    playSfx(spec.reloadSfx);
    window.setTimeout(() => {
      setAmmo(spec.magazine);
      setReloading(false);
      // The cylinder reload already ends on a closed gate — no extra click.
      if (spec.cycleSfx && spec.reloadSfx !== "cylinder") playSfx(spec.cycleSfx);
    }, spec.reloadMs);

  }, [ammo, reloading, spec]);

  const fire = useCallback(() => {
    const me = pose.current;
    if (!active || !me) return;
    const now = performance.now();
    if (now - lastFire.current < spec.cooldownMs) return;
    if (reloading) return;
    if (spec.magazine > 0 && ammo <= 0) {
      playSfx("empty");
      flashNote("EMPTY · R TO RELOAD");
      return;
    }
    lastFire.current = now;
    if (spec.magazine > 0) setAmmo((current) => Math.max(0, current - 1));
    playSfx(spec.fireSfx);
    if (spec.cycleSfx) {
      const cycle = spec.cycleSfx;
      window.setTimeout(() => playSfx(cycle), spec.cycleDelayMs);
    }
    if (!spec.mining && weapon !== "whip") setFlash(now);
    recoil.current = 1;
    setLash(1);

    const range = STRIDE * spec.reachStrides;
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(direction);
    const ray = new THREE.Ray(origin, direction.normalize());

    let best: { distance: number; point: THREE.Vector3; peer: MapCursor } | null = null;
    const hit = new THREE.Vector3();
    for (const peer of cursorsRef.current) {
      if (peer.hp <= 0) continue;
      const center = new THREE.Vector3(peer.x, STRIDE * 1.1, peer.z);
      const sphere = new THREE.Sphere(center, STRIDE * (weapon === "whip" ? 1.3 : 0.85));
      if (!ray.intersectSphere(sphere, hit)) continue;
      const distance = origin.distanceTo(hit);
      if (distance > range) continue;
      if (!best || distance < best.distance) best = { distance, point: hit.clone(), peer };
    }

    // WILDLIFE — every animal carries its own health, so a strike can bring it down.
    let beastHit: { distance: number; point: THREE.Vector3; beast: BeastEntity } | null = null;
    for (const beast of liveBeasts()) {
      if (beast.deadUntil || beast.hp <= 0) continue;
      const center = new THREE.Vector3(beast.x, beast.bodyY, beast.z);
      const sphere = new THREE.Sphere(center, Math.max(beast.bodyRadius, STRIDE * 0.12));
      if (!ray.intersectSphere(sphere, hit)) continue;
      const distance = origin.distanceTo(hit);
      if (distance > range) continue;
      if (!beastHit || distance < beastHit.distance) {
        beastHit = { distance, point: hit.clone(), beast };
      }
    }

    // GOLD — only a mining tool bites into a seam, one voxel per swing.
    let oreHit:
      | { distance: number; point: THREE.Vector3; vein: OreVein; voxel: OreVoxel }
      | null = null;
    if (spec.mining) {
      for (const vein of liveVeins()) {
        if (vein.depletedUntil) continue;
        if (Math.hypot(vein.x - me.x, vein.z - me.z) > range + STRIDE * 2) continue;
        for (const voxel of vein.voxels) {
          if (!voxel.alive) continue;
          const center = new THREE.Vector3(vein.x + voxel.x, voxel.y, vein.z + voxel.z);
          const sphere = new THREE.Sphere(center, voxel.size * 0.9);
          if (!ray.intersectSphere(sphere, hit)) continue;
          const distance = origin.distanceTo(hit);
          if (distance > range) continue;
          if (!oreHit || distance < oreHit.distance) {
            oreHit = { distance, point: hit.clone(), vein, voxel };
          }
        }
      }
    }

    // Whatever the swing reached first is what it struck.
    const nearest = [
      best ? { kind: "peer" as const, distance: best.distance, point: best.point } : null,
      beastHit ? { kind: "beast" as const, distance: beastHit.distance, point: beastHit.point } : null,
      oreHit ? { kind: "ore" as const, distance: oreHit.distance, point: oreHit.point } : null,
    ]
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.distance - b.distance)[0];

    if (weapon !== "whip" && !spec.mining) {
      const end = nearest
        ? nearest.point.clone()
        : origin.clone().addScaledVector(ray.direction, range * 0.5);
      const id = ++nextTracer.current;
      setTracers((current) => [...current.slice(-5), { id, from: origin.clone(), to: end, born: now }]);
    }

    const impact = nearest
      ? nearest.point.clone()
      : origin.clone().addScaledVector(ray.direction, range * 0.35);
    setBursts((current) => [...current.slice(-3), { id: ++nextBurst.current, at: impact, born: now }]);

    if (!nearest) {
      if (spec.mining) flashNote("NOTHING TO MINE HERE");
      return;
    }

    // MINING — break the voxel, bank the experience, keep the nugget.
    if (nearest.kind === "ore" && oreHit) {
      const level = skillLevel("mining");
      if (level < oreHit.vein.level) {
        flashNote(`NEEDS MINING LEVEL ${oreHit.vein.level}`);
        return;
      }
      const result = mineVoxel(oreHit.vein, oreHit.voxel);
      if (!result.mined) return;
      playSfx("ore");
      const stored = addItem("gold-nugget", 1);
      const gained = grantXp("mining", oreHit.vein.xpPerVoxel);
      setScore((current) => current + 15);
      if (!stored) {
        flashNote("BACKPACK FULL");
      } else if (gained.levelled) {
        playSfx("levelup");
        flashNote(`MINING LEVEL ${gained.level}`);
      } else {
        playSfx("nugget");
        flashNote(
          result.emptied
            ? "SEAM MINED OUT · GONE FOR GOOD"
            : `+${oreHit.vein.xpPerVoxel} MINING XP`,
        );
      }
      return;
    }

    // WILDLIFE — damage, a downed animal, and the experience for the kill.
    if (nearest.kind === "beast" && beastHit) {
      const struck = damageBeast(beastHit.beast, spec.damage);
      if (!struck.damage) return;
      playSfx(struck.killed ? "kill" : "hit");
      setScore((current) => current + (struck.killed ? 40 : 10));
      if (struck.killed) {
        setKills((current) => current + 1);
        const gained = grantXp("hunter", beastHit.beast.xp);
        addItem(beastHit.beast.hostile ? "fang" : "hide", 1);
        if (gained.levelled) {
          playSfx("levelup");
          flashNote(`HUNTER LEVEL ${gained.level}`);
        } else {
          flashNote(`${beastHit.beast.label} DOWN · +${beastHit.beast.xp} HUNTER XP`);
        }
      } else {
        grantXp("attack", Math.round(struck.damage * 1.4));
        flashNote(`${beastHit.beast.label} · ${beastHit.beast.hp}/${beastHit.beast.maxHp}`);
      }
      return;
    }

    if (!best) return;
    const reach = Math.hypot(best.peer.x - me.x, best.peer.z - me.z);
    if (reach > ATTACK_RANGE) {
      flashNote(`${best.peer.handle} OUT OF COMBAT RANGE`);
      return;
    }
    // SPLASH — the strike lands on the target and everyone caught in the blast
    // around the impact, still inside the world's shared combat range.
    const splash = STRIDE * spec.splashStrides;
    const caught = cursorsRef.current.filter((peer) => {
      if (peer.hp <= 0) return false;
      if (peer.id === best!.peer.id) return true;
      const near = Math.hypot(peer.x - impact.x, peer.z - impact.z) <= splash;
      const inRange = Math.hypot(peer.x - me.x, peer.z - me.z) <= ATTACK_RANGE;
      return near && inRange;
    });
    for (const peer of caught) onShootPeer(peer.id);
    playSfx("hit");
    setScore((current) => current + 25 * caught.length);
    setKills((current) => current + caught.filter((peer) => peer.hp - SHOT_DAMAGE <= 0).length);
    grantXp("attack", 20 * caught.length);
    flashNote(
      caught.length > 1
        ? `SPLASH HIT ${caught.length} VISITORS`
        : `HIT ${best.peer.handle}`,
    );
  }, [active, ammo, camera, flashNote, onShootPeer, pose, reloading, spec, weapon]);



  // Mouse / touch strike on the canvas, R to reload.
  useEffect(() => {
    if (!active) return;
    const element = gl.domElement;
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      unlockAudio();
      fire();
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code === "KeyR") {
        event.preventDefault();
        reload();
      }
      if (event.code === "KeyE") {
        event.preventDefault();
        unlockAudio();
        fire();
      }
    };
    element.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, fire, gl, reload]);

  useEffect(() => {
    if (!active || spec.magazine === 0) return;
    if (ammo === 0 && !reloading) reload();
  }, [active, ammo, reload, reloading, spec.magazine]);

  const liveTargets = cursors.filter((peer) => peer.hp > 0).length;
  useEffect(() => {
    onStats({
      weapon,
      ammo,
      magazine: spec.magazine,
      reloading,
      score,
      kills,
      targets: liveTargets,
      note,
    });
  }, [ammo, kills, liveTargets, note, onStats, reloading, score, spec.magazine, weapon]);

  if (!active) return null;

  return (
    <group>
      {firstPerson ? (
        <group ref={heldRef}>
          <WeaponModel
            kind={weapon}
            u={STRIDE}
            materials={materials}
            flash={Boolean(flash)}
            flashColor={bitcoin}
            lash={lash}
          />
        </group>
      ) : null}

      {bursts.map((burst) => (
        <VoxelBurst key={burst.id} at={burst.at} born={burst.born} color={bitcoin} radius={STRIDE * spec.splashStrides} />
      ))}
      {tracers.map((tracer) => (
        <Tracer key={tracer.id} from={tracer.from} to={tracer.to} color={bitcoin} />
      ))}
      {flash ? (
        <pointLight color={bitcoin} intensity={12} distance={STRIDE * 16} position={camera.position} />
      ) : null}
    </group>
  );
}

function Tracer({ from, to, color }: { from: THREE.Vector3; to: THREE.Vector3; color: string }) {
  const geometry = useState(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints([from, to]);
    return g;
  })[0];
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={color} transparent opacity={0.75} />
    </line>
  );
}

/** Chunky voxel debris kicked up at the point of impact, sized to the splash. */
function VoxelBurst({
  at,
  born,
  color,
  radius,
}: {
  at: THREE.Vector3;
  born: number;
  color: string;
  radius: number;
}) {
  const group = useRef<THREE.Group>(null);
  const shards = useState(() =>
    Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2 + Math.random();
      const speed = 0.6 + Math.random() * 0.9;
      return {
        dir: new THREE.Vector3(Math.cos(angle) * speed, 0.8 + Math.random(), Math.sin(angle) * speed),
        size: radius * (0.08 + Math.random() * 0.12),
        spin: (Math.random() - 0.5) * 6,
      };
    }),
  )[0];

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = Math.min(1, (performance.now() - born) / 620);
    g.children.forEach((child, i) => {
      const shard = shards[i];
      if (!shard) return;
      child.position.set(
        shard.dir.x * radius * t,
        Math.max(0.02 * radius, shard.dir.y * radius * t - radius * 2.4 * t * t),
        shard.dir.z * radius * t,
      );
      child.rotation.set(shard.spin * t, shard.spin * t * 0.7, 0);
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = 1 - t;
    });
    g.scale.setScalar(1);
  });

  return (
    <group ref={group} position={at}>
      {shards.map((shard, i) => (
        <mesh key={i}>
          <boxGeometry args={[shard.size, shard.size, shard.size]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}
