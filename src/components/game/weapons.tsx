import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { Primitive } from "@/components/game/Primitive";

/**
 * WEAPONS — the things a visitor can carry in the land world.
 *
 * One shared set of low-poly view models, used both as the first-person model
 * glued to the camera and as the piece held in the avatar's hand in third
 * person, so what other visitors see matches what you are holding. The sword is
 * a real on-chain inscription loaded straight from the chain.
 *
 * Every model is built facing -Z with its grip at the origin.
 */

/** on-chain GLB inscription of the sword */
import { TRAP_INSCRIPTION } from "@/lib/world-traps";
import { STAFF_INSCRIPTION, useFittedStone } from "@/lib/world-runestones";


export const SWORD_INSCRIPTION =
  "7b674e8378b14b590960d452900507e2e26089bc9f622fa7e6c938d95d697b81i0";
/** on-chain GLB inscription of the powersword */
export const POWERSWORD_INSCRIPTION =
  "b4de4f0db1e6bab3e3b5714566e90dc91091fe8630f607d79c7062a28776ef6di0";
/** on-chain GLB inscription of the second blade */
export const SWORD_TWO_INSCRIPTION =
  "593fb11363d49f4cf404d7dbbcaad623dbbc2e37539dedd328448f7feeaa8ff0i0";
/** on-chain GLB inscription of the minigun */
export const MINIGUN_INSCRIPTION =
  "46dd4a7cfb48132b2a4d06cbebdcf4a340192ba386c6f76832221c51e8d67b77i0";
/** on-chain GLB inscription of the blue wand */
export const WAND_INSCRIPTION =
  "fdc01c2ffb7e74585b121ad79000b0910b9e38087becb0102aff3f1eef2c18fai0";

/** on-chain GLB inscription of the mining pick */
export const PICK_INSCRIPTION =
  "fd69f76fc8964ab62237d8fd6a5de7f76765bbf9861a48855d6502d25b4db7e8i0";

/** on-chain GLB inscription of the sledge hammer */
export const HAMMER_INSCRIPTION =
  "fb1dcba0405adf5b6ded0312a32738a25aafa5de68db341434952d6772692fd5i0";

export type WeaponKind =
  | "minigun"
  | "revolver"
  | "trap"
  | "pickaxe"
  | "hammer"
  | "sword"
  | "powersword"
  | "wand"
  | "staff"
  | "blaster"
  | "ionrifle"
  | "lightsaber"
  | "sithsaber";



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
  fireSfx: "minigun" | "revolver" | "trap" | "pick" | "slash" | "spell" | "blaster" | "ion" | "saber";
  /** plasma bolt colour for blaster-class guns */
  boltColor?: string;
  /** blade colour for lightsabers — a saber swings an arc instead of firing */
  saber?: string;
  /** ion bolts burst into a shock ring where they land */
  ion?: boolean;
  /** holds down for continuous fire instead of one strike per click */
  auto?: boolean;
  /** the wand casts spells: an arcane bolt on click, a party heal on H */
  spell?: boolean;
  /** follow-up mechanical sound after a shot (bolt lift / cylinder) */
  cycleSfx: "bolt" | "cock" | null;
  cycleDelayMs: number;
  /** the sound of loading this weapon back up */
  reloadSfx: "reload" | "cylinder";
  hint: string;
};


