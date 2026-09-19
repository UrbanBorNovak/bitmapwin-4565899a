import { useMemo } from "react";
import { SPRITES, SpriteCritter } from "@/components/SpriteCritter";

const HIDDEN_PREFIXES = ["/map", "/auth", "/reset-password", "/wallet", "/studio", "/create"];

const PLACEMENTS = [
  "-left-3 top-[36%] sm:left-4 sm:top-[22%]",
  "-right-3 top-[48%] sm:right-5 sm:top-[38%]",
  "-left-3 bottom-[8%] sm:left-[14%] sm:bottom-5",
  "-right-3 bottom-[8%] sm:right-[16%] sm:bottom-5",
  "-left-3 bottom-[28%] sm:left-6 sm:bottom-[25%]",
  "-right-3 top-[68%] sm:right-6 sm:top-[64%]",
] as const;

function hashPath(pathname: string): number {
  let hash = 2166136261;
  for (let index = 0; index < pathname.length; index += 1) {
    hash ^= pathname.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function choices(pathname: string) {
  const seed = hashPath(pathname || "/");
  const spriteStart = seed % SPRITES.length;
  const placementStart = (seed >>> 5) % PLACEMENTS.length;
  return Array.from({ length: 3 }, (_, index) => ({
    sheet: SPRITES[(spriteStart + index * 3) % SPRITES.length],
    placement: PLACEMENTS[(placementStart + index * 2) % PLACEMENTS.length],
    flip: ((seed >>> (index + 1)) & 1) === 1,
    delay: `${(index * 0.7 + (seed % 5) * 0.1).toFixed(1)}s`,
  })).filter((choice) => choice.sheet !== undefined && choice.placement !== undefined);
}

export function AmbientCharacters({ pathname }: { pathname: string }) {
  const selected = useMemo(() => choices(pathname), [pathname]);
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-label="Inscribed pixel companions" data-no-translate>
      {selected.map(({ sheet, placement, flip, delay }, index) => (
        <div
          key={`${pathname}-${sheet.id}`}
          className={`absolute origin-bottom scale-75 opacity-80 sm:scale-100 sm:opacity-90 ${placement} ${index === 1 ? "animate-sprite-stroll-slow" : "animate-sprite-bob"}`}
          style={{ animationDelay: delay }}
        >
          <SpriteCritter sheet={sheet} height={index === 1 ? 66 : 58} flip={flip} />
        </div>
      ))}
    </div>
  );
}