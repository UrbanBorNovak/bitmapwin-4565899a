import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * "First 10 Minutes" — a plain-language checklist that walks a new holder
 * from zero to their first build. Progress is saved on this device only.
 */

type Step = {
  id: string;
  minutes: string;
  title: string;
  body: string;
  tip: string;
  cta: { label: string; to: "/land-101" | "/wallet" | "/my-land" | "/create" | "/builds" | "/oasis" };
};

const STEPS: Step[] = [
  {
    id: "understand",
    minutes: "0–2 MIN",
    title: "KNOW WHAT YOU OWN",
    body: "A BITMAP is one Bitcoin block turned into a piece of land. The first person to claim a block owns it — forever.",
    tip: "You don't need to understand the tech. Think of it as a plot with a street address.",
    cta: { label: "READ THE 2-MINUTE PRIMER", to: "/land-101" },
  },
  {
    id: "connect",
    minutes: "2–3 MIN",
    title: "CONNECT YOUR WALLET",
    body: "Link the wallet that holds your BITMAP so we can see your land. Nothing is moved and nothing is spent.",
    tip: "No BITMAP yet? Skip ahead — you can still try building and see how it works.",
    cta: { label: "CONNECT WALLET", to: "/wallet" },
  },
  {
    id: "pick",
    minutes: "3–4 MIN",
    title: "PICK YOUR LAND",
    body: "Choose which of your BITMAPs you want to build on. Each one looks different because it's drawn from its real block.",
    tip: "Not sure which? Start with the one you like the look of — you can build on the others later.",
    cta: { label: "SEE MY LAND", to: "/my-land" },
  },
  {
    id: "describe",
    minutes: "4–7 MIN",
    title: "SAY WHAT YOU WANT",
    body: "Type an idea like you'd tell a friend: \"a cosy tavern with lanterns\" or \"a small art gallery\". We build it for you.",
    tip: "Short and simple works best. You'll see a live preview before anything goes public.",
    cta: { label: "START BUILDING", to: "/create" },
  },
  {
    id: "deploy",
    minutes: "7–9 MIN",
    title: "PUT IT ON YOUR LAND",
    body: "Happy with the preview? Press deploy. Your build now appears on your BITMAP for every visitor.",
    tip: "You can change or replace it anytime — nothing is locked in.",
    cta: { label: "OPEN THE BUILDER", to: "/create" },
  },
  {
    id: "share",
    minutes: "9–10 MIN",
    title: "WALK IN AND SHARE",
    body: "Enter the Oasis and visit your own land, then share the card so friends can walk in too.",
    tip: "See what others made for ideas — every build there started with one sentence.",
    cta: { label: "ENTER THE OASIS", to: "/oasis" },
  },
];

const KEY = "bitmapwin:first-ten";

export function FirstTenMinutes({ compact = false }: { compact?: boolean }) {
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(compact);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
      setDone(saved);
      setOpen(STEPS.find((s) => !saved.includes(s.id))?.id ?? null);
    } catch {
      setOpen(STEPS[0]!.id);
    }
  }, []);

  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    if (!done.includes(id)) setOpen(STEPS.find((s) => !next.includes(s.id))?.id ?? null);
  };

  const pct = Math.round((done.length / STEPS.length) * 100);

  return (
    <section className="border border-bitcoin/50 bg-surface" aria-label="Your first 10 minutes">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left md:p-5"
      >
        <div>
          <div className="label text-bitcoin">NEW HERE? · YOUR FIRST 10 MINUTES</div>
          <h2 className="display mt-1 text-lg md:text-xl">FROM ZERO TO YOUR FIRST BUILD</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {done.length}/{STEPS.length}
          </span>
          <ChevronDown className={`size-4 transition-transform ${collapsed ? "" : "rotate-180"}`} />
        </div>
      </button>
      <div className="h-1 bg-border">
        <div className="h-full bg-bitcoin transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      {!collapsed && (
        <ol className="divide-y divide-border">
          {STEPS.map((s, i) => {
            const isDone = done.includes(s.id);
            const isOpen = open === s.id;
            return (
              <li key={s.id}>
                <div className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-label={isDone ? `Mark ${s.title} not done` : `Mark ${s.title} done`}
                    className={`grid size-6 shrink-0 place-items-center border ${
                      isDone ? "border-bitcoin bg-bitcoin text-background" : "border-border-strong"
                    }`}
                  >
                    {isDone ? <Check className="size-3" /> : <span className="font-mono text-[10px]">{i + 1}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : s.id)}
                    className="flex flex-1 items-center justify-between gap-3 text-left"
                  >
                    <span className={`display text-sm ${isDone ? "text-muted-foreground line-through" : ""}`}>
                      {s.title}
                    </span>
                    <span className="label shrink-0 text-muted-foreground">{s.minutes}</span>
                  </button>
                </div>
                {isOpen && (
                  <div className="space-y-3 px-4 pb-4 pl-13 md:px-5 md:pl-14">
                    <p className="text-sm leading-relaxed text-foreground">{s.body}</p>
                    <p className="border-l-2 border-signal pl-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      TIP · {s.tip}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link to={s.cta.to} className="btn-term px-3 py-2 text-[10px]">
                        {s.cta.label}
                      </Link>
                      {!isDone && (
                        <button type="button" onClick={() => toggle(s.id)} className="btn-term-ghost px-3 py-2 text-[10px]">
                          I DID THIS
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {!collapsed && pct === 100 && (
        <div className="border-t border-border p-4 font-mono text-xs text-bitcoin md:px-5">
          &gt; DONE. YOU'RE A BUILDER NOW. SEE WHAT OTHERS MADE ON{" "}
          <Link to="/builds" className="underline">COMMUNITY BUILDS</Link>.
        </div>
      )}
    </section>
  );
}
