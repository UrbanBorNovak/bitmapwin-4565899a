import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { GuardianTurntable, SummonGuardianDialog } from "@/components/bitmon/SummonGuardianDialog";
import { guardianDnaQuery, guardianQuery } from "@/lib/bitmon-queries";
import { GUARDIAN_PRICE_SATS, RARITY_TONE, guardianLevel } from "@/lib/bitmon";
import { morphFromDna } from "@/lib/creature-morph";
import { DelegateGuardianSummon } from "@/components/bitmon/DelegateGuardianSummon";
import { UnfinishedInscriptions } from "@/components/territory/UnfinishedInscriptions";
import { SummonDashboard } from "@/components/bitmon/SummonDashboard";
import { SHORD_VAULT_DISABLED } from "@/lib/shord-flag";

export const Route = createFileRoute("/mint")({
  validateSearch: z.object({ height: z.coerce.number().int().min(0).optional() }),
  head: () => ({
    meta: [
      { title: "Summon a DMT Guardian — BITMAPWIN" },
      { name: "description", content: "Pick any BITMAP and summon the Guardian read straight from its block — Digital Matter Theory, no invented traits. Optional shielded experiment." },
      { property: "og:title", content: "Summon a DMT Guardian from any BITMAP" },
      { property: "og:description", content: "One block, one Guardian. Every trait is read from Bitcoin itself." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MintPage,
});

const STEPS = [
  ["01", "PICK A BITMAP", "Every block grows one Guardian. Armor from difficulty, size from block weight, crests from fork signals — read, not invented."],
  ["02", "SUMMON IN THE OASIS", `Pay ${GUARDIAN_PRICE_SATS.toLocaleString()} sats. After one confirmation your Guardian wakes up and patrols its BITMAP in the Oasis.`],
  ["03", "INSCRIBE ON-CHAIN", "Inscribe your awake Guardian as a real Ordinal child of its BITMAP. It lands in your own wallet — or try the shielded experiment."],
] as const;

function MintPage() {
  const { height: initial } = Route.useSearch();
  const navigate = useNavigate({ from: "/mint" });
  const [input, setInput] = useState(String(initial ?? 840000));
  const height = initial ?? 840000;
  const [open, setOpen] = useState(false);
  const dna = useQuery(guardianDnaQuery(height));
  const awake = useQuery(guardianQuery(height));
  const d = dna.data;
  const m = d ? morphFromDna(d) : null;
  const go = (h: number) => Number.isInteger(h) && h >= 0 && navigate({ search: { height: h } });

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <p className="label text-signal">BITMAPWIN / SUMMON</p>
      <h1 className="display mt-2 text-4xl md:text-5xl">SUMMON A GUARDIAN. <span className="text-bitcoin">PURE DIGITAL MATTER.</span></h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Digital Matter Theory (DMT) means nothing is made up: every Guardian is read straight from its Bitcoin block — difficulty, weight, hash, transactions. Anyone with a node gets the exact same creature.
      </p>

      <div className="panel mt-4 max-w-2xl rounded-md border border-signal/40 p-3">
        <p className="label text-signal">◇ EXPERIMENT · FIRST SHIELDED DMT</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional: send your Guardian into a private pool instead of your wallet, so explorers can't link the first owner to you. Your browser holds the only key. Unaudited research — try it only if you want to be part of the first real shielded DMT.
        </p>
      </div>

      <div className="mt-6 space-y-2"><UnfinishedInscriptions /><div className="flex gap-3"><Link to="/guardians-guide" className="label text-signal underline">? WHAT ARE GUARDIANS →</Link><Link to="/payments" className="label text-signal underline">◇ MY INSCRIPTION PAYMENTS →</Link></div></div>

      <ol data-tour="mint-steps" className="mt-6 grid gap-3 md:grid-cols-3">
        {STEPS.map(([n, t, note]) => (
          <li key={n} className="panel rounded-md border border-border p-4">
            <p className="font-mono text-xs text-bitcoin">{n}</p>
            <p className="display mt-1 text-lg">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{note}</p>
          </li>
        ))}
      </ol>

      <form data-tour="mint-pick" className="mt-8 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); go(Number(input)); }}>
        <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))} aria-label="BITMAP number" className="w-40 rounded-sm border border-border bg-background px-3 py-2 font-mono text-sm" />
        <span className="font-mono text-sm text-muted-foreground">.bitmap</span>
        <button type="submit" className="btn-term-ghost">PREVIEW</button>
        <button type="button" className="btn-term-ghost" onClick={() => go(Math.floor(Math.random() * 840000))}>RANDOM</button>
      </form>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_340px]">
        <div className="panel rounded-md border border-border">
          {d ? <GuardianTurntable dna={d} className="h-[420px]" /> : (
            <div className="grid h-[420px] place-items-center font-mono text-xs text-muted-foreground">
              {dna.isError ? "✕ COULD NOT READ THIS BLOCK — TRY AGAIN" : "> READING BLOCK DNA…"}
            </div>
          )}
        </div>
        <aside data-tour="mint-buy" className="panel space-y-3 rounded-md border border-border p-4">
          {d && m ? (
            <>
              <p className={`font-mono text-[11px] ${RARITY_TONE[d.rarity]}`}>{d.rarity} · ERA {d.epoch} · LV {guardianLevel(d)}</p>
              <h2 className="display text-2xl">{m.name}</h2>
              <p className="font-mono text-[10px] text-muted-foreground">{d.species} LINE · {m.plan} · {m.code}</p>
              <p className="font-mono text-[11px] text-signal">ABILITY · {d.ability}</p>
              <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                {([["HP", d.hp], ["BITE", d.bite], ["SPD", d.speed], ["ARM", d.armor]] as const).map(([k, v]) => (
                  <div key={k} className="border border-border px-1.5 py-1"><p className="text-muted-foreground">{k}</p><p>{v}</p></div>
                ))}
              </div>
              {awake.data ? (
                <p className="font-mono text-xs text-muted-foreground">✕ {height}.BITMAP'S GUARDIAN IS ALREADY SUMMONED — PICK ANOTHER BLOCK.</p>
              ) : (
                <button type="button" onClick={() => setOpen(true)} className="btn-term w-full">◆ SUMMON · {GUARDIAN_PRICE_SATS.toLocaleString()} SATS</button>
              )}
              <p className="font-mono text-[10px] text-muted-foreground">SUMMON WAKES IT IN THE OASIS. INSCRIBE IS THE NEXT STEP — IT MAKES THE ON-CHAIN ORDINAL IN YOUR WALLET. SIGN IN AND CONNECT A WALLET TO PAY.</p>
              <div className="flex gap-3 font-mono text-[10px]">
                {!SHORD_VAULT_DISABLED && <Link to="/shord" className="text-signal underline">YOUR POOL NOTES</Link>}
                <Link to="/codex/morphs" className="text-signal underline">MORPH LAB</Link>
              </div>
            </>
          ) : null}
        </aside>
      </div>
      {d ? (
        <section data-tour="mint-delegate" className="panel mt-6 space-y-3 rounded-md border border-border p-4">
          <p className="label text-signal">HOLDER INSCRIBE · DELEGATE</p>
          <h2 className="display text-2xl">INSCRIBE FROM <span className="text-bitcoin">{height}.BITMAP</span></h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Hold this BITMAP? Inscribe a tiny on-chain child of it that borrows the master generator. It lands in your own wallet, not the pool.
          </p>
          <DelegateGuardianSummon dna={d} />
        </section>
      ) : null}
      <SummonDashboard />
      {open ? <SummonGuardianDialog height={height} open={open} onOpenChange={setOpen} /> : null}
    </div>
  );
}
