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

export type WeaponKind = "mosin" | "revolver" | "whip" | "pickaxe";

export type WeaponSpec = {
  kind: WeaponKind;
  label: string;
  short: string;
  /** rounds before a reload; 0 means the weapon never needs one (whip, pickaxe) */
  magazine: number;
  reloadMs: number;
  cooldownMs: number;
  /** how far a hit can land, in strides */
  reachStrides: number;
  /** splash radius around an impact, in strides — anyone inside also takes a hit */
  splashStrides: number;
  /** damage one clean strike does to wildlife */
  damage: number;
  /** a mining tool breaks gold veins; a gun does not */
  mining: boolean;
  fireSfx: "mosin" | "revolver" | "whip" | "pick";
  /** follow-up mechanical sound after a shot (bolt lift / cylinder) */
  cycleSfx: "bolt" | "cock" | null;
  cycleDelayMs: number;
  /** the sound of loading this weapon back up */
  reloadSfx: "reload" | "cylinder";
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
    damage: 42,
    mining: false,
    fireSfx: "mosin",
    cycleSfx: "bolt",
    cycleDelayMs: 620,
    reloadSfx: "reload",
    hint: "BOLT ACTION · RIGHT TO AIM · LEFT TO FIRE",
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
    damage: 22,
    mining: false,
    fireSfx: "revolver",
    cycleSfx: "cock",
    cycleDelayMs: 220,
    reloadSfx: "cylinder",
    hint: "SIX SHOTS · RIGHT TO AIM · LEFT TO FIRE",
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
    damage: 14,
    mining: false,
    fireSfx: "whip",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    hint: "NO AMMO · RIGHT TO STEADY · LEFT TO CRACK",
  },
  pickaxe: {
    kind: "pickaxe",
    label: "PICKAXE",
    short: "PICKAXE",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 700,
    reachStrides: 3,
    splashStrides: 0.6,
    damage: 10,
    mining: true,
    fireSfx: "pick",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    hint: "MINE GOLD VEINS · RIGHT TO LINE UP · LEFT TO SWING",
  },
};

export const WEAPON_ORDER: WeaponKind[] = ["mosin", "revolver", "whip", "pickaxe"];


