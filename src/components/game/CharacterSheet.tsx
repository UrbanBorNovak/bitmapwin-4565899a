/**
 * CHARACTER SHEET — the paper-doll preview inside the Oasis inventory shelf.
 *
 * A portrait of the figure you walk as, ringed by the slots the kit goes in.
 * Every slot is the same switch the old buttons were, so nothing about how gear
 * works changes here — only how you see it. Presentation only.
 */

import { Suspense, useEffect, useMemo, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen, CircleDot, Footprints, Gem, Glasses, HardHat, PawPrint, ToyBrick, Watch } from "lucide-react";
import { useThree } from "@react-three/fiber";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { WeaponGlyph } from "@/components/game/WeaponBelt";
import { WEAPONS, WeaponModel, useWeaponMaterials, type WeaponKind } from "@/components/game/weapons";
import { Primitive } from "@/components/game/Primitive";
import { WornGear } from "@/components/game/WornGear";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { DEFAULT_AVATAR_MODEL, DEFAULT_AVATAR_TEXTURE } from "@/lib/map-identity";
import { createPlayerState } from "@/lib/player-state";
import {
  companionSpec,
  cycleCompanion,
  cycleToy,
  toySpec,
  toggleComic,
  toggleBatmanHead,
  toggleGoggles,
  toggleNecklace,
  toggleRing,
  toggleShoes,
  toggleWatch,
  useGear,
} from "@/lib/world-gear";
import { playSfx } from "@/lib/world-audio";

type SlotView = {
  slot: string;
  label: string;
  filled: boolean;
  Icon: LucideIcon | null;
  onPick: (() => void) | null;
};

const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

/**
 * Frame the whole figure, gear included.
 *
 * The panel is narrow, so a fixed camera distance cropped the head and the
 * shoes. Measure the panel and pull back until the tallest and widest thing the
 * doll can wear — hat above the head, sneakers below the feet — fits inside.
 */
const DOLL_BOTTOM = -0.34;
const DOLL_TOP = 1.55;
const DOLL_HALF_WIDTH = 0.62;

function PreviewCamera() {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);
  useEffect(() => {
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.0001);
    const fov = (camera.fov * Math.PI) / 180;
    const centerY = (DOLL_TOP + DOLL_BOTTOM) / 2;
    const halfHeight = (DOLL_TOP - DOLL_BOTTOM) / 2;
    const forHeight = halfHeight / Math.tan(fov / 2);
    const forWidth = DOLL_HALF_WIDTH / (Math.tan(fov / 2) * aspect);
    const distance = Math.max(forHeight, forWidth) * 1.12;
    // Keep the three-quarter angle the doll was posed for.
    const dir = new THREE.Vector3(0.42, 0.1, 1).normalize();
    camera.position.set(dir.x * distance, centerY + dir.y * distance, dir.z * distance);
    camera.lookAt(0, centerY, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}


function PreviewAvatar({ model, skin }: { model: string | null; skin?: string | null }) {
  const inscription = model ?? DEFAULT_AVATAR_MODEL;
  const gltf = useGLTF(`https://ordinals.com/content/${inscription}`);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  // The figure must stand the way it stands in the world, or the gear tuned
  // against the standing body (shoes at the ankles, weapon in the hand) lands
  // against a sprawled bind pose instead.
  const { actions, names } = useAnimations(gltf.animations, scene);
  useEffect(() => {
    const name = names.find((entry) => /idle|stand/i.test(entry)) ?? names[0];
    const action = name ? actions[name] : null;
    if (!action) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
    return () => {
      action.stop();
    };
  }, [actions, names]);
  // The stock rig takes a pixel skin: the chosen BITMAP skin, or the stock one.
  const texture = useTexture(
    inscription === DEFAULT_AVATAR_MODEL
      ? `https://ordinals.com/content/${skin?.trim() || DEFAULT_AVATAR_TEXTURE}`
      : TRANSPARENT_PIXEL,
  );
  const fitted = useMemo(() => {
    if (inscription === DEFAULT_AVATAR_MODEL) {
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
    }
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      if (inscription !== DEFAULT_AVATAR_MODEL) return;
      const paint = (source: THREE.Material) => {
        const material = source.clone() as THREE.MeshStandardMaterial;
        material.map = texture;
        material.color.set("#ffffff");
        material.metalness = 0;
        material.roughness = 0.85;
        material.needsUpdate = true;
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(paint) : paint(mesh.material);
    });
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    // Keep every inscription at one apparent body height in LIVE LOADOUT.
    // Using its widest axis made broad figures look much shorter than slim ones.
    // But a flat or degenerate model (lying down, a lone prop, empty bounds)
    // has almost no height, so a pure height fit blows it up into a closeup —
    // never let the figure scale past what its width implies, and never past
    // the hard cap.
    const impliedHeight = Math.max(size.y, size.x * 0.45, size.z * 0.45, 0.001);
    const scale = Math.min(1.15 / impliedHeight, 6);
    return { scale, center, minY: bounds.min.y };
  }, [inscription, scene, texture]);
  return (
    <group
      scale={fitted.scale}
      position={[-fitted.center.x * fitted.scale, -fitted.minY * fitted.scale, -fitted.center.z * fitted.scale]}
    >
      <Primitive object={scene} />
    </group>
  );
}

