import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { GuardianTurntable } from "@/components/bitmon/SummonGuardianDialog";
import { guardianDnaQuery } from "@/lib/bitmon-queries";
import { GUARDIAN_PRICE_SATS, RARITY_TONE, guardianLevel } from "@/lib/bitmon";
import { morphFromDna } from "@/lib/creature-morph";
import { GUARDIAN_MASTER_DELEGATE_ID, GUARDIAN_MASTER_DELEGATE_IDS, TRIBUTE_SATS } from "@/lib/guardian-delegate";
import { getGuardianMarketFn } from "@/lib/guardian-market.functions";

const TITLE = "Block-DNA Guardians — Collection Drop & Mint";
const DESC =
  "One block, one BITMAP, one Guardian. Living 3D creatures grown from Bitcoin block DNA, rendered fully on-chain by a single V6 master inscription.";
const COLLECTION_ADDRESS = "bc1pjpa5333aef8f9rnqhfmkncdrhdca2qnvdy23ag3e7708kccp2dssgpnz7l";

const marketQuery = queryOptions({
  queryKey: ["guardian-market"],
  queryFn: () => getGuardianMarketFn(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/guardians")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuardiansPromo,
});

const SPECS: [string, string][] = [
  ["SUPPLY", "ONE PER BLOCK, EVER — CAPPED BY BITCOIN ITSELF"],
  ["PARENT", "THE FIRST-IS-FIRST <HEIGHT>.BITMAP + V6 MASTER"],
  ["RENDERER", "TAG 11 DELEGATE → ONE V6 MASTER INSCRIPTION"],
  ["ENGINE", "12,132 BYTES · BROTLI · ZERO EXTERNAL FILES"],
  ["TRIBUTE", `${TRIBUTE_SATS.toLocaleString()} SATS, CHECKED ON CHAIN`],
  ["SHIELDED MINT", `${GUARDIAN_PRICE_SATS.toLocaleString()} SATS + NETWORK FEE`],
  ["METADATA", "NONE OFF-CHAIN — EVERY TRAIT READ FROM THE BLOCK"],
  ["STORAGE", "100% BITCOIN L1 · NO IPFS · NO SERVERS"],
];

const FEATURES: [string, string][] = [
  ["LIVING CLOCK", "Reads the current block height every 10 minutes. Age, epochs survived and halvings witnessed grow on the creature as orange sparks."],
  ["BLOCK VOICE", "Every roar and hum is synthesized from its block's hash. No two Guardians sound alike."],
  ["STANCES & X-RAY", "Idle, prowl, strike and roar stances, plus a glowing X-ray view of the voxel body."],
  [".OBJ EXPORT", "Download your Guardian as a 3D model with colours, ready for any 3D tool."],
  ["REAL-WORLD CAMERA", "On a phone, open the back camera and watch your Guardian roam the room around you."],
  ["LIVES IN THE OASIS", "Awake Guardians appear on their own BITMAP in the 3D world, patrol its edge and roar at visitors."],
];

const SHOWCASE = [0, 840000, 800541, 210000, 630000];

function GuardiansPromo() {
  const [height, setHeight] = useState(840000);
  const dna = useQuery(guardianDnaQuery(height));
  const market = useQuery(marketQuery);
  const d = dna.data;
  const m = d ? morphFromDna(d) : null;
  const minted = market.data?.ids.length;
  const sales = market.data?.sales ?? [];
  const volume = sales.reduce((n, s) => n + s.priceSats, 0);

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-10 md:px-8">
      {/* Announcement */}
      <p className="label inline-block border border-bitcoin/60 px-2 py-1 text-bitcoin">● MINT LIVE · V6 MASTER ON BITCOIN</p>
      <h1 className="display mt-5 text-4xl leading-tight md:text-6xl">
        1 BLOCK = 1 BITMAP = <span className="text-bitcoin">1 GUARDIAN.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Block-DNA Guardians are living 3D creatures grown from the data of a Bitcoin block. Each one hangs off its BITMAP and is drawn by a single master inscription — nothing lives off-chain.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/mint" className="btn-term">◆ MINT / SUMMON NOW</Link>
        <Link to="/collections/guardians" className="btn-term-ghost">GUARDIAN MARKET →</Link>
        <Link to="/oasis" className="btn-term-ghost">MEET THEM IN THE OASIS →</Link>
      </div>

      {/* Live stats */}
      <section className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          ["MAX SUPPLY", "1 / BLOCK"],
          ["SUMMONED", minted === undefined ? "…" : minted.toLocaleString()],
          ["CONFIRMED SALES", market.data ? sales.length.toLocaleString() : "…"],
          ["VOLUME", market.data ? `${volume.toLocaleString()} SATS` : "…"],
        ] as const).map(([k, v]) => (
          <div key={k} className="panel rounded-md border border-border p-4">
            <p className="label text-muted-foreground">{k}</p>
            <p className="display mt-1 text-2xl text-signal" data-no-translate>{v}</p>
          </div>
        ))}
      </section>

      {/* Preview */}
      <section className="mt-10 grid gap-4 md:grid-cols-[1fr_360px]">
        <div className="panel rounded-md border border-border">
          {d ? <GuardianTurntable dna={d} className="h-[440px]" /> : (
            <div className="grid h-[440px] place-items-center font-mono text-xs text-muted-foreground">
              {dna.isError ? "✕ COULD NOT READ THIS BLOCK" : "> READING BLOCK DNA…"}
            </div>
          )}
        </div>
        <aside className="panel space-y-3 rounded-md border border-border p-4">
          <p className="label text-signal">DNA INSPECTOR</p>
          <div className="flex flex-wrap gap-2">
            {SHOWCASE.map((h) => (
              <button key={h} type="button" onClick={() => setHeight(h)} className={h === height ? "btn-term" : "btn-term-ghost"} data-no-translate>
                {h}
              </button>
            ))}
            <button type="button" className="btn-term-ghost" onClick={() => setHeight(Math.floor(Math.random() * 840000))}>RANDOM</button>
          </div>
          {d && m ? (
            <>
              <p className={`font-mono text-[11px] ${RARITY_TONE[d.rarity]}`}>{d.rarity} · ERA {d.epoch} · LV {guardianLevel(d)}</p>
              <h2 className="display text-2xl">{m.name}</h2>
              <p className="font-mono text-[10px] text-muted-foreground" data-no-translate>{height}.BITMAP · {d.species} · {m.plan}</p>
              <p className="font-mono text-[11px] text-signal">ABILITY · {d.ability}</p>
              <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                {([["HP", d.hp], ["BITE", d.bite], ["SPD", d.speed], ["ARM", d.armor]] as const).map(([k, v]) => (
                  <div key={k} className="border border-border px-1.5 py-1"><p className="text-muted-foreground">{k}</p><p>{v}</p></div>
                ))}
              </div>
              <Link to="/mint" search={{ height }} className="btn-term block w-full text-center">MINT THIS GUARDIAN →</Link>
            </>
          ) : null}
        </aside>
      </section>

      {/* Specs */}
      <section className="mt-12">
        <h2 className="display text-2xl md:text-3xl">COLLECTION <span className="text-bitcoin">SPECS</span></h2>
        <dl className="mt-4 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2">
          {SPECS.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 bg-card px-4 py-3">
              <dt className="label text-muted-foreground">{k}</dt>
              <dd className="text-right font-mono text-xs">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Features */}
      <section className="mt-12">
        <h2 className="display text-2xl md:text-3xl">WHAT MAKES THEM <span className="text-bitcoin">ALIVE</span></h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {FEATURES.map(([t, b]) => (
            <div key={t} className="panel rounded-md border border-border p-4">
              <p className="display text-lg text-signal">{t}</p>
              <p className="mt-2 text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to mint */}
      <section className="mt-12 grid gap-3 md:grid-cols-2">
        <div className="panel rounded-md border border-bitcoin/60 p-5">
          <p className="label text-bitcoin">ROUTE A · HOLDER SUMMON</p>
          <p className="display mt-2 text-xl">YOU HOLD THE BITMAP</p>
          <p className="mt-2 text-sm text-muted-foreground">Inscribe a tiny child of your BITMAP that borrows the master's code. Pay the {TRIBUTE_SATS.toLocaleString()}-sat tribute and it wakes in your own wallet.</p>
        </div>
        <div className="panel rounded-md border border-signal/60 p-5">
          <p className="label text-signal">ROUTE B · SHIELDED MINT</p>
          <p className="display mt-2 text-xl">MINT INTO THE POOL</p>
          <p className="mt-2 text-sm text-muted-foreground">Pay {GUARDIAN_PRICE_SATS.toLocaleString()} sats and the Guardian lands in BITMAPWIN's shielded pool. Only your browser's key can withdraw it. The pool is our own and not yet audited.</p>
        </div>
      </section>
      <ol className="mt-3 grid gap-3 md:grid-cols-4">
        {[
          ["01", "PICK A BITMAP", "Every block grows exactly one Guardian."],
          ["02", "INSCRIBE & PAY", "Sign one transaction with the tribute."],
          ["03", "AWAKEN", "The master checks parent and tribute on chain."],
          ["04", "ROAM & TRADE", "Meet it in the Oasis, list it on the market."],
        ].map(([n, t, b]) => (
          <li key={n} className="panel rounded-md border border-border p-4">
            <p className="font-mono text-xs text-bitcoin">{n}</p>
            <p className="display mt-1">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{b}</p>
          </li>
        ))}
      </ol>

      {/* Rules */}
      <section className="mt-12 panel rounded-md border border-border p-5">
        <h2 className="display text-2xl">THE RULES</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>▸ Only the first-ever {"<height>"}.bitmap counts as a parent. Later copies render as grey stone.</li>
          <li>▸ The first paid Guardian for a block is the one. Extra copies never create a second Guardian.</li>
          <li>▸ No tribute, no life — unpaid inscriptions stay a sleeping relic.</li>
          <li>▸ Earlier V5 and V1 Guardians stay valid members of the collection.</li>
        </ul>
      </section>

      {/* Provenance */}
      <section className="mt-12">
        <h2 className="display text-2xl">PROVENANCE</h2>
        <div className="mt-3 space-y-2 font-mono text-xs" data-no-translate>
          <p><span className="text-muted-foreground">V6 MASTER · #127,507,146 · </span>
            <a className="break-all text-bitcoin hover:underline" href={`https://ordinals.com/inscription/${GUARDIAN_MASTER_DELEGATE_ID}`} target="_blank" rel="noreferrer">{GUARDIAN_MASTER_DELEGATE_ID}</a></p>
          {GUARDIAN_MASTER_DELEGATE_IDS.slice(1).map((id, i) => (
            <p key={id}><span className="text-muted-foreground">{i === 0 ? "V5" : "V1"} · </span>
              <a className="break-all text-signal hover:underline" href={`https://ordinals.com/inscription/${id}`} target="_blank" rel="noreferrer">{id}</a></p>
          ))}
          <p><span className="text-muted-foreground">COLLECTION ADDRESS · </span>
            <a className="break-all text-signal hover:underline" href={`https://ordinals.com/address/${COLLECTION_ADDRESS}`} target="_blank" rel="noreferrer">{COLLECTION_ADDRESS}</a></p>
        </div>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link to="/mint" className="btn-term">◆ MINT YOUR GUARDIAN</Link>
        <Link to="/codex/bestiary" className="btn-term-ghost">BESTIARY →</Link>
      </div>
    </div>
  );
}