export const WEAPONS: Record<WeaponKind, WeaponSpec> = {
  minigun: {
    kind: "minigun",
    label: "MINIGUN",
    short: "MINIGUN",
    magazine: 150,
    reloadMs: 4_200,
    cooldownMs: 85,
    reachStrides: 80,
    splashStrides: 1.1,
    damage: 9,
    mining: false,
    fireSfx: "minigun",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    auto: true,
    hint: "SPINS UP · RIGHT TO AIM · HOLD LEFT TO RIP",
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
  trap: {
    kind: "trap",
    label: "TRAP",
    short: "TRAP",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 900,
    reachStrides: 3,
    splashStrides: 0.4,
    damage: 4,
    mining: false,
    fireSfx: "trap",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    hint: "LEFT TO LAY A TRAP · HOLDS WHOEVER STEPS ON IT FOR 15S",
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
    hint: "MINE GOLD VEINS · LEFT TO SWING · K TO UNLOCK A CHEST",
  },
  hammer: {
    kind: "hammer",
    label: "HAMMER",
    short: "HAMMER",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 980,
    reachStrides: 3.4,
    splashStrides: 1.4,
    damage: 34,
    mining: true,
    fireSfx: "pick",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    hint: "HEAVY ON-CHAIN SLEDGE · CRUSHES ROCK AND BONE · LEFT TO SWING",
  },
  sword: {
    kind: "sword",
    label: "DUAL BLADES",
    short: "BLADES",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 430,
    reachStrides: 4.8,
    splashStrides: 1.6,
    damage: 42,
    mining: false,
    fireSfx: "slash",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    hint: "TWO ON-CHAIN BLADES · RIGHT TO GUARD · LEFT TO SLASH",
  },
  powersword: {
    kind: "powersword",
    label: "POWERSWORD",
    short: "POWERSWORD",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 620,
    reachStrides: 5.4,
    splashStrides: 2.2,
    damage: 78,
    mining: false,
    fireSfx: "slash",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    hint: "ON-CHAIN POWERSWORD · SLOW, HEAVY, DEVASTATING · LEFT TO SWING",
  },
  wand: {
    kind: "wand",
    label: "BLUE WAND",
    short: "WAND",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 420,
    reachStrides: 44,
    splashStrides: 2.4,
    damage: 26,
    mining: false,
    fireSfx: "spell",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    spell: true,
    hint: "LEFT TO CAST A BOLT · H TO HEAL THE WHOLE PARTY",
  },
  staff: {
    kind: "staff",
    label: "RUNESTONE STAFF",
    short: "STAFF",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 620,
    reachStrides: 52,
    splashStrides: 3.2,
    damage: 34,
    mining: false,
    fireSfx: "spell",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    spell: true,
    hint: "SEAT A STONE ON THE HEAD · LEFT TO CAST · H TO HEAL THE PARTY",
  },
  blaster: {
    kind: "blaster",
    label: "E-11 BLASTER RIFLE",
    short: "BLASTER",
    magazine: 40,
    reloadMs: 1_900,
    cooldownMs: 170,
    reachStrides: 60,
    splashStrides: 0.9,
    damage: 16,
    mining: false,
    fireSfx: "blaster",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    auto: true,
    boltColor: "#ff2a1f",
    hint: "RED PLASMA BOLTS · HOLD LEFT TO FIRE · RIGHT TO AIM",
  },
  ionrifle: {
    kind: "ionrifle",
    label: "ION RIFLE",
    short: "ION",
    magazine: 8,
    reloadMs: 2_400,
    cooldownMs: 650,
    reachStrides: 70,
    splashStrides: 2.6,
    damage: 34,
    mining: false,
    fireSfx: "ion",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    boltColor: "#5ad8ff",
    ion: true,
    hint: "HEAVY ION BOLT · SHOCK RING ON IMPACT · LEFT TO FIRE",
  },
  lightsaber: {
    kind: "lightsaber",
    label: "LIGHTSABER",
    short: "SABER",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 380,
    reachStrides: 5.2,
    splashStrides: 1.8,
    damage: 48,
    mining: false,
    fireSfx: "saber",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    saber: "#4fb8ff",
    hint: "LEFT TO SLASH · HOLD RIGHT TO DEFLECT · G FOR A DUEL",
  },
  sithsaber: {
    kind: "sithsaber",
    label: "CRIMSON SABER",
    short: "CRIMSON",
    magazine: 0,
    reloadMs: 0,
    cooldownMs: 460,
    reachStrides: 5.6,
    splashStrides: 2.2,
    damage: 56,
    mining: false,
    fireSfx: "saber",
    cycleSfx: null,
    cycleDelayMs: 0,
    reloadSfx: "reload",
    saber: "#ff2338",
    hint: "HEAVIER RED BLADE · HOLD RIGHT TO DEFLECT · G FOR A DUEL",
  },
};

export const WEAPON_ORDER: WeaponKind[] = [
  "blaster",
  "ionrifle",
  "lightsaber",
  "sithsaber",
  "minigun",
  "revolver",
  "trap",
  "pickaxe",
  "hammer",
  "sword",
  "powersword",
  "wand",
  "staff",
];




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
  guard = 0,
}: {
  kind: WeaponKind;
  /** one avatar stride in world units — everything scales off this */
  u: number;
  materials: WeaponMaterials;
  flash?: boolean;
  flashColor?: string;
  /** 0..1 crack of the whip / recoil of a gun */
  lash?: number;
  /** 0..1 how far the piece is brought up into a guard / aim */
  guard?: number;
}) {
  const { wood, steel, leather, iron, brass } = materials;

  if (kind === "blaster" || kind === "ionrifle") {
    const ion = kind === "ionrifle";
    const glow = ion ? "#5ad8ff" : "#ff2a1f";
    return (
      <group position={[0, -0.05 * u, 0.06 * u]} rotation={[0.02 - lash * 0.16, 0, -0.04]}>
        <mesh material={iron} position={[0, 0, -0.35 * u]}>
          <boxGeometry args={[0.09 * u, 0.12 * u, 0.62 * u]} />
        </mesh>
        <mesh material={steel} position={[0, 0.02 * u, -0.86 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[(ion ? 0.05 : 0.035) * u, (ion ? 0.05 : 0.035) * u, 0.5 * u, 10]} />
        </mesh>
        {/* cooling fins on the barrel */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={leather} position={[0, 0.02 * u, (-0.7 - i * 0.12) * u]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.055 * u, 0.055 * u, 0.04 * u, 10]} />
          </mesh>
        ))}
        <mesh material={iron} position={[0, 0.11 * u, -0.38 * u]}>
          <boxGeometry args={[0.04 * u, 0.06 * u, 0.3 * u]} />
        </mesh>
        <mesh material={leather} position={[0, -0.13 * u, -0.18 * u]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.06 * u, 0.18 * u, 0.07 * u]} />
        </mesh>
        <mesh material={iron} position={[0, -0.02 * u, 0.06 * u]}>
          <boxGeometry args={[0.07 * u, 0.09 * u, 0.28 * u]} />
        </mesh>
        {/* power cell glow */}
        <mesh position={[0.05 * u, 0, -0.3 * u]}>
          <boxGeometry args={[0.012 * u, 0.04 * u, 0.16 * u]} />
          <meshBasicMaterial color={glow} toneMapped={false} />
        </mesh>
        {flash ? <Muzzle u={u} z={-1.13 * u} size={ion ? 0.12 : 0.08} color={glow} /> : null}
      </group>
    );
  }

  if (kind === "lightsaber" || kind === "sithsaber") {
    const blade = kind === "sithsaber" ? "#ff2338" : "#4fb8ff";
    const swing = lash;
    const up = guard;
    return (
      <group
        position={[0.12 * u - up * 0.1 * u, (-0.12 + up * 0.12) * u, 0.04 * u]}
        rotation={[-0.9 + up * 0.5 + swing * 1.5, 0.3 - swing * 0.7 + up * 0.5, -0.4 - swing * 0.6 + up * 1.1]}
      >
        <mesh material={steel} position={[0, 0, 0.08 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03 * u, 0.034 * u, 0.26 * u, 12]} />
        </mesh>
        <mesh material={iron} position={[0, 0, -0.06 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04 * u, 0.034 * u, 0.04 * u, 12]} />
        </mesh>
        <mesh position={[0, 0, -0.66 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016 * u, 0.02 * u, 1.16 * u, 10]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.66 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045 * u, 0.05 * u, 1.2 * u, 12]} />
          <meshBasicMaterial color={blade} toneMapped={false} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.66 * u]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09 * u, 0.1 * u, 1.26 * u, 12]} />
          <meshBasicMaterial color={blade} toneMapped={false} transparent opacity={0.16 + swing * 0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  if (kind === "minigun") {
    // The real on-chain minigun, held level, barrels spinning as it rips.
    return (
      <group
        position={[0, -0.06 * u, 0.1 * u]}
        rotation={[0.02 - lash * 0.12, 0, -0.04]}
      >
        <Suspense fallback={<MinigunStandIn u={u} materials={materials} spin={lash} />}>
          <OnChainWeapon url={MINIGUN_URL} u={u} lengthStrides={1.5} />
        </Suspense>
        {flash ? <Muzzle u={u} z={-1.5 * u} size={0.09} color={flashColor} /> : null}
      </group>
    );
  }

  if (kind === "wand") {
    // The inscribed blue wand: a spark gathers at the tip as a spell goes off.
    return (
      <group
        position={[0.14 * u, -0.12 * u, 0.02 * u]}
        rotation={[-0.42 - lash * 0.3, 0.24, -0.12]}
      >
        <Suspense fallback={<WandStandIn u={u} materials={materials} />}>
          <OnChainWeapon url={WAND_URL} u={u} lengthStrides={0.8} />
        </Suspense>
        <mesh position={[0, 0.02 * u, -0.86 * u]}>
          <sphereGeometry args={[(0.04 + lash * 0.05) * u, 10, 10]} />
          <meshBasicMaterial color="#4fa8ff" transparent opacity={0.35 + lash * 0.55} />
        </mesh>
        {flash ? <Muzzle u={u} z={-0.9 * u} size={0.07} color="#6cc6ff" /> : null}
      </group>
    );
  }

  if (kind === "staff") {
    // The runestone staff, carried upright. Whatever stone is seated on the head
    // rides at the tip and lends the cast its colour.
    return <RunestoneStaff u={u} materials={materials} lash={lash} flash={flash} />;
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
    // The real on-chain mining pick, swung from the haft. The forged stand-in
    // below holds the pose while the inscription streams in.
    const swing = lash;
    return (
      <group
        position={[0.05 * u, -0.06 * u, 0.02 * u]}
        rotation={[-0.25 + swing * 0.9, 0.1, -0.2]}
      >
        <Suspense fallback={<PickStandIn u={u} materials={materials} />}>
          <PickModel u={u} />
        </Suspense>
        {flash ? <Muzzle u={u} z={-0.86 * u} size={0.05} color={flashColor} /> : null}
      </group>
    );
  }


  if (kind === "hammer") {
    // The on-chain sledge, hauled over the shoulder and driven down hard.
    const swing = lash;
    return (
      <group
        position={[0.06 * u, -0.05 * u, 0.04 * u]}
        rotation={[-0.42 + swing * 1.15, 0.14, -0.24]}
      >
        <Suspense fallback={<HammerStandIn u={u} materials={materials} />}>
          <OnChainWeapon url={HAMMER_URL} u={u} lengthStrides={0.72} />
        </Suspense>
        {flash ? <Muzzle u={u} z={-0.7 * u} size={0.05} color={flashColor} /> : null}
      </group>
    );
  }

  if (kind === "powersword") {
    // The on-chain powersword: two-handed, hauled high and brought down slow.
    const swing = lash;
    const up = guard;
    return (
      <group
        position={[0.1 * u, (-0.04 - up * 0.04) * u, 0.02 * u]}
        rotation={[-0.62 + up * 0.4 + swing * 1.35, 0.22 - swing * 0.4, -0.34 - swing * 0.5]}
      >
        <Suspense fallback={<SwordStandIn u={u} materials={materials} />}>
          <OnChainWeapon url={POWERSWORD_URL} u={u} lengthStrides={1.35} />
        </Suspense>
        {flash ? <Muzzle u={u} z={-1.4 * u} size={0.06} color="#6cc6ff" /> : null}
      </group>
    );
  }


  if (kind === "sword") {
    // Dual wield: one on-chain blade per hand, held low and angled inward so
    // the tips read in front of the chest rather than crossing the face. A
    // guard lifts both blades up and crosses them; a slash sweeps them out.
    const swing = lash;
    const up = guard;
    return (
      <group position={[0, -0.02 * u * (1 - up), -0.04 * u * up]}>
        <group
          position={[0.3 * u - up * 0.06 * u, (-0.16 + up * 0.16) * u, (0.12 - up * 0.05) * u]}
          rotation={[
            -0.42 + up * 0.5 + swing * 0.85,
            0.42 - up * 0.16 - swing * 0.5,
            -0.5 - up * 0.35 - swing * 0.45,
          ]}
        >
          <Suspense fallback={<SwordStandIn u={u} materials={materials} />}>
            <OnChainWeapon url={SWORD_URL} u={u} lengthStrides={0.95} />
          </Suspense>
          {flash ? <Muzzle u={u} z={-1.05 * u} size={0.04} color={flashColor} /> : null}
        </group>
        <group
          position={[-0.3 * u + up * 0.06 * u, (-0.16 + up * 0.1) * u, (0.12 - up * 0.05) * u]}
          rotation={[
            -0.42 + up * 0.42 + swing * 0.45,
            -0.42 + up * 0.16 + swing * 0.2,
            0.5 + up * 0.35 + swing * 0.9,
          ]}
        >
          <Suspense fallback={<SwordStandIn u={u} materials={materials} />}>
            <OnChainWeapon url={SWORD_TWO_URL} u={u} lengthStrides={1.02} />
          </Suspense>
        </group>
      </group>
    );
  }

  // trap — the on-chain iron jaws, carried low and set down with a swing
  return (
    <group
      position={[0.02 * u, -0.08 * u - lash * 0.05 * u, 0.1 * u]}
      rotation={[-0.5 + lash * 0.9, 0.25, -0.12]}
    >
      <Suspense fallback={<TrapStandIn u={u} materials={materials} />}>
        <OnChainWeapon url={TRAP_URL} u={u} lengthStrides={0.6} />
      </Suspense>
      {flash ? <Muzzle u={u} z={-0.3 * u} size={0.03} color={flashColor} /> : null}
    </group>
  );
}

