import { Link } from "@tanstack/react-router";
import { rarityOf, traitsOf } from "@/lib/traits";

/**
 * Monochrome trait badges for a bitmap parcel. Rare traits invert (filled)
 * so rarity is readable at a glance; common traits stay outlined.
 */
export function TraitBadges({
  height,
  max,
  showRarity = false,
  className = "",
}: {
  height: number;
  max?: number;
  showRarity?: boolean;
  className?: string;
}) {
  const traits = traitsOf(height);
  const rarity = rarityOf(height);
  const shown = typeof max === "number" ? traits.slice(0, max) : traits;
  const hidden = traits.length - shown.length;

  if (traits.length === 0 && !showRarity) return null;

  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`}>
      {showRarity && (
        <li className="border border-foreground bg-foreground px-1.5 py-0.5 font-mono text-[9px] uppercase text-background">
          {rarity}
        </li>
      )}
      {shown.map((t) => (
        <li key={t.id}>
          <Link
            to="/traits/$trait"
            params={{ trait: t.id }}
            title={`${t.sourceKey} — ${t.description}`}
            className={
              t.rare
                ? "block border border-foreground px-1.5 py-0.5 font-mono text-[9px] hover:border-bitcoin hover:text-bitcoin"
                : "block border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
            }
          >
            {t.label}
          </Link>
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
