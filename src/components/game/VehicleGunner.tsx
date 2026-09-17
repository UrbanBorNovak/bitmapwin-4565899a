/**
 * VEHICLE GUNNER — the armed seat of every ride that carries a weapon.
 *
 * The crew that aims is the gunner brain in `gunner-brain.ts`: plain
 * arithmetic on the frame, so targeting, lead and trigger discipline cost
 * nothing to run — no model calls, no tokens.
 *
 * The driver keeps the trigger: click or [E] fires. [G] hands the trigger to
 * the crew, which then fires by itself the moment the hull lines up on the
 * body it has committed to. Either way the shell is aimed at the brain's
 * intercept point, so moving beasts get led rather than trailed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MapCursor } from "@/lib/map-presence";
import type { PlayerState } from "@/lib/player-state";
import { STRIDE } from "@/lib/player-state";
import { damageBeast, liveBeasts } from "@/lib/world-entities";
import { playSfx, unlockAudio } from "@/lib/world-audio";
import type { VehicleGunSpec } from "@/lib/world-vehicle";
import {
  createGunnerBrain,
  type GunnerAct,
  type GunnerTarget,
} from "@/lib/gunner-brain";

type Shell = { id: number; from: THREE.Vector3; to: THREE.Vector3; born: number };

/** how often the brain re-reads the world, milliseconds */
const THINK_MS = 90;

export function VehicleGunner({
  active,
  gun,
  pose,
  cursors,
  bitcoin,
  onShootPeer,
  onStatus,
}: {
  active: boolean;
  gun: VehicleGunSpec;
  pose: React.RefObject<PlayerState>;
  cursors: MapCursor[];
  bitcoin: string;
  onShootPeer: (id: string) => void;
  onStatus: (message: string) => void;
}) {
  const gl = useThree((state) => state.gl);
  const [shells, setShells] = useState<Shell[]>([]);
  const [lock, setLock] = useState<THREE.Vector3 | null>(null);
  const sequence = useRef(0);
  const lastFire = useRef(0);
  const lastThink = useRef(0);
  const lastCallout = useRef("");
  const autoFire = useRef(false);
  const brain = useMemo(() => createGunnerBrain(), []);
  const act = useRef<GunnerAct | null>(null);
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;

  const range = STRIDE * gun.rangeStrides;
  const shellSpeed = STRIDE * gun.shellStrides;
  const forgiveness = STRIDE * gun.forgivenessStrides;

  const muzzle = useCallback(
    (player: PlayerState) => {
      const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      return new THREE.Vector3(player.x, player.y + STRIDE * gun.muzzleUp, player.z)
        .addScaledVector(forward, STRIDE * gun.muzzleAhead);
    },
    [gun.muzzleAhead, gun.muzzleUp],
  );

  /** Send one shell at whatever the crew is pointed at. */
  const shoot = useCallback(
    (fromBrain: boolean) => {
      const player = pose.current;
      if (!active || !player || player.combat === "down") return;
      const now = performance.now();
      const remaining = gun.cooldownMs - (now - lastFire.current);
      if (remaining > 0) {
        if (!fromBrain) onStatus(`${gun.label} RECHARGING · ${(remaining / 1000).toFixed(1)}S`);
        return;
      }
      lastFire.current = now;
      unlockAudio();
      playSfx(gun.voice);

      const from = muzzle(player);
      const plan = act.current;
      const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).normalize();

      // The brain's intercept point wins whenever the hull is roughly on it —
      // that is the aim assist. Otherwise the shell just goes where you point.
      let hit: GunnerTarget | null = null;
      let to: THREE.Vector3;
      if (plan?.target && plan.align > 0.94) {
        hit = plan.target;
        to = new THREE.Vector3(plan.aimX, plan.aimY, plan.aimZ);
      } else {
        let distance = range;
        for (const beast of liveBeasts()) {
          if (beast.deadUntil || beast.hp <= 0) continue;
          const relative = new THREE.Vector3(beast.x - from.x, beast.bodyY - from.y, beast.z - from.z);
          const along = relative.dot(forward);
          if (along <= 0 || along >= distance) continue;
          if (relative.addScaledVector(forward, -along).length() <= Math.max(beast.bodyRadius, forgiveness)) {
            distance = along;
            hit = {
              id: `beast:${beast.id}`,
              kind: "beast",
              label: beast.label,
              x: beast.x,
              y: beast.bodyY,
              z: beast.z,
              hp: beast.hp,
              maxHp: beast.maxHp,
              hostile: beast.hostile,
              radius: beast.bodyRadius,
            };
          }
        }
        for (const peer of cursorsRef.current) {
          if (peer.hp <= 0) continue;
          const relative = new THREE.Vector3(peer.x - from.x, STRIDE - from.y, peer.z - from.z);
          const along = relative.dot(forward);
          if (along <= 0 || along >= distance) continue;
          if (relative.addScaledVector(forward, -along).length() <= forgiveness) {
            distance = along;
            hit = {
              id: `peer:${peer.id}`,
              kind: "peer",
              label: peer.handle,
              x: peer.x,
              y: STRIDE,
              z: peer.z,
              hp: peer.hp,
              maxHp: peer.hp,
              hostile: true,
              radius: forgiveness,
            };
          }
        }
        to = from.clone().addScaledVector(forward, distance);
      }

      setShells((current) => [...current.slice(-3), { id: ++sequence.current, from, to, born: now }]);

      if (!hit) {
        onStatus(`${gun.label} FIRED`);
        return;
      }
      if (hit.kind === "peer") {
        onShootPeer(hit.id.slice(5));
        onStatus(`${gun.label} HIT · ${hit.label}`);
        return;
      }
      const beast = liveBeasts().find((body) => `beast:${body.id}` === hit!.id);
      if (!beast) {
        onStatus(`${gun.label} FIRED`);
        return;
      }
      const result = damageBeast(beast, gun.damage);
      onStatus(
        result.killed ? `${beast.label} DESTROYED` : `${beast.label} · ${beast.hp}/${beast.maxHp}`,
      );
    },
    [active, forgiveness, gun, muzzle, onShootPeer, onStatus, pose, range],
  );

  useEffect(() => {
    if (!active) return;
    const canvas = gl.domElement;
    const pointer = (event: PointerEvent) => {
      if (event.button === 0) shoot(false);
    };
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code === "KeyE") {
        event.preventDefault();
        shoot(false);
        return;
      }
      if (event.code === "KeyG") {
        event.preventDefault();
        autoFire.current = !autoFire.current;
        onStatus(autoFire.current ? `${gun.label} · CREW WEAPONS FREE` : `${gun.label} · CREW HOLD`);
      }
    };
    canvas.addEventListener("pointerdown", pointer);
    window.addEventListener("keydown", key);
    return () => {
      canvas.removeEventListener("pointerdown", pointer);
      window.removeEventListener("keydown", key);
    };
  }, [active, gl, gun.label, onStatus, shoot]);

  useEffect(() => {
    if (active) return;
    autoFire.current = false;
    brain.committed = null;
    brain.aimingAt = null;
    brain.aimingSince = 0;
    brain.contacts.clear();
    brain.duel.book.clear();
    act.current = null;
    setLock(null);
  }, [active, brain]);

  useFrame(() => {
    const now = performance.now();
    if (shells.length && now - shells[0]!.born > 700) {
      setShells((current) => current.filter((shell) => now - shell.born <= 700));
    }
    const player = pose.current;
    if (!active || !player) return;
    if (now - lastThink.current < THINK_MS) return;
    lastThink.current = now;

    const from = muzzle(player);
    const contacts: GunnerTarget[] = [];
    for (const beast of liveBeasts()) {
      if (beast.deadUntil || beast.hp <= 0) continue;
      if (Math.hypot(beast.x - from.x, beast.z - from.z) > range) continue;
      contacts.push({
        id: `beast:${beast.id}`,
        kind: "beast",
        label: beast.label,
        x: beast.x,
        y: beast.bodyY,
        z: beast.z,
        hp: beast.hp,
        maxHp: beast.maxHp,
        hostile: beast.hostile,
        radius: beast.bodyRadius,
      });
    }
    for (const peer of cursorsRef.current) {
      if (peer.hp <= 0) continue;
      if (Math.hypot(peer.x - from.x, peer.z - from.z) > range) continue;
      contacts.push({
        id: `peer:${peer.id}`,
        kind: "peer",
        label: peer.handle,
        x: peer.x,
        y: STRIDE,
        z: peer.z,
        hp: peer.hp,
        maxHp: 100,
        hostile: true,
        radius: forgiveness,
      });
    }

    const plan = brain.think({
      now,
      x: from.x,
      y: from.y,
      z: from.z,
      yaw: player.yaw,
      speed: Math.hypot(player.vx, player.vz),
      hp: player.combat === "down" ? 0 : 100,
      maxHp: 100,
      range,
      shellSpeed,
      cooldownRemaining: Math.max(0, gun.cooldownMs - (now - lastFire.current)),
      autoFire: autoFire.current,
      contacts,
    });
    act.current = plan;

    setLock(plan.target ? new THREE.Vector3(plan.aimX, plan.aimY, plan.aimZ) : null);
    if (plan.fire) shoot(true);
    const line = `${gun.label} · ${plan.callout}`;
    if (line !== lastCallout.current) {
      lastCallout.current = line;
      onStatus(line);
    }
  });

  const flashColor = useMemo(() => new THREE.Color(bitcoin), [bitcoin]);
  if (!active) return null;
  return (
    <group>
      {shells.map((shell) => <CannonShell key={shell.id} shell={shell} color={flashColor} />)}
      {lock ? <LockReticle at={lock} color={flashColor} /> : null}
    </group>
  );
}

