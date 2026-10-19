import { useState } from "react";
import { Link } from "@tanstack/react-router";

type Stage = {
  id: string;
  label: string;
  kind: "chain" | "live";
  title: string;
  body: string;
  to?: "/marketplace" | "/forge" | "/oasis" | "/toon" | "/watch" | "/ownership";
};

const STAGES: Stage[] = [
  { id: "in", label: "01 · INPUT", kind: "chain", title: "Bitcoin blocks & inscriptions", body: "Every world element starts from a mined block or an inscription. Nothing is invented by the browser.", to: "/ownership" },
  { id: "res", label: "02 · RESOLVER", kind: "live", title: "LiveOCI + provenance", body: "The sat index and live block parser resolve which inscription is the BITMAP and who holds it right now.", to: "/ownership" },
  { id: "bed", label: "03 · BEDROCK", kind: "chain", title: "Fixed land coordinates", body: "Each BITMAP takes a permanent place on the grid. Parcels own exact tiles; nothing is ever relocated.", to: "/marketplace" },
  { id: "atoms", label: "04 · WORLD ATOMS", kind: "chain", title: "BWVX · GLB · Guardian DNA · Pixel skins", body: "Persistent, portable pieces: voxels, on-chain models, block-derived creatures and pixel textures, referenced by inscription id.", to: "/forge" },
  { id: "rt", label: "05 · RUNTIME", kind: "live", title: "Oasis · Forge · Toon Studio", body: "Every visitor re-derives the same world deterministically: terrain, builds, rigs, effects and camera cues.", to: "/oasis" },
  { id: "out", label: "06 · OUTPUT", kind: "live", title: "Watch · downloads · release kits", body: "Films, GLB/BWVX files and YouTube / TikTok / X packages. You post them yourself.", to: "/watch" },
];

// Persistent "atoms" inside the bedrock cube — fixed positions (x,y,z in 0..1)
const ATOMS: [number, number, number][] = [
  [0.22, 0.3, 0.2], [0.46, 0.4, 0.34], [0.7, 0.25, 0.6], [0.3, 0.7, 0.5],
  [0.62, 0.62, 0.2], [0.8, 0.75, 0.8], [0.15, 0.55, 0.85], [0.5, 0.15, 0.75],
];

function iso(x: number, y: number, z: number) {
  const s = 120;
  return { px: 200 + (x - z) * s * 0.87, py: 190 - y * s + (x + z) * s * 0.5 - 60 };
}

export function WorldPipelineMap() {
  const [active, setActive] = useState("atoms");
  const stage = STAGES.find((s) => s.id === active)!;
  const corners = ([[0,0,0],[1,0,0],[1,0,1],[0,0,1],[0,1,0],[1,1,0],[1,1,1],[0,1,1]] as [number, number, number][]).map(([x,y,z]) => iso(x,y,z));
  const edges: [number, number][] = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];

  return (
    <section className="border border-border bg-card/60 p-5 backdrop-blur md:p-6">
      <div className="label text-signal">SYSTEM MAP · HOW BITMAPWIN WORKS</div>
      <h2 className="display mt-2 text-2xl md:text-3xl">
        FROM BLOCK TO <span className="text-bitcoin">WORLD.</span>
      </h2>

      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_400px]">
        <ol className="grid gap-2">
          {STAGES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setActive(s.id)}
                className={`w-full border px-3 py-2 text-left transition-colors ${
                  active === s.id ? (s.kind === "chain" ? "border-bitcoin bg-bitcoin/10" : "border-signal bg-signal/10") : "border-border hover:border-border-strong"
                }`}
              >
                <span className={`font-mono text-[10px] ${s.kind === "chain" ? "text-bitcoin" : "text-signal"}`}>{s.label}</span>
                <span className="mt-0.5 block text-sm">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="flex flex-col">
          <svg viewBox="0 0 400 300" className="w-full" role="img" aria-label="Bedrock cube with persistent world atoms">
            {edges.map(([a, b], i) => (
              <line key={i} x1={corners[a]!.px} y1={corners[a]!.py} x2={corners[b]!.px} y2={corners[b]!.py} className="stroke-border-strong" strokeWidth={1} strokeDasharray={i >= 8 ? "3 3" : undefined} />
            ))}
            {ATOMS.map(([x, y, z], i) => {
              const p = iso(x, y, z);
              const hot = active === "atoms" || active === "rt";
              return (
                <g key={i}>
                  <line x1={p.px} y1={p.py} x2={iso(x, 0, z).px} y2={iso(x, 0, z).py} className="stroke-border" strokeDasharray="2 3" />
                  <circle cx={p.px} cy={p.py} r={hot ? 5 : 3.5} className={i % 3 === 0 ? "fill-signal" : "fill-bitcoin"}>
                    {hot && <animate attributeName="r" values="4;6;4" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />}
                  </circle>
                </g>
              );
            })}
            <text x={iso(0.46,0.4,0.34).px + 9} y={iso(0.46,0.4,0.34).py - 6} className="fill-muted-foreground font-mono" fontSize={9}>xyz · fixed</text>
            <text x={200} y={292} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>BEDROCK · ONE OWNER PER TILE</text>
          </svg>
          <div className="mt-2 border border-border p-3">
            <div className={`font-mono text-[10px] ${stage.kind === "chain" ? "text-bitcoin" : "text-signal"}`}>
              {stage.kind === "chain" ? "CHAIN FACT" : "LIVE / DERIVED"}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{stage.body}</p>
            {stage.to && <Link to={stage.to} className="btn-term-ghost mt-3 inline-block">[ OPEN ]</Link>}
          </div>
        </div>
      </div>
      <p className="mt-4 font-mono text-[10px] text-muted-foreground">Orange = proven on Bitcoin · Cyan = resolved live or re-derived by every viewer. Browser state never proves ownership.</p>
    </section>
  );
}
