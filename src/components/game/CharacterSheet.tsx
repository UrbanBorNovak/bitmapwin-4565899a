/**
 * CHARACTER SHEET — the paper-doll preview inside the Oasis inventory shelf.
 *
 * A portrait of the figure you walk as, ringed by the slots the kit goes in.
 * Every slot is the same switch the old buttons were, so nothing about how gear
 * works changes here — only how you see it. Presentation only.
 */

import type { LucideIcon } from "lucide-react";
import { BookOpen, CircleDot, Footprints, Gem, Glasses, HardHat, ToyBrick, Watch } from "lucide-react";
import { WeaponGlyph } from "@/components/game/WeaponBelt";
import { WEAPONS, type WeaponKind } from "@/components/game/weapons";
import { ordContentUrl } from "@/lib/oci";
import {
  cycleToy,
  toySpec,
  toggleComic,
  toggleBatmanHead,
  toggleGoggles,
  toggleNecklace,
  toggleRing,
  toggleShoes,
  toggleWatch,
  useGear,
} from "@/lib/world-gear";
import { playSfx } from "@/lib/world-audio";

type SlotView = {
  slot: string;
  label: string;
  filled: boolean;
  Icon: LucideIcon | null;
  onPick: (() => void) | null;
};

function Slot({ view }: { view: SlotView }) {
  const body = (
    <>
      {view.Icon && view.filled ? (
        <view.Icon aria-hidden="true" className="size-6 text-bitcoin" strokeWidth={1.6} />
      ) : (
        <span className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
          {view.slot}
        </span>
      )}
    </>
  );
  const shell = `flex size-11 items-center justify-center border transition-colors ${
    view.filled
      ? "border-bitcoin bg-bitcoin/10"
      : "border-border bg-background hover:border-foreground"
  }`;
  return (
    <div className="flex flex-col items-center gap-0.5" data-no-translate>
      {view.onPick ? (
        <button type="button" onClick={view.onPick} className={shell} title={view.label}>
          {body}
        </button>
      ) : (
        <div className={shell} title={view.label}>
          {body}
        </div>
      )}
      <span className="max-w-[3.6rem] truncate text-center text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
        {view.label}
      </span>
    </div>
  );
}

export function CharacterSheet({
  weapon,
  model,
  flying = false,
  onNote,
}: {
  weapon: WeaponKind | null;
  /** the inscription you walk as, when you are wearing one */
  model: string | null;
  /** the jetpack is strapped on — the helmet fills the head slot */
  flying?: boolean;
  onNote?: (note: string) => void;
}) {
  const gear = useGear();
  const note = (text: string) => {
    playSfx("ui");
    onNote?.(text);
  };
  const toy = toySpec(gear.toy);

  const head: SlotView = flying
    ? {
        slot: "HEAD",
        label: "FLIGHT HELMET",
        filled: true,
        Icon: HardHat,
        onPick: null,
      }
    : gear.batmanHead
      ? {
          slot: "HEAD",
          label: "BATMAN HEAD",
          filled: true,
          Icon: HardHat,
          onPick: () => note(toggleBatmanHead() ? "BATMAN HEAD ON" : "BATMAN HEAD OFF"),
        }
      : {
        slot: "HEAD",
        label: gear.goggles ? "NIGHT VISION" : "HEAD",
        filled: gear.goggles,
        Icon: Glasses,
        onPick: () => {
          note(toggleBatmanHead() ? "BATMAN HEAD ON" : "BATMAN HEAD OFF");
        },
      };

  const left: SlotView[] = [
    head,
    {
      slot: "NECK",
      label: gear.necklace ? "NECKLACE" : "NECK",
      filled: gear.necklace,
      Icon: Gem,
      onPick: () => note(toggleNecklace() ? "NECKLACE ON · STEADY RECOVERY" : "NECKLACE OFF"),
    },
    {
      slot: "WRIST",
      label: gear.watch ? "WATCH" : "WRIST",
      filled: gear.watch,
      Icon: Watch,
      onPick: () => note(toggleWatch() ? "WATCH ON" : "WATCH OFF"),
    },
  ];

  const right: SlotView[] = [
    {
      slot: "HAND",
      label: weapon ? WEAPONS[weapon].label : "MAIN HAND",
      filled: weapon !== null,
      Icon: null,
      onPick: null,
    },
    {
      slot: "OFF",
      label: toy.inscription ? toy.label : "OFF HAND",
      filled: toy.inscription !== "",
      Icon: toy.inscription ? ToyBrick : null,
      onPick: () => {
        const next = cycleToy();
        note(next.inscription ? `TOY IN HAND · ${next.label}` : "TOY PUT AWAY");
      },
    },
    {
      slot: "RING",
      label: gear.ring ? "RING" : "RING",
      filled: gear.ring,
      Icon: CircleDot,
      onPick: () => note(toggleRing() ? "RING ON" : "RING OFF"),
    },
  ];

  const bottom: SlotView[] = [
    {
      slot: "FEET",
      label: gear.shoes ? "SHOES" : "FEET",
      filled: gear.shoes,
      Icon: Footprints,
      onPick: () => note(toggleShoes() ? "SHOES ON · FASTER STRIDE" : "SHOES OFF"),
    },
    {
      slot: "TOME",
      label: gear.comic ? "COMIC BOOK" : "TOME",
      filled: gear.comic,
      Icon: BookOpen,
      onPick: () => note(toggleComic() ? "COMIC BOOK IN HAND" : "COMIC BOOK AWAY"),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        Character
      </span>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          {left.map((view) => (
            <Slot key={view.slot} view={view} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex h-[9.5rem] w-full items-center justify-center border border-border bg-background/60">
            {model ? (
              <img
                src={ordContentUrl(model)}
                alt="Your figure"
                className="max-h-[8.6rem] max-w-full [image-rendering:pixelated]"
                loading="lazy"
              />
            ) : (
              <span className="px-2 text-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                No inscribed figure worn
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {weapon ? (
              <span className="flex size-8 items-center justify-center border border-bitcoin text-bitcoin">
                <WeaponGlyph kind={weapon} />
              </span>
            ) : null}
            <span
              className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground"
              data-no-translate
            >
              {weapon ? WEAPONS[weapon].label : "HANDS EMPTY"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {right.map((view) => (
            <Slot key={view.slot} view={view} />
          ))}
        </div>
      </div>
      <div className="flex items-start gap-1.5">
        {bottom.map((view) => (
          <Slot key={view.slot} view={view} />
        ))}
      </div>
    </div>
  );
}
