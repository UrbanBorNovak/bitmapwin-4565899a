/**
 * CLAY SHRINES — deterministic fortified sanctuaries assembled from inscribed
 * architectural pieces. Sites are sparse, dry-land only, and streamed with the
 * rest of the nearby desert dressing.
 */

import { Suspense, memo, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { InscribedModel, contentUrl } from "@/components/game/InscribedParts";
import { dropSolids, registerSolids } from "@/lib/world-solids";
import { dryLandNear, isSea } from "@/lib/world-sea";

export const CLAY_INSCRIPTIONS = {
  shrine: "85bf8d819bf3c403d86523cfa01c39ea947fc914924197cd1828f4957af0e188i0",
  spikes: "f973c9cad80b3c6602b6bdfcdbfb8bd5737a554c3bb073eeecd4bc7e9825e223i0",
  bars: "6c31fbb610af1ee999da8f84fadab566dceac56499bcff7de2e6a3cdf4687db8i0",
  saw: "59dc1b7be0c51cc6028226968f52af94f4af8b88f6eb8471c39f7037f890ec0ai0",
  steps: "4a058985e62d88a97985405e309a334ad50c20e536cc3fe4e8abb1a4e2f0b0c2i0",
  brokenWall: "94d6ef9c946f96015e392f8b7361660d3935a3a9aa807ee46ca1ba920aeccd4ei0",
  entranceWall: "a1100e97c1632d43b1461e55dc4c1dae95edaf13a965aa4eb6300146cc822681i0",
  windowWall: "a05fd77bd88e0edbedad504761bbdeed5a9fd4c8b3af45f6c85a7f71e16bbd4fi0",
  door: "acc034162e5df7e5e1535960e59719628ae49252a2bdfe542199117305cb1a55i0",
  pillar: "6b627123ad25d9e1bc5dad3668099bb22e54661c6e311548f0dba0ba81a524a4i0",
  holeWall: "772b8d2ddc053fc5773f24e94b3595a9fed347363ab3f8c488de9691006c3f88i0",
} as const;

type PieceKind = keyof typeof CLAY_INSCRIPTIONS;
type Piece = {
  id: string;
  kind: PieceKind;
  x: number;
  z: number;
  size: number;
  yaw: number;
  solids?: { x: number; z: number; radius: number }[];
};

type Site = { key: string; x: number; z: number; yaw: number; variant: number };

const URLS = Object.fromEntries(
  Object.entries(CLAY_INSCRIPTIONS).map(([key, inscription]) => [key, contentUrl(inscription)]),
) as Record<PieceKind, string>;

const noRaycast = () => {};

function hash(x: number, z: number, salt: number) {
  const n = Math.sin(x * 83.7 + z * 197.3 + salt * 61.9) * 49_731.3157;
  return n - Math.floor(n);
}

function wallSolids(length = 4.8) {
  return [-0.34, 0, 0.34].map((portion) => ({ x: portion * length, z: 0, radius: 0.78 }));
}

function entranceSolids() {
  return [
    { x: -1.65, z: 0, radius: 0.72 },
    { x: 1.65, z: 0, radius: 0.72 },
  ];
}

/** A complete compound: shrine at the back, open gate and steps at the front. */
const COMPOUND: Piece[] = [
  { id: "shrine", kind: "shrine", x: 0, z: -4.8, size: 7.2, yaw: Math.PI, solids: [{ x: 0, z: 0, radius: 2.2 }] },
  { id: "steps", kind: "steps", x: 0, z: -1.1, size: 4.4, yaw: 0 },
  { id: "back-left", kind: "windowWall", x: -3.4, z: -7.7, size: 4.8, yaw: 0, solids: wallSolids() },
  { id: "back-right", kind: "holeWall", x: 3.4, z: -7.7, size: 4.8, yaw: 0, solids: wallSolids() },
  { id: "left-front", kind: "brokenWall", x: -7.2, z: 2.2, size: 5.1, yaw: Math.PI / 2, solids: wallSolids() },
  { id: "left-back", kind: "windowWall", x: -7.2, z: -3.3, size: 5.1, yaw: Math.PI / 2, solids: wallSolids() },
  { id: "right-front", kind: "holeWall", x: 7.2, z: 2.2, size: 5.1, yaw: Math.PI / 2, solids: wallSolids() },
  { id: "right-back", kind: "brokenWall", x: 7.2, z: -3.3, size: 5.1, yaw: Math.PI / 2, solids: wallSolids() },
  { id: "gate", kind: "entranceWall", x: 0, z: 6.3, size: 5.4, yaw: 0, solids: entranceSolids() },
  { id: "door", kind: "door", x: 2.55, z: 5.75, size: 2.7, yaw: -Math.PI / 2 },
  { id: "pillar-left", kind: "pillar", x: -3.6, z: 6.25, size: 4.2, yaw: 0, solids: [{ x: 0, z: 0, radius: 0.7 }] },
  { id: "pillar-right", kind: "pillar", x: 3.6, z: 6.25, size: 4.2, yaw: 0, solids: [{ x: 0, z: 0, radius: 0.7 }] },
  { id: "bars", kind: "bars", x: 7.05, z: -6.25, size: 3.6, yaw: Math.PI / 2, solids: [{ x: 0, z: 0, radius: 0.9 }] },
  { id: "spikes-left", kind: "spikes", x: -5.2, z: 7.2, size: 2.3, yaw: 0, solids: [{ x: 0, z: 0, radius: 0.75 }] },
  { id: "spikes-right", kind: "spikes", x: 5.2, z: 7.2, size: 2.3, yaw: Math.PI, solids: [{ x: 0, z: 0, radius: 0.75 }] },
  { id: "saw", kind: "saw", x: -5.7, z: -6.4, size: 1.8, yaw: Math.PI / 4, solids: [{ x: 0, z: 0, radius: 0.65 }] },
];

function rotate(x: number, z: number, yaw: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c - z * s, z: x * s + z * c };
}

function siteIsDry(x: number, z: number, unit: number) {
  return [
    [0, 0],
    [-9, -9],
    [9, -9],
    [-9, 9],
    [9, 9],
  ].every(([dx = 0, dz = 0]) => !isSea(x + dx * unit, z + dz * unit));
}

function PieceFallback({ size }: { size: number }) {
  return (
    <mesh position={[0, size * 0.3, 0]} raycast={noRaycast}>
      <boxGeometry args={[size * 0.65, size * 0.6, size * 0.18]} />
      <meshLambertMaterial color="#7a5944" flatShading />
    </mesh>
  );
}

function ShrineSite({ site, unit }: { site: Site; unit: number }) {
  return (
    <group position={[site.x, 0, site.z]} rotation-y={site.yaw}>
      {COMPOUND.map((piece) => {
        const mirror = site.variant === 1 && piece.id.includes("right") ? Math.PI : 0;
        return (
          <group key={piece.id} position={[piece.x * unit, 0, piece.z * unit]}>
            <Suspense fallback={<PieceFallback size={piece.size * unit} />}>
              <InscribedModel
                url={URLS[piece.kind]}
                size={piece.size * unit}
                yaw={piece.yaw + mirror}
              />
            </Suspense>
          </group>
        );
      })}
    </group>
  );
}

export const ClayShrines = memo(function ClayShrines({
  unit,
  center,
  radius,
}: {
  unit: number;
  center: [number, number];
  radius: number;
}) {
  const sites = useMemo(() => {
    const pitch = unit * 105;
    const span = Math.ceil(radius / pitch) + 1;
    const cx = Math.round(center[0] / pitch);
    const cz = Math.round(center[1] / pitch);
    const found: Site[] = [];
    for (let ix = -span; ix <= span; ix++) {
      for (let iz = -span; iz <= span; iz++) {
        const gx = cx + ix;
        const gz = cz + iz;
        if (hash(gx, gz, 301) > 0.28) continue;
        const rawX = gx * pitch + (hash(gx, gz, 302) - 0.5) * pitch * 0.45;
        const rawZ = gz * pitch + (hash(gx, gz, 303) - 0.5) * pitch * 0.45;
        const dry = dryLandNear(rawX, rawZ, unit * 42, gx * 7 + gz * 11);
        if (!dry || !siteIsDry(dry.x, dry.z, unit)) continue;
        const dx = dry.x - center[0];
        const dz = dry.z - center[1];
        if (dx * dx + dz * dz > radius * radius) continue;
        found.push({
          key: `${gx}:${gz}`,
          x: dry.x,
          z: dry.z,
          yaw: Math.floor(hash(gx, gz, 304) * 4) * (Math.PI / 2),
          variant: Math.floor(hash(gx, gz, 305) * 2),
        });
      }
    }
    return found
      .sort((a, b) => (a.x - center[0]) ** 2 + (a.z - center[1]) ** 2 - ((b.x - center[0]) ** 2 + (b.z - center[1]) ** 2))
      .slice(0, 2);
  }, [center, radius, unit]);

  useEffect(() => {
    const solids = sites.flatMap((site) =>
      COMPOUND.flatMap((piece) =>
        (piece.solids ?? []).map((solid, index) => {
          const pieceOffset = rotate(piece.x * unit, piece.z * unit, site.yaw);
          const localOffset = rotate(solid.x * unit, solid.z * unit, site.yaw + piece.yaw);
          return {
            key: `clay-shrine:${site.key}:${piece.id}:${index}`,
            x: site.x + pieceOffset.x + localOffset.x,
            z: site.z + pieceOffset.z + localOffset.z,
            radius: solid.radius * unit,
          };
        }),
      ),
    );
    registerSolids(solids);
    return () => dropSolids(solids.map((solid) => solid.key));
  }, [sites, unit]);

  return (
    <>
      {sites.map((site) => (
        <ShrineSite key={site.key} site={site} unit={unit} />
      ))}
    </>
  );
});

for (const url of Object.values(URLS)) useGLTF.preload(url);