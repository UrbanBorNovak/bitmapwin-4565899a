import { abilityFor } from "@/lib/game/abilities";
import { WORLD_CELL, WORLD_GRID, WORLD_UNITS } from "@/lib/player-state";
import { reliefAt } from "@/lib/world-terrain";
import { bitmapPixelForHeight, useBitmapPixels } from "@/lib/game/bitmapPixels";
import { hash } from "@/lib/game/cardFactory";
import { activePfpExtenderForCard, inscriptionContentUrl, ordinalsPreviewUrl } from "@/lib/game/pfpExtenders";
import type { CardState, CardType, LivingCard as Card } from "@/lib/game/types";
import { usePlayProfile } from "@/lib/game/worldState";
import { ORD_TORCHES_POOL, useOrdTorches } from "@/lib/game/ordTorches";
import { CardCharacter3D } from "./CardCharacter3D";

export type CardUiState =
  | "idle"
  | "selected"
  | "playable"
  | "disabled"
  | "attacking"
  | "damaged"
  | "evolved"
  | "defeated";

const TYPE_GLYPH: Record<CardType, string> = {
  TERRITORY: "▦",
  BUILDER: "▲",
  MINER: "◆",
  EXPLORER: "➤",
  GUARDIAN: "⛨",
  EVENT: "✦",
};

export function BitmapPattern({ height, state, className = "" }: { height: number; state: CardState; className?: string }) {
  const h = hash(height);
  const cells: boolean[] = [];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      const col = c < 3 ? c : 4 - c;
      cells.push(((h >>> (r * 3 + col)) & 1) === 1);
    }
  const lit = state === "DORMANT" ? "text-muted-foreground/60" : "text-bitcoin";
  return (
    <svg viewBox="0 0 5 5" className={`${lit} ${className}`} aria-hidden shapeRendering="crispEdges">
      {cells.map((on, i) =>
        on ? <rect key={i} x={i % 5} y={Math.floor(i / 5)} width={0.9} height={0.9} fill="currentColor" className="lc-cell" style={{ animationDelay: `${(i % 7) * 0.35}s` }} /> : null,
      )}
    </svg>
  );
}

/**
 * The Oasis horizon around the card's own BITMAP, drawn from the same relief
 * field the 3D world walks on. Far ridge, near ridge and a low sun, all
 * deterministic per block height.
 */
export function OasisBackdrop({ height, className = "" }: { height: number; className?: string }) {
  const col = height % WORLD_GRID;
  const row = Math.floor(height / WORLD_GRID);
  const cx = (col + 0.5) * WORLD_CELL - WORLD_UNITS / 2;
  const cz = (row + 0.5) * WORLD_CELL;
  const span = WORLD_CELL * 6;
  const N = 24;
  const ridge = (zOff: number, lift: number, base: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const x = cx - span / 2 + (span * i) / N;
      const r = reliefAt(x, cz + zOff);
      const px = (i / N) * 100;
      const py = base - r * lift;
      pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
    }
    return `0,100 ${pts.join(" ")} 100,100`;
  };
  const sunX = 18 + (hash(height) % 64);
  const sunY = 16 + (hash(height * 7 + 3) % 18);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`absolute inset-0 h-full w-full ${className}`} aria-hidden>
      <circle cx={sunX} cy={sunY} r="9" className="fill-bitcoin/25" />
      <circle cx={sunX} cy={sunY} r="5" className="fill-bitcoin/45" />
      <polygon points={ridge(WORLD_CELL * 4, 34, 74)} className="fill-foreground/10" />
      <polygon points={ridge(0, 44, 92)} className="fill-foreground/20" />
      <rect x="0" y="92" width="100" height="8" className="fill-foreground/25" />
    </svg>
  );
}