/**
 * The weapon on the paper doll.
 *
 * The world holds a piece low, near the hip, because the camera looks over your
 * shoulder from behind. Face-on in the sheet that reads as a prop floating by
 * the thigh, so the doll raises it to hand height and turns it broadside.
 */
function PreviewWeapon({ kind }: { kind: WeaponKind }) {
  const materials = useWeaponMaterials();
  return (
    <group
      position={[kind === "sword" ? 0 : 0.27, kind === "sword" ? 0.66 : 0.52, 0.16]}
      rotation={[kind === "trap" ? 0.5 : -0.06, Math.PI * 0.86, 0]}
      scale={kind === "sword" ? 0.7 : 0.62}
    >
      <WeaponModel kind={kind} u={1} materials={materials} flashColor="#f7931a" lash={0} />
    </group>
  );
}


/**
 * The companion at the doll's heel, sized the way it reads in the world.
 */
function PreviewCompanion() {
  const gear = useGear();
  const pet = companionSpec(gear.companion);
  if (!pet.inscription) return null;
  return (
    <group position={[-0.42, 0, 0.3]} rotation-y={0.5}>
      <InscribedModel url={contentUrl(pet.inscription)} size={pet.fit} />
    </group>
  );
}

export function EquippedAvatarPreview({
  model,
  weapon,
  flying,
  skin = null,
}: {
  model: string | null;
  weapon: WeaponKind | null;
  flying: boolean;
  skin?: string | null;
}) {
  const pose = useRef(createPlayerState(0, 0, 0));
  return (
    <SafeCanvas dpr={[1, 1.5]} camera={{ position: [1.05, 0.78, 2.05], fov: 38, near: 0.01, far: 20 }}>
      <PreviewCamera />
      <ambientLight intensity={1.5} />
      <directionalLight position={[2, 3, 3]} intensity={2.2} />
      <directionalLight position={[-2, 1, -2]} intensity={0.8} />
      <group rotation-y={-0.18}>
        <Suspense fallback={null}>
          <PreviewAvatar model={model} skin={skin} />
          <PreviewCompanion />
          {weapon ? <PreviewWeapon kind={weapon} /> : null}
          <WornGear unit={1} pose={pose} weapon={weapon} showHead jetpack={flying} />
        </Suspense>
      </group>
    </SafeCanvas>
  );
}

function Slot({ view }: { view: SlotView }) {
  const body = (
    <>
      {view.Icon && view.filled ? (
        <view.Icon aria-hidden="true" className="size-6 text-bitcoin" strokeWidth={1.6} />
      ) : (
        <span className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
          {view.slot}
        </span>
      )}
    </>
  );
  const shell = `flex size-11 items-center justify-center border transition-colors ${
    view.filled
      ? "border-bitcoin bg-bitcoin/10"
      : "border-border bg-background hover:border-foreground"
  }`;
  return (
    <div className="flex flex-col items-center gap-0.5" data-no-translate>
      {view.onPick ? (
        <button type="button" onClick={view.onPick} className={shell} title={view.label}>
          {body}
        </button>
      ) : (
        <div className={shell} title={view.label}>
          {body}
        </div>
      )}
      <span className="max-w-[3.6rem] truncate text-center text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
        {view.label}
      </span>
    </div>
  );
}

