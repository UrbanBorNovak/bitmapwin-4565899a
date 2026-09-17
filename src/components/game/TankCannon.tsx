import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MapCursor } from "@/lib/map-presence";
import { ATTACK_RANGE } from "@/lib/map-presence";
import type { PlayerState } from "@/lib/player-state";
import { STRIDE } from "@/lib/player-state";
import { damageBeast, liveBeasts } from "@/lib/world-entities";
import { playSfx, unlockAudio } from "@/lib/world-audio";

const COOLDOWN_MS = 1_500;
const CANNON_DAMAGE = 70;
const RANGE = STRIDE * 30;

type Shell = { id: number; from: THREE.Vector3; to: THREE.Vector3; born: number };

export function TankCannon({
  active,
  pose,
  cursors,
  bitcoin,
  onShootPeer,
  onStatus,
}: {
  active: boolean;
  pose: React.RefObject<PlayerState>;
  cursors: MapCursor[];
  bitcoin: string;
  onShootPeer: (id: string) => void;
  onStatus: (message: string) => void;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const [shells, setShells] = useState<Shell[]>([]);
  const sequence = useRef(0);
  const lastFire = useRef(0);
  const cursorsRef = useRef(cursors);
  cursorsRef.current = cursors;

  const fire = useCallback(() => {
    const player = pose.current;
    if (!active || !player || player.combat === "down") return;
    const now = performance.now();
    const remaining = COOLDOWN_MS - (now - lastFire.current);
    if (remaining > 0) {
      onStatus(`CANNON RECHARGING · ${(remaining / 1000).toFixed(1)}S`);
      return;
    }
    lastFire.current = now;
    unlockAudio();
    playSfx("cannon");

    const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).normalize();
    const from = new THREE.Vector3(player.x, player.y + STRIDE * 1.45, player.z)
      .addScaledVector(forward, STRIDE * 2.1);
    let distance = RANGE;
    let beastTarget: ReturnType<typeof liveBeasts>[number] | null = null;
    for (const beast of liveBeasts()) {
      if (beast.deadUntil || beast.hp <= 0) continue;
      const relative = new THREE.Vector3(beast.x - from.x, beast.bodyY - from.y, beast.z - from.z);
      const along = relative.dot(forward);
      if (along <= 0 || along >= distance) continue;
      const miss = relative.addScaledVector(forward, -along).length();
      if (miss <= Math.max(beast.bodyRadius, STRIDE * 1.4)) {
        distance = along;
        beastTarget = beast;
      }
    }
    let peerTarget: MapCursor | null = null;
    for (const peer of cursorsRef.current) {
      if (peer.hp <= 0) continue;
      const relative = new THREE.Vector3(peer.x - from.x, STRIDE - from.y, peer.z - from.z);
      const along = relative.dot(forward);
      if (along <= 0 || along >= distance) continue;
      const miss = relative.addScaledVector(forward, -along).length();
      const legalReach = Math.hypot(peer.x - player.x, peer.z - player.z) <= ATTACK_RANGE;
      if (miss <= STRIDE * 1.5 && legalReach) {
        distance = along;
        peerTarget = peer;
        beastTarget = null;
      }
    }
    const to = from.clone().addScaledVector(forward, distance);
    setShells((current) => [...current.slice(-2), { id: ++sequence.current, from, to, born: now }]);
    if (beastTarget) {
      const result = damageBeast(beastTarget, CANNON_DAMAGE);
      onStatus(result.killed ? `${beastTarget.label} DESTROYED` : `${beastTarget.label} · ${beastTarget.hp}/${beastTarget.maxHp}`);
    } else if (peerTarget) {
      onShootPeer(peerTarget.id);
      onStatus(`CANNON HIT · ${peerTarget.handle}`);
    } else {
      onStatus("CANNON FIRED");
    }
  }, [active, onShootPeer, onStatus, pose]);

  useEffect(() => {
    if (!active) return;
    const canvas = gl.domElement;
    const pointer = (event: PointerEvent) => {
      if (event.button === 0) fire();
    };
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code !== "KeyE") return;
      event.preventDefault();
      fire();
    };
    canvas.addEventListener("pointerdown", pointer);
    window.addEventListener("keydown", key);
    return () => {
      canvas.removeEventListener("pointerdown", pointer);
      window.removeEventListener("keydown", key);
    };
  }, [active, fire, gl]);

  useFrame(() => {
    if (!shells.length) return;
    const now = performance.now();
    if (now - shells[0]!.born > 700) setShells((current) => current.filter((shell) => now - shell.born <= 700));
  });

  const flashColor = useMemo(() => new THREE.Color(bitcoin), [bitcoin]);
  if (!active) return null;
  return (
    <group>
      {shells.map((shell) => <CannonShell key={shell.id} shell={shell} color={flashColor} />)}
    </group>
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