/** Plain iron jaws, holding the pose while the inscription streams in. */
function TrapStandIn({ u, materials }: { u: number; materials: WeaponMaterials }) {
  return (
    <group>
      <mesh material={materials.iron} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12 * u, 0.018 * u, 6, 14]} />
      </mesh>
      <mesh material={materials.steel} position={[0, 0.01 * u, 0]}>
        <boxGeometry args={[0.06 * u, 0.02 * u, 0.06 * u]} />
      </mesh>
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

const SWORD_URL = `https://ordinals.com/content/${SWORD_INSCRIPTION}`;
const SWORD_TWO_URL = `https://ordinals.com/content/${SWORD_TWO_INSCRIPTION}`;
const POWERSWORD_URL = `https://ordinals.com/content/${POWERSWORD_INSCRIPTION}`;
const MINIGUN_URL = `https://ordinals.com/content/${MINIGUN_INSCRIPTION}`;
const WAND_URL = `https://ordinals.com/content/${WAND_INSCRIPTION}`;
const PICK_URL = `https://ordinals.com/content/${PICK_INSCRIPTION}`;
const TRAP_URL = `https://ordinals.com/content/${TRAP_INSCRIPTION}`;
const HAMMER_URL = `https://ordinals.com/content/${HAMMER_INSCRIPTION}`;
const STAFF_URL = `https://ordinals.com/content/${STAFF_INSCRIPTION}`;

