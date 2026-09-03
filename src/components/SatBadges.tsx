import { useQuery } from "@tanstack/react-query";
import { satQuery } from "@/lib/sat-lookup";
import { satRarity, satSpecials, satToBlock, type SatRarity } from "@/lib/sat-rarity";

/**
 * Badges for the satoshi a bitmap is inscribed on: ordinal-theory rarity plus
 * named sat collections (block 9, pizza, vintage…). Everything is derived from
 * the real sat number in the on-chain index — nothing is estimated.
 */

const FILLED: SatRarity[] = ["MYTHIC", "LEGENDARY", "EPIC", "RARE", "UNCOMMON"];

export function SatBadges({
  height,
  max,
  className = "",
}: {
  height: number;
  max?: number;
  className?: string;
}) {
  const { data: sat } = useQuery(satQuery(height));
  if (sat === null || sat === undefined) return null;

  const rarity = satRarity(sat);
  const specials = satSpecials(sat);
  const rare = FILLED.includes(rarity);
  if (!rare && specials.length === 0) return null;

  const shown = typeof max === "number" ? specials.slice(0, max) : specials;
  const hidden = specials.length - shown.length;
  const mined = satToBlock(sat).height;

  return (
    <ul className={`flex flex-wrap items-center gap-1 ${className}`}>
      {rare && (
        <li
          title={`SAT ${sat} · MINED IN BLOCK ${mined}`}
          className="border border-primary bg-primary px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary-foreground"
        >
          {rarity} SAT
        </li>
      )}
      {shown.map((s) => (
        <li
          key={s.id}
          title={`${s.note} SAT ${sat}`}
          className="border border-primary px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary"
        >
          {s.label}
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

/** Full sat provenance line for the bitmap detail page. */
export function SatProvenance({ height }: { height: number }) {
  const { data: sat, isLoading } = useQuery(satQuery(height));

  if (isLoading) return null;
  if (sat === null || sat === undefined) {
    return (
      <p className="font-mono text-[10px] text-muted-foreground">SAT DATA — NO DATA YET</p>
    );
  }

  const mined = satToBlock(sat);
  return (
    <div className="space-y-2">
      <SatBadges height={height} />
      <dl className="space-y-1 text-[11px]">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="label">SAT</dt>
          <dd className="truncate font-mono text-foreground">{sat.toLocaleString("en-US")}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="label">SAT RARITY</dt>
          <dd className="font-mono text-foreground">{satRarity(sat)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="label">SAT MINED IN</dt>
          <dd className="font-mono text-foreground">BLOCK {mined.height.toLocaleString("en-US")}</dd>
        </div>
      </dl>
    </div>
  );
}
