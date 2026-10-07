import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STRIDE, type PlayerState } from "@/lib/player-state";
import { ATTACK_RANGE } from "@/lib/map-presence";
import type { MapCursor } from "@/lib/map-presence";
import { playSfx, startMinigunSpin, stopMinigunSpin, unlockAudio } from "@/lib/world-audio";
import { WEAPONS, WeaponModel, useWeaponMaterials, type WeaponKind } from "./weapons";
import { stonePower } from "@/lib/world-runestones";

import {
  damageBeast,
  liveBeasts,
  liveVeins,
  mineVoxel,
  nearestChest,
  openChest,
  type BeastEntity,
  type OreVein,
  type OreVoxel,
} from "@/lib/world-entities";
import { MEMBER_MINE_RATE, MEMBER_MINE_XP, isMember } from "@/lib/world-perks";
import { addItem, grantXp, skillLevel, spendItems } from "@/lib/world-skills";
import { Primitive } from "./Primitive";
import { partyIds } from "@/lib/party-ids";
import { DUEL_DAMAGE_BONUS, duel, setDuel } from "@/lib/saber-duel";
import { AIM_FORGIVENESS, AIM_REACH_BONUS, aimState } from "@/lib/world-aim";
import { TRAP_LIMIT, placeTrap } from "@/lib/world-traps";
import { isSea } from "@/lib/world-sea";

/**
 * WEAPONS IN THE WORLD — carry a minigun, a revolver, traps or a pickaxe.
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

/** How much health one wand heal returns to every party member, and how often. */
export const HEAL_AMOUNT = 34;
export const HEAL_COOLDOWN_MS = 12_000;

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

/**
 * How far the carried view model sits from the eye, and how much it is scaled
 * up to compensate. A stride is 0.01 world units here, well inside the near
 * plane, so the model must be pushed out and enlarged together.
 */
const VIEW_PUSH = 12;