function CardArt({ card }: { card: Card }) {
  const profile = usePlayProfile();
  const torches = useOrdTorches();
  const bitmapPixels = useBitmapPixels();
  const selectedTorchPool = profile?.visuals.pfpExtendersEnabled === true && profile.visuals.selectedPfpCollection === ORD_TORCHES_POOL;
  const torch = selectedTorchPool && torches?.list.length
    ? torches.list[hash(card.bitmap) % torches.list.length]
    : undefined;
  if (torch)
    return (
      <div className="lc-pfp-frame absolute inset-0" title={`ORD TORCHES · #${torch.index + 1} / 3000`}>
        <OasisBackdrop height={card.bitmap} />
        <iframe src={ordinalsPreviewUrl(torch.inscriptionId)} title={`Ord Torch #${torch.index + 1}`} loading="lazy" sandbox="allow-scripts allow-same-origin" scrolling="no" className="h-full w-full border-0 pointer-events-none" />
        <div className="lc-pfp-scan absolute inset-0" aria-hidden />
        <BitmapPattern height={card.bitmap} state={card.state} className="absolute bottom-2 left-2 size-10 opacity-90" />
        <span className="lc-pfp-badge label absolute left-1.5 top-1 text-[7px] text-bitcoin">TORCH #{torch.index + 1}</span>
      </div>
    );
  const extender = activePfpExtenderForCard(card, profile?.visuals);
  if (extender)
    return (
      <div className="lc-pfp-frame absolute inset-0" title={`${extender.collection} · ${extender.name}`}>
        <OasisBackdrop height={card.bitmap} />
        {extender.source === "ordinals-image" ? (
          <img src={inscriptionContentUrl(extender.inscriptionId)} alt="" loading="lazy" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <iframe
            src={ordinalsPreviewUrl(extender.inscriptionId)}
            title={`${extender.name} Ordinals HTML PFP`}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
            scrolling="no"
            className="h-full w-full border-0 pointer-events-none"
          />
        )}
        <div className="lc-pfp-scan absolute inset-0" aria-hidden />
        <BitmapPattern height={card.bitmap} state={card.state} className="absolute bottom-2 left-2 size-10 opacity-90" />
        <span className="lc-pfp-badge label absolute left-1.5 top-1 text-[7px] text-bitcoin">{extender.source === "ordinals-image" ? "CHILD IMG" : "HTML PFP"}</span>
      </div>
    );

  const pixel = bitmapPixelForHeight(card.bitmap, bitmapPixels ?? []);
  if (!pixel)
    return (
      <div className="lc-pfp-frame absolute inset-0">
        <OasisBackdrop height={card.bitmap} />
        <BitmapPattern height={card.bitmap} state={card.state} className="relative size-[58%]" />
      </div>
    );
  return (
    <div className="lc-pfp-frame absolute inset-0" title={`BITMAP PIXELS · ${pixel.name}`}>
      <OasisBackdrop height={card.bitmap} />
      <CardCharacter3D skin={pixel.inscriptionId} label={`${pixel.name}, the 3D character for ${card.name}`} />
      <div className="lc-pfp-scan absolute inset-0" aria-hidden />
      <BitmapPattern height={card.bitmap} state={card.state} className="absolute bottom-2 left-2 size-10 opacity-90" />
      <span className="lc-pfp-badge label absolute left-1.5 top-1 text-[7px] text-bitcoin">PIXEL #{String(pixel.index).padStart(3, "0")}</span>
    </div>
  );
}

type Props = {
  card: Card;
  size?: "sm" | "md" | "lg";
  ui?: CardUiState;
  /** Live combat values (board units). */
  live?: { atk: number; hp: number; maxHp: number; ready?: boolean };
  onClick?: (() => void) | undefined;
  label?: string | undefined;
};

export function LivingCard({ card, size = "md", ui = "idle", live, onClick, label }: Props) {
  const w = size === "sm" ? "w-[7.5rem]" : size === "lg" ? "w-[15rem]" : "w-[10rem]";
  const Tag = onClick ? "button" : "div";
  const atk = live?.atk ?? card.power;
  const hp = live?.hp ?? card.defense;
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={label ?? `${card.name}, ${card.type}, ${card.state}`}
      aria-pressed={onClick ? ui === "selected" : undefined}
      disabled={onClick ? ui === "disabled" : undefined}
      className={`living-card lc-${card.state.toLowerCase()} lc-ui-${ui} ${w} relative flex shrink-0 flex-col border bg-card text-left`}
    >
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="font-mono text-[9px] text-muted-foreground">{card.blockHeight.toLocaleString("en-US")}</span>
        <span className="lc-cost font-mono text-[10px]" title="Energy cost">⚡{card.energy}</span>
      </div>
      <div className="lc-art relative grid aspect-[5/4] place-items-center overflow-hidden border-b border-border">
        <div className="lc-grid absolute inset-0" aria-hidden />
        <CardArt card={card} />
        <span className="absolute left-1.5 top-1 text-sm leading-none text-foreground/80" aria-hidden>{TYPE_GLYPH[card.type]}</span>
        <span className="lc-state label absolute bottom-1 right-1.5 text-[8px]">{card.state}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 py-1.5">
        <div className={`display leading-tight ${size === "sm" ? "text-[10px]" : "text-xs"}`}>{card.name}</div>
        <div className="label text-[8px] text-muted-foreground">{card.type} · <span className="text-bitcoin">{abilityFor(card.type, card.bitmap).name}</span></div>
        {size !== "sm" && (
          <div className="flex flex-wrap gap-1">
            {card.traits.slice(0, 4).map((t) => (
              <span key={t} className="border border-border px-1 font-mono text-[8px] text-muted-foreground">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-auto grid grid-cols-3 border-t border-border font-mono text-[10px]">
        <span className="px-1.5 py-1 text-bitcoin" title="Power">⚔ {atk}</span>
        <span className={`border-x border-border px-1.5 py-1 ${live && hp < live.maxHp ? "text-destructive" : ""}`} title="Defense">⛨ {hp}</span>
        <span className="px-1.5 py-1 text-signal" title="Activity">◉ {card.activity}</span>
      </div>
      {live?.ready === false && <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center label text-[8px] text-muted-foreground">RESTING</span>}
    </Tag>
  );
}
