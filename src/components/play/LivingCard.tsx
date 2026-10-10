import { abilityFor } from "@/lib/game/abilities";
import atlasImage from "@/assets/oasis-atlas-storybook.jpg";
import { atlasPlaceStory } from "@/lib/atlas-places";
import { WORLD_CELL, WORLD_GRID, WORLD_UNITS } from "@/lib/player-state";
import { reliefAt } from "@/lib/world-terrain";
import { bitmapPixelForHeight, useBitmapPixels } from "@/lib/game/bitmapPixels";
import { hash } from "@/lib/game/cardFactory";
import { activePfpExtenderForCard, inscriptionContentUrl, ordinalsPreviewUrl } from "@/lib/game/pfpExtenders";
import type { CardState, CardType, LivingCard as Card } from "@/lib/game/types";
import { usePlayProfile } from "@/lib/game/worldState";
import { useQuery } from "@tanstack/react-query";
import { OFFICIAL_TRAITS_POOL, traitExtenderPoolQuery } from "@/lib/trait-collections";
import { ORD_TORCHES_POOL, useOrdTorches } from "@/lib/game/ordTorches";
import { PUPPETS_POOL, usePuppets } from "@/lib/game/puppets";
import { JIGGLYPUFF_POOL, useJigglypuff } from "@/lib/game/jigglypuff";
import { CardCharacter3D } from "./CardCharacter3D";
import { CardBitmap3D } from "./CardBitmap3D";

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

/** The exact painted Atlas place crop assigned to this BITMAP. */
export function AtlasPlaceBackdrop({ height, className = "" }: { height: number; className?: string }) {
  const place = atlasPlaceStory(height);
  const scale = place.frame.divisions * 100;
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden title={`${place.localName} · ${place.name}`}>
      <img
        src={atlasImage}
        alt=""
        width={1920}
        height={1200}
        loading="lazy"
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none object-cover"
        style={{
          width: `${scale}%`,
          height: `${scale}%`,
          left: `${place.frame.left}%`,
          top: `${place.frame.top}%`,
        }}
      />
      <div className="absolute inset-0 bg-background/15" />
    </div>
  );
}