export function useWeaponMaterials() {
  return useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ color: "#4a3524", roughness: 0.72, metalness: 0.05 }),
      steel: new THREE.MeshStandardMaterial({ color: "#20232a", roughness: 0.34, metalness: 0.85 }),
      leather: new THREE.MeshStandardMaterial({ color: "#2b1d13", roughness: 0.85, metalness: 0.02 }),
      iron: new THREE.MeshStandardMaterial({ color: "#14161b", roughness: 0.52, metalness: 0.72 }),
      brass: new THREE.MeshStandardMaterial({ color: "#8a6a2f", roughness: 0.38, metalness: 0.9 }),
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
  const { wood, steel, leather, iron, brass } = materials;

  if (kind === "mosin") {
    // A long rifle: shaped stock, banded barrel, a bolt that lifts on the cycle,
    // sling slots, a hooded front post and a laddered rear sight.
    const bolt = lash;
    return (
      <group>
        {/* butt stock, with a shaped comb and a steel plate */}
        <mesh material={wood} position={[0, -0.02 * u, 0.4 * u]} rotation={[0.05, 0, 0]}>
          <boxGeometry args={[0.085 * u, 0.15 * u, 0.56 * u]} />
        </mesh>
        <mesh material={wood} position={[0, 0.06 * u, 0.28 * u]} rotation={[0.11, 0, 0]}>
          <boxGeometry args={[0.07 * u, 0.06 * u, 0.3 * u]} />
        </mesh>
        <mesh material={iron} position={[0, -0.02 * u, 0.68 * u]}>
          <boxGeometry args={[0.088 * u, 0.16 * u, 0.02 * u]} />
        </mesh>
        {/* pistol wrist and trigger guard */}
        <mesh material={wood} position={[0, -0.07 * u, 0.19 * u]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.06 * u, 0.11 * u, 0.08 * u]} />
        </mesh>
        <mesh material={iron} position={[0, -0.062 * u, 0.09 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.028 * u, 0.007 * u, 6, 12]} />
        </mesh>
        <mesh material={iron} position={[0, -0.05 * u, 0.1 * u]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.01 * u, 0.045 * u, 0.012 * u]} />
        </mesh>
        {/* forend */}
        <mesh material={wood} position={[0, -0.015 * u, -0.3 * u]}>
          <boxGeometry args={[0.075 * u, 0.095 * u, 0.66 * u]} />
        </mesh>
        {/* barrel + banded barrel shroud */}
        <mesh material={steel} position={[0, 0.025 * u, -0.55 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.017 * u, 0.02 * u, 1.12 * u, 12]} />
        </mesh>
        {[-0.12, -0.44, -0.72].map((z) => (
          <mesh key={z} material={iron} position={[0, 0.01 * u, z * u]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03 * u, 0.03 * u, 0.045 * u, 10]} />
          </mesh>
        ))}
        {/* receiver + magazine box */}
        <mesh material={iron} position={[0, 0.015 * u, 0.03 * u]}>
          <boxGeometry args={[0.068 * u, 0.095 * u, 0.34 * u]} />
        </mesh>
        <mesh material={iron} position={[0, -0.06 * u, -0.02 * u]}>
          <boxGeometry args={[0.055 * u, 0.075 * u, 0.14 * u]} />
        </mesh>
        {/* bolt body + handle, lifting as the action cycles */}
        <mesh material={steel} position={[0, 0.05 * u, 0.12 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018 * u, 0.018 * u, 0.24 * u, 10]} />
        </mesh>
        <group position={[0.03 * u, 0.05 * u, 0.14 * u]} rotation={[0, 0, -bolt * 1.1]}>
          <mesh material={steel} position={[0.05 * u, 0.02 * u, 0]} rotation={[0, 0, Math.PI / 2.4]}>
            <cylinderGeometry args={[0.012 * u, 0.012 * u, 0.13 * u, 8]} />
          </mesh>
          <mesh material={steel} position={[0.09 * u, 0.055 * u, 0]}>
            <sphereGeometry args={[0.022 * u, 10, 8]} />
          </mesh>
        </group>
        {/* rear sight ladder */}
        <mesh material={iron} position={[0, 0.075 * u, -0.16 * u]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[0.045 * u, 0.012 * u, 0.1 * u]} />
        </mesh>
        <mesh material={iron} position={[0, 0.09 * u, -0.12 * u]}>
          <boxGeometry args={[0.05 * u, 0.03 * u, 0.012 * u]} />
        </mesh>
        {/* hooded front post */}
        <mesh material={iron} position={[0, 0.055 * u, -1.02 * u]}>
          <boxGeometry args={[0.036 * u, 0.05 * u, 0.03 * u]} />
        </mesh>
        <mesh material={brass} position={[0, 0.07 * u, -1.02 * u]}>
          <boxGeometry args={[0.008 * u, 0.03 * u, 0.008 * u]} />
        </mesh>
        {/* sling slots and a leather sling stub */}
        <mesh material={leather} position={[0, -0.075 * u, -0.44 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.022 * u, 0.005 * u, 5, 10]} />
        </mesh>
        <mesh material={leather} position={[0, -0.09 * u, 0.42 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.022 * u, 0.005 * u, 5, 10]} />
        </mesh>
        {flash ? <Muzzle u={u} z={-1.14 * u} size={0.075} color={flashColor} /> : null}
      </group>
    );
  }

  if (kind === "revolver") {
    // Single-action iron: fluted cylinder, ejector rod, checkered grip panels.
    return (
      <group>
        {/* grip with a steel backstrap */}
        <mesh material={wood} position={[0, -0.1 * u, 0.07 * u]} rotation={[0.36, 0, 0]}>
          <boxGeometry args={[0.048 * u, 0.21 * u, 0.075 * u]} />
        </mesh>
        <mesh material={iron} position={[0, -0.1 * u, 0.11 * u]} rotation={[0.36, 0, 0]}>
          <boxGeometry args={[0.052 * u, 0.21 * u, 0.012 * u]} />
        </mesh>
        <mesh material={iron} position={[0, -0.205 * u, 0.03 * u]}>
          <boxGeometry args={[0.05 * u, 0.02 * u, 0.06 * u]} />
        </mesh>
        {/* frame */}
        <mesh material={steel} position={[0, 0.02 * u, -0.02 * u]}>
          <boxGeometry args={[0.05 * u, 0.095 * u, 0.18 * u]} />
        </mesh>
        {/* fluted cylinder */}
        <mesh material={steel} position={[0, 0.02 * u, -0.11 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.046 * u, 0.046 * u, 0.12 * u, 12]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 + lash * 0.5;
          return (
            <mesh
              key={i}
              material={iron}
              position={[Math.cos(a) * 0.033 * u, 0.02 * u + Math.sin(a) * 0.033 * u, -0.11 * u]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.009 * u, 0.009 * u, 0.125 * u, 6]} />
            </mesh>
          );
        })}
        {/* barrel with rib and ejector rod housing */}
        <mesh material={steel} position={[0, 0.03 * u, -0.3 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.019 * u, 0.019 * u, 0.3 * u, 12]} />
        </mesh>
        <mesh material={steel} position={[0, 0.058 * u, -0.3 * u]}>
          <boxGeometry args={[0.022 * u, 0.018 * u, 0.3 * u]} />
        </mesh>
        <mesh material={iron} position={[0.03 * u, 0.006 * u, -0.26 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.011 * u, 0.011 * u, 0.22 * u, 8]} />
        </mesh>
        {/* front blade + loading gate */}
        <mesh material={iron} position={[0, 0.075 * u, -0.43 * u]}>
          <boxGeometry args={[0.008 * u, 0.026 * u, 0.02 * u]} />
        </mesh>
        <mesh material={brass} position={[0.028 * u, 0.02 * u, -0.06 * u]}>
          <boxGeometry args={[0.008 * u, 0.05 * u, 0.05 * u]} />
        </mesh>
        {/* hammer, thumbed back as it fires */}
        <mesh material={steel} position={[0, 0.075 * u, 0.055 * u]} rotation={[-0.4 + lash * 0.6, 0, 0]}>
          <boxGeometry args={[0.017 * u, 0.055 * u, 0.022 * u]} />
        </mesh>
        {/* trigger + guard */}
        <mesh material={steel} position={[0, -0.04 * u, -0.01 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.031 * u, 0.007 * u, 6, 12]} />
        </mesh>
        <mesh material={iron} position={[0, -0.03 * u, -0.005 * u]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.009 * u, 0.035 * u, 0.01 * u]} />
        </mesh>
        {flash ? <Muzzle u={u} z={-0.47 * u} size={0.06} color={flashColor} /> : null}
      </group>
    );
  }

  if (kind === "pickaxe") {
    // A miner's pick: bound haft, iron head with a wedge, worn point and chisel.
    const swing = lash;
    return (
      <group rotation={[swing * 0.9, 0, 0]}>
        <mesh material={wood} position={[0, 0.07 * u, -0.3 * u]} rotation={[Math.PI / 2.2, 0, 0]}>
          <cylinderGeometry args={[0.024 * u, 0.032 * u, 0.78 * u, 10]} />
        </mesh>
        {/* grip wraps */}
        {[0.03, -0.02, -0.07].map((z) => (
          <mesh key={z} material={leather} position={[0, -0.02 * u - z * 0.4 * u, z * u]} rotation={[Math.PI / 2.2, 0, 0]}>
            <cylinderGeometry args={[0.035 * u, 0.035 * u, 0.05 * u, 8]} />
          </mesh>
        ))}
        <mesh material={leather} position={[0, -0.05 * u, 0.04 * u]} rotation={[Math.PI / 2.2, 0, 0]}>
          <cylinderGeometry args={[0.036 * u, 0.03 * u, 0.1 * u, 8]} />
        </mesh>
        {/* head collar, wedged onto the haft */}
        <mesh material={iron} position={[0, 0.25 * u, -0.53 * u]} rotation={[0.28, 0, 0]}>
          <boxGeometry args={[0.055 * u, 0.09 * u, 0.09 * u]} />
        </mesh>
        <mesh material={brass} position={[0, 0.3 * u, -0.53 * u]}>
          <boxGeometry args={[0.03 * u, 0.02 * u, 0.05 * u]} />
        </mesh>
        {/* pick point */}
        <mesh material={iron} position={[0, 0.22 * u, -0.72 * u]} rotation={[-Math.PI / 2.6, 0, 0]}>
          <coneGeometry args={[0.034 * u, 0.44 * u, 8]} />
        </mesh>
        <mesh material={steel} position={[0, 0.16 * u, -0.88 * u]} rotation={[-Math.PI / 2.6, 0, 0]}>
          <coneGeometry args={[0.014 * u, 0.1 * u, 8]} />
        </mesh>
        {/* chisel back */}
        <mesh material={iron} position={[0, 0.31 * u, -0.36 * u]} rotation={[0.52, 0, 0]}>
          <boxGeometry args={[0.062 * u, 0.055 * u, 0.22 * u]} />
        </mesh>
        <mesh material={steel} position={[0, 0.37 * u, -0.26 * u]} rotation={[0.52, 0, 0]}>
          <boxGeometry args={[0.064 * u, 0.018 * u, 0.05 * u]} />
        </mesh>
        {flash ? <Muzzle u={u} z={-0.86 * u} size={0.05} color={flashColor} /> : null}
      </group>
    );
  }

  // whip — braided leather on a bound handle, straightening as it cracks
  const segments = 12;

  return (
    <group>
      {/* handle: knob, wrap and a steel collar */}
      <mesh material={wood} position={[0, -0.02 * u, 0.12 * u]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028 * u, 0.032 * u, 0.24 * u, 10]} />
      </mesh>
      {[0.19, 0.13, 0.07].map((z) => (
        <mesh key={z} material={leather} position={[0, -0.02 * u, z * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.034 * u, 0.034 * u, 0.04 * u, 8]} />
        </mesh>
      ))}
      <mesh material={brass} position={[0, -0.02 * u, 0.24 * u]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03 * u, 0.026 * u, 0.03 * u, 10]} />
      </mesh>
      <mesh material={leather} position={[0, -0.06 * u, 0.24 * u]} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[0.03 * u, 0.006 * u, 5, 12]} />
      </mesh>
      <mesh material={steel} position={[0, -0.02 * u, -0.02 * u]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03 * u, 0.028 * u, 0.035 * u, 10]} />
      </mesh>
      {Array.from({ length: segments }, (_, i) => {
        const t = (i + 1) / segments;
        const straight = lash;
        // coiled when idle, whipped forward when it cracks
        const coil = (1 - straight) * 0.55;
        const z = -t * u * (0.22 + straight * 1.6) - 0.04 * u;
        const x = Math.sin(t * Math.PI * 2.4) * u * coil * 0.17;
        const y = -0.02 * u + Math.cos(t * Math.PI * 1.9) * u * coil * 0.15 - straight * t * u * 0.05;
        const r = Math.max((0.022 - 0.0015 * i) * u, 0.004 * u);
        return (
          <mesh key={i} material={leather} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[r, r * 0.88, 0.15 * u, 6]} />
          </mesh>
        );
      })}
      {/* the popper at the tip — what actually cracks */}
      <mesh
        material={brass}
        position={[0, -0.02 * u - lash * u * 0.05, -u * (0.26 + lash * 1.7)]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.006 * u, 0.002 * u, 0.09 * u, 6]} />
      </mesh>
      {flash ? <Muzzle u={u} z={-u * (0.3 + lash * 1.7)} size={0.03} color={flashColor} /> : null}
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