/**
 * The runestone staff with whatever stone is seated on its head. With a bare
 * socket the head carries a plain rune glow instead.
 */
function RunestoneStaff({
  u,
  materials,
  lash,
  flash,
}: {
  u: number;
  materials: WeaponMaterials;
  lash: number;
  flash: boolean;
}) {
  const stone = useFittedStone();
  const glow = stone?.glow ?? "#7ad1ff";
  return (
    <group
      position={[0.16 * u, -0.14 * u, 0.02 * u]}
      rotation={[-0.36 - lash * 0.34, 0.2, -0.1]}
    >
      <Suspense fallback={<WandStandIn u={u} materials={materials} />}>
        <OnChainWeapon url={STAFF_URL} u={u} lengthStrides={1.35} />
      </Suspense>
      {/* the socket at the head, where a stone is seated */}
      <group position={[0, 0.02 * u, -1.34 * u]}>
        {stone ? (
          <Suspense fallback={null}>
            <OnChainWeapon
              url={`https://ordinals.com/content/${stone.inscription}`}
              u={u}
              lengthStrides={stone.fit}
            />
          </Suspense>
        ) : null}
        <mesh>
          <sphereGeometry args={[(0.05 + lash * 0.06) * u, 12, 12]} />
          <meshBasicMaterial color={glow} transparent opacity={0.3 + lash * 0.6} />
        </mesh>
      </group>
      {flash ? <Muzzle u={u} z={-1.42 * u} size={0.08} color={glow} /> : null}
    </group>
  );
}


