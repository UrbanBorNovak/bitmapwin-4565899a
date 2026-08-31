import { clubOf } from "@/lib/clubs";
import { traitsOf } from "@/lib/traits";

/**
 * Aggregated rarity for a district: which clubs its bitmaps belong to and which
 * rare traits appear across them, each with a count. Derived purely from the
 * block heights the district contains — no chain lookup needed.
 */
export type DistrictRaritySummary = {
  clubs: { id: string; label: string; count: number }[];
  traits: { id: string; label: string; count: number; rare: boolean }[];
};

export function summarizeDistrict(heights: number[]): DistrictRaritySummary {
  const clubs = new Map<string, { id: string; label: string; count: number }>();
  const traits = new Map<string, { id: string; label: string; count: number; rare: boolean }>();

  for (const height of heights) {
    const club = clubOf(height);
    const c = clubs.get(club.id);
    if (c) c.count += 1;
    else clubs.set(club.id, { id: club.id, label: club.short, count: 1 });

    for (const t of traitsOf(height)) {
      const existing = traits.get(t.id);
      if (existing) existing.count += 1;
      else traits.set(t.id, { id: t.id, label: t.label, count: 1, rare: t.rare });
    }
  }

  return {
    clubs: [...clubs.values()].sort((a, b) => b.count - a.count),
    traits: [...traits.values()].sort(
      (a, b) => Number(b.rare) - Number(a.rare) || b.count - a.count,
    ),
  };
}

/** Compact badge row: club membership first, then rare traits found inside. */
export function DistrictRarity({
  heights,
  max,
  className = "",
}: {
  heights: number[];
  max?: number;
  className?: string;
}) {
  const { clubs, traits } = summarizeDistrict(heights);
  const shown = typeof max === "number" ? traits.slice(0, max) : traits;
  const hidden = traits.length - shown.length;

  if (clubs.length === 0 && traits.length === 0) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`}>
      {clubs.map((c) => (
        <li
          key={c.id}
          title="CLUB MEMBERSHIP"
          className="border border-primary px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary"
        >
          {c.label} ×{c.count}
        </li>
      ))}
      {shown.map((t) => (
        <li
          key={t.id}
          title={t.rare ? "RARE TRAIT" : "TRAIT"}
          className={
            t.rare
              ? "border border-foreground px-1.5 py-0.5 font-mono text-[9px]"
              : "border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
          }
        >
          {t.label} ×{t.count}
        </li>
      ))}
      {hidden > 0 && (
        <li className="border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
          +{hidden}
        </li>
      )}
    </ul>
  );
}
