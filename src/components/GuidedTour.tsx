import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";

/**
 * A short, dismissible guided tour.
 *
 * Each step points at an element that carries a data-tour attribute. Steps
 * whose target is missing are skipped, so a page can drop a marker without any
 * tour bookkeeping. Seen tours are remembered per page so a returning visitor
 * is never interrupted twice, and the header help button replays the tour for
 * the page they are on.
 */

type Step = { target: string; title: string; body: string };

type Tour = { id: string; steps: Step[] };

const TOURS: Record<string, Tour> = {
  "/": {
    id: "home",
    steps: [
      {
        target: "home-flow",
        title: "THREE STEPS · THAT IS THE WHOLE THING",
        body: "Enter the Oasis to find land, extend it with an experience, then deploy so other people can walk in. Start at step one.",
      },
      {
        target: "home-market",
        title: "LIVE MARKET NUMBERS",
        body: "Everything here is read straight from Bitcoin. Cheapest land on sale, how much land is known, and what has actually sold.",
      },
      {
        target: "home-featured",
        title: "LAND WORTH A LOOK",
        body: "Each card is one block of land. Open one to see its full record, price history and who holds it.",
      },
    ],
  },
  "/map": {
    id: "map",
    steps: [
      {
        target: "map-legend",
        title: "READING THE WORLD",
        body: "Every square is one block of land. Colour tells you who holds it — orange squares are yours.",
      },
      {
        target: "map-world",
        title: "MOVE AND LOOK AROUND",
        body: "Drag to look around and use the on-screen stick — or W to walk, A and D to turn, SPACE to jump. Tap a square to open it.",
      },
      {
        target: "flow-rail",
        title: "FROM LAND TO EXPERIENCE",
        body: "Picked a square you hold? Follow this strip to extend it and put something on it.",
      },
    ],
  },
  // /oasis uses its own first-visit controls card (OasisControlsHint).
  "/extend": {
    id: "extend",
    steps: [
      {
        target: "extend-paths",
        title: "THREE WAYS TO FILL YOUR LAND",
        body: "Bring in something a creator already made, describe what you want and let AI build it, or shop the market.",
      },
      {
        target: "flow-rail",
        title: "WHERE YOU ARE",
        body: "This strip always shows the step you are on and the one that comes next.",
      },
    ],
  },
  "/create": {
    id: "create",
    steps: [
      {
        target: "create-brief",
        title: "DESCRIBE IT IN PLAIN WORDS",
        body: "Write what you want on your land as if telling a friend. You will see it running before anything is published.",
      },
      {
        target: "flow-rail",
        title: "LAST STEP",
        body: "Once it looks right, pick your land and deploy. Visitors can then enter it from the map.",
      },
    ],
  },
  "/marketplace": {
    id: "marketplace",
    steps: [
      {
        target: "market-header",
        title: "THE LAND MARKET",
        body: "Every BITMAP for sale or ever sold, read from real Bitcoin transactions. Nothing here is made up.",
      },
      {
        target: "market-stats",
        title: "THE NUMBERS AT A GLANCE",
        body: "How much land is known, how much has traded, and the cheapest price right now.",
      },
      {
        target: "market-filters",
        title: "FIND YOUR LAND",
        body: "Search a block number, filter by what is for sale, or browse by collection and traits.",
      },
      {
        target: "market-grid",
        title: "OPEN A CARD",
        body: "Each card is one block of land. Open one to see its full record, price history and holder — then buy or bid.",
      },
    ],
  },
  "/wallet": {
    id: "wallet",
    steps: [
      {
        target: "wallet-connect",
        title: "CONNECT OR INSPECT",
        body: "Connect your Bitcoin wallet to see your land — or paste any address to look at someone else's. Nothing is moved or spent.",
      },
      {
        target: "wallet-stats",
        title: "WHAT THIS WALLET HOLDS",
        body: "Balance, coins and how many BITMAPs live here, scanned straight from the chain.",
      },
      {
        target: "wallet-tabs",
        title: "YOUR LAND, LISTED HERE",
        body: "The LAND tab lists every BITMAP this wallet holds. From there you can set a price or open each one.",
      },
    ],
  },
  "/mint": {
    id: "mint",
    steps: [
      {
        target: "mint-steps",
        title: "THREE STEPS TO A GUARDIAN",
        body: "Pick a block and summon the Guardian read straight from it — pure digital matter. Shielded delivery is an optional experiment.",
      },
      {
        target: "mint-pick",
        title: "PICK ANY BLOCK",
        body: "Type a BITMAP number or press RANDOM. Every block grows a different creature — preview as many as you like for free.",
      },
      {
        target: "mint-buy",
        title: "MEET YOUR GUARDIAN",
        body: "Name, rarity, stats and ability all come from the block itself. Happy with it? Press MINT SHIELDED to make it yours.",
      },
    ],
  },
  "/my-land": {
    id: "my-land",
    steps: [
      {
        target: "myland-stats",
        title: "YOUR LAND AT A GLANCE",
        body: "How many BITMAPs this wallet holds and how many already have something built on them.",
      },
      {
        target: "myland-grid",
        title: "EVERY TILE IS YOURS",
        body: "Open any tile to see its full record, or press EXTEND MY LAND to put something on it.",
      },
    ],
  },
};

