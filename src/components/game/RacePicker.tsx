import { useState } from "react";
import { RACES, RACE_ORDER, setRace, useRace } from "@/lib/character-race";

/** Compact HUD chip: tap to open, pick Human / Elf / Dwarf / Orc. */
export function RacePicker() {
  const race = useRace();
  const [open, setOpen] = useState(false);
  return (
    <div data-embed-pad className="pointer-events-auto absolute right-3 top-[3.25rem] z-[90] flex flex-col items-end font-mono text-[10px]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="hud-panel px-2 py-1 text-signal hover:text-bitcoin">
        RACE · {RACES[race].name.toUpperCase()}
      </button>
      {open && (
        <div className="hud-panel mt-1 flex w-44 flex-col gap-1 p-1">
          {RACE_ORDER.map((r) => (
            <button key={r} type="button" onClick={() => { setRace(r); setOpen(false); }}
              className={`border px-2 py-1 text-left ${r === race ? "border-bitcoin text-bitcoin" : "border-border text-foreground hover:border-signal"}`}>
              <span className="block">{RACES[r].name.toUpperCase()}</span>
              <span className="block text-[9px] text-muted-foreground">{RACES[r].perk}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