/** Forged sledge shown for the moment before the inscription streams in. */
function HammerStandIn({ u, materials }: { u: number; materials: WeaponMaterials }) {
  return (
    <group>
      <mesh material={materials.wood} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.3 * u]}>
        <cylinderGeometry args={[0.022 * u, 0.026 * u, 0.62 * u, 8]} />
      </mesh>
      <mesh material={materials.iron} position={[0, 0, -0.62 * u]}>
        <boxGeometry args={[0.24 * u, 0.12 * u, 0.12 * u]} />
      </mesh>
    </group>
  );
}

/** An inscribed piece, fitted to the hand and pointed down -Z like the rest. */
/**
 * The mining pick, mounted by hand. Its head is as long as its haft, so the
 * shared fitter reads it sideways; these numbers come from the inscription's
 * own measurements: haft along Z, head across X.
 */
function PickModel({ u }: { u: number }) {
  const gltf = useGLTF(PICK_URL);
  const scene = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
    });
    return copy;
  }, [gltf.scene]);
  // native longest span is 1.3; carry it about a quarter of a stride wide
  const scale = (0.3 * u) / 1.3;
  return (
    <group scale={scale} position={[0, 0, -0.55 * 0.3 * u]}>
      <Primitive object={scene} />
    </group>
  );
}