const STORE = "bitmapwin:tour:seen";

function seen(): string[] {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markSeen(id: string) {
  try {
    const next = Array.from(new Set([...seen(), id]));
    localStorage.setItem(STORE, JSON.stringify(next));
  } catch {
    /* private mode — the tour simply shows again */
  }
}

export const TOUR_EVENT = "bitmapwin:start-tour";

export function startGuidedTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

export function GuidedTour() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tour = TOURS[pathname] ?? null;
  const [index, setIndex] = useState<number | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (tour) markSeen(tour.id);
    setIndex(null);
  }, [tour]);

  // Auto-open once per page, and only when the page has a tour to give.
  useEffect(() => {
    setIndex(null);
    if (!tour) return;
    if (seen().includes(tour.id)) return;
    const timer = window.setTimeout(() => setIndex(0), 900);
    return () => window.clearTimeout(timer);
  }, [tour]);

  // Replay from the header help button.
  useEffect(() => {
    const replay = () => {
      if (!tour) return;
      setIndex(0);
    };
    window.addEventListener(TOUR_EVENT, replay);
    return () => window.removeEventListener(TOUR_EVENT, replay);
  }, [tour]);

  const step = tour && index !== null ? tour.steps[index] : undefined;

  // Track the highlighted element, skipping steps whose target is absent.
  useLayoutEffect(() => {
    if (!tour || index === null) return;
    const current = tour.steps[index];
    if (!current) {
      close();
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    if (!el) {
      if (index + 1 < tour.steps.length) setIndex(index + 1);
      else close();
      return;
    }
    // Only scroll when the target is off screen — on a phone the world already
    // fills the viewport and scrolling it away was disorienting.
    const rect = el.getBoundingClientRect();
    if (rect.bottom < 8 || rect.top > window.innerHeight - 8)
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setBox(el.getBoundingClientRect());
    measure();
    const timer = window.setTimeout(measure, 350);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [tour, index, close]);

  useEffect(() => {
    if (index === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, close]);

  if (!tour || index === null || !step || !box) return null;

  const total = tour.steps.length;
  const pad = 6;
  const cardWidth = Math.min(320, window.innerWidth - 24);
  const below = box.bottom + 200 < window.innerHeight;
  // Keep the card fully on screen — on a phone the highlighted area often fills
  // the whole viewport, which used to push the card past the bottom edge.
  const cardHeight = cardRef.current?.offsetHeight ?? 220;
  const top = Math.min(
    Math.max(12, below ? box.bottom + 12 : box.top - 12 - cardHeight),
    Math.max(12, window.innerHeight - cardHeight - 12),
  );
  const left = Math.min(
    Math.max(12, box.left + box.width / 2 - cardWidth / 2),
    window.innerWidth - cardWidth - 12,
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" role="dialog" aria-label="Guided tour">
      <div
        className="absolute border-2 border-bitcoin transition-all duration-200"
        style={{
          top: box.top - pad,
          left: box.left - pad,
          width: box.width + pad * 2,
          height: box.height + pad * 2,
          boxShadow: "0 0 0 9999px color-mix(in oklab, var(--color-background) 72%, transparent)",
        }}
      />
      <div
        ref={cardRef}
        className="pointer-events-auto absolute border-2 border-border-strong bg-background p-4 shadow-[6px_6px_0_0_var(--color-border)] transition-all duration-200"
        style={{ top, left, width: cardWidth }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="label text-bitcoin">
            STEP {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => close()}
            aria-label="Close tour"
            className="grid size-6 place-items-center border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
        <h2 className="display mt-2 text-sm leading-snug">{step.title}</h2>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => close()} className="label hover:text-foreground">
            SKIP
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)} className="btn-term-ghost px-3 py-2 text-[10px]">
                BACK
              </button>
            )}
            <button
              type="button"
              onClick={() => (index + 1 < total ? setIndex(index + 1) : close())}
              className="btn-term px-3 py-2 text-[10px]"
            >
              {index + 1 < total ? "NEXT" : "GOT IT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