export function CharacterSheet({
  weapon,
  model,
  flying = false,
  onNote,
}: {
  weapon: WeaponKind | null;
  /** the inscription you walk as, when you are wearing one */
  model: string | null;
  /** the jetpack is strapped on — the helmet fills the head slot */
  flying?: boolean;
  onNote?: (note: string) => void;
}) {
  const gear = useGear();
  const note = (text: string) => {
    playSfx("ui");
    onNote?.(text);
  };
  const toy = toySpec(gear.toy);
  const pet = companionSpec(gear.companion);

  const head: SlotView = flying
    ? {
        slot: "HEAD",
        label: "FLIGHT HELMET",
        filled: true,
        Icon: HardHat,
        onPick: null,
      }
    : gear.batmanHead
      ? {
          slot: "HEAD",
          label: "BATMAN HEAD",
          filled: true,
          Icon: HardHat,
          onPick: () => note(toggleBatmanHead() ? "BATMAN HEAD ON" : "BATMAN HEAD OFF"),
        }
      : {
        slot: "HEAD",
        label: gear.goggles ? "NIGHT VISION" : "HEAD",
        filled: gear.goggles,
        Icon: Glasses,
        onPick: () => {
          note(toggleBatmanHead() ? "BATMAN HEAD ON" : "BATMAN HEAD OFF");
        },
      };

  const left: SlotView[] = [
    head,
    {
      slot: "NECK",
      label: gear.necklace ? "NECKLACE" : "NECK",
      filled: gear.necklace,
      Icon: Gem,
      onPick: () => note(toggleNecklace() ? "NECKLACE ON · STEADY RECOVERY" : "NECKLACE OFF"),
    },
    {
      slot: "WRIST",
      label: gear.watch ? "WATCH" : "WRIST",
      filled: gear.watch,
      Icon: Watch,
      onPick: () => note(toggleWatch() ? "WATCH ON" : "WATCH OFF"),
    },
  ];

  const right: SlotView[] = [
    {
      slot: "HAND",
      label: weapon ? WEAPONS[weapon].label : "MAIN HAND",
      filled: weapon !== null,
      Icon: null,
      onPick: null,
    },
    {
      slot: "OFF",
      label: toy.inscription ? toy.label : "OFF HAND",
      filled: toy.inscription !== "",
      Icon: toy.inscription ? ToyBrick : null,
      onPick: () => {
        const next = cycleToy();
        note(next.inscription ? `TOY IN HAND · ${next.label}` : "TOY PUT AWAY");
      },
    },
    {
      slot: "RING",
      label: gear.ring ? "RING" : "RING",
      filled: gear.ring,
      Icon: CircleDot,
      onPick: () => note(toggleRing() ? "RING ON" : "RING OFF"),
    },
  ];

  const bottom: SlotView[] = [
    {
      slot: "FEET",
      label: gear.shoes ? "SHOES" : "FEET",
      filled: gear.shoes,
      Icon: Footprints,
      onPick: () => note(toggleShoes() ? "SHOES ON · FASTER STRIDE" : "SHOES OFF"),
    },
    {
      slot: "TOME",
      label: gear.comic ? "COMIC BOOK" : "TOME",
      filled: gear.comic,
      Icon: BookOpen,
      onPick: () => note(toggleComic() ? "COMIC BOOK IN HAND" : "COMIC BOOK AWAY"),
    },
    {
      slot: "PET",
      label: pet.inscription ? pet.label : "COMPANION",
      filled: pet.inscription !== "",
      Icon: PawPrint,
      onPick: () => {
        cycleCompanion();
        const next = companionSpec(gear.companion === "goose" ? "none" : gear.companion === "none" ? "cat" : gear.companion === "cat" ? "dog" : "goose");
        note(next.inscription ? `COMPANION · ${next.label}` : "COMPANION LEFT BEHIND");
      },
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        Character
      </span>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          {left.map((view) => (
            <Slot key={view.slot} view={view} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="relative h-[12rem] w-full min-w-[8rem] overflow-hidden border border-border bg-background/60">
            <EquippedAvatarPreview model={model} weapon={weapon} flying={flying} />
            <span className="pointer-events-none absolute bottom-1 left-1.5 text-[7px] uppercase tracking-[0.16em] text-muted-foreground" data-no-translate>
              LIVE LOADOUT
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {weapon ? (
              <span className="flex size-8 items-center justify-center border border-bitcoin text-bitcoin">
                <WeaponGlyph kind={weapon} />
              </span>
            ) : null}
            <span
              className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground"
              data-no-translate
            >
              {weapon ? WEAPONS[weapon].label : "HANDS EMPTY"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {right.map((view) => (
            <Slot key={view.slot} view={view} />
          ))}
        </div>
      </div>
      <div className="flex items-start gap-1.5">
        {bottom.map((view) => (
          <Slot key={view.slot} view={view} />
        ))}
      </div>
    </div>
  );
}
