import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { esploraFetch, guardianFromBlock, RARITY_TONE } from "@/lib/bitmon";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";
import { guardianQuery } from "@/lib/bitmon-queries";
import { BW_MATTER_TABLE, deriveMatter, eraName, fmt100 } from "@/lib/bw-matter";
import { liveBitmapFn } from "@/lib/bw-matter.functions";
import { dmtBlueprint, ERA_TRADITIONS } from "@/lib/bw-matter-blueprint";
import { MatterVeil, useMistSound } from "@/components/matter/MatterAtmosphere";

export const Route = createFileRoute("/matter")({
  head: () => ({
    meta: [
      { title: "BW-MATTER-1 — Block Matter & Guardians | BitmapWin" },
      { name: "description", content: "See the BW-MATTER-1 element of any Bitcoin block, its canonical BITMAP from bop's LiveOCI, and the Guardian grown from the same block." },
      { property: "og:title", content: "BW-MATTER-1 — Block Matter & Guardians" },
      { property: "og:description", content: "One Bitcoin block, three readings: its LiveOCI BITMAP, its BW-MATTER-1 element, and its Guardian." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatterPage,
});

const PRESETS = [0, 170, 210_000, 420_000, 630_000, 715_093, 840_000];

type Block = { height: number; hash: string; txCount: number; size: number; weight: number; timestamp: number; nonce: number };

async function fetchBlock(height: number): Promise<Block> {
  const hash = (await (await esploraFetch(`/block-height/${height}`)).text()).trim();
  const b = (await (await esploraFetch(`/block/${hash}`)).json()) as { tx_count: number; size: number; weight: number; timestamp: number; nonce: number };
  return { height, hash, txCount: b.tx_count, size: b.size, weight: b.weight, timestamp: b.timestamp, nonce: b.nonce };
}

function MatterPage() {
  const [input, setInput] = useState("715093");
  const [height, setHeight] = useState(715_093);
  const block = useQuery({ queryKey: ["matter-block", height], queryFn: () => fetchBlock(height), staleTime: Infinity, retry: 1 });
  const bitmap = useQuery({ queryKey: ["matter-liveoci", height], queryFn: () => liveBitmapFn({ data: { height } }), staleTime: 5 * 60_000 });
  const b = block.data;
  const m = b ? deriveMatter(b) : null;
  const dna = b ? guardianFromBlock(b) : null;
  const awake = useQuery(guardianQuery(height));

  const sound = useMistSound();
  const go = (h: number) => { if (Number.isInteger(h) && h >= 0) { setHeight(h); setInput(String(h)); sound.chime(); } };
  const tone = m?.element.color;

  return (
    <div className="relative" style={tone ? ({ "--matter-tone": tone } as React.CSSProperties) : undefined}>
    <MatterVeil />
    <main className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-primary">THE ALCHEMY OF PROOF-OF-WORK · BW-MATTER-1</p>
          <button type="button" onClick={sound.toggle} aria-pressed={sound.on}
            className="border border-border px-3 py-1 font-mono text-[10px] tracking-widest text-muted-foreground hover:text-foreground">
            {sound.on ? "◉ MIST SOUND ON" : "○ HEAR THE MIST"}
          </button>
        </div>
        <h1 className="matter-glow-text font-display text-3xl md:text-5xl">Every block was forged in fire.<br />Read what it became.</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Miners poured energy into this block until the hash broke. From that one block rise three readings: the land it claims, the matter it holds, and the Guardian sleeping inside it.
          The BITMAP is the first valid <span className="font-mono">&lt;height&gt;.bitmap</span> found by bop's on-chain LiveOCI.
          Elements and phases are BW-MATTER-1 lore, not chemistry, and give no reward or rarity guarantee.
        </p>
      </header>

      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); go(Number(input)); }}>
        <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Block height"
          className="w-40 border border-border bg-background px-3 py-2 font-mono text-sm" />
        <button className="border border-primary px-3 py-2 font-mono text-xs tracking-widest text-primary hover:bg-primary/10">REVEAL BLOCK</button>
        {PRESETS.map((p) => (
          <button type="button" key={p} onClick={() => go(p)}
            className={`border px-2 py-1 font-mono text-[10px] tracking-widest ${p === height ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {p.toLocaleString()}
          </button>
        ))}
      </form>

      {block.isError ? <p className="font-mono text-xs text-destructive">COULD NOT READ BLOCK {height} FROM THE CHAIN RIGHT NOW</p> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel step="1" title="THE FORGED BLOCK · ITS LAND">
          <Row k="HEIGHT" v={`${height.toLocaleString()}`} />
          <Row k="HASH" v={b ? `${b.hash.slice(0, 10)}…${b.hash.slice(-8)}` : "…"} />
          <Row k="TRANSACTIONS" v={b ? b.txCount.toLocaleString() : "…"} />
          <Row k="SIZE" v={b ? `${Math.floor(b.size / 1024).toLocaleString()} KB` : "…"} />
          <Row k="WEIGHT" v={b ? `${(b.weight / 1e6).toFixed(2)} MWU` : "…"} />
          <Row k="NONCE" v={b ? String(b.nonce) : "…"} />
          <div className="mt-3 border-t border-border pt-3">
            <Row k="CANONICAL BITMAP" v={bitmap.isLoading ? "READING LIVEOCI…" : bitmap.data?.inscriptionId ? `${height}.bitmap` : bitmap.data?.error ?? "NONE FOUND"} accent />
            {bitmap.data?.inscriptionId ? (
              <>
                <Row k="INSCRIPTION" v={`${bitmap.data.inscriptionId.slice(0, 10)}…${bitmap.data.inscriptionId.slice(-4)}`} />
                {bitmap.data.sat != null ? <Row k="SAT" v={bitmap.data.sat.toLocaleString()} /> : null}
                <Row k="SOURCE" v={bitmap.data.source ?? ""} />
                <div className="mt-2 flex gap-3 font-mono text-[10px] tracking-widest">
                  <a className="text-accent hover:underline" href={`https://ordinals.com/inscription/${bitmap.data.inscriptionId}`} target="_blank" rel="noreferrer">ORDINALS.COM ↗</a>
                  <Link className="text-primary hover:underline" to="/bitmap/$block" params={{ block: String(height) }}>BITMAP PAGE →</Link>
                </div>
              </>
            ) : null}
          </div>
        </Panel>

        <Panel step="2" title="THE CRUCIBLE · ITS MATTER">
          {m ? (
            <>
              <div className="flex items-center gap-4">
                <div className="matter-crucible flex h-20 w-20 flex-col items-center justify-center border-2 font-mono" style={{ borderColor: m.element.color, color: m.element.color }}>
                  <span className="text-[10px]">#{m.element.z}</span>
                  <span className="text-2xl font-bold">{m.element.symbol}</span>
                </div>
                <div>
                  <p className="font-display text-xl">{m.element.name}</p>
                  <p className="font-mono text-[10px] tracking-widest text-muted-foreground">ERA {m.era} · {eraName(m.era)} · STRATUM {m.stratum}</p>
                </div>
              </div>
              <Row k="DENSITY" v={`${fmt100(m.density100)} TX/KB`} />
              <Row k="PHASE" v={m.phase} accent />
              <div className="mt-3 border-t border-border pt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                ERA = ⌊{height} ÷ 210,000⌋ = {m.era}<br />
                STRATUM = min(7, ⌊({height} − {m.era} × 210,000) ÷ 26,250⌋) = {m.stratum}<br />
                INDEX = {m.era} × 8 + {m.stratum} = {m.index}
              </div>
            </>
          ) : <p className="font-mono text-xs text-muted-foreground">READING BLOCK…</p>}
        </Panel>

        <Panel step="3" title="THE SPIRIT · ITS GUARDIAN">
          {dna && m ? (
            <>
              <div className="flex items-center gap-4">
                {awake.data ? (
                  <GuardianPortrait height={height} dna={dna} size={120} className="border border-border" />
                ) : (
                  <div className="matter-shroud relative h-[120px] w-[120px] shrink-0 overflow-hidden border border-border" role="img" aria-label="Unawakened — veiled in mist">
                    <div className="matter-mist" style={{ top: "-10%", height: "120%" }} />
                    <div className="matter-mist matter-mist-2" style={{ top: "20%", height: "100%" }} />
                    <span className="absolute inset-x-0 bottom-2 text-center font-mono text-[8px] tracking-widest text-muted-foreground">{awake.isPending ? "…" : "VEILED IN MIST"}</span>
                  </div>
                )}
                <div>
                  <p className="font-mono text-[10px] tracking-widest" style={{ color: awake.data ? undefined : "var(--muted-foreground)" }}>
                    {awake.data ? (awake.data.inscriptionId ? "◆ INSCRIBED" : "● AWAKE IN OASIS") : "○ DORMANT IN BLOCK"}
                  </p>
                  <p className="font-display text-lg">{dna.species}</p>
                  <p className="font-mono text-[10px] tracking-widest" style={{ color: RARITY_TONE[dna.rarity] }}>{dna.rarity} · EPOCH {dna.epoch}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">DNA {dna.dnaHash.slice(0, 12)}</p>
                </div>
              </div>
              <p className="mt-3 font-mono text-[10px] tracking-widest text-primary">LIVE GUARDIAN RULES · USED BY INSCRIBED GUARDIANS</p>
              <Row k="HP · BITE · SPEED · ARMOR" v={`${dna.hp} · ${dna.bite} · ${dna.speed} · ${dna.armor}`} />
              <p className="mt-3 border-t border-dashed border-border pt-2 font-mono text-[10px] tracking-widest text-muted-foreground">BW-MATTER-1 STATS · DRAFT · NOT USED BY ANY GUARDIAN</p>
              <Row k="VITALITY HP" v={String(m.hp)} />
              <Row k="DENSITY STRIKE" v={String(m.atk)} />
              <Row k="CONSENSUS ARMOR" v={String(m.def)} />
              <Row k="HASH CADENCE" v={`${fmt100(m.spd100)}×`} />
              <Link to="/mint" className="mt-3 inline-block font-mono text-[10px] tracking-widest text-primary hover:underline">AWAKEN OR INSCRIBE THIS GUARDIAN →</Link>
              {!awake.data ? <p className="mt-2 text-xs text-muted-foreground">Still dormant. A Guardian is only one of many things that may one day be drawn from this block.</p> : null}
            </>
          ) : <p className="font-mono text-xs text-muted-foreground">READING BLOCK…</p>}
        </Panel>
      </section>

      {b && m ? <BlueprintPanel b={b} m={m} /> : null}

      {b && dna && m ? <TraitInputs b={b} dna={dna} m={m} /> : null}

      <section className="border border-border bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap justify-between gap-2 font-mono text-[10px] tracking-widest">
          <span className="text-primary">THE PERIODIC TABLE OF BLOCKS · 40 ELEMENTS · 5 HALVING ERAS × 8 STRATA · FUTURE ERAS UNDISCOVERED</span>
          <span className="text-muted-foreground">TOUCH AN ELEMENT TO SUMMON ITS FIRST BLOCK</span>
        </div>
        <div className="grid grid-cols-8 gap-1 md:grid-cols-16">
          {BW_MATTER_TABLE.map((e, i) => (
            <button key={e.symbol} onClick={() => go(e.era * 210_000 + (i % 8) * 26_250)} title={`${e.name} · era ${e.era}`}
              className={`border p-1 text-center font-mono transition ${m?.index === i ? "border-primary bg-primary/10" : "border-border hover:border-accent"}`}>
              <span className="block text-[8px] text-muted-foreground">{e.z}</span>
              <span className="block text-sm font-bold" style={{ color: e.color }}>{e.symbol}</span>
            </button>
          ))}
          {Array.from({ length: 8 }, (_, s) => (
            <button key={`f${s}`} onClick={() => go(1_050_000 + s * 26_250)} title="Era 5 · not mined yet · undiscovered"
              className="border border-dashed border-border p-1 text-center font-mono text-muted-foreground hover:border-accent">
              <span className="block text-[8px]">ERA 5</span>
              <span className="block text-sm font-bold">?{s + 1}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Era 4 began at block 840,000. Every future halving opens a new era of 8 undiscovered strata; they stay unnamed until a new element is published. Other standards may read different matter from the same blocks.</p>
      </section>

      <section className="border border-border bg-card/60 p-4 backdrop-blur">
        <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-primary">THE FIVE BUILDING TRADITIONS · ONE PER HALVING ERA</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ERA_TRADITIONS.map((t) => (
            <button key={t.era} type="button" onClick={() => go(t.era * 210_000)}
              className={`border p-3 text-left transition ${m?.era === t.era ? "border-primary bg-primary/5" : "border-border hover:border-accent"}`}>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground">ERA {t.era} · {t.name}</p>
              <p className="mt-1 font-display text-base">{t.style}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.forms.join(" · ")}</p>
              <div className="mt-2 flex gap-1">{t.palette.map((c) => <span key={c} className="h-4 w-4 border border-border" style={{ background: c }} />)}</div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Anyone can build in any tradition. Holders can put their build on their own BITMAP in Land Forge; everyone else can build freely in Tiny Studio and download it.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Panel step="?" title="HOW A GUARDIAN COMES FROM THE BLOCK">
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>The <b className="text-foreground">block hash</b> seeds the Guardian's species, rarity roll, colours and DNA.</li>
            <li>The <b className="text-foreground">transaction count</b> sets HP and body length.</li>
            <li>The <b className="text-foreground">block size and weight</b> set bulk and armour.</li>
            <li>The <b className="text-foreground">height</b> sets the halving epoch; pre-210,000 blocks get a rarity boost.</li>
          </ol>
        </Panel>
        <Panel step="?" title="HOW THE ELEMENT COMES FROM THE BLOCK">
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>The <b className="text-foreground">height</b> picks the era and one of 8 strata; eras 0–4 name 40 elements, later eras are undiscovered.</li>
            <li><b className="text-foreground">Transactions per KB</b> picks the phase: ore, ingot or crystal.</li>
            <li>The element is a separate reading; it does not change how inscribed Guardians look.</li>
          </ol>
        </Panel>
      </section>
    </main>
    </div>
  );
}

const hx = (tail: string, s: number, n: number) => tail.slice(s, s + n);
const hi = (tail: string, s: number, n: number) => parseInt(tail.slice(s, s + n), 16);

function TraitInputs({ b, dna, m }: { b: Block; dna: ReturnType<typeof guardianFromBlock>; m: NonNullable<ReturnType<typeof deriveMatter>> }) {
  const t = dna.dnaHash;
  const density = b.size > 0 ? b.weight / b.size : 4;
  const roll = hi(t, 4, 4) / 0xffff;
  const live: [string, string, string, string][] = [
    ["SPECIES", `hash tail [0..4] = ${hx(t, 0, 4)}`, `${hi(t, 0, 4)} mod 8`, dna.species],
    ["EPOCH", `height ${b.height.toLocaleString()}`, "⌊height ÷ 210,000⌋", String(dna.epoch)],
    ["RARITY", `hash tail [4..8] = ${hx(t, 4, 4)} · height`, `roll ${roll.toFixed(4)}; <0.02 Mythic, <0.10 Epic, <0.32 Rare; epoch 0 +1 tier; height <10,000 Mythic`, dna.rarity],
    ["HP", `${b.txCount.toLocaleString()} transactions`, "(120 + √tx × 18) × tier boost", String(dna.hp)],
    ["BITE", `weight ÷ size = ${density.toFixed(2)} · tail [8..10] = ${hx(t, 8, 2)}`, "(18 + (4 − density) × 12 + byte ÷ 12) × tier boost", String(dna.bite)],
    ["SPEED", `hash tail [10..12] = ${hx(t, 10, 2)}`, "(20 + byte ÷ 6) × tier boost", String(dna.speed)],
    ["ARMOR", `${b.size.toLocaleString()} bytes · epoch ${dna.epoch}`, "(10 + min(40, size ÷ 50,000) + (4 − epoch) × 4) × tier boost", String(dna.armor)],
    ["COLOURS", `hash tail [12..16] = ${hx(t, 12, 4)}`, "hue = value ÷ 0xFFFF × 360°; Mythic accent is Bitcoin orange", `${Math.round((hi(t, 12, 4) / 0xffff) * 360)}°`],
    ["BODY SHAPE", "full block hash", "seeded generator picks body plan, limbs, horns, wings, pattern", "see portrait"],
  ];
  const draft: [string, string, string, string][] = [
    ["ELEMENT", `height ${b.height.toLocaleString()}`, "era × 8 + stratum", `${m.element.symbol} · ${m.element.name}`],
    ["PHASE", `${b.txCount.toLocaleString()} tx · ${Math.floor(b.size / 1024).toLocaleString()} KB`, "transactions per whole KB", m.phase],
    ["VITALITY · STRIKE · ARMOR · CADENCE", "height, tx count, size", "BW-MATTER-1 draft formulas", `${m.hp} · ${m.atk} · ${m.def} · ${fmt100(m.spd100)}×`],
  ];
  const Table = ({ rows }: { rows: [string, string, string, string][] }) => (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-[11px]">
        <thead><tr className="text-left text-[10px] tracking-widest text-muted-foreground"><th className="py-1 pr-3">TRAIT</th><th className="pr-3">BLOCK INPUT</th><th className="pr-3">RULE</th><th>RESULT</th></tr></thead>
        <tbody>{rows.map(([k, i, r, v]) => (
          <tr key={k} className="border-t border-border/40 align-top"><td className="py-1 pr-3 text-foreground">{k}</td><td className="pr-3 text-accent">{i}</td><td className="pr-3 text-muted-foreground">{r}</td><td className="text-foreground">{v}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
  return (
    <section className="grid gap-4">
      <div className="border border-primary/60 bg-card/60 p-4 backdrop-blur">
        <p className="font-mono text-[10px] tracking-[0.2em] text-primary">LIVE GUARDIAN RULES · WHICH BLOCK INPUT SETS EACH TRAIT</p>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">These are the existing rules. Inscribed Guardians and this site both use them, and nothing on this page changes them. Tier boost = 1 + tier × 0.12.</p>
        <Table rows={live} />
      </div>
      <div className="border border-dashed border-border bg-card/40 p-4 backdrop-blur">
        <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">BW-MATTER-1 · DRAFT READING · SEPARATE FROM GUARDIANS</p>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">A proposed lore reading of the same block. It does not affect any Guardian's look, stats, battles or inscription.</p>
        <Table rows={draft} />
      </div>
    </section>
  );
}

function BlueprintPanel({ b, m }: { b: Block; m: NonNullable<ReturnType<typeof deriveMatter>> }) {
  const bp = dmtBlueprint(b, m);
  return (
    <section className="border border-primary/40 bg-card/60 p-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-primary">4 · THE FORM · ITS DMT BLUEPRINT</p>
          <p className="mt-1 font-display text-2xl">{m.element.name} {bp.form}</p>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground">{bp.tradition.name} TRADITION · {bp.tradition.style.toUpperCase()}</p>
        </div>
        <div className="flex gap-1">{bp.palette.map((c, i) => <span key={i} title={c} className="h-8 w-8 border border-border" style={{ background: c }} />)}</div>
      </div>
      <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
        <Row k="FOOTPRINT" v={`${bp.footprint} · ${b.txCount.toLocaleString()} TX`} />
        <Row k="TERRACES" v={`${bp.terraces} · 1 + ⌊tx ÷ 500⌋, max 7`} />
        <Row k="CEILING" v={`${bp.ceiling} VOXELS · 8 + ⌊weight ÷ 80,000⌋`} />
        <Row k="INNER CORE" v={`${bp.core} · nonce mod 8`} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/forge" search={{ height: b.height }} className="border border-primary px-3 py-2 font-mono text-xs tracking-widest text-primary hover:bg-primary/10">[ BUILD ON THIS BITMAP IN LAND FORGE ]</Link>
        <Link to="/tiny-studio" className="border border-border px-3 py-2 font-mono text-xs tracking-widest text-muted-foreground hover:text-foreground">[ BUILD FREELY IN TINY STUDIO ]</Link>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">A suggestion to inspire your build, read from this block's facts. It is lore, not a rule: build anything you like. Putting a build on a BITMAP needs the holder's wallet.</p>
    </section>
  );
}

function Panel({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 border border-border bg-card/60 p-4 backdrop-blur">
      <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-primary">{step} · {title}</p>
      {children}
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1 font-mono text-[11px]">
      <span className="text-muted-foreground">{k}</span>
      <span className={accent ? "text-accent" : "text-foreground"}>{v}</span>
    </div>
  );
}
