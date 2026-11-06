import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { GuardianTurntable, SummonGuardianDialog } from "@/components/bitmon/SummonGuardianDialog";
import { allGuardiansQuery, guardianDnaQuery, guardianQuery } from "@/lib/bitmon-queries";
import { GUARDIAN_PRICE_SATS, RARITY_TONE, guardianLevel } from "@/lib/bitmon";
import { morphFromDna } from "@/lib/creature-morph";
import { GUARDIAN_MASTER_DELEGATE_ID, GUARDIAN_MASTER_DELEGATE_IDS, TRIBUTE_SATS } from "@/lib/guardian-delegate";
import { getGuardianMarketFn } from "@/lib/guardian-market.functions";
import { GuardianLiveFloor } from "@/components/bitmon/GuardianLiveFloor";

const TITLE = "Block-DNA Guardians — Collection Drop & Mint";
const DESC =
  "One block, one BITMAP, one Guardian. Living 3D creatures grown from Bitcoin block DNA, rendered fully on-chain by a single V7 master inscription.";
const COLLECTION_ADDRESS = "bc1pjpa5333aef8f9rnqhfmkncdrhdca2qnvdy23ag3e7708kccp2dssgpnz7l";

const marketQuery = queryOptions({
  queryKey: ["guardian-market"],
  queryFn: () => getGuardianMarketFn(),
  staleTime: 60_000,
  refetchInterval: 60_000,
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

const SPECS: [string, string, string][] = [
  ["SUPPLY", "1 PER BITCOIN BLOCK", "Hard ceiling set by Bitcoin itself. The first paid Guardian for a block is the only one, ever."],
  ["PARENTS", "TWO ON-CHAIN PARENTS", "Officially linked on Bitcoin to its own <height>.bitmap (the first one, checked against the live index read from raw block data) and to the master Guardian."],
  ["RENDERER", "ONE SHARED ENGINE", "Every Guardian borrows its drawing code from one master inscription (#127,507,146). The code is inscribed once, never copied."],
  ["DNA", "READ FROM THE BLOCK", "Hash, transaction count, size and era decide body, colours, stats and rarity. Same block, same creature."],
  ["TRIBUTE", `${TRIBUTE_SATS.toLocaleString()} SATS · PROVEN`, "The engine decodes the reveal transaction itself and only wakes if the tribute output is really there."],
  ["SHIELDED MINT", `${GUARDIAN_PRICE_SATS.toLocaleString()} SATS + FEE`, "Optional private route: a zero-knowledge pass proves the Guardian is yours without showing your wallet history. Withdraw any time with the key kept in your browser."],
  ["METADATA", "ZERO OFF-CHAIN", "No JSON, no trait files. Every trait is computed live from Bitcoin data."],
  ["STORAGE", "100% BITCOIN L1", "No IPFS, no CDN, no servers. If ordinals.com and Bitcoin exist, the Guardian exists."],
];

const ENGINE: [string, string][] = [
  ["12 KB OF LIFE", "Voxel body, animation, lighting, voice, camera mode and 3D export packed into 12,132 bytes with Brotli — 32 KB unpacked, zero outside files."],
  ["SELF-VERIFYING", "On load it reads its own parents and transaction from Bitcoin. A copied parent turns it to grey stone; a missing tribute keeps it a sleeping relic."],
  ["A BITCOIN CLOCK", "Every 10 minutes it asks the chain for the latest block. Age, epochs survived and halvings witnessed grow on its crest as orange sparks."],
  ["VOICE FROM THE HASH", "Roars and hums are synthesized in the browser from the block's hash — no sound files, no two alike."],
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
  const [open, setOpen] = useState(false);
  const dna = useQuery(guardianDnaQuery(height));
  const awake = useQuery(guardianQuery(height));
  const market = useQuery(marketQuery);
  const summons = useQuery(allGuardiansQuery());
  const d = dna.data;
  const m = d ? morphFromDna(d) : null;
  const minted = market.data?.ids.length;
  const sales = market.data?.sales ?? [];
  const volume = sales.reduce((n, s) => n + s.priceSats, 0);

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-10 md:px-8">
      {/* Announcement */}
      <p className="label inline-block border border-bitcoin/60 px-2 py-1 text-bitcoin">● MINT LIVE · V8 MASTER ON BITCOIN</p>
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
      <section className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-5">
        {([
          ["MAX SUPPLY", "1 / BLOCK", "ONE GUARDIAN PER BITCOIN BLOCK"],
          ["ON-CHAIN CHILDREN", minted === undefined ? "…" : minted.toLocaleString(), "REAL INSCRIPTIONS · CHILD OF <HEIGHT>.BITMAP"],
          ["OASIS SUMMONS", summons.data ? summons.data.length.toLocaleString() : "…", "AWAKE IN THE APP · NOT YET AN ORDINAL"],
          ["CONFIRMED SALES", market.data ? sales.length.toLocaleString() : "…", "ON-CHAIN CHILDREN ONLY"],
          ["VOLUME", market.data ? `${volume.toLocaleString()} SATS` : "…", "CONFIRMED ON BITCOIN"],
        ] as const).map(([k, v, note]) => (
          <div key={k} className="panel rounded-md border border-border p-4">
            <p className="label text-muted-foreground">{k}</p>
            <p className="display mt-1 text-2xl text-signal" data-no-translate>{v}</p>
            <p className="mt-1 font-mono text-[9px] text-muted-foreground">{note}</p>
          </div>
        ))}
      </section>
      <p className="mt-3 max-w-3xl font-mono text-[11px] text-muted-foreground">
        A SUMMON WAKES A GUARDIAN IN THE OASIS. IT ONLY JOINS THE COLLECTION ONCE THE HOLDER INSCRIBES IT AS A CHILD OF THEIR <span className="text-bitcoin">&lt;HEIGHT&gt;.BITMAP</span> — ONLY THOSE CAN BE LISTED AND TRADED.
      </p>

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
              {awake.data ? (
                <p className="font-mono text-xs text-muted-foreground">✕ ALREADY AWAKE — PICK ANOTHER BLOCK</p>
              ) : (
                <button type="button" onClick={() => setOpen(true)} className="btn-term w-full">◆ SUMMON LIVE</button>
              )}
              <Link to="/mint" search={{ height }} className="btn-term-ghost block w-full text-center">SHIELDED MINT →</Link>
            </>
          ) : null}
        </aside>
      </section>

      {/* Specs */}
      <section className="mt-12">
        <h2 className="display text-2xl md:text-3xl">COLLECTION <span className="text-bitcoin">SPECS</span></h2>
        <dl className="mt-4 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {SPECS.map(([k, v, note]) => (
            <div key={k} className="bg-card p-4">
              <dt className="label text-muted-foreground">{k}</dt>
              <dd className="display mt-1 text-lg text-bitcoin">{v}</dd>
              <p className="mt-2 text-xs text-muted-foreground">{note}</p>
            </div>
          ))}
        </dl>
      </section>

      {/* Engine */}
      <section className="mt-12 panel rounded-md border border-signal/50 p-5">
        <p className="label text-signal">V8 MASTER ENGINE · #127,831,725</p>
        <h2 className="display mt-2 text-2xl md:text-3xl">ONE INSCRIPTION. <span className="text-bitcoin">EVERY GUARDIAN.</span></h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          The whole collection runs on a single program written to Bitcoin. Each Guardian is a tiny pointer to it, so the engine draws, checks and animates every creature straight from chain data.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {ENGINE.map(([t, b]) => (
            <div key={t} className="border border-border p-4">
              <p className="display text-base text-signal">{t}</p>
              <p className="mt-2 text-xs text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono text-[10px] text-muted-foreground" data-no-translate>
          12,132 B BROTLI · 32,380 B RAW · TEXT/HTML · CONTENT-ENCODING BR · V5 + V1 STILL ACCEPTED
        </p>
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
      <GuardianLiveFloor sales={sales} listedFloor={null} />
      <SummonWalkthrough height={height} onSummon={() => setOpen(true)} />

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
          <p><span className="text-muted-foreground">V8 MASTER · #127,831,725 · </span>
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
      {open ? <SummonGuardianDialog height={height} open={open} onOpenChange={setOpen} /> : null}
    </div>
  );
}

const STAGES: [string, string][] = [
  ["INVOICE", "OPEN"],
  ["MEMPOOL", "SEEN"],
  ["1 CONF", "AWAKE"],
];

const TUTORIAL: { n: string; t: string; body: string; see: string }[] = [
  {
    n: "01",
    t: "PICK A BLOCK",
    body: "Every Bitcoin block grows exactly one Guardian, forever. Choose a block in the DNA inspector above — or type any height on the mint page — and the creature is already decided by that block's hash, transactions, size and era.",
    see: "> THE SAME BLOCK ALWAYS MAKES THE SAME GUARDIAN",
  },
  {
    n: "02",
    t: "SIGN IN",
    body: "Summons are tied to an account so the app can prove who holds the BITMAP. Sign in first — the summon button shows a sign-in link when you are not signed in.",
    see: "> SIGN IN TO SUMMON →",
  },
  {
    n: "03",
    t: "OPEN THE INVOICE",
    body: "Press SUMMON. The app checks the Bitcoin index for the verified holder of that BITMAP and only opens an invoice for that wallet. If you do not hold it, the request is refused with a short reason and nothing is charged.",
    see: "> CHECKING HOLDER…",
  },
  {
    n: "04",
    t: "PAY THE INVOICE",
    body: "Send exactly the amount shown, in one transaction, to the address on screen. Scan the QR code or press COPY ADDRESS. The total is the summon price plus a small id sat; the network fee is paid by your wallet, not taken from the invoice.",
    see: `> SEND EXACTLY ${GUARDIAN_PRICE_SATS.toLocaleString()}+ SATS · ONE TRANSACTION`,
  },
  {
    n: "05",
    t: "WAIT FOR THE CHAIN",
    body: "The app re-checks the Bitcoin network every 15 seconds. Your payment first appears in the mempool, then needs one confirmation before the Guardian wakes — usually a few minutes, longer when the network is busy. Keep the window open.",
    see: "> WATCHING THE BLOCKCHAIN FOR YOUR PAYMENT…",
  },
  {
    n: "06",
    t: "IT WAKES",
    body: "The master inscription reads the parent BITMAP and the tribute straight from Bitcoin. When both check out, the Guardian is awake: it patrols its own BITMAP in the Oasis, roars at visitors, and can be inscribed as a public ordinal or listed on the market.",
    see: "> THIS GUARDIAN IS AWAKE AND PATROLS ITS BITMAP",
  },
];

function SummonWalkthrough({ height, onSummon }: { height: number; onSummon: () => void }) {
  const [step, setStep] = useState(0);
  const s = TUTORIAL[step] ?? TUTORIAL[0]!;
  return (
    <section className="mt-12" id="how-to-summon">
      <h2 className="display text-2xl md:text-3xl">
        HOW TO SUMMON <span className="text-bitcoin">STEP BY STEP</span>
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Six steps, one transaction, no middleman. Follow them in order — the numbers below are the exact words the summon window shows you at each stage.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-[280px_1fr]">
        <ol className="space-y-px overflow-hidden rounded-md border border-border bg-border">
          {TUTORIAL.map((t, i) => (
            <li key={t.n}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left font-mono text-xs transition-colors ${
                  i === step ? "bg-bitcoin text-background" : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={i === step ? "" : "text-bitcoin"}>{t.n}</span>
                <span className="tracking-wide">{t.t}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="panel rounded-md border border-border p-5">
          <p className="font-mono text-xs text-bitcoin">STEP {s.n} / 06 · {s.t}</p>
          <p className="mt-3 text-sm text-foreground">{s.body}</p>
          <p className="mt-4 border border-border bg-background px-3 py-2 font-mono text-[10px] text-signal" data-no-translate>
            {s.see}
          </p>

          <div className="mt-5">
            <p className="label text-muted-foreground">THE PROGRESS BAR YOU WILL SEE</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden border border-border">
              <div
                className={`h-full transition-all duration-700 ${step >= 4 ? "w-2/3 bg-signal animate-pulse" : step >= 3 ? "w-1/3 bg-bitcoin" : "w-0"}`}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
              {STAGES.map(([k, v], i) => (
                <span key={k} className={step >= 3 + i ? (i === 2 ? "text-signal" : "text-bitcoin") : ""}>
                  {k} · {v}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={onSummon} className="btn-term">◆ OPEN THE SUMMON WINDOW</button>
            <Link to="/mint" search={{ height }} className="btn-term-ghost">MINT PAGE →</Link>
            <Link to="/auth" className="btn-term-ghost">SIGN IN →</Link>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="panel rounded-md border border-border p-4">
          <p className="label text-bitcoin">WHAT YOU PAY</p>
          <dl className="mt-2 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">SUMMON PRICE</dt><dd>{GUARDIAN_PRICE_SATS.toLocaleString()} SATS</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">TRIBUTE CHECKED ON CHAIN</dt><dd>{TRIBUTE_SATS.toLocaleString()} SATS</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">ID SATS</dt><dd>A FEW HUNDRED</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">NETWORK FEE</dt><dd>PAID BY YOUR WALLET</dd></div>
          </dl>
        </div>
        <div className="panel rounded-md border border-border p-4">
          <p className="label text-signal">IF THE WINDOW SAYS…</p>
          <ul className="mt-2 space-y-1.5 font-mono text-[11px] text-muted-foreground">
            <li>▸ WATCHING THE BLOCKCHAIN FOR YOUR PAYMENT… — nothing has arrived yet. Check the amount and address, then wait.</li>
            <li>▸ PAYMENT SEEN · AWAKENS AFTER 1 CONFIRMATION — it is in the mempool. Do not send twice.</li>
            <li>▸ INVOICE EXPIRED — START AGAIN — the invoice timed out before payment. Open a fresh one.</li>
            <li>▸ ANOTHER SUMMON LANDED FIRST FOR THIS BLOCK — someone else woke this Guardian. Pick another block.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

