import { useMemo } from "react";
import * as THREE from "three";

/**
 * WEAPONS — the three things a visitor can carry in the land world.
 *
 * One shared set of low-poly view models, used both as the first-person model
 * glued to the camera and as the piece held in the avatar's hand in third
 * person, so what other visitors see matches what you are holding.
 *
 * Every model is built facing -Z with its grip at the origin.
 */

export type WeaponKind = "mosin" | "revolver" | "whip";

export type WeaponSpec = {
  kind: WeaponKind;
  label: string;
  short: string;
  /** rounds before a reload; 0 means the weapon never needs one (whip) */
  magazine: number;
  reloadMs: number;
  cooldownMs: number;
  /** how far a hit can land, in strides */
  reachStrides: number;
  /** splash radius around an impact, in strides — anyone inside also takes a hit */
  splashStrides: number;
  fireSfx: "mosin" | "revolver" | "whip";
  /** follow-up mechanical sound after a shot (bolt lift / cylinder) */
  cycleSfx: "bolt" | "cock" | null;
  cycleDelayMs: number;
  hint: string;
};


export const WEAPONS: Record<WeaponKind, WeaponSpec> = {
  mosin: {
    kind: "mosin",
    label: "MOSIN NAGANT",
    short: "MOSIN",
    magazine: 5,
    reloadMs: 2_400,
    cooldownMs: 1_250,
    reachStrides: 90,
    splashStrides: 1.6,
    fireSfx: "mosin",
    cycleSfx: "bolt",
    cycleDelayMs: 620,
    hint: "BOLT ACTION · LONG RANGE · SPLASH",
  },
  revolver: {
    kind: "revolver",
    label: "REVOLVER",
    short: "REVOLVER",
    magazine: 6,
    reloadMs: 1_700,
    cooldownMs: 420,
    reachStrides: 34,
    splashStrides: 1.1,
    fireSfx: "revolver",
    cycleSfx: "cock",
    cycleDelayMs: 220,
    hint: "SIX SHOTS · FAST · SPLASH",
  },
  whip: {
    kind: "whip",
    label: "WHIP",
    short: "WHIP",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 640,
    reachStrides: 4,
    splashStrides: 2.2,
    fireSfx: "whip",
    cycleSfx: null,
    cycleDelayMs: 0,
    hint: "NO AMMO · CLOSE RANGE · WIDE SPLASH",
  },
};

export const WEAPON_ORDER: WeaponKind[] = ["mosin", "revolver", "whip"];

export function useWeaponMaterials() {
  return useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ color: "#4a3524", roughness: 0.72, metalness: 0.05 }),
      steel: new THREE.MeshStandardMaterial({ color: "#20232a", roughness: 0.34, metalness: 0.85 }),
      leather: new THREE.MeshStandardMaterial({ color: "#2b1d13", roughness: 0.85, metalness: 0.02 }),
    }),
    [],
  );
}

export type WeaponMaterials = ReturnType<typeof useWeaponMaterials>;

