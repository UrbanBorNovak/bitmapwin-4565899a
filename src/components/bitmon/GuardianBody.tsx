/** A Guardian's body, built from its species shape and block-derived colours. */
import { memo } from "react";
import { shapeOf, type GuardianRarity, type GuardianSpecies } from "@/lib/bitmon";

const noRaycast = () => {};

export const GuardianBody = memo(function GuardianBody({
  species,
  rarity,
  body,
  accent,
  unit = 1,
}: {
  species: GuardianSpecies;
  rarity: GuardianRarity;
  body: string;
  accent: string;
  unit?: number;
}) {
  const shape = shapeOf(species);
  const u = unit;
  const glow = rarity === "MYTHIC" ? 1.4 : rarity === "EPIC" ? 0.8 : rarity === "RARE" ? 0.4 : 0.15;
  const skin = <meshStandardMaterial color={body} roughness={0.6} metalness={0.2} flatShading />;
  const eye = <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={glow + 0.6} />;

  if (shape === "golem") {
    return (
      <group raycast={noRaycast}>
        <mesh position={[0, u * 0.9, 0]}><boxGeometry args={[u * 0.9, u * 0.9, u * 0.6]} />{skin}</mesh>
        <mesh position={[0, u * 1.55, 0.05 * u]}><boxGeometry args={[u * 0.5, u * 0.4, u * 0.45]} />{skin}</mesh>
        <mesh position={[0, u * 1.58, u * 0.29]}><boxGeometry args={[u * 0.36, u * 0.07, u * 0.02]} />{eye}</mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * u * 0.62, u * 0.85, 0]}><boxGeometry args={[u * 0.3, u * 0.9, u * 0.3]} />{skin}</mesh>
            <mesh position={[s * u * 0.25, u * 0.22, 0]}><boxGeometry args={[u * 0.3, u * 0.45, u * 0.3]} />{skin}</mesh>
          </group>
        ))}
        <mesh position={[0, u * 0.95, u * 0.31]}><boxGeometry args={[u * 0.2, u * 0.2, u * 0.02]} />{eye}</mesh>
      </group>
    );
  }
  if (shape === "wisp") {
    return (
      <group raycast={noRaycast}>
        <mesh position={[0, u * 1.1, 0]}><icosahedronGeometry args={[u * 0.5, 0]} /><meshStandardMaterial color={body} transparent opacity={0.75} flatShading emissive={accent} emissiveIntensity={glow * 0.3} /></mesh>
        <mesh position={[0, u * 0.5, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[u * 0.4, u * 0.8, 6]} /><meshStandardMaterial color={body} transparent opacity={0.5} flatShading /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[s * u * 0.17, u * 1.18, u * 0.42]}><sphereGeometry args={[u * 0.07, 8, 8]} />{eye}</mesh>)}
      </group>
    );
  }
  if (shape === "bird") {
    return (
      <group raycast={noRaycast}>
        <mesh position={[0, u * 0.8, 0]}><boxGeometry args={[u * 0.5, u * 0.5, u * 0.9]} />{skin}</mesh>
        <mesh position={[0, u * 1.2, u * 0.5]}><boxGeometry args={[u * 0.36, u * 0.36, u * 0.36]} />{skin}</mesh>
        <mesh position={[0, u * 1.16, u * 0.78]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[u * 0.08, u * 0.24, 4]} />{eye}</mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * u * 0.6, u * 0.95, 0]} rotation={[0, 0, s * 0.35]}><boxGeometry args={[u * 0.8, u * 0.05, u * 0.55]} /><meshStandardMaterial color={accent} flatShading emissive={accent} emissiveIntensity={glow * 0.3} /></mesh>
            <mesh position={[s * u * 0.14, u * 0.28, 0]}><boxGeometry args={[u * 0.1, u * 0.56, u * 0.1]} />{skin}</mesh>
          </group>
        ))}
      </group>
    );
  }
  const long = shape === "wyrm";
  return (
    <group raycast={noRaycast}>
      <mesh position={[0, u * 0.6, 0]}><boxGeometry args={[u * 0.5, u * 0.45, long ? u * 1.4 : u * 0.95]} />{skin}</mesh>
      <mesh position={[0, u * 0.85, long ? u * 0.85 : u * 0.6]}><boxGeometry args={[u * 0.4, u * 0.36, u * 0.46]} />{skin}</mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * u * 0.12, u * 0.92, long ? u * 1.09 : u * 0.84]}><boxGeometry args={[u * 0.08, u * 0.06, u * 0.02]} />{eye}</mesh>
          <mesh position={[s * u * 0.13, u * 1.12, long ? u * 0.75 : u * 0.5]} rotation={[-0.5, 0, s * 0.2]}><coneGeometry args={[u * 0.05, u * 0.3, 4]} />{eye}</mesh>
          {(long ? [-0.4, 0.4] : [-0.3, 0.3]).map((z) => (
            <mesh key={z} position={[s * u * 0.2, u * 0.2, z * u]}><boxGeometry args={[u * 0.14, u * 0.4, u * 0.14]} />{skin}</mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, u * 0.7, long ? -u * 1.0 : -u * 0.6]} rotation={[-0.6, 0, 0]}><coneGeometry args={[u * 0.14, long ? u * 0.9 : u * 0.5, 5]} /><meshStandardMaterial color={accent} flatShading emissive={accent} emissiveIntensity={glow * 0.4} /></mesh>
      {long ? <mesh position={[0, u * 0.95, 0]}><boxGeometry args={[u * 0.06, u * 0.2, u * 1.2]} />{eye}</mesh> : null}
    </group>
  );
});
