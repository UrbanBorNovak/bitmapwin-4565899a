import { useState } from "react";
import { HOST_SPLIT } from "@/lib/coins";

/**
 * HOST & EARN TUTORIAL — a five-step walkthrough shown above the Host & Earn
 * panel on My Land. Purely explanatory; no wallet actions happen here.
 */
const STEPS = [
  {
    title: "PICK YOUR LAND",
    body: "In the left column, choose one of the BITMAPs your wallet holds. Each one shows its holding tier — land held longer earns a bigger visitor multiplier. Land already hosting something is marked HOSTING.",
  },
  {
    title: "CHECK YOUR BOOST",
    body: "The stat row shows your selected land's holding tier, visitor multiplier, and what is already hosted there. A higher tier means every visitor pays you more BIT.",
  },
  {
    title: "PICK AN EXPERIENCE",
    body: "Browse the published community games, arenas and galleries. Each card shows its category and a short summary. You don't need to code or pay anything — hosting is free.",
  },
  {
    title: "HOST IN ONE CLICK",
    body: "Press HOST ON THIS LAND. The server re-checks on-chain that your wallet really owns the BITMAP, then links the experience to it. Your BITMAP never leaves your wallet — hosting is non-custodial.",
  },
  {
    title: "EARN FROM VISITORS",
    body: `Every day, visitor BIT from that land is split ${HOST_SPLIT.holderPercent}% to you and ${HOST_SPLIT.creatorPercent}% to the experience's creator — multiplied by your land's holding boost. Payouts land in your BIT balance automatically.`,
  },
] as const;

export function HostEarnTutorial() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mt-10 border border-border">
      <header className="border-b border-border p-5">
        <div className="label text-signal">HOW HOST &amp; EARN WORKS</div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Turn land you already hold into passive BIT income — no coding, no payment, no custodial risk.
        </p>
      </header>
      <ol className="divide-y divide-border">
        {STEPS.map((s, i) => {
          const isOpen = open === i;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-4 p-4 text-left hover:bg-secondary"
              >
                <span className="font-mono text-xs text-bitcoin">{String(i + 1).padStart(2, "0")}</span>
                <span className="display flex-1 text-sm md:text-base">{s.title}</span>
                <span className="font-mono text-xs text-muted-foreground">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <p className="px-4 pb-4 pl-14 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              )}
            </li>
          );
        })}
      </ol>
      <footer className="border-t border-border p-4">
        <p className="font-mono text-[11px] text-muted-foreground">
          SAFETY · IF THE ON-CHAIN OWNERSHIP CHECK FAILS, NOTHING IS HOSTED AND NOTHING IS PAID. IF YOU SELL OR MOVE THE
          BITMAP, HOSTING DETACHES AUTOMATICALLY.
        </p>
      </footer>
    </section>
  );
}