function OnChainWeapon({
  url,
  u,
  lengthStrides,
  flip = false,
  forwardAxis,
}: {
  url: string;
  u: number;
  /** how long the piece reads from grip to tip, in strides */
  lengthStrides: number;
  /** the model's grip sits at the far end of its long axis, not the near end */
  flip?: boolean;
  /** override which model axis points away from the hand */
  forwardAxis?: "x" | "y" | "z";
}) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const fit = useMemo(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        // Some inscriptions ship a flat presentation plane behind the object.
        // It would swallow the fitting box, so it is dropped from the carry.
        const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
        const count = geometry?.attributes?.["position"]?.count ?? 0;
        if (geometry && count > 0 && count <= 8) {
          geometry.computeBoundingBox();
          const box = geometry.boundingBox;
          if (box) {
            const span = box.getSize(new THREE.Vector3());
            const flat = [span.x, span.y, span.z].filter((v) => v < 1e-4).length >= 1;
            if (flat) mesh.visible = false;
          }
        }
      }
    });
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.visible) bounds.expandByObject(mesh);
    });
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z, 0.0001);
    // Blade runs a little over one stride from grip to tip.
    const scale = (lengthStrides * u) / longest;
    // The model's own long axis becomes the forward (-Z) direction, with the
    // low end of that axis (the grip) sitting at the origin like every other
    // weapon here.
    const axis: "x" | "y" | "z" =
      forwardAxis ??
      (size.y >= size.x && size.y >= size.z ? "y" : size.x >= size.z ? "x" : "z");
    const low = flip ? bounds.max[axis] : bounds.min[axis];
    return { scale, center, axis, low };
  }, [scene, u, lengthStrides, flip, forwardAxis]);

  const spin: [number, number, number] =
    fit.axis === "y" ? [-Math.PI / 2, 0, 0] : fit.axis === "x" ? [0, -Math.PI / 2, 0] : [0, Math.PI, 0];
  // centre the two short axes, and start the long axis at the grip
  const offset = new THREE.Vector3(-fit.center.x, -fit.center.y, -fit.center.z);
  offset[fit.axis] = -fit.low;


  return (
    <group rotation={spin}>
      <group scale={fit.scale} position={[offset.x * fit.scale, offset.y * fit.scale, offset.z * fit.scale]}>
        <Primitive object={scene} />
      </group>
    </group>
  );
}