/** Low-poly weapon geometry, grip at origin, muzzle pointing down -Z. */
export function WeaponModel({
  kind,
  u,
  materials,
  flash = false,
  flashColor = "#f7931a",
  lash = 0,
}: {
  kind: WeaponKind;
  /** one avatar stride in world units — everything scales off this */
  u: number;
  materials: WeaponMaterials;
  flash?: boolean;
  flashColor?: string;
  /** 0..1 crack of the whip / recoil of a gun */
  lash?: number;
}) {
  const { wood, steel, leather } = materials;

  if (kind === "mosin") {
    return (
      <group>
        <mesh material={wood} position={[0, -0.02 * u, 0.34 * u]} rotation={[0.06, 0, 0]}>
          <boxGeometry args={[0.09 * u, 0.14 * u, 0.62 * u]} />
        </mesh>
        <mesh material={wood} position={[0, -0.02 * u, -0.28 * u]}>
          <boxGeometry args={[0.08 * u, 0.1 * u, 0.62 * u]} />
        </mesh>
        <mesh material={steel} position={[0, 0.02 * u, -0.52 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018 * u, 0.02 * u, 1.05 * u, 10]} />
        </mesh>
        <mesh material={steel} position={[0, 0.01 * u, 0.02 * u]}>
          <boxGeometry args={[0.07 * u, 0.09 * u, 0.3 * u]} />
        </mesh>
        <mesh material={steel} position={[0.08 * u, 0.03 * u, 0.06 * u]} rotation={[0, 0, Math.PI / 2.6]}>
          <cylinderGeometry args={[0.014 * u, 0.014 * u, 0.14 * u, 8]} />
        </mesh>
        <mesh material={steel} position={[0, 0.06 * u, -1.0 * u]}>
          <boxGeometry args={[0.02 * u, 0.05 * u, 0.04 * u]} />
        </mesh>
        {flash ? <Muzzle u={u} z={-1.08 * u} size={0.07} color={flashColor} /> : null}
      </group>
    );
  }

  if (kind === "revolver") {
    return (
      <group>
        {/* grip */}
        <mesh material={wood} position={[0, -0.09 * u, 0.06 * u]} rotation={[0.34, 0, 0]}>
          <boxGeometry args={[0.045 * u, 0.19 * u, 0.07 * u]} />
        </mesh>
        {/* frame */}
        <mesh material={steel} position={[0, 0.02 * u, -0.02 * u]}>
          <boxGeometry args={[0.05 * u, 0.09 * u, 0.16 * u]} />
        </mesh>
        {/* cylinder */}
        <mesh material={steel} position={[0, 0.02 * u, -0.11 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045 * u, 0.045 * u, 0.11 * u, 6]} />
        </mesh>
        {/* barrel */}
        <mesh material={steel} position={[0, 0.03 * u, -0.29 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018 * u, 0.018 * u, 0.26 * u, 10]} />
        </mesh>
        {/* barrel rib */}
        <mesh material={steel} position={[0, 0.055 * u, -0.29 * u]}>
          <boxGeometry args={[0.02 * u, 0.02 * u, 0.26 * u]} />
        </mesh>
        {/* hammer */}
        <mesh material={steel} position={[0, 0.07 * u, 0.05 * u]} rotation={[-0.4 + lash * 0.5, 0, 0]}>
          <boxGeometry args={[0.016 * u, 0.05 * u, 0.02 * u]} />
        </mesh>
        {/* trigger guard */}
        <mesh material={steel} position={[0, -0.035 * u, -0.01 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.03 * u, 0.007 * u, 6, 10]} />
        </mesh>
        {flash ? <Muzzle u={u} z={-0.44 * u} size={0.06} color={flashColor} /> : null}
      </group>
    );
  }

  // whip — braided leather that straightens as it cracks
  const segments = 9;
  return (
    <group>
      <mesh material={leather} position={[0, -0.02 * u, 0.1 * u]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.026 * u, 0.03 * u, 0.22 * u, 8]} />
      </mesh>
      <mesh material={steel} position={[0, -0.02 * u, -0.02 * u]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028 * u, 0.028 * u, 0.03 * u, 8]} />
      </mesh>
      {Array.from({ length: segments }, (_, i) => {
        const t = (i + 1) / segments;
        const straight = lash;
        // coiled when idle, whipped forward when it cracks
        const coil = (1 - straight) * 0.55;
        const z = -t * u * (0.22 + straight * 1.5) - 0.04 * u;
        const x = Math.sin(t * Math.PI * 2.2) * u * coil * 0.16;
        const y = -0.02 * u + Math.cos(t * Math.PI * 1.8) * u * coil * 0.14 - straight * t * u * 0.05;
        const r = (0.02 - 0.0013 * i) * u;
        return (
          <mesh key={i} material={leather} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[Math.max(r, 0.004 * u), Math.max(r, 0.004 * u), 0.16 * u, 6]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Muzzle({ u, z, size, color }: { u: number; z: number; size: number; color: string }) {
  return (
    <mesh position={[0, 0.02 * u, z]}>
      <sphereGeometry args={[size * u, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </mesh>
  );
}
