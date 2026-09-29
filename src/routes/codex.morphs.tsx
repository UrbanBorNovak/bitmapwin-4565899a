import { Suspense, useState } from "react";
import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { OrbitControls, Bounds, Center } from "@react-three/drei";
import { SafeCanvas } from "@/components/game/SafeCanvas";
import { MorphBody } from "@/components/bitmon/MorphBody";
import { fetchBlockDnaSource } from "@/lib/bitmon";
import { morphFromBlock, type CreatureMorph } from "@/lib/creature-morph";

export const Route = createFileRoute("/codex/morphs")({
  head: () => ({
    meta: [
      { title: "Morph Lab — Creatures Grown From Every BITMAP" },
      { name: "description", content: "Procedural creature designs grown from each Bitcoin block's hash, transactions and size: body plan, limbs, wings, horns and colours." },
      { property: "og:title", content: "Morph Lab — a new creature for every BITMAP" },
      { property: "og:description", content: "Eight body plans and countless parts, all read from real block data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MorphLab,
});

function Viewer({ m }: { m: CreatureMorph }) {
  return (
    <ClientOnly fallback={<div className="grid size-full place-items-center font-mono text-[11px] text-muted-foreground">&gt; GROWING<span className="blink">_</span></div>}>
      <SafeCanvas dpr={[1, 1.5]} camera={{ position: [2.8, 2, 3.4], fov: 35 }} gl={{ powerPreference: "low-power" }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 3]} intensity={1.8} />
        <pointLight position={[-3, 2, -2]} intensity={6} color={m.glow} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.3}>
            <Center><MorphBody m={m} unit={1} /></Center>
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enablePan={false} autoRotate autoRotateSpeed={1.2} />
      </SafeCanvas>
    </ClientOnly>
  );
}

function MorphLab() {
  const [input, setInput] = useState("840000");
  const [height, setHeight] = useState(840000);
  const q = useQuery({
    queryKey: ["morph", height],
    queryFn: async () => morphFromBlock(await fetchBlockDnaSource(height)),
    staleTime: Infinity,
  });
  const m = q.data;
  const go = (h: number) => { if (Number.isInteger(h) && h >= 0) { setHeight(h); setInput(String(h)); } };

  const rows: [string, string | number][] = m ? [
    ["BODY PLAN", m.plan], ["SEGMENTS", m.segments], ["LEGS", m.legPairs * 2], ["WINGS", m.wings],
    ["EYES", m.eyes], ["HORNS", m.hornCount ? `${m.hornCount} × ${m.horns}` : "NONE"], ["TAIL", m.tailSegs],
    ["SPINES", m.spines], ["PATTERN", m.pattern], ["GAIT", m.gait.toFixed(2)], ["SEED", m.seed],
  ] : [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      <p className="label text-signal">BITMAPWIN / CODEX / MORPH LAB</p>
      <h1 className="display mt-2 text-4xl md:text-5xl">A NEW CREATURE. <span className="text-bitcoin">EVERY BITMAP.</span></h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Beyond the eight Guardian species: each block's hash picks a body plan, limbs, wings, horns, pattern and colours; busier blocks grow longer bodies and bigger blocks grow bulkier ones. The same BITMAP always grows the same creature.
      </p>

      <form className="mt-6 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); go(Number(input)); }}>
        <input value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))} className="w-40 rounded-sm border border-border bg-background px-3 py-2 font-mono text-sm" aria-label="BITMAP number" />
        <span className="font-mono text-sm text-muted-foreground">.bitmap</span>
        <button type="submit" className="btn-term">GROW</button>
        <button type="button" className="btn-term-ghost" onClick={() => go(Math.max(0, height - 1))}>◂ PREV</button>
        <button type="button" className="btn-term-ghost" onClick={() => go(height + 1)}>NEXT ▸</button>
        <button type="button" className="btn-term-ghost" onClick={() => go(Math.floor(Math.random() * 840000))}>RANDOM</button>
      </form>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="panel h-[460px] overflow-hidden rounded-md border border-border">
          {m ? <Viewer m={m} /> : (
            <div className="grid size-full place-items-center font-mono text-xs text-muted-foreground">
              {q.isError ? "✕ BITCOIN NETWORK UNREACHABLE — TRY AGAIN" : "> READING BLOCK…"}
            </div>
          )}
        </div>
        <aside className="panel rounded-md border border-border p-4">
          {m && (
            <>
              <p className="label">{m.height}.BITMAP · {m.code}</p>
              <h2 className="display mt-1 text-2xl">{m.name}</h2>
              <div className="mt-3 flex gap-2">
                {[m.primary, m.secondary, m.glow].map((c) => <span key={c} className="size-6 rounded-sm border border-border" style={{ background: c }} />)}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-1 font-mono text-xs">
                {rows.flatMap(([k, v]) => [<dt key={`${k}k`} className="text-muted-foreground">{k}</dt>, <dd key={`${k}v`} className="text-right text-signal">{v}</dd>])}
              </dl>
              <Link to="/bitmap/$height" params={{ height: String(m.height) }} className="btn-term-ghost mt-4 inline-block">VIEW {m.height}.BITMAP</Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
