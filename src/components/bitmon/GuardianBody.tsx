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
            <mesh position={[s * u * 0.58, u * 1.25, 0]} rotation-z={s * 0.12}><boxGeometry args={[u * 0.44, u * 0.34, u * 0.48]} />{skin}</mesh>
            <mesh position={[s * u * 0.64, u * 0.78, 0]}><boxGeometry args={[u * 0.24, u * 0.62, u * 0.28]} />{skin}</mesh>
            <mesh position={[s * u * 0.25, u * 0.22, 0]}><boxGeometry args={[u * 0.3, u * 0.45, u * 0.3]} />{skin}</mesh>
            <mesh position={[s * u * 0.25, u * 0.04, u * 0.08]}><boxGeometry args={[u * 0.4, u * 0.12, u * 0.48]} />{skin}</mesh>
          </group>
        ))}
        <mesh position={[0, u * 0.95, u * 0.31]}><boxGeometry args={[u * 0.2, u * 0.2, u * 0.02]} />{eye}</mesh>
        <mesh position={[0, u * 0.95, u * 0.335]} rotation-z={Math.PI / 4}><boxGeometry args={[u * 0.1, u * 0.1, u * 0.02]} />{eye}</mesh>
        {[-1, 1].map((s) => <mesh key={`brow-${s}`} position={[s * u * 0.13, u * 1.68, u * 0.29]} rotation-z={s * 0.18}><boxGeometry args={[u * 0.18, u * 0.04, u * 0.03]} />{eye}</mesh>)}
      </group>
    );
  }
  if (shape === "wisp") {
    return (
      <group raycast={noRaycast}>
        <mesh position={[0, u * 1.1, 0]}><icosahedronGeometry args={[u * 0.5, 0]} /><meshStandardMaterial color={body} transparent opacity={0.75} flatShading emissive={accent} emissiveIntensity={glow * 0.3} /></mesh>
        <mesh position={[0, u * 0.5, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[u * 0.4, u * 0.8, 6]} /><meshStandardMaterial color={body} transparent opacity={0.5} flatShading /></mesh>
        {[0, 1, 2].map((i) => <mesh key={i} position={[Math.sin(i * 2.1) * u * 0.34, u * (0.35 - i * 0.08), Math.cos(i * 2.1) * u * 0.34]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[u * 0.08, u * 0.34, 4]} />{eye}</mesh>)}
        {[-1, 1].map((s) => <mesh key={s} position={[s * u * 0.17, u * 1.18, u * 0.42]}><sphereGeometry args={[u * 0.07, 8, 8]} />{eye}</mesh>)}
        <mesh position={[0, u * 1.1, u * 0.46]}><boxGeometry args={[u * 0.08, u * 0.025, u * 0.025]} />{eye}</mesh>
      </group>
    );
  }
  if (shape === "bird") {
    return (
      <group raycast={noRaycast}>
        <mesh position={[0, u * 0.8, 0]}><boxGeometry args={[u * 0.5, u * 0.5, u * 0.9]} />{skin}</mesh>
        <mesh position={[0, u * 1.2, u * 0.5]}><boxGeometry args={[u * 0.36, u * 0.36, u * 0.36]} />{skin}</mesh>
        <mesh position={[0, u * 1.16, u * 0.78]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[u * 0.08, u * 0.24, 4]} />{eye}</mesh>
        {[-1, 1].map((s) => <mesh key={`eye-${s}`} position={[s * u * 0.1, u * 1.28, u * 0.69]}><boxGeometry args={[u * 0.055, u * 0.055, u * 0.025]} />{eye}</mesh>)}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * u * 0.6, u * 0.95, 0]} rotation={[0, 0, s * 0.35]}><boxGeometry args={[u * 0.8, u * 0.05, u * 0.55]} /><meshStandardMaterial color={accent} flatShading emissive={accent} emissiveIntensity={glow * 0.3} /></mesh>
            <mesh position={[s * u * 0.92, u * 0.88, -u * 0.08]} rotation={[0, s * 0.18, s * 0.5]}><boxGeometry args={[u * 0.42, u * 0.035, u * 0.34]} />{skin}</mesh>
            <mesh position={[s * u * 0.14, u * 0.28, 0]}><boxGeometry args={[u * 0.1, u * 0.56, u * 0.1]} />{skin}</mesh>
            <mesh position={[s * u * 0.14, u * 0.03, u * 0.08]}><boxGeometry args={[u * 0.18, u * 0.1, u * 0.28]} />{skin}</mesh>
          </group>
        ))}
        <mesh position={[0, u * 0.86, -u * 0.62]} rotation-x={-0.7}><coneGeometry args={[u * 0.12, u * 0.55, 4]} />{skin}</mesh>
      </group>
    );
  }
  const long = shape === "wyrm";
  return (
    <group raycast={noRaycast}>
      <mesh position={[0, u * 0.6, 0]}><boxGeometry args={[u * 0.5, u * 0.45, long ? u * 1.4 : u * 0.95]} />{skin}</mesh>
      <mesh position={[0, u * 0.85, long ? u * 0.85 : u * 0.6]}><boxGeometry args={[u * 0.4, u * 0.36, u * 0.46]} />{skin}</mesh>
      <mesh position={[0, u * 0.78, long ? u * 1.1 : u * 0.84]}><boxGeometry args={[u * 0.26, u * 0.18, u * 0.3]} />{skin}</mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * u * 0.12, u * 0.92, long ? u * 1.09 : u * 0.84]}><boxGeometry args={[u * 0.08, u * 0.06, u * 0.02]} />{eye}</mesh>
          <mesh position={[s * u * 0.13, u * 1.12, long ? u * 0.75 : u * 0.5]} rotation={[-0.5, 0, s * 0.2]}><coneGeometry args={[u * 0.05, u * 0.3, 4]} />{eye}</mesh>
          {(long ? [-0.4, 0.4] : [-0.3, 0.3]).map((z) => (
            <group key={z} position={[s * u * 0.2, 0, z * u]}>
              <mesh position={[0, u * 0.32, 0]}><boxGeometry args={[u * 0.15, u * 0.26, u * 0.16]} />{skin}</mesh>
              <mesh position={[0, u * 0.12, u * 0.035]}><boxGeometry args={[u * 0.12, u * 0.22, u * 0.13]} />{skin}</mesh>
              <mesh position={[0, u * 0.025, u * 0.09]}><boxGeometry args={[u * 0.2, u * 0.08, u * 0.28]} />{skin}</mesh>
            </group>
          ))}
        </group>
      ))}
      <mesh position={[0, u * 0.7, long ? -u * 1.0 : -u * 0.6]} rotation={[-0.6, 0, 0]}><coneGeometry args={[u * 0.14, long ? u * 0.9 : u * 0.5, 5]} /><meshStandardMaterial color={accent} flatShading emissive={accent} emissiveIntensity={glow * 0.4} /></mesh>
      {long ? [-0.6, -0.2, 0.2, 0.6].map((z) => <mesh key={z} position={[0, u * 0.98, z * u]} rotation-x={0.35}><coneGeometry args={[u * 0.08, u * 0.3, 4]} />{eye}</mesh>) : null}
      <mesh position={[0, u * 0.78, long ? u * 1.27 : u * 1.01]}><boxGeometry args={[u * 0.16, u * 0.07, u * 0.08]} />{eye}</mesh>
    </group>
  );
});