/** The crew's committed target, drawn where the shell would meet it. */
function LockReticle({ at, color }: { at: THREE.Vector3; color: THREE.Color }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.copy(at);
    ref.current.rotation.z += 0.05;
    const pulse = 1 + Math.sin(performance.now() / 140) * 0.12;
    ref.current.scale.setScalar(pulse);
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[STRIDE * 0.7, STRIDE * 0.92, 4]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.85}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

function CannonShell({ shell, color }: { shell: Shell; color: THREE.Color }) {
  const shellRef = useRef<THREE.Mesh>(null);
  const blastRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const elapsed = performance.now() - shell.born;
    const flight = THREE.MathUtils.clamp(elapsed / 360, 0, 1);
    shellRef.current?.position.lerpVectors(shell.from, shell.to, 1 - Math.pow(1 - flight, 3));
    if (shellRef.current) shellRef.current.visible = flight < 1;
    if (blastRef.current) {
      blastRef.current.visible = flight >= 1;
      blastRef.current.position.copy(shell.to);
      blastRef.current.scale.setScalar(0.3 + Math.max(0, (elapsed - 360) / 340) * 3.8);
      const material = blastRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 1 - (elapsed - 360) / 340);
    }
  });
  return (
    <>
      <mesh ref={shellRef} position={shell.from}>
        <sphereGeometry args={[STRIDE * 0.22, 8, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={blastRef} visible={false}>
        <sphereGeometry args={[STRIDE * 1.2, 10, 8]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