export function ShooterLayer({
  active,
  firstPerson,
  weapon,
  selfId,
  pose,
  cursors,
  bitcoin,
  onShootPeer,
  onCastHeal,
  onStats,
}: {
  active: boolean;
  /** only the first-person view draws the carried model in front of the camera */
  firstPerson: boolean;
  weapon: WeaponKind;
  /** the local visitor's id — stamped on any trap they lay */
  selfId: string;
  pose: React.RefObject<PlayerState>;
  cursors: MapCursor[];
  bitcoin: string;
  /** land a strike on another visitor through the world's shared combat rules */
  onShootPeer: (id: string, damage?: number) => void;
  /** the wand's healing spell — mends the caster and the whole party */
  onCastHeal?: (amount: number) => void;
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
  const [rings, setRings] = useState<Burst[]>([]);
  const [arcs, setArcs] = useState<{ id: number; born: number }[]>([]);
  const [duelTarget, setDuelTarget] = useState<string | null>(duel.targetId);
  const nextBurst = useRef(0);
  const [lash, setLash] = useState(0);
  const [guard, setGuard] = useState(0);

  const lastFire = useRef(0);
  const holding = useRef(false);
  /** how far the minigun barrels have spun up, 0 cold to 1 at full speed */
  const spinUp = useRef(0);
  /** multiplies the weapon's cooldown — a cold minigun fires slowly at first */
  const rateScale = useRef(1);
  const lastHeal = useRef(0);

  const nextTracer = useRef(0);
  const heldRef = useRef<THREE.Group>(null);
  const recoil = useRef(0);
  const swayQ = useRef(new THREE.Quaternion());
  const materials = useWeaponMaterials();
  // The carried model is a view model: it lives a few centimetres from the eye,
  // so it must draw over the world instead of clipping into terrain or props.
  const viewMaterials = useMemo(() => {
    const clone = <T extends THREE.MeshStandardMaterial>(material: T, lift: number) => {
      const copy = material.clone() as T;
      copy.depthTest = false;
      copy.depthWrite = false;
      // The world light rarely falls on a piece held right at the lens, so the
      // view model carries a little light of its own and reads at a glance.
      copy.emissive = new THREE.Color(copy.color).multiplyScalar(lift);
      copy.emissiveIntensity = 1;
      copy.roughness = Math.max(0.2, copy.roughness - 0.1);
      return copy;
    };
    return {
      wood: clone(materials.wood, 0.85),
      steel: clone(materials.steel, 1.5),
      leather: clone(materials.leather, 0.9),
      iron: clone(materials.iron, 1.15),
      brass: clone(materials.brass, 1.4),
    };
  }, [materials]);



  // swapping weapons hands you a full load
  useEffect(() => {
    setAmmo(spec.magazine);
    setReloading(false);
  }, [spec.magazine, weapon]);

  useFrame((_, delta) => {
    if (!active) return;
    const now = performance.now();
    if (flash && now - flash > 70) setFlash(0);
    setTracers((current) => (current.length && now - current[0]!.born > BOLT_LIFE_MS ? current.slice(1) : current));
    setBursts((current) => (current.length && now - current[0]!.born > 620 ? current.slice(1) : current));
    setRings((current) => (current.length && now - current[0]!.born > 700 ? current.slice(1) : current));
    setArcs((current) => (current.length && now - current[0]!.born > 260 ? current.slice(1) : current));

    const next = Math.max(0, recoil.current - delta * 3.4);
    if (next !== recoil.current) {
      recoil.current = next;
      setLash((current) => (Math.abs(current - next) > 0.06 || next === 0 ? next : current));
    }

    // Keep the carried model glued to the eye like a proper view model: held at
    // the lower right of the frame, angled slightly inward, breathing gently,
    // and kicking back with every strike.
    const held = heldRef.current;
    if (held && firstPerson) {
      // draw the whole view model over the world, never through it
      held.traverse((node) => {
        node.renderOrder = 900;
        const mesh = node as THREE.Mesh;
        const material = mesh.material as THREE.Material | undefined;
        if (material && "depthTest" in material && material.depthTest) {
          material.depthTest = false;
          material.depthWrite = false;
        }
      });
      const kick = recoil.current;

      const t = now / 1000;
      const breath = Math.sin(t * 1.6) * 0.012;
      const drift = Math.cos(t * 1.1) * 0.01;
      const long = weapon === "minigun" || weapon === "pickaxe";
      // Dual blades are carried in both hands, so the rig sits centred on the
      // frame instead of tucked into the right corner.
      const dual = weapon === "sword";
      // A stride is tiny in world units, so a hand-distance offset would fall
      // inside the camera's near plane and vanish. Push the model out by a
      // fixed factor and scale it up by the same amount: identical on screen,
      // safely in front of the lens.
      const k = VIEW_PUSH;
      // Aiming brings the piece up to the centre of the frame and stills the
      // sway, so the sights line up with what the crosshair is on.
      const aim = aimState.amount;
      // The blade rig itself needs to know about the guard, so mirror the aim
      // into React state, but only in coarse steps to keep renders cheap.
      if (dual || spec.saber) {
        const step = Math.round(aim * 5) / 5;
        setGuard((current) => (current === step ? current : step));
      }
      const still = 1 - aim * 0.85;
      held.position.copy(camera.position);
      // Look sway: the piece trails the view a touch when turning, then settles.
      swayQ.current.slerp(camera.quaternion, 1 - Math.exp(-(aim > 0.5 ? 40 : 18) * (1 / 60)));
      held.quaternion.copy(swayQ.current);
      const restX = (dual ? 0 : long ? 0.3 : 0.22) + drift * still;
      const restY = -(dual ? 0.22 : long ? 0.2 : 0.14) + breath * still - kick * 0.05;
      const restZ = -(dual ? 0.34 : long ? 0.4 : 0.32) + kick * (dual ? 0.1 : 0.16);
      const sightX = dual ? 0 : long ? 0.012 : 0.028;
      // A guard brings the blades up in front of the eyes, not down to a sight.
      const sightY = dual ? -0.1 : long ? -0.055 : -0.05;
      const sightZ = -(dual ? 0.42 : long ? 0.58 : 0.46) + kick * 0.2;
      held.translateX(k * STRIDE * THREE.MathUtils.lerp(restX, sightX, aim));
      held.translateY(k * STRIDE * THREE.MathUtils.lerp(restY, sightY, aim));
      held.translateZ(k * STRIDE * THREE.MathUtils.lerp(restZ, sightZ, aim));
      // aim the piece slightly across the view so the barrel reads as held,
      // not floating dead-centre — squared up when aimed
      held.rotateY(THREE.MathUtils.lerp(dual ? 0 : long ? 0.1 : 0.14, 0, aim));
      held.rotateZ(THREE.MathUtils.lerp(long ? -0.04 : -0.07, 0, aim));
      held.rotateX(kick * (weapon === "trap" ? -0.3 : 0.22) - 0.03);
      held.scale.setScalar(k * 0.5 * (1 + aim * 0.08));

    }

  });

  const flashNote = useCallback((message: string) => {
    setNote(message);
    window.setTimeout(() => setNote((current) => (current === message ? null : current)), 1300);
  }, []);

  const fireRef = useRef<() => void>(() => {});

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
    // A knocked-out visitor swings at nothing: no shots, no strikes, no mining
    // until the respawn puts them back on their feet.
    if (me.combat === "down") return;
    const now = performance.now();
    // MEMBERS work a seam noticeably faster than everyone else.
    const memberRate = spec.mining && isMember() ? MEMBER_MINE_RATE : 1;
    if (now - lastFire.current < spec.cooldownMs * rateScale.current * memberRate) return;
    if (reloading) return;

    if (spec.magazine > 0 && ammo <= 0) {
      playSfx("empty");
      flashNote("EMPTY · R TO RELOAD");
      return;
    }
    // THE TRAP — laid on the ground a pace ahead instead of swung at anything.
    if (weapon === "trap") {
      lastFire.current = now;
      playSfx("trap");
      setLash(1);
      recoil.current = 1;
      const ahead = STRIDE * 2.2;
      const trapX = me.x + Math.sin(me.yaw) * ahead;
      const trapZ = me.z + Math.cos(me.yaw) * ahead;
      if (isSea(trapX, trapZ)) {
        flashNote("TRAP NEEDS DRY LAND");
        return;
      }
      const laid = placeTrap(
        selfId,
        trapX,
        trapZ,
        0,
      );
      flashNote(laid ? "TRAP SET · ARMING" : `TRAP LIMIT · ${TRAP_LIMIT} IN THE SAND`);
      return;
    }

    lastFire.current = now;
    if (spec.magazine > 0) setAmmo((current) => Math.max(0, current - 1));
    playSfx(spec.fireSfx);
    if (spec.cycleSfx) {
      const cycle = spec.cycleSfx;
      window.setTimeout(() => playSfx(cycle), spec.cycleDelayMs);
    }
    if (!spec.mining) setFlash(now);
    recoil.current = 1;
    setLash(1);

    const aimed = firstPerson && aimState.amount > 0.6;
    const range = STRIDE * spec.reachStrides * (aimed ? AIM_REACH_BONUS : 1);
    const forgive = aimed ? AIM_FORGIVENESS : 1;
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(direction);
    const ray = new THREE.Ray(origin, direction.normalize());

    let best: { distance: number; point: THREE.Vector3; peer: MapCursor } | null = null;
    const hit = new THREE.Vector3();
    for (const peer of cursorsRef.current) {
      if (peer.hp <= 0 || partyIds.has(peer.id)) continue;
      const center = new THREE.Vector3(peer.x, STRIDE * 1.1, peer.z);
      const sphere = new THREE.Sphere(center, STRIDE * (0.85) * forgive);
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
      const sphere = new THREE.Sphere(center, Math.max(beast.bodyRadius, STRIDE * 0.12) * forgive);
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

    if (spec.saber) {
      setArcs((current) => [...current.slice(-2), { id: ++nextTracer.current, born: now }]);
    } else if (!spec.mining) {
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
    if (spec.ion) setRings((current) => [...current.slice(-2), { id: ++nextBurst.current, at: impact, born: now }]);

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
      const kind = oreHit.vein.kind;
      const stored = addItem(
        kind === "mineral" ? "mineral" : kind === "ore" ? "ore-chunk" : "gold-nugget",
        1,
      );
      // A key turns up now and then in the rubble — treasure needs one.
      if (Math.random() < 0.07 && addItem("key", 1)) flashNote("A KEY IN THE RUBBLE");
      const gained = grantXp(
        "mining",
        oreHit.vein.xpPerVoxel * (isMember() ? MEMBER_MINE_XP : 1),
      );
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
            ? kind === "mineral"
              ? "CLUSTER MINED OUT · CLEARED FROM THE SAND"
              : kind === "ore"
                ? "MINE WORKED OUT · CLEARED FROM THE SAND"
                : "SEAM MINED OUT · GONE FOR GOOD"
            : `+${oreHit.vein.xpPerVoxel} MINING XP`,
        );
      }
      return;
    }

    // WILDLIFE — damage, a downed animal, and the experience for the kill.
    if (nearest.kind === "beast" && beastHit) {
      // The staff hits as hard as the stone seated on its head.
      const bite = weapon === "staff" ? Math.round(spec.damage * stonePower()) : spec.damage;
      const struck = damageBeast(beastHit.beast, bite);

      if (!struck.damage) return;
      playSfx(struck.killed ? "kill" : "hit");
      window.dispatchEvent(new CustomEvent("oasis:hitmark", { detail: { kill: struck.killed } }));
      setScore((current) => current + (struck.killed ? 40 : 10));
      if (struck.killed) {
        setKills((current) => current + 1);
        const gained = grantXp("hunter", beastHit.beast.xp);
        addItem(beastHit.beast.hostile ? "fang" : "hide", 1);
        if (Math.random() < 0.05) addItem("key", 1);
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
      if (peer.hp <= 0 || partyIds.has(peer.id)) return false;
      if (peer.id === best!.peer.id) return true;
      const near = Math.hypot(peer.x - impact.x, peer.z - impact.z) <= splash;
      const inRange = Math.hypot(peer.x - me.x, peer.z - me.z) <= ATTACK_RANGE;
      return near && inRange;
    });
    for (const peer of caught) {
      // Sabers cut harder, and harder still against the rival you are duelling.
      const base = spec.saber ? SHOT_DAMAGE * 1.4 : SHOT_DAMAGE;
      const bonus = duel.targetId === peer.id ? DUEL_DAMAGE_BONUS : 1;
      onShootPeer(peer.id, Math.round(base * bonus));
    }
    playSfx("hit");
    window.dispatchEvent(new CustomEvent("oasis:hitmark", { detail: { kill: caught.some((p) => p.hp - SHOT_DAMAGE <= 0) } }));
    setScore((current) => current + 25 * caught.length);
    setKills((current) => current + caught.filter((peer) => peer.hp - SHOT_DAMAGE <= 0).length);
    grantXp("attack", 20 * caught.length);
    flashNote(
      caught.length > 1
        ? `SPLASH HIT ${caught.length} VISITORS`
        : `HIT ${best.peer.handle}`,
    );
  }, [active, ammo, camera, firstPerson, flashNote, onShootPeer, pose, reloading, selfId, spec, weapon]);



  fireRef.current = fire;

  // A minigun keeps ripping for as long as the button is down. The barrels have
  // to come up to speed first: nothing leaves the muzzle for the first fraction
  // of a second, then the rate climbs until it is a solid ripping stream. Let go
  // and the cluster coasts back down instead of stopping dead.
  useFrame((_, delta) => {
    const down = pose.current?.combat === "down";
    const spinning = active && spec.auto && holding.current && !down;
    if (spinning) {
      startMinigunSpin();
      spinUp.current = Math.min(1, spinUp.current + delta / 0.3);
      // first round leaves almost at once, then the rate climbs to full speed
      rateScale.current = 1.5 - spinUp.current * 0.5;
      fireRef.current();
    } else {
      spinUp.current = Math.max(0, spinUp.current - delta / 0.45);
      rateScale.current = 1;
      stopMinigunSpin();
    }
  });


  // Never leave the barrels humming when the layer unmounts or the weapon changes.
  useEffect(() => () => stopMinigunSpin(), [spec.auto]);


  // THE HEALING SPELL — the wand mends the caster and every party member at once.
  const castHeal = useCallback(() => {
    if (!spec.spell) return;
    const now = performance.now();
    const wait = HEAL_COOLDOWN_MS - (now - lastHeal.current);
    if (wait > 0) {
      flashNote(`HEAL READY IN ${Math.ceil(wait / 1000)}S`);
      return;
    }
    lastHeal.current = now;
    playSfx("heal");
    recoil.current = 1;
    setLash(1);
    onCastHeal?.(HEAL_AMOUNT);
    flashNote(`HEALING SPELL · +${HEAL_AMOUNT} TO THE PARTY`);
  }, [flashNote, onCastHeal, spec.spell]);

  // TREASURE — turn a key on the nearest chest and take what is inside.
  const unlockChest = useCallback(() => {
    const me = pose.current;
    if (!me) return;
    const chest = nearestChest(me.x, me.z, STRIDE * 3.5);
    if (!chest) {
      flashNote("NO TREASURE CHEST IN REACH");
      return;
    }
    if (chest.opened) {
      flashNote("THIS CHEST IS ALREADY EMPTY");
      return;
    }
    if (!spendItems({ key: 1 })) {
      playSfx("empty");
      flashNote("LOCKED · FIND A KEY FIRST");
      return;
    }
    openChest(chest);
    const nuggets = 2 + Math.floor(Math.random() * 4);
    addItem("gold-nugget", nuggets);
    const relic = Math.random() < 0.35;
    if (relic) addItem("relic", 1);
    const gained = grantXp("mining", 240);
    setScore((current) => current + 120);
    playSfx(relic ? "levelup" : "nugget");
    if (gained.levelled) {
      flashNote(`TREASURE · MINING LEVEL ${gained.level}`);
    } else {
      flashNote(
        relic
          ? `TREASURE · ${nuggets} GOLD AND A RELIC`
          : `TREASURE · ${nuggets} GOLD NUGGETS`,
      );
    }
  }, [flashNote, pose]);

  // Mouse / touch strike on the canvas, R to reload.
  useEffect(() => {
    if (!active) return;
    const element = gl.domElement;
    // Hold the right button to keep the sights up for as long as it is down;
    // the left button fires at any time, aimed or not, without dropping aim.
    const onDown = (event: PointerEvent) => {
      if (event.button === 2 && spec.saber) duel.guarding = true;
      if (event.button === 2) {
        if (firstPerson) {
          event.preventDefault();
          aimState.active = true;
        }
        return;
      }
      if (event.button !== 0) return;
      unlockAudio();
      // a left click while the right button is still held keeps aiming
      if (firstPerson && (event.buttons & 2) !== 0) aimState.active = true;
      holding.current = true;
      fire();
    };
    const onUp = (event: PointerEvent) => {
      if (event.button === 0) holding.current = false;
      if (event.button === 2 || (event.buttons & 2) === 0) {
        aimState.active = false;
        duel.guarding = false;
      }
    };
    // keep the sights and the trigger honest if a button is released elsewhere
    const onMove = (event: PointerEvent) => {
      if (aimState.active && (event.buttons & 2) === 0) aimState.active = false;
      if (holding.current && (event.buttons & 1) === 0) holding.current = false;
    };
    const onLeave = () => {
      aimState.active = false;
      holding.current = false;
    };
    const onContext = (event: Event) => event.preventDefault();

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.code === "KeyR") {
        event.preventDefault();
        reload();
      }
      if (event.code === "KeyG" && spec.saber) {
        event.preventDefault();
        const me = pose.current;
        if (duel.targetId) {
          setDuel(null, null);
          setDuelTarget(null);
          flashNote("DUEL ENDED · BLADE LOWERED");
        } else if (me) {
          const rival = cursorsRef.current
            .filter((peer) => peer.hp > 0 && !partyIds.has(peer.id))
            .map((peer) => ({ peer, d: Math.hypot(peer.x - me.x, peer.z - me.z) }))
            .filter((entry) => entry.d <= STRIDE * 40)
            .sort((a, b) => a.d - b.d)[0];
          if (!rival) flashNote("NO RIVAL CLOSE ENOUGH TO DUEL");
          else {
            setDuel(rival.peer.id, rival.peer.handle);
            setDuelTarget(rival.peer.id);
            playSfx("saber");
            flashNote(`LIGHTSABER DUEL · ${rival.peer.handle} · +50% BLADE DAMAGE`);
          }
        }
      }
      if (event.code === "KeyH") {
        event.preventDefault();
        unlockAudio();
        castHeal();
      }
      if (event.code === "KeyK") {
        event.preventDefault();
        unlockAudio();
        unlockChest();
      }
      if (event.code === "KeyE") {
        event.preventDefault();
        unlockAudio();
        fire();
      }
    };
    // right button is caught on the window so HUD panels over the canvas
    // never swallow the hold
    const onWindowDown = (event: PointerEvent) => {
      if (event.button !== 2 || !firstPerson) return;
      event.preventDefault();
      aimState.active = true;
    };
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("contextmenu", onContext);
    window.addEventListener("pointerdown", onWindowDown, true);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointercancel", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("keydown", onKey);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("contextmenu", onContext);
      window.removeEventListener("pointerdown", onWindowDown, true);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointercancel", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("keydown", onKey);
      aimState.active = false;
      holding.current = false;
    };

  }, [active, castHeal, fire, firstPerson, gl, reload, unlockChest]);

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

  const strikeColor = spec.saber ?? spec.boltColor ?? (spec.spell ? "#6cc6ff" : bitcoin);

  // Only a held saber can guard or duel; drop both when it goes away.
  useEffect(() => {
    duel.saber = active && Boolean(spec.saber);
    if (!duel.saber) {
      duel.guarding = false;
      if (duel.targetId) {
        setDuel(null, null);
        setDuelTarget(null);
      }
    }
  }, [active, spec.saber]);

  if (!active) return null;

  return (
    <group>
      {firstPerson ? (
        <group ref={heldRef} renderOrder={900}>
          <WeaponModel
            kind={weapon}
            u={STRIDE}
            materials={viewMaterials}
            flash={Boolean(flash)}
            flashColor={strikeColor}
            lash={lash}
            guard={guard}
          />
        </group>

      ) : null}

      {bursts.map((burst) => (
        <VoxelBurst key={burst.id} at={burst.at} born={burst.born} color={strikeColor} radius={STRIDE * spec.splashStrides} />
      ))}
      {tracers.map((tracer) => (
        <BlasterBolt
          key={tracer.id}
          from={tracer.from}
          to={tracer.to}
          born={tracer.born}
          color={spec.boltColor ?? (weapon === "minigun" || weapon === "revolver" ? BOLT_RED : strikeColor)}
          fat={Boolean(spec.ion)}
        />
      ))}
      {rings.map((ring) => (
        <IonRing key={ring.id} at={ring.at} born={ring.born} color={strikeColor} radius={STRIDE * spec.splashStrides} />
      ))}
      {arcs.map((arc) => (
        <SaberArc key={arc.id} pose={pose} born={arc.born} color={strikeColor} />
      ))}
      {duelTarget ? <DuelRing cursorsRef={cursorsRef} targetId={duelTarget} color={strikeColor} /> : null}
      {flash ? (
        <pointLight color={strikeColor} intensity={12} distance={STRIDE * 16} position={camera.position} />
      ) : null}
    </group>
  );
}

