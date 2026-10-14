import { useQuery } from "@tanstack/react-query";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { morphFromDna } from "@/lib/creature-morph";

/** The Guardian's on-chain name, read from its block. Falls back to the species line. */
export function GuardianName({ height, fallback }: { height: number; fallback: string }) {
  const dna = useQuery(guardianDnaQuery(height));
  return <>{dna.data ? morphFromDna(dna.data).name : fallback}</>;
}
