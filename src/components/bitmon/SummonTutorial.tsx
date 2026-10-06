/**
 * Step-by-step summon tutorial: what actually happens, in order, with the real
 * amounts and the safety checks, so a new user understands summoning before
 * they ever reach the inscribe step.
 */
import { useState } from "react";
import { GUARDIAN_PRICE_SATS } from "@/lib/bitmon";
import { TRIBUTE_SATS } from "@/lib/guardian-delegate";

type Step = {
  key: string;
  title: string;
  short: string;
  body: string;
  bullets: string[];
  cost?: string;
};

const STEPS: Step[] = [
  {
    key: "pick",
    title: "PICK A BLOCK",
    short: "Choose any Bitcoin block — every block grows exactly one Guardian.",
    body:
      "Type any block number into the console and press PREVIEW, or roll a random one. Its Guardian is read straight from the block's real hash, size, weight and transactions — the same block always makes the same Guardian, forever. Looking around costs nothing.",
    bullets: [
      "The 3D preview and its HP / BITE / SPEED / ARMOR bars are free to browse.",
      "If the block already has a Guardian, the console says so — each block has only one, so roll another.",
      "You pay nothing until step 3.",
    ],
  },
  {
    key: "wallet",
    title: "CONNECT A WALLET",
    short: "Your wallet must hold <height>.bitmap — the app checks BEFORE any payment.",
    body:
      "Connect UniSat or Xverse with the account that holds the BITMAP you want to wake. The app verifies your wallet actually holds <height>.bitmap before any payment is created. If the check fails, the summon stops and NOTHING WAS PAID.",
    bullets: [
      "UNISAT: use one Taproot (bc1p…) account that holds the BITMAP.",
      "XVERSE: the Ordinals address (bc1p…) must hold the BITMAP; the Payment address only pays fees.",
      "The summon never moves your BITMAP — it stays in your wallet the whole time.",
    ],
  },
  {
    key: "summon",
    title: "PAY THE SUMMON",
    short: `One payment of ${GUARDIAN_PRICE_SATS.toLocaleString()} sats to the treasury wakes it.`,
    body:
      "Press SUMMON and your wallet shows one normal payment — no inscription is involved yet. Scan the QR code from a phone wallet if you prefer. This payment wakes the Guardian in the app; it is not the on-chain inscription.",
    bullets: [
      `Amount: exactly ${GUARDIAN_PRICE_SATS.toLocaleString()} sats, plus the small miner fee your wallet sets.`,
      "One popup, one payment — if you see more, close it and start again.",
      "Already paid but the page froze? The console remembers your order — reopening the summon resumes it instead of charging twice.",
    ],
    cost: `${GUARDIAN_PRICE_SATS.toLocaleString()} SATS`,
  },
  {
    key: "awake",
    title: "WAIT FOR ONE CONFIRMATION",
    short: "About 10 minutes. Then it awakes on its BITMAP in the Oasis.",
    body:
      "After one Bitcoin confirmation the Guardian wakes up on <height>.bitmap in the Oasis. Every player can see it patrolling the land — with you or without you. The console flips to 'ALREADY AWAKE IN THE OASIS' automatically.",
    bullets: [
      "While waiting, the panel polls the payment — leave the tab open or come back later.",
      "Once awake, you can watch it in the Oasis or command it from the Command Centre (/command).",
      "Awake is not inscribed: it lives in the app until step 5.",
    ],
  },
  {
    key: "inscribe",
    title: "INSCRIBE ON-CHAIN",
    short: "Optional, separate, and locked until the summon confirmed.",
    body:
      "Only after the summon confirms does the inscribe panel unlock. Inscribing creates a real Ordinal child of your BITMAP in your own wallet, so it joins the on-chain collection and becomes listable. Your wallet will show a small funding payment (the commit), then the reveal — where your BITMAP is spent and returned to you in the same transaction.",
    bullets: [
      "Popups: SUMMON was step 3; the COMMIT is a small ~2,000-sat funding payment; the REVEAL returns your BITMAP to your own address and mints the 546-sat Guardian child.",
      `A ${TRIBUTE_SATS.toLocaleString()}-sat treasury tribute is paid inside the reveal.`,
      "The full popup-by-popup walkthrough for UniSat and Xverse is in the WALLET GUIDE tab.",
    ],
    cost: `+${TRIBUTE_SATS.toLocaleString()} SATS TRIBUTE`,
  },
];

export function SummonTutorial({ height }: { height: number }) {
  const [open, setOpen] = useState<string | null>("pick");
  return (
    <section className="panel rounded-md border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="label text-signal">SUMMON TUTORIAL · FIRST TIME HERE</p>
          <h2 className="display mt-1 text-3xl">
            FIVE STEPS. <span className="text-bitcoin">ONE GUARDIAN.</span>
          </h2>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          SUMMON = {GUARDIAN_PRICE_SATS.toLocaleString()} SATS · INSCRIBE = SEPARATE, LATER, OPTIONAL
        </p>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        New to Guardians? This is exactly what happens when you summon one on {height}.bitmap — in order, with the real
        costs. Nothing is paid before the wallet checks pass.
      </p>

      <ol className="mt-4 space-y-2">
        {STEPS.map((s, i) => {
          const active = open === s.key;
          return (
            <li key={s.key} className={`border ${active ? "border-bitcoin/60 bg-background" : "border-border"}`}>
              <button
                type="button"
                onClick={() => setOpen(active ? null : s.key)}
                aria-expanded={active}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <span className={`font-mono text-xs ${active ? "text-bitcoin" : "text-muted-foreground"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="display flex-1 text-base">{s.title}</span>
                <span className="hidden font-mono text-[10px] text-muted-foreground sm:block">{s.short}</span>
                {s.cost ? (
                  <span className="hidden border border-bitcoin/50 px-1.5 py-0.5 font-mono text-[9px] text-bitcoin md:block">
                    {s.cost}
                  </span>
                ) : null}
                <span className={`font-mono text-xs ${active ? "text-bitcoin" : "text-muted-foreground"}`}>
                  {active ? "−" : "+"}
                </span>
              </button>
              {active ? (
                <div className="border-t border-border px-3 pb-3 pt-2">
                  <p className="max-w-3xl text-sm text-muted-foreground">{s.body}</p>
                  <ul className="mt-2 space-y-1.5">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-xs">
                        <span className="font-mono text-signal">›</span>
                        <span className="text-muted-foreground">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 font-mono text-[10px] text-muted-foreground">
        SAFETY: THE APP CHECKS YOUR WALLET HOLDS THE BITMAP BEFORE ANY PAYMENT. IF THE CHECK FAILS, NOTHING IS PAID.
        YOUR BITMAP IS NEVER MOVED BY THE SUMMON ITSELF.
      </p>
    </section>
  );
}