/** Blaster bolt look: saturated red plasma around a white-hot core. */
const BOLT_RED = "#ff2a1f";
const BOLT_LIFE_MS = 320;
const BOLT_SPEED = STRIDE * 420; // world units per second
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * STAR WARS BLASTER BOLT — a short glowing slug that streaks from the muzzle
 * to the impact point instead of an instant line, then flares where it lands.
 */
function BlasterBolt({
  from,
  to,
  born,
  color,
  fat = false,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  born: number;
  color: string;
  fat?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const flare = useRef<THREE.Mesh>(null);
  const { dir, dist, len, quat } = useMemo(() => {
    const d = to.clone().sub(from);
    const distance = d.length() || 1;
    d.divideScalar(distance);
    return {
      dir: d,
      dist: distance,
      len: Math.min(STRIDE * 5, distance * 0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(Y_AXIS, d),
    };
  }, [from, to]);
  const travelMs = Math.min(BOLT_LIFE_MS - 60, (dist / BOLT_SPEED) * 1000);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = performance.now() - born;
    const head = Math.min(dist, (t / Math.max(1, travelMs)) * dist);
    const arrived = t >= travelMs;
    g.visible = !arrived;
    g.position.copy(from).addScaledVector(dir, Math.max(len / 2, head - len / 2));
    if (flare.current) {
      flare.current.visible = arrived;
      const k = Math.max(0, 1 - (t - travelMs) / 80);
      flare.current.scale.setScalar(STRIDE * (0.4 + (1 - k) * 0.9));
      (flare.current.material as THREE.MeshBasicMaterial).opacity = k;
    }
  });

  const r = STRIDE * (fat ? 0.14 : 0.07);
  return (
    <>
      <group ref={group} quaternion={quat} position={from}>
        <mesh>
          <cylinderGeometry args={[r * 0.45, r * 0.45, len, 6]} />
          <meshBasicMaterial color="#fff6f0" toneMapped={false} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[r * 1.6, r * 1.6, len * 1.08, 8]} />
          <meshBasicMaterial
            color={color}
            toneMapped={false}
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <cylinderGeometry args={[r * 3, r * 3, len * 1.2, 8]} />
          <meshBasicMaterial
            color={color}
            toneMapped={false}
            transparent
            opacity={0.18}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
      <mesh ref={flare} position={to} visible={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial
          color={color}
          toneMapped={false}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
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

/** An ion bolt's landing: an expanding electric shock ring on the ground. */
function IonRing({ at, born, color, radius }: { at: THREE.Vector3; born: number; color: string; radius: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const t = Math.min(1, (performance.now() - born) / 700);
    m.scale.setScalar(radius * (0.2 + t * 1.3));
    (m.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.9;
  });
  return (
    <mesh ref={mesh} position={at} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.75, 1, 36]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** A saber swing: a bright crescent of light sweeping across in front of you. */
function SaberArc({ pose, born, color }: { pose: React.RefObject<PlayerState>; born: number; color: string }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const g = group.current;
    const me = pose.current;
    if (!g || !me) return;
    const t = Math.min(1, (performance.now() - born) / 260);
    g.position.set(me.x, me.y + STRIDE * 1.1, me.z);
    g.rotation.set(0, me.yaw + Math.PI, 0);
    if (mesh.current) {
      mesh.current.rotation.z = -1.2 + t * 2.4;
      (mesh.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.8;
    }
  });
  return (
    <group ref={group}>
      <mesh ref={mesh} rotation-x={Math.PI / 2.4}>
        <torusGeometry args={[STRIDE * 1.4, STRIDE * 0.06, 6, 24, Math.PI * 0.7]} />
        <meshBasicMaterial color={color} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Duel arena: a pulsing ring of light locked around your rival's feet. */
function DuelRing({
  cursorsRef,
  targetId,
  color,
}: {
  cursorsRef: React.RefObject<MapCursor[]>;
  targetId: string;
  color: string;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const rival = cursorsRef.current?.find((peer) => peer.id === targetId);
    m.visible = Boolean(rival && rival.hp > 0);
    if (!rival) return;
    m.position.set(rival.x, (rival.y ?? 0) + STRIDE * 0.05, rival.z);
    const pulse = 1 + Math.sin(performance.now() / 160) * 0.08;
    m.scale.setScalar(STRIDE * 1.6 * pulse);
  });
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.85, 1, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
