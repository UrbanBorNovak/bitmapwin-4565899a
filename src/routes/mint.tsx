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
import { GuardianShowcase } from "@/components/bitmon/GuardianShowcase";
import { GuardianStory, WalletMintGuide } from "@/components/bitmon/WalletMintGuide";
import { MintHero } from "@/components/bitmon/MintHero";
import { MintMusic } from "@/components/bitmon/MintMusic";

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
  const [tab, setTab] = useState<Tab>("tour");
  const dna = useQuery(guardianDnaQuery(height));
  const awake = useQuery(guardianQuery(height));
  const d = dna.data;
  const m = d ? morphFromDna(d) : null;
  const go = (h: number) => Number.isInteger(h) && h >= 0 && navigate({ search: { height: h } });

  const stats = d ? ([["HP", d.hp], ["BITE", d.bite], ["SPEED", d.speed], ["ARMOR", d.armor]] as const) : [];
  const maxStat = Math.max(100, ...stats.map(([, v]) => Number(v) || 0));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      <MintHero />

      <div className="mb-4 space-y-2">
        <UnfinishedInscriptions />
      </div>

      {/* Mint console */}
      <section className="panel overflow-hidden rounded-md border border-border">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 md:p-4">
          <div>
            <p className="label text-signal">MINT CONSOLE</p>
            <h1 className="display text-2xl md:text-3xl">Pick a block. <span className="text-bitcoin">Meet its Guardian.</span></h1>
            <div className="mt-2"><MintMusic seed={height} /></div>
          </div>
          <form data-tour="mint-pick" className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); go(Number(input)); }}>
            <div className="flex items-center rounded-sm border border-border bg-background px-2">
              <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))} aria-label="BITMAP number" className="w-28 bg-transparent py-2 font-mono text-sm outline-none" />
              <span className="font-mono text-xs text-muted-foreground">.bitmap</span>
            </div>
            <button type="submit" className="btn-term-ghost">PREVIEW</button>
            <button type="button" className="btn-term-ghost" onClick={() => go(Math.floor(Math.random() * 840000))}>⟳ RANDOM</button>
          </form>
        </header>

        <div className="grid md:grid-cols-[1fr_360px]">
          <div className="relative border-b border-border md:border-b-0 md:border-r">
            {d ? <GuardianTurntable dna={d} className="h-[380px] md:h-[460px]" /> : (
              <div className="grid h-[380px] place-items-center font-mono text-xs text-muted-foreground md:h-[460px]">
                {dna.isError ? "✕ COULD NOT READ THIS BLOCK — TRY AGAIN" : <span className="animate-pulse">&gt; READING BLOCK DNA…</span>}
              </div>
            )}
            <p className="pointer-events-none absolute left-3 top-3 font-mono text-[11px] text-bitcoin">{height}.BITMAP</p>
          </div>

          <aside data-tour="mint-buy" className="flex flex-col gap-4 p-4">
            {d && m ? (
              <>
                <div>
                  <p className={`font-mono text-[11px] ${RARITY_TONE[d.rarity]}`}>{d.rarity} · ERA {d.epoch} · LV {guardianLevel(d)}</p>
                  <h2 className="display mt-1 text-3xl">{m.name}</h2>
                  <p className="font-mono text-[10px] text-muted-foreground">{d.species} LINE · {m.plan} · {m.code}</p>
                  <p className="mt-2 font-mono text-[11px] text-signal">ABILITY · {d.ability}</p>
                </div>

                <div className="space-y-2">
                  {stats.map(([k, v]) => (
                    <div key={k} className="font-mono text-[10px]">
                      <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-bitcoin transition-all duration-700" style={{ width: `${Math.min(100, (Number(v) / maxStat) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto space-y-2">
                  {awake.data ? (
                    <div className="rounded-sm border border-signal/40 p-3 font-mono text-[11px]">
                      <p className="text-signal">● ALREADY AWAKE IN THE OASIS</p>
                      <p className="mt-1 text-muted-foreground">Each block has one Guardian. Try another block.</p>
                      <div className="mt-2 flex gap-3">
                        <button type="button" className="text-bitcoin underline" onClick={() => go(Math.floor(Math.random() * 840000))}>ROLL ANOTHER →</button>
                        {awake.data.inscriptionId ? <a href={`https://ordinals.com/inscription/${awake.data.inscriptionId}`} target="_blank" rel="noreferrer" className="text-signal underline">VIEW ON-CHAIN</a> : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-mono text-[11px] text-signal">● AVAILABLE TO SUMMON</p>
                      <button type="button" onClick={() => setOpen(true)} className="btn-term w-full py-3 text-base">◆ SUMMON · {GUARDIAN_PRICE_SATS.toLocaleString()} SATS</button>
                    </>
                  )}
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Summon wakes it in the Oasis. Then inscribe it as a child of {height}.bitmap and the BITMAPWIN master — it joins the collection automatically.
                  </p>
                </div>
              </>
            ) : <p className="font-mono text-xs text-muted-foreground">Pick a block to begin.</p>}
          </aside>
        </div>

        <ol data-tour="mint-steps" className="grid border-t border-border md:grid-cols-3">
          {STEPS.map(([n, t, note]) => (
            <li key={n} className="border-b border-border p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <p className="font-mono text-xs text-bitcoin">{n} · {t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{note}</p>
            </li>
          ))}
        </ol>
      </section>

      {d ? (
        <section data-tour="mint-delegate" className="panel mt-6 space-y-3 rounded-md border border-border p-4">
          <p className="label text-signal">STEP 03 · INSCRIBE ON-CHAIN</p>
          <h2 className="display text-2xl">Inscribe from <span className="text-bitcoin">{height}.bitmap</span></h2>
          {awake.isPending ? (
            <p className="font-mono text-xs text-muted-foreground animate-pulse">&gt; CHECKING SUMMON STATUS…</p>
          ) : !awake.data ? (
            <div className="rounded-sm border border-border p-3 font-mono text-[11px]">
              <p className="text-bitcoin">🔒 LOCKED · SUMMON THIS GUARDIAN FIRST</p>
              <p className="mt-1 text-muted-foreground">Inscribing opens once the summon payment confirms and the Guardian wakes in the Oasis.</p>
              <button type="button" onClick={() => setOpen(true)} className="btn-term mt-3">◆ SUMMON · {GUARDIAN_PRICE_SATS.toLocaleString()} SATS</button>
            </div>
          ) : awake.data.inscriptionId ? (
            <div className="rounded-sm border border-signal/40 p-3 font-mono text-[11px]">
              <p className="text-signal">✓ ALREADY INSCRIBED ON-CHAIN</p>
              <a href={`https://ordinals.com/inscription/${awake.data.inscriptionId}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-bitcoin underline">VIEW INSCRIPTION →</a>
            </div>
          ) : (
            <>
              <p className="max-w-2xl text-sm text-muted-foreground">Summon confirmed. A tiny on-chain child that borrows the master generator. It lands in your own wallet.</p>
              <DelegateGuardianSummon dna={d} />
            </>
          )}
        </section>
      ) : null}

      {/* Secondary content */}
      <div className="mt-8 flex flex-wrap gap-1 border-b border-border">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-3 py-2 font-mono text-[11px] transition-colors ${tab === k ? "border-b-2 border-bitcoin text-bitcoin" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 font-mono text-[10px]">
          <Link to="/guardians-guide" className="text-signal underline">GUIDE</Link>
          <Link to="/payments" className="text-signal underline">MY PAYMENTS</Link>
          <Link to="/codex/morphs" className="text-signal underline">MORPH LAB</Link>
          {!SHORD_VAULT_DISABLED && <Link to="/shord" className="text-signal underline">POOL NOTES</Link>}
        </div>
      </div>
      <div className="[&>*:first-child]:mt-4">
        {tab === "tour" ? <GuardianShowcase /> : null}
        {tab === "wallet" ? <WalletMintGuide /> : null}
        {tab === "story" ? (
          <>
            <GuardianStory />
            <div className="panel mt-4 rounded-md border border-signal/40 p-3">
              <p className="label text-signal">◇ EXPERIMENT · FIRST SHIELDED DMT</p>
              <p className="mt-1 text-sm text-muted-foreground">Optional: send your Guardian into a private pool instead of your wallet. Your browser holds the only key. Unaudited research.</p>
            </div>
          </>
        ) : null}
        {tab === "mine" ? <SummonDashboard /> : null}
      </div>

      {open ? <SummonGuardianDialog height={height} open={open} onOpenChange={setOpen} /> : null}
    </div>
  );
}

const TABS = [["tour", "GUARDIAN TOUR"], ["wallet", "WALLET GUIDE"], ["story", "THE STORY"], ["mine", "MY SUMMONS"]] as const;
type Tab = (typeof TABS)[number][0];