function CardArt({ card }: { card: Card }) {
  const profile = usePlayProfile();
  const torches = useOrdTorches();
  const puppets = usePuppets();
  const jigglypuff = useJigglypuff();
  const traitPool = useQuery(traitExtenderPoolQuery());
  const bitmapPixels = useBitmapPixels();
  const pixel = bitmapPixelForHeight(card.bitmap, bitmapPixels ?? []);
  const selectedTorchPool = profile?.visuals.pfpExtendersEnabled === true && profile.visuals.selectedPfpCollection === ORD_TORCHES_POOL;
  const torch = selectedTorchPool && torches?.list.length
    ? torches.list[hash(card.bitmap) % torches.list.length]
    : undefined;
  if (torch)
    return (
      <div className="lc-pfp-frame absolute inset-0" title={`FREE ROSS · #${torch.index + 1}`}>
        <AtlasPlaceBackdrop height={card.bitmap} />
        <iframe src={ordinalsPreviewUrl(torch.inscriptionId)} title={`Free Ross #${torch.index + 1}`} loading="lazy" sandbox="allow-scripts allow-same-origin" scrolling="no" className="h-full w-full border-0 opacity-75 pointer-events-none" />
        <AtlasPlaceBackdrop height={card.bitmap} className="pointer-events-none opacity-30 mix-blend-soft-light" />
        <OasisBackdrop height={card.bitmap} className="pointer-events-none opacity-60 mix-blend-screen" />
        <div className="lc-pfp-scan absolute inset-0" aria-hidden />
        <CardBitmap3D height={card.bitmap} state={card.state} className="absolute bottom-1 left-1 size-12 opacity-95" />
        <span className="lc-pfp-badge label absolute left-1.5 top-1 text-[7px] text-bitcoin">ROSS #{torch.index + 1}</span>
      </div>
    );
  const selectedPuppetPool = profile?.visuals.pfpExtendersEnabled === true && profile.visuals.selectedPfpCollection === PUPPETS_POOL;
  const puppet = selectedPuppetPool && puppets?.list.length
    ? puppets.list[hash(card.bitmap) % puppets.list.length]
    : undefined;
  if (puppet)
    return (
      <div className="lc-pfp-frame absolute inset-0" title={`BITMAP EMPORIUM · #${puppet.index + 1}`}>
        <AtlasPlaceBackdrop height={card.bitmap} />
        <img src={inscriptionContentUrl(puppet.inscriptionId)} alt={`Bitmap Emporium #${puppet.index + 1}`} loading="lazy" className="h-full w-full object-cover opacity-75 [image-rendering:pixelated]" />
        <AtlasPlaceBackdrop height={card.bitmap} className="pointer-events-none opacity-30 mix-blend-soft-light" />
        <OasisBackdrop height={card.bitmap} className="pointer-events-none opacity-60 mix-blend-screen" />
        <div className="lc-pfp-scan absolute inset-0" aria-hidden />
        <CardBitmap3D height={card.bitmap} state={card.state} className="absolute bottom-1 left-1 size-12 opacity-95" />
        <span className="lc-pfp-badge label absolute left-1.5 top-1 text-[7px] text-bitcoin">EMPORIUM #{puppet.index + 1}</span>
      </div>
    );
  const selectedJigglypuffPool = profile?.visuals.pfpExtendersEnabled === true && profile.visuals.selectedPfpCollection === JIGGLYPUFF_POOL;
  const jig = selectedJigglypuffPool && jigglypuff.list.length
    ? jigglypuff.list[hash(card.bitmap) % jigglypuff.list.length]
    : undefined;
  if (jig)
    return (
      <div className="lc-pfp-frame absolute inset-0" title={`JIGGLYPUFF · #${jig.index + 1}`}>
        <AtlasPlaceBackdrop height={card.bitmap} />
        <img src={inscriptionContentUrl(jig.inscriptionId)} alt={`Jigglypuff #${jig.index + 1}`} loading="lazy" className="h-full w-full object-cover opacity-75 [image-rendering:pixelated]" />
        <AtlasPlaceBackdrop height={card.bitmap} className="pointer-events-none opacity-30 mix-blend-soft-light" />
        <OasisBackdrop height={card.bitmap} className="pointer-events-none opacity-60 mix-blend-screen" />
        <div className="lc-pfp-scan absolute inset-0" aria-hidden />
        <CardBitmap3D height={card.bitmap} state={card.state} className="absolute bottom-1 left-1 size-12 opacity-95" />
        <span className="lc-pfp-badge label absolute left-1.5 top-1 text-[7px] text-bitcoin">JIG #{jig.index + 1}</span>
      </div>
    );
  const selectedTraitPool = profile?.visuals.pfpExtendersEnabled === true && profile.visuals.selectedPfpCollection === OFFICIAL_TRAITS_POOL;
  const traitBitmap = selectedTraitPool && traitPool.data?.length
    ? traitPool.data[hash(card.bitmap) % traitPool.data.length]
    : undefined;
  if (traitBitmap)
    return (
      <div className="lc-pfp-frame absolute inset-0" title={`OFFICIAL TRAIT · ${traitBitmap.bitmapHeight}.BITMAP`}>
        <AtlasPlaceBackdrop height={card.bitmap} />
        <div className="absolute inset-[6%] opacity-90"><CardBitmap3D height={traitBitmap.bitmapHeight} state={card.state} className="h-full w-full" /></div>
        <AtlasPlaceBackdrop height={card.bitmap} className="pointer-events-none opacity-20 mix-blend-soft-light" />
        <OasisBackdrop height={card.bitmap} className="pointer-events-none opacity-60 mix-blend-screen" />
        <div className="lc-pfp-scan absolute inset-0" aria-hidden />
        <CardBitmap3D height={card.bitmap} state={card.state} className="absolute bottom-1 left-1 size-12 opacity-95" />
        <span className="lc-pfp-badge label absolute left-1.5 top-1 text-[7px] text-bitcoin">TRAIT · {traitBitmap.bitmapHeight}</span>
      </div>
    );
  const extender = activePfpExtenderForCard(card, profile?.visuals);
  if (extender)
    return (
      <div className="lc-pfp-frame absolute inset-0" title={`${extender.collection} · ${extender.name}`}>
        <AtlasPlaceBackdrop height={card.bitmap} />
        <div className="absolute inset-0 opacity-75" aria-hidden={pixel ? true : undefined}>
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
        </div>
        <AtlasPlaceBackdrop height={card.bitmap} className="pointer-events-none opacity-30 mix-blend-soft-light" />
        <OasisBackdrop height={card.bitmap} className="pointer-events-none opacity-60 mix-blend-screen" />
        {pixel && <CardCharacter3D skin={pixel.inscriptionId} label={`${pixel.name}, the 3D character for ${card.name}`} />}
        <div className="lc-pfp-scan absolute inset-0" aria-hidden />
        <CardBitmap3D height={card.bitmap} state={card.state} className="absolute bottom-1 left-1 size-12 opacity-95" />
        <span className="lc-pfp-badge label absolute left-1.5 top-1 text-[7px] text-bitcoin">
          {pixel ? `PIXEL #${String(pixel.index).padStart(3, "0")}` : extender.source === "ordinals-image" ? "CHILD IMG" : "HTML PFP"}
        </span>
      </div>
    );

  if (!pixel)
    return (
      <div className="lc-pfp-frame absolute inset-0">
        <AtlasPlaceBackdrop height={card.bitmap} />
        <OasisBackdrop height={card.bitmap} className="pointer-events-none opacity-60 mix-blend-screen" />
        <CardBitmap3D height={card.bitmap} state={card.state} className="absolute inset-[5%] drop-shadow-lg" />
      </div>
    );
  return (
    <div className="lc-pfp-frame absolute inset-0" title={`BITMAP PIXELS · ${pixel.name}`}>
      <AtlasPlaceBackdrop height={card.bitmap} />
      <OasisBackdrop height={card.bitmap} className="pointer-events-none opacity-60 mix-blend-screen" />
      <CardCharacter3D skin={pixel.inscriptionId} label={`${pixel.name}, the 3D character for ${card.name}`} />
      <div className="lc-pfp-scan absolute inset-0" aria-hidden />
      <CardBitmap3D height={card.bitmap} state={card.state} className="absolute bottom-1 left-1 size-12 opacity-95" />
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
  const dimensions = size === "sm" ? "h-[11.625rem] w-[7.5rem]" : size === "lg" ? "h-[23.25rem] w-[15rem]" : "h-[15.5rem] w-[10rem]";
  const Tag = onClick ? "button" : "div";
  const atk = live?.atk ?? card.power;
  const hp = live?.hp ?? card.defense;
  const ability = abilityFor(card.type, card.bitmap);
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={label ?? `${card.name}, ${card.type}, ${card.state}`}
      aria-pressed={onClick ? ui === "selected" : undefined}
      disabled={onClick ? ui === "disabled" : undefined}
      data-size={size}
      className={`living-card lc-${card.state.toLowerCase()} lc-ui-${ui} ${dimensions} group relative isolate flex shrink-0 flex-col overflow-hidden text-left`}
    >
      <div className="lc-relic-shell absolute inset-0" aria-hidden />
      <div className="lc-relic-rim absolute inset-1" aria-hidden />
      <i className="lc-rivet lc-rivet-nw" aria-hidden />
      <i className="lc-rivet lc-rivet-ne" aria-hidden />
      <i className="lc-rivet lc-rivet-sw" aria-hidden />
      <i className="lc-rivet lc-rivet-se" aria-hidden />

      <header className="lc-crown relative z-10 mx-2 mt-2 shrink-0 text-center">
        <div className="lc-title-band flex min-w-0 items-center justify-center px-5 py-0.5">
          <h3 className="display truncate text-[10px] font-bold uppercase text-card-foreground">{card.name}</h3>
        </div>
        <div className="lc-type-seal mx-auto -mt-px flex max-w-[82%] items-center justify-center gap-1 px-2 py-px">
          <span aria-hidden>{TYPE_GLYPH[card.type]}</span>
          <span className="truncate font-mono text-[6px] font-bold uppercase">{card.type} · {card.state}</span>
        </div>
        <span className="lc-cost absolute right-0 top-0 grid size-5 place-items-center font-mono text-[8px]" title="Energy cost">{card.energy}</span>
      </header>

      <div className="lc-art relative z-[1] mx-2 mt-1.5 min-h-0 flex-[1.35] overflow-hidden">
        <div className="lc-grid absolute inset-0" aria-hidden />
        <CardArt card={card} />
        <span className="lc-block-stamp absolute bottom-1 left-1 font-mono text-[6px]" data-no-translate>{card.blockHeight.toLocaleString("en-US")}.BITMAP</span>
        <span className="lc-state absolute bottom-1 right-1 font-mono text-[6px]">{card.state}</span>
        <i className="lc-corner lc-corner-nw" aria-hidden />
        <i className="lc-corner lc-corner-ne" aria-hidden />
      </div>

      <section className="lc-rules relative z-10 mx-2 mt-1.5 flex min-h-0 flex-[0.72] flex-col px-2 py-1.5">
        <div className="flex items-center justify-center gap-1.5">
          <i className="lc-sigil" aria-hidden />
          <strong className="display text-[7px] uppercase text-card-foreground">{ability.name}</strong>
          <i className="lc-sigil lc-sigil-moss" aria-hidden />
        </div>
        {size !== "sm" && <p className="lc-ability-text mt-1 text-center text-[7px] leading-[1.25] text-card-foreground/80">{ability.text}</p>}
        {size !== "sm" && (
          <div className="mt-auto flex min-w-0 flex-wrap justify-center gap-1 border-t border-relic/25 pt-1">
            {card.traits.slice(0, size === "lg" ? 4 : 2).map((trait) => (
              <span key={trait} className="lc-trait px-1 py-px font-mono text-[5px] uppercase">{trait}</span>
            ))}
          </div>
        )}
      </section>

      <footer className="lc-relic-stats relative z-10 mx-2 mb-2 mt-1.5 grid shrink-0 grid-cols-[1fr_minmax(2.5rem,.7fr)_1fr] items-stretch">
        <span className="lc-stat lc-stat-power" title="Power"><small>PWR</small><b>{atk}</b></span>
        <span className="lc-integrity" title="Activity"><small>ACTIVITY</small><b>{card.activity}</b><span><i style={{ width: `${Math.max(12, Math.min(100, card.activity * 10))}%` }} /></span></span>
        <span className={`lc-stat lc-stat-defense ${live && hp < live.maxHp ? "text-destructive" : ""}`} title="Defense"><small>DEF</small><b>{hp}</b></span>
      </footer>
      <div className="lc-foil absolute inset-0 z-20 pointer-events-none" aria-hidden />
      {live?.ready === false && <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center label text-[8px] text-muted-foreground">RESTING</span>}
    </Tag>
  );
}
