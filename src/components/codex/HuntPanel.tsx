import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { claimHuntBountyFn } from "@/lib/coins.functions";
import { markBitClaimed, useHuntQuest, creatureName } from "@/lib/hunt-quest";
import { useWalletSession } from "@/lib/wallet-session";
import type { CritterKind } from "@/lib/bestiary";

/** Daily hunt: target, progress, bounty claim. `compact` is the Oasis HUD form. */
export function HuntPanel({ compact = false }: { compact?: boolean }) {
  const hunt = useHuntQuest();
  const wallet = useWalletSession();
  const claim = useServerFn(claimHuntBountyFn);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;
  const { quest, kills, done, bitClaimed, totals } = hunt;

  async function pay() {
    if (!address) { setNote("CONNECT A VERIFIED WALLET TO CLAIM BIT"); return; }
    setBusy(true); setNote(null);
    try {
      const r = await claim({ data: { address, day: quest.day } });
      if (!r.ok) { setNote(r.error); return; }
      markBitClaimed();
      setNote(r.already ? "BOUNTY ALREADY PAID TODAY" : `+${quest.bit} BIT PAID`);
      void qc.invalidateQueries();
    } catch {
      setNote("SIGN IN AND VERIFY YOUR WALLET TO CLAIM");
    } finally { setBusy(false); }
  }

  const bar = (
    <div className="mt-1.5 flex gap-1" aria-label={`${kills} of ${quest.goal}`}>
      {Array.from({ length: quest.goal }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-sm ${i < kills ? "bg-bitcoin" : "bg-border"}`} />
      ))}
    </div>
  );
  const action = done ? (
    bitClaimed ? <p className="mt-2 text-signal">BOUNTY COMPLETE · PAID</p> : (
      <button onClick={pay} disabled={busy} className="btn-term mt-2 w-full px-2 py-1 text-[10px]">
        {busy ? "PAYING…" : `CLAIM ${quest.bit} BIT`}
      </button>
    )
  ) : null;

  if (compact) {
    return (
      <div data-no-translate className="hud-panel absolute right-3 bottom-24 z-30 w-[min(13rem,calc(100%-1.5rem))] px-2.5 py-2 font-mono text-[10px]" aria-label="Daily hunt">
        <span className="hud-telemetry-title">DAILY HUNT</span>
        <p className="text-foreground">{quest.name} · {kills}/{quest.goal}</p>
        {bar}
        {done && !bitClaimed && <p className="mt-1 text-bitcoin">+{quest.xp} HUNTER XP EARNED</p>}
        {action}
        {note && <p className="mt-1 text-muted-foreground">{note}</p>}
      </div>
    );
  }

  const tally = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return (
    <section data-no-translate className="mt-6 grid gap-4 rounded-md border border-border bg-card/60 p-5 backdrop-blur md:grid-cols-[1.2fr_1fr]">
      <div className="font-mono text-[11px]">
        <p className="label text-signal">DAILY HUNT · {quest.day}</p>
        <h2 className="display mt-1 text-2xl">{quest.name}</h2>
        <p className="mt-1 text-muted-foreground">DOWN {quest.goal} IN THE OASIS · REWARD {quest.xp} HUNTER XP + {quest.bit} BIT</p>
        <p className="mt-3 tabular-nums">{kills} / {quest.goal}</p>
        {bar}
        {action}
        {note && <p className="mt-2 text-muted-foreground">{note}</p>}
      </div>
      <div className="font-mono text-[10px]">
        <p className="label">YOUR HUNT RECORD</p>
        {tally.length === 0 ? <p className="mt-2 text-muted-foreground">&gt; NOTHING HUNTED YET</p> : (
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {tally.map(([k, n]) => (
              <li key={k} className="flex justify-between rounded border border-border px-2 py-1">
                <span>{creatureName(k.toLowerCase() as CritterKind)}</span><span className="text-bitcoin">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
