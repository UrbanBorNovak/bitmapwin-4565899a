import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { esploraFetch, guardianFromBlock, RARITY_TONE } from "@/lib/bitmon";
import { GuardianPortrait } from "@/components/bitmon/GuardianPortrait";
import { BW_MATTER_TABLE, ERA_NAMES, deriveMatter, fmt100 } from "@/lib/bw-matter";
import { liveBitmapFn } from "@/lib/bw-matter.functions";

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

  const go = (h: number) => { if (Number.isInteger(h) && h >= 0) { setHeight(h); setInput(String(h)); } };

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-[0.2em] text-primary">BW-MATTER-1 · DRAFT STANDARD</p>
        <h1 className="font-display text-3xl md:text-4xl">One block. Its BITMAP, its matter, its Guardian.</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every reading below comes from the same Bitcoin block. The BITMAP is the first valid <span className="font-mono">&lt;height&gt;.bitmap</span> found by bop's on-chain LiveOCI.
          The element and phase are BW-MATTER-1 lore labels, not chemistry, and they give no reward or rarity guarantee.
        </p>
      </header>

      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); go(Number(input)); }}>
        <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Block height"
          className="w-40 border border-border bg-background px-3 py-2 font-mono text-sm" />
        <button className="border border-primary px-3 py-2 font-mono text-xs tracking-widest text-primary hover:bg-primary/10">READ BLOCK</button>
        {PRESETS.map((p) => (
          <button type="button" key={p} onClick={() => go(p)}
            className={`border px-2 py-1 font-mono text-[10px] tracking-widest ${p === height ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {p.toLocaleString()}
          </button>
        ))}
      </form>

      {block.isError ? <p className="font-mono text-xs text-destructive">COULD NOT READ BLOCK {height} FROM THE CHAIN RIGHT NOW</p> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel step="1" title="BITCOIN BLOCK + LIVEOCI">
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

        <Panel step="2" title="BW-MATTER-1 ELEMENT">
          {m ? (
            <>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 flex-col items-center justify-center border-2 font-mono" style={{ borderColor: m.element.color, color: m.element.color }}>
                  <span className="text-[10px]">#{m.element.z}</span>
                  <span className="text-2xl font-bold">{m.element.symbol}</span>
                </div>
                <div>
                  <p className="font-display text-xl">{m.element.name}</p>
                  <p className="font-mono text-[10px] tracking-widest text-muted-foreground">ERA {m.era} · {ERA_NAMES[m.era]} · STRATUM {m.stratum}</p>
                </div>
              </div>
              <Row k="DENSITY" v={`${fmt100(m.density100)} TX/KB`} />
              <Row k="PHASE" v={m.phase} accent />
              <div className="mt-3 border-t border-border pt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                ERA = min(3, ⌊{height} ÷ 210,000⌋) = {m.era}<br />
                STRATUM = min(7, ⌊({height} − {m.era} × 210,000) ÷ 26,250⌋) = {m.stratum}<br />
                INDEX = {m.era} × 8 + {m.stratum} = {m.index}
              </div>
            </>
          ) : <p className="font-mono text-xs text-muted-foreground">READING BLOCK…</p>}
        </Panel>

        <Panel step="3" title="GUARDIAN FROM THE SAME BLOCK">
          {dna && m ? (
            <>
              <div className="flex items-center gap-4">
                <GuardianPortrait height={height} dna={dna} size={120} className="border border-border" />
                <div>
                  <p className="font-display text-lg">{dna.species}</p>
                  <p className="font-mono text-[10px] tracking-widest" style={{ color: RARITY_TONE[dna.rarity] }}>{dna.rarity} · EPOCH {dna.epoch}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">DNA {dna.dnaHash.slice(0, 12)}</p>
                </div>
              </div>
              <p className="mt-3 font-mono text-[10px] tracking-widest text-muted-foreground">GUARDIAN STATS (LIVE COLLECTION RULES)</p>
              <Row k="HP · BITE · SPEED · ARMOR" v={`${dna.hp} · ${dna.bite} · ${dna.speed} · ${dna.armor}`} />
              <p className="mt-3 font-mono text-[10px] tracking-widest text-muted-foreground">BW-MATTER-1 PHYSICS (DRAFT)</p>
              <Row k="VITALITY HP" v={String(m.hp)} />
              <Row k="DENSITY STRIKE" v={String(m.atk)} />
              <Row k="CONSENSUS ARMOR" v={String(m.def)} />
              <Row k="HASH CADENCE" v={`${fmt100(m.spd100)}×`} />
              <Link to="/mint" className="mt-3 inline-block font-mono text-[10px] tracking-widest text-primary hover:underline">AWAKEN OR INSCRIBE THIS GUARDIAN →</Link>
            </>
          ) : <p className="font-mono text-xs text-muted-foreground">READING BLOCK…</p>}
        </Panel>
      </section>

      <section className="border border-border bg-card/60 p-4 backdrop-blur">
        <div className="mb-3 flex flex-wrap justify-between gap-2 font-mono text-[10px] tracking-widest">
          <span className="text-primary">PERIODIC SPECTRUM · 32 ELEMENTS · 4 ERAS × 8 STRATA</span>
          <span className="text-muted-foreground">CLICK AN ELEMENT TO JUMP TO ITS FIRST BLOCK</span>
        </div>
        <div className="grid grid-cols-8 gap-1 md:grid-cols-16">
          {BW_MATTER_TABLE.map((e, i) => (
            <button key={e.symbol} onClick={() => go(e.era * 210_000 + (i % 8) * 26_250)} title={`${e.name} · era ${e.era}`}
              className={`border p-1 text-center font-mono transition ${m?.index === i ? "border-primary bg-primary/10" : "border-border hover:border-accent"}`}>
              <span className="block text-[8px] text-muted-foreground">{e.z}</span>
              <span className="block text-sm font-bold" style={{ color: e.color }}>{e.symbol}</span>
            </button>
          ))}
        </div>
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
            <li>The <b className="text-foreground">height</b> picks the era and one of 8 strata, so one of 32 elements.</li>
            <li><b className="text-foreground">Transactions per KB</b> picks the phase: ore, ingot or crystal.</li>
            <li>The element is a separate reading; it does not change how inscribed Guardians look.</li>
          </ol>
        </Panel>
      </section>
    </main>
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
