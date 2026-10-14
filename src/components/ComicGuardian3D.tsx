import { useQuery } from "@tanstack/react-query";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { CreatureModel3D } from "@/components/codex/CreatureModel3D";

/** Live 3D turntable of the inscribed Guardian of a BITMAP (child of the collection root). */
export default function ComicGuardian3D({ height }: { height: number }) {
  const dna = useQuery({ ...guardianDnaQuery(height), staleTime: Infinity });
  if (!dna.data) return null;
  const d = dna.data;
  return <CreatureModel3D label={`${height}.bitmap Guardian`} guardian={{ species: d.species, rarity: d.rarity, body: d.body, accent: d.accent, height }} />;
}
