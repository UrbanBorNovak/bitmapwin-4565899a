/**
 * SMELTER PANEL — appears while you stand at a furnace you or anyone else built,
 * and melts your raw nuggets down into solid gold bars.
 */

import { useEffect, useState } from "react";
import { GoldBarIcon } from "@/components/GoldBarIcon";
import { playSfx } from "@/lib/world-audio";
import { useWorldSkills } from "@/lib/world-skills";
import { BAR_COST, smeltGoldBar, furnaceInReach } from "@/lib/world-smelt";
import type { SelfPose } from "@/components/BitmapWorld3D";

const NUGGETS = BAR_COST["gold-nugget"] ?? 4;

export function SmeltHud({ pose }: { pose: React.RefObject<SelfPose> }) {
  const skills = useWorldSkills();
  const [near, setNear] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const spot = pose.current;
      setNear(spot ? furnaceInReach(spot.x, spot.z) !== null : false);
    }, 400);
    return () => window.clearInterval(timer);
  }, [pose]);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 2600);
    return () => window.clearTimeout(timer);
  }, [note]);

  if (!near) return null;

  const nuggets = skills.items["gold-nugget"] ?? 0;
  const bars = skills.items["gold-bar"] ?? 0;

  const smelt = () => {
    const spot = pose.current;
    if (!spot) return;
    const result = smeltGoldBar(spot.x, spot.z);
    if (result.ok) {
      playSfx("nugget");
      setNote(`+1 GOLD BAR · +${result.xp} MINING XP`);
      return;
    }
    setNote(
      result.reason === "no-gold"
        ? `NEED ${NUGGETS} GOLD NUGGETS`
        : result.reason === "full"
          ? "BACKPACK FULL"
          : "STAND CLOSER TO THE FURNACE",
    );
  };

  return (
    <div
      data-no-translate
      className="hud-panel absolute left-3 bottom-52 z-40 w-[min(15rem,calc(100%-1.5rem))] space-y-1 px-2.5 py-2 font-mono text-[10px]"
      aria-label="Smelting furnace"
    >
      <span className="label text-[9px] text-bitcoin">SMELTING FURNACE</span>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">GOLD NUGGETS</span>
        <span className="tabular-nums text-foreground">{nuggets}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <GoldBarIcon size={12} />
          GOLD BARS
        </span>
        <span className="tabular-nums text-bitcoin">{bars}</span>
      </div>
      <button
        type="button"
        onClick={smelt}
        disabled={nuggets < NUGGETS}
        className="btn-term w-full py-1 text-[9px] disabled:opacity-40"
      >
        MELT {NUGGETS} NUGGETS INTO A BAR
      </button>
      {note ? <p className="text-muted-foreground">{note}</p> : null}
    </div>
  );
}