/** Plain blade shown for the moment before the inscription finishes loading. */
function SwordStandIn({ u, materials }: { u: number; materials: WeaponMaterials }) {
  const { steel, leather, brass } = materials;
  return (
    <group>
      <mesh material={leather} position={[0, 0, 0.1 * u]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028 * u, 0.032 * u, 0.2 * u, 8]} />
      </mesh>
      <mesh material={brass} position={[0, 0, -0.02 * u]}>
        <boxGeometry args={[0.22 * u, 0.03 * u, 0.04 * u]} />
      </mesh>
      <mesh material={steel} position={[0, 0, -0.6 * u]}>
        <boxGeometry args={[0.07 * u, 0.02 * u, 1.1 * u]} />
      </mesh>
    </group>
  );
}

useGLTF.preload(TRAP_URL);
useGLTF.preload(SWORD_URL);
useGLTF.preload(SWORD_TWO_URL);
useGLTF.preload(MINIGUN_URL);
useGLTF.preload(WAND_URL);
useGLTF.preload(PICK_URL);
useGLTF.preload(STAFF_URL);

/** Barrel cluster shown while the minigun inscription streams in. */
function MinigunStandIn({
  u,
  materials,
  spin,
}: {
  u: number;
  materials: WeaponMaterials;
  spin: number;
}) {
  const { steel, iron } = materials;
  return (
    <group>
      <mesh material={iron} position={[0, 0, 0.16 * u]}>
        <boxGeometry args={[0.16 * u, 0.16 * u, 0.4 * u]} />
      </mesh>
      <group rotation={[0, 0, spin * 6]}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              material={steel}
              position={[Math.cos(a) * 0.05 * u, Math.sin(a) * 0.05 * u, -0.65 * u]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.016 * u, 0.016 * u, 1.1 * u, 8]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Plain blue rod shown while the wand inscription streams in. */
function WandStandIn({ u, materials }: { u: number; materials: WeaponMaterials }) {
  const { leather } = materials;
  return (
    <group>
      <mesh material={leather} position={[0, 0, 0.08 * u]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.024 * u, 0.028 * u, 0.2 * u, 8]} />
      </mesh>
      <mesh position={[0, 0, -0.42 * u]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014 * u, 0.02 * u, 0.8 * u, 8]} />
        <meshStandardMaterial color="#2f6fd0" emissive="#1a4a9c" emissiveIntensity={0.8} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Forged pick shown for the moment before the inscription finishes loading. */
function PickStandIn({ u, materials }: { u: number; materials: WeaponMaterials }) {
  const { wood, leather, iron, steel, brass } = materials;
  return (
    <group>
      <mesh material={wood} position={[0, 0.07 * u, -0.3 * u]} rotation={[Math.PI / 2.2, 0, 0]}>
        <cylinderGeometry args={[0.024 * u, 0.032 * u, 0.78 * u, 10]} />
      </mesh>
      <mesh material={leather} position={[0, -0.05 * u, 0.04 * u]} rotation={[Math.PI / 2.2, 0, 0]}>
        <cylinderGeometry args={[0.036 * u, 0.03 * u, 0.1 * u, 8]} />
      </mesh>
      <mesh material={iron} position={[0, 0.25 * u, -0.53 * u]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[0.055 * u, 0.09 * u, 0.09 * u]} />
      </mesh>
      <mesh material={brass} position={[0, 0.3 * u, -0.53 * u]}>
        <boxGeometry args={[0.03 * u, 0.02 * u, 0.05 * u]} />
      </mesh>
      <mesh material={iron} position={[0, 0.22 * u, -0.72 * u]} rotation={[-Math.PI / 2.6, 0, 0]}>
        <coneGeometry args={[0.034 * u, 0.44 * u, 8]} />
      </mesh>
      <mesh material={steel} position={[0, 0.16 * u, -0.88 * u]} rotation={[-Math.PI / 2.6, 0, 0]}>
        <coneGeometry args={[0.014 * u, 0.1 * u, 8]} />
      </mesh>
      <mesh material={iron} position={[0, 0.31 * u, -0.36 * u]} rotation={[0.52, 0, 0]}>
        <boxGeometry args={[0.062 * u, 0.055 * u, 0.22 * u]} />
      </mesh>
    </group>
  );
}
