/**
 * BITMAP MINING PANEL — the ore your own land has produced, and the button that
 * moves it into your backpack.
 */

import { useEffect, useState } from "react";
import {
  CREW_PER_BITMAP,
  MAX_BANKED_HOURS,
  ORE_PER_CREW_HOUR,
  collectOre,
  crewFor,
  pendingOre,
  useBitmapMining,
} from "@/lib/bitmap-mining";
import { playSfx } from "@/lib/world-audio";

export function BitmapMineHud({ bitmaps }: { bitmaps: number }) {
  const tally = useBitmapMining();
  const [, tick] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const crew = crewFor(bitmaps);
  const ready = pendingOre(bitmaps);

  return (
    <div
      data-no-translate
      className="hud-panel absolute right-3 bottom-24 z-40 w-[min(15rem,calc(100%-1.5rem))] space-y-1 px-2.5 py-2 font-mono text-[10px]"
      aria-label="Bitmap mining"
    >
      <span className="label text-[9px] text-bitcoin">BITMAP MINING</span>
      {bitmaps === 0 ? (
        <p className="text-muted-foreground">
          HOLD A BITMAP TO PUT A CREW ON IT · {CREW_PER_BITMAP} MINERS PER BITMAP ·{" "}
          {ORE_PER_CREW_HOUR} ORE PER MINER PER HOUR
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">YOUR BITMAPS</span>
            <span className="tabular-nums text-foreground">{bitmaps}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">MINERS AT WORK</span>
            <span className="tabular-nums text-foreground">{crew}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">ORE READY</span>
            <span className="tabular-nums text-bitcoin">{ready}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">COLLECTED</span>
            <span className="tabular-nums text-foreground">{tally.collected}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const result = collectOre(bitmaps);
              if (result.collected > 0) playSfx("nugget");
              setNote(
                result.collected > 0
                  ? `+${result.collected} ORE IN THE BACKPACK`
                  : result.full
                    ? "BACKPACK FULL"
                    : "NOTHING DUG YET",
              );
            }}
            disabled={ready <= 0}
            className="btn-term w-full py-1 text-[9px] disabled:opacity-40"
          >
            COLLECT ORE
          </button>
          <p className="text-muted-foreground">
            {note ?? `CREWS BANK UP TO ${MAX_BANKED_HOURS}H OF WORK`}
          </p>
        </>
      )}
    </div>
  );
}
