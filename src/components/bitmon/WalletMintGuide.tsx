/** Step-by-step: what each wallet popup means when minting a Guardian. */
import { useState } from "react";
import { GUARDIAN_PRICE_SATS } from "@/lib/bitmon";

type Wallet = "unisat" | "xverse";

const SHARED = [
  ["SUMMON", `Pay ${GUARDIAN_PRICE_SATS.toLocaleString()} sats (plus a few unique sats that identify you) to the treasury. After one confirmation your Guardian wakes up in the Oasis.`],
  ["COMMIT", "A small payment (about 2,000 sats) to a one-time address. That address is built from the inscription itself — it already names your BITMAP as parent. Your BITMAP is NOT moved here, and that is correct."],
  ["REVEAL", "The last popup. Input 0 is your BITMAP, Output 0 sends it straight back to you. A new 546-sat Guardian Ordinal lands in your wallet as a true child of your BITMAP."],
] as const;

const WALLET: Record<Wallet, { name: string; tips: string[] }> = {
  unisat: {
    name: "UNISAT",
    tips: [
      "Use one Taproot (bc1p…) account that holds the BITMAP. UniSat pays fees and holds Ordinals from the same address.",
      "Popup 1 and 2 are normal payments. Popup 3 shows several inputs — check that your BITMAP comes back to your own address.",
      "If UniSat warns about spending an inscription on popup 3, that is the BITMAP being used as parent and returned in the same transaction.",
    ],
  },
  xverse: {
    name: "XVERSE",
    tips: [
      "Xverse has two addresses: Payment (starts with 3… or bc1q…) pays the fees; Ordinals (bc1p…) must hold the BITMAP.",
      "Popup 2 spends from your Payment address — you will not see the BITMAP there. That is expected.",
      "Popup 3 asks you to sign inputs from BOTH addresses. Approve all of them, or the reveal can't include your BITMAP.",
      "If you closed the tab mid-way, open My Inscription Payments — your commit is saved and you can finish without paying again.",
    ],
  },
};

export function WalletMintGuide() {
  const [w, setW] = useState<Wallet>("unisat");
  return (
    <section className="panel mt-10 rounded-md border border-border p-5">
      <p className="label text-signal">HOW TO MINT · WALLET GUIDE</p>
      <h2 className="display mt-1 text-3xl">THREE POPUPS. <span className="text-bitcoin">ONE GUARDIAN.</span></h2>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {SHARED.map(([t, body], k) => (
          <li key={t} className="border border-border p-3">
            <p className="font-mono text-xs text-bitcoin">POPUP {k + 1}</p>
            <p className="display text-lg">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex gap-2">
        {(Object.keys(WALLET) as Wallet[]).map((k) => (
          <button key={k} type="button" onClick={() => setW(k)} className={w === k ? "btn-term" : "btn-term-ghost"}>{WALLET[k].name}</button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {WALLET[w].tips.map((t) => (
          <li key={t} className="flex gap-2 text-sm"><span className="font-mono text-signal">›</span><span>{t}</span></li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[10px] text-muted-foreground">
        SAFETY: THE APP CHECKS YOUR WALLET HOLDS THE BITMAP BEFORE ANY PAYMENT. IF THE CHECK FAILS, NOTHING IS PAID.
      </p>
    </section>
  );
}

const STORY = [
  ["READ FROM BITCOIN", "Every Guardian comes from one block: its hash, size, weight and transactions. Anyone with a node can rebuild the same creature — forever. That is Digital Matter."],
  ["GROWS WITH THE LAND", "The longer a BITMAP is held, the stronger its land boost — more visitor BIT and taller builds. A Guardian stationed there defends it, raids neighbours and brings spoils home."],
  ["A WORLD OTHERS SEE", "Send your Guardian on patrols and marches from the Command Centre. Every player in the Oasis sees it walking the same route, even when you're offline."],
  ["BEDROCK ANYONE CAN BUILD ON", "The Guardian generator is inscribed on-chain and every Guardian is a child of its BITMAP. Any builder can read them to make arenas, quests or games — no permission needed."],
] as const;

export function GuardianStory() {
  return (
    <section className="mt-10">
      <p className="label text-signal">WHY IT MATTERS</p>
      <h2 className="display mt-1 text-3xl">THE LAND WAKES UP. <span className="text-bitcoin">SO DO ITS GUARDIANS.</span></h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {STORY.map(([t, b], k) => (
          <div key={t} className="panel rounded-md border border-border p-4">
            <p className="font-mono text-xs text-bitcoin">0{k + 1}</p>
            <p className="display text-lg">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
