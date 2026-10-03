import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { allGuardiansQuery } from "@/lib/bitmon-queries";
import { useWalletSession } from "@/lib/wallet-session";
import { RARITY_TONE } from "@/lib/bitmon";
import { GuardianTurntable, SummonGuardianDialog } from "@/components/bitmon/SummonGuardianDialog";

/** Guardians summoned by the connected wallet, shown on the inventory. */
export function MyGuardians() {
  const wallet = useWalletSession();
  const { data } = useQuery(allGuardiansQuery());
  const [open, setOpen] = useState<number | null>(null);
  const mine = (data ?? []).filter((g) => wallet && (g.owner === wallet.ordinalsAddress || g.owner === wallet.paymentAddress));
  return (
    <section className="border border-border bg-card p-4" aria-label="Your guardians">
      <p className="label text-bitcoin">BLOCK-DNA GUARDIANS</p>
      {mine.length === 0 ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">NO GUARDIANS YET · OPEN ONE OF YOUR BITMAP PAGES AND PRESS BLOCK-DNA GUARDIAN TO SUMMON ONE.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mine.map((g) => (
            <button key={g.height} type="button" onClick={() => setOpen(g.height)} className="border border-border text-left hover:border-bitcoin">
              <GuardianTurntable dna={g} className="h-36" />
              <div className="p-2 font-mono text-[10px]">
                <p className={RARITY_TONE[g.rarity]}>{g.rarity} · LV {g.level}</p>
                <p className="text-foreground">{g.species}</p>
                <p className="text-muted-foreground">{g.height}.BITMAP · {g.hp} HP</p>
                <p className="mt-1 text-signal">● OASIS AWAKENED · NOT TRADABLE</p>
                <p className="text-muted-foreground">INSCRIBE AS A CHILD OF ITS BITMAP TO TRADE</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open !== null ? <SummonGuardianDialog height={open} open onOpenChange={(v) => !v && setOpen(null)} /> : null}
    </section>
  );
}
