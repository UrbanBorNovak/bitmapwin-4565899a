import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * LAND PROMPT TERMINAL — the front door of the build loop.
 *
 * One question, one input. Whatever is typed here is carried straight into the
 * AI builder at /create, which is where the real package gets written and
 * deployed onto land the visitor holds.
 */

const PRESETS = [
  {
    chip: "01 · CYBER TAVERN",
    prompt:
      "Build a cypherpunk tavern on my BITMAP with a bartender NPC, tables, lanterns, a quest board and a drink-selling interaction",
  },
  {
    chip: "02 · HUNTING PIT",
    prompt:
      "Build a monster hunting pit on my BITMAP with a fighting arena, spawning creatures, a loot chest and a bounty quest",
  },
  {
    chip: "03 · HALVING PORTAL",
    prompt:
      "Build a stone watchtower on my BITMAP with a rotating beacon and a glowing portal that marks the 840,000 halving block",
  },
  {
    chip: "04 · NIGHT MARKET",
    prompt:
      "Build a neon night market on my BITMAP with trading stalls, hanging lanterns, a merchant NPC and a haggling quest",
  },
] as const;

const ROTATING = [
  "Build a tavern here.",
  "Create a mining camp.",
  "Make this land dangerous at night.",
  "Build a portal to another BITMAP.",
  "Create a game on my land.",
];

export function LandPromptTerminal() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2600);
    return () => window.clearInterval(id);
  }, []);

  function go(prompt: string) {
    const brief = prompt.trim();
    if (brief.length < 4) return;
    void navigate({ to: "/create", search: { prompt: brief } });
  }

  return (
    <div data-tour="home-prompt" className="border border-bitcoin/50 bg-background/70 p-4 backdrop-blur-sm md:p-5">
      <div className="label text-bitcoin">OWN → PROMPT → BUILD → ENTER</div>
      <h2 className="display mt-3 text-lg leading-tight sm:text-2xl">
        WHAT WOULD YOU BUILD IF YOU OWNED THE LAND?
      </h2>

      <form
        className="mt-4 flex flex-col gap-px sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 border border-border bg-background px-3 py-3">
          <span className="font-mono text-xs text-bitcoin" aria-hidden="true">
            &gt;
          </span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={ROTATING[tick % ROTATING.length]}
            aria-label="Describe what you would build on your BITMAP"
            className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button type="submit" className="btn-term min-h-12 shrink-0 sm:min-h-0">
          [ BUILD IT ]
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.chip}
            type="button"
            onClick={() => go(preset.prompt)}
            className="label border border-border px-2 py-1.5 text-muted-foreground hover:border-bitcoin hover:text-bitcoin"
            data-no-translate
          >
            {preset.chip}
          </button>
        ))}
      </div>

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
        YOUR WORDS BECOME A REAL EXPERIENCE ON A REAL BITCOIN BLOCK. OTHER PEOPLE WALK INTO IT.
      </p>
    </div>
  );
}
