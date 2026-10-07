import type React from "react";
/**
 * THE BELT — the weapon strip you see in the world.
 *
 * Purely presentational: each slot draws its own little on-screen glyph so a
 * weapon reads at a glance instead of by name, the held slot lifts and glows,
 * and the held weapon gets a readout strip above the belt with its rounds,
 * damage and the one-line hint.
 */

import { WEAPONS, WEAPON_ORDER, type WeaponKind } from "@/components/game/weapons";

type BeltStats = {
  ammo: number;
  magazine: number;
  reloading: boolean;
};

/** hand-drawn terminal glyphs, one per weapon, all on a 24-unit box */
export function WeaponGlyph({ kind }: { kind: WeaponKind }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<WeaponKind, React.ReactElement> = {
    minigun: (
      <g {...stroke}>
        <path d="M3 9h13M3 12h13M3 15h13" />
        <path d="M16 7.5h4v9h-4z" />
        <path d="M8 17v3" />
      </g>
    ),
    revolver: (
      <g {...stroke}>
        <path d="M3 9h13v3H8l-3 7H3z" />
        <circle cx="8.5" cy="10.5" r="2.2" />
      </g>
    ),
    trap: (
      <g {...stroke}>
        <circle cx="12" cy="13" r="4" />
        <path d="M12 9V4M6 13H2M22 13h-4M12 17v4M7 8l-3-3M17 8l3-3" />
      </g>
    ),
    pickaxe: (
      <g {...stroke}>
        <path d="M4 7c6-3 12-3 16 0" />
        <path d="M12 6v14" />
      </g>
    ),
    hammer: (
      <g {...stroke}>
        <path d="M5 5h9v5H5z" />
        <path d="M10 10 9 21" />
      </g>
    ),
    sword: (
      <g {...stroke}>
        <path d="M5 20 16 6M8 20 19 6" />
        <path d="M3 18h5M6 21v-5" />
      </g>
    ),
    powersword: (
      <g {...stroke}>
        <path d="M6 21 18 4l2 3-11 16z" />
        <path d="M4 17h6" />
      </g>
    ),
    wand: (
      <g {...stroke}>
        <path d="M5 20 17 7" />
        <circle cx="18.5" cy="5.5" r="2" />
        <path d="M12 4v3M21 12h-3" />
      </g>
    ),
    staff: (
      <g {...stroke}>
        <path d="M9 21 13 6" />
        <path d="M10 6h6l-2 4h-5z" />
        <circle cx="13" cy="4" r="1.6" />
      </g>
    ),
    blaster: (
      <g {...stroke}>
        <path d="M2 10h15v3H9l-1 5H5l1-5H2z" />
        <path d="M17 11h5M10 8h5" />
      </g>
    ),
    ionrifle: (
      <g {...stroke}>
        <path d="M2 10h13v4H8l-1 5H4l1-5H2z" />
        <circle cx="19" cy="12" r="3" />
      </g>
    ),
    lightsaber: (
      <g {...stroke}>
        <path d="M5 19 8 16" strokeWidth={2.6} />
        <path d="M8 16 20 4" />
      </g>
    ),
    sithsaber: (
      <g {...stroke}>
        <path d="M4 20 7 17" strokeWidth={2.6} />
        <path d="M7 17 19 5M9 19 11 17" />
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      {paths[kind]}
    </svg>
  );
}

export function WeaponBelt({
  weapon,
  stats,
  onEquip,
}: {
  weapon: WeaponKind | null;
  stats: BeltStats;
  onEquip: (kind: WeaponKind | null) => void;
}) {
  const held = weapon ? WEAPONS[weapon] : null;
  const pips = held && held.magazine > 0 ? Math.min(held.magazine, 12) : 0;
  const filled =
    held && held.magazine > 0
      ? Math.round((stats.ammo / Math.max(1, stats.magazine)) * pips)
      : 0;

  return (
    <div
      data-no-translate
      className="absolute bottom-[10.5rem] left-1/2 z-20 w-[calc(100%-1rem)] -translate-x-1/2 md:bottom-[4.4rem] md:z-40 md:w-auto"
      aria-label="Weapon belt"
    >
      {held ? (
        <div className="mb-1 flex items-end justify-between gap-3 border-l-2 border-signal/60 bg-background/70 px-2 py-1 font-mono backdrop-blur-md md:justify-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-signal">
              <span className="label">{held.label}</span>
              {held.magazine > 0 ? (
                <span className="tabular-nums text-muted-foreground">
                  {stats.reloading ? "RELOADING" : `${stats.ammo}/${stats.magazine}`}
                </span>
              ) : (
                <span className="text-muted-foreground">NO RELOAD</span>
              )}
            </div>
            <div className="truncate text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {held.hint}
            </div>
          </div>
          {pips > 0 ? (
            <div className="flex shrink-0 items-center gap-[2px]" aria-hidden>
              {Array.from({ length: pips }).map((_, index) => (
                <span
                  key={index}
                  className={`h-2.5 w-[3px] ${
                    index < filled && !stats.reloading ? "bg-bitcoin" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto md:overflow-visible">
        <div className="hud-panel flex w-max items-end gap-1 px-1.5 py-1.5 font-mono md:w-auto">
          {WEAPON_ORDER.map((kind, index) => {
            const active = weapon === kind;
            const spec = WEAPONS[kind];
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                aria-label={spec.label}
                title={spec.hint}
                onClick={() => onEquip(active ? null : kind)}
                className={`relative flex w-[3.5rem] flex-col items-center gap-1 border px-1 pb-1 pt-1.5 text-[9px] transition-all ${
                  active
                    ? "-translate-y-1 border-bitcoin bg-bitcoin/10 text-bitcoin shadow-[0_0_16px_-6px_var(--bitcoin)]"
                    : "border-border/80 bg-background/45 text-muted-foreground hover:border-signal/60 hover:text-signal"
                }`}
              >
                <span
                  className={`absolute left-1 top-1 text-[8px] tabular-nums ${
                    active ? "text-bitcoin" : "text-muted-foreground/70"
                  }`}
                >
                  {index + 1}
                </span>
                <WeaponGlyph kind={kind} />
                <span className="label w-full truncate text-center text-[8px] leading-none">
                  {spec.short}
                </span>
                <span
                  className={`h-[2px] w-full ${active ? "bg-bitcoin" : "bg-transparent"}`}
                  aria-hidden
                />
              </button>
            );
          })}
          <span className="self-center px-1.5 text-[9px] leading-tight text-muted-foreground">
            {weapon ? "SCROLL SWAP" : "1-9 DRAW"}
            <br />
            {weapon ? "0 HOLSTER" : "WHEEL CYCLE"}
          </span>
        </div>
      </div>
    </div>
  );
}
