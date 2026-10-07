/** Voxel race accents worn on top of any avatar skin: ears, beard, tusks. */
import { memo } from "react";
import type { Race } from "@/lib/character-race";

const noRaycast = () => null;

export const RaceFeatures = memo(function RaceFeatures({ race, u }: { race: Race; u: number }) {
  if (race === "human") return null;
  const b = (p: [number, number, number], s: [number, number, number], c: string, r = 0) => (
    <mesh position={p} rotation-z={r} raycast={noRaycast}>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} />
    </mesh>
  );
  if (race === "elf")
    return (
      <group>
        {b([-u * 0.15, u * 0.9, 0], [u * 0.04, u * 0.16, u * 0.05], "#e8c39e", 0.5)}
        {b([u * 0.15, u * 0.9, 0], [u * 0.04, u * 0.16, u * 0.05], "#e8c39e", -0.5)}
        {b([0, u * 0.98, 0], [u * 0.26, u * 0.03, u * 0.26], "#c9a227")}
      </group>
    );
  if (race === "dwarf")
    return (
      <group>
        {b([0, u * 0.74, u * 0.12], [u * 0.24, u * 0.18, u * 0.06], "#8a4b22")}
        {b([0, u * 0.66, u * 0.13], [u * 0.14, u * 0.08, u * 0.05], "#8a4b22")}
        {b([0, u * 1.0, 0], [u * 0.3, u * 0.07, u * 0.3], "#7c8188")}
      </group>
    );
  return (
    <group>
      {b([-u * 0.06, u * 0.8, u * 0.14], [u * 0.03, u * 0.07, u * 0.03], "#f1ead2")}
      {b([u * 0.06, u * 0.8, u * 0.14], [u * 0.03, u * 0.07, u * 0.03], "#f1ead2")}
      {b([-u * 0.27, u * 0.6, 0], [u * 0.14, u * 0.06, u * 0.16], "#4a4d52")}
      {b([u * 0.27, u * 0.6, 0], [u * 0.14, u * 0.06, u * 0.16], "#4a4d52")}
      {b([0, u * 0.85, u * 0.135], [u * 0.22, u * 0.06, u * 0.01], "#5d8a3a")}
    </group>
  );
});
