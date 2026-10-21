import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { heistStatusFn } from "@/lib/void-heist.functions";
import { voidStatusFn } from "@/lib/void-progress.functions";
import { hideoutStatusFn } from "@/lib/hideout-progress.functions";
import { CASEBOOK, aftermathUnlocked, caseSolved, type CaseCounts } from "@/lib/biternam-casebook";
import { CREW_PIXEL_AVATAR } from "@/lib/biternam-quests";
import { PixelFace } from "@/components/game/PixelFace";

export const Route = createFileRoute("/biternam_/aftermath")({
  head: () => ({
    meta: [
      { title: "Biternam · Aftermath & Casebook | BITMAPWIN" },
      { name: "description", content: "After the Canonical Block: the Unreasonables reunite, Tornado reads the verdict, and the ghost of 1138 rests." },
      { property: "og:title", content: "Biternam · Aftermath & Casebook" },
      { property: "og:description", content: "Your 12-chapter case file, fast travel, and the epilogue of Biternam's first arc." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AftermathPage,
});

const REUNION: { id: string; name: string; where: string; line: string }[] = [
  { id: "wierdamoto", name: "WIERDAMOTO", where: "Outpost", line: "Bitoshi cooks. I watch the inputs. Second recipe, two signatures. Both real." },
  { id: "bitoshi", name: "BITOSHI", where: "Outpost", line: "The bait was my idea. Write that down. In ink." },
  { id: "dev9", name: "DEV9", where: "Batcave", line: "Marauder log closed. Opened a new one. Blank page. Don't touch it." },
  { id: "dabber", name: "ELEVATED DABBER", where: "Bit-Café", line: "Booth's yours. First round is on Will. He just doesn't know yet." },
  { id: "urban", name: "URBAN", where: "Island Hotel", line: "My blueprint held up in court. Wake me for the sequel." },
  { id: "bop", name: "BOP", where: "Boptimization Lab", line: "Iman's rig had 4,000 junk opcodes. I counted. Twice." },
  { id: "invest-geek", name: "INVEST GEEK", where: "Trading Post", line: "Row 1138 is now my favourite row. I made it a pivot table." },
];

function AftermathPage() {
  const heist = useServerFn(heistStatusFn);
  const voidS = useServerFn(voidStatusFn);
  const hideout = useServerFn(hideoutStatusFn);
  const [counts, setCounts] = useState<CaseCounts | null>(null);
  const [state, setState] = useState<"loading" | "out" | "ready" | "error">("loading");

  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!live) return;
      if (!data.session) { setState("out"); return; }
      try {
        const rooms = CASEBOOK.slice(2).map((c) => c.key) as ("batcave" | "island" | "vault" | "lair" | "basement" | "archive" | "holders" | "handshake" | "fortress" | "canon")[];
        const [h, v, ...rest] = await Promise.all([heist(), voidS(), ...rooms.map((room) => hideout({ data: { room } }))]);
        if (!live) return;
        if (!h.ok || !v.ok || rest.some((r) => !r.ok)) { setState("error"); return; }
        const c: CaseCounts = { heist: h.stage, void: v.count };
        rooms.forEach((room, i) => { const r = rest[i]!; c[room] = r.ok ? r.count : 0; });
        setCounts(c); setState("ready");
      } catch { if (live) setState("error"); }
    });
    return () => { live = false; };
  }, [heist, voidS, hideout]);

  const open = counts ? aftermathUnlocked(counts) : false;

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-4xl px-6 py-14 font-mono">
        <Link to="/biternam" className="text-xs text-signal hover:underline">← BITERNAM</Link>
        <div className="mt-6 text-[11px] tracking-[0.3em] text-signal">BITERNAM · ARC ONE · EPILOGUE</div>
        <h1 className="mt-2 font-display text-4xl">AFTERMATH</h1>

        {state === "loading" && <p className="mt-6 text-xs text-muted-foreground">Opening the case file…</p>}
        {state === "out" && <p className="mt-6 text-xs text-muted-foreground">Sign in to open your casebook. Progress comes from your saved account.</p>}
        {state === "error" && <p className="mt-6 text-xs text-muted-foreground">Could not load your saved progress.</p>}

        {state === "ready" && !open && (
          <div className="mt-6 rounded border border-border bg-card/40 p-5 backdrop-blur">
            <div className="text-sm text-bitcoin">CASE STILL OPEN</div>
            <p className="mt-2 text-xs text-muted-foreground">The Aftermath opens once the Canonical Block is confirmed. Finish the chapters below.</p>
          </div>
        )}

        {state === "ready" && open && (
          <>
            <div className="mt-8 rounded border border-signal/50 bg-card/40 p-5 backdrop-blur" data-testid="verdict">
              <div className="flex items-center gap-3">
                {CREW_PIXEL_AVATAR["tornado"] && <PixelFace inscriptionId={CREW_PIXEL_AVATAR["tornado"]!} label="Tornado" className="size-10 border border-signal/40" />}
                <div className="text-[11px] tracking-[0.3em] text-signal">BITMAP NEWS · ON AIR · TORNADO H. THOMPSON</div>
              </div>
              <p className="mt-3 text-sm leading-relaxed">"Verdict from the chain: the fork is orphaned. Iman signed the bait with his own address. Will printed forty thousand receipts and not one moved a sat. The Turdinals are done. Tordinals forever. Back to you, Bedrock."</p>
            </div>

            <h2 className="mt-10 font-display text-2xl">THE UNREASONABLES, REUNITED</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {REUNION.map((r) => (
                <div key={r.id} className="rounded border border-border bg-card/40 p-4 backdrop-blur">
                  <div className="flex items-center gap-3">
                    {CREW_PIXEL_AVATAR[r.id] && <PixelFace inscriptionId={CREW_PIXEL_AVATAR[r.id]!} label={r.name} className="size-10 border border-bitcoin/40" />}
                    <div>
                      <div className="font-display text-lg" data-no-translate>{r.name}</div>
                      <div className="text-[10px] tracking-[0.2em] text-signal">{r.where}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">"{r.line}"</p>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded border border-bitcoin/50 bg-card/40 p-5 backdrop-blur">
              <div className="text-[11px] tracking-[0.3em] text-bitcoin">MUSEUM · NEW EXHIBIT · CURATED BY ASTRAL</div>
              <h3 className="mt-2 font-display text-xl">THE NIGHT OF TWO SIGNATURES</h3>
              <p className="mt-2 text-xs text-muted-foreground">The shared key. The third fee address. Urban's blueprint. The bait key. The canonical proof. Five objects, one story, under glass.</p>
              <Link to="/biternam/museum" search={{ focus: "signatures" }} className="mt-3 inline-block rounded border border-bitcoin px-3 py-1.5 text-xs text-bitcoin hover:bg-bitcoin hover:text-background">[ VISIT THE EXHIBIT ]</Link>
            </div>

            <div className="mt-6 rounded border border-signal/40 bg-card/40 p-5 text-center backdrop-blur">
              <div className="text-[11px] tracking-[0.3em] text-signal">MEMORIAL</div>
              <div className="mt-2 font-display text-5xl text-signal">1138</div>
              <p className="mt-2 text-xs text-muted-foreground">Orphaned on purpose. Confirmed at last. He doesn't flicker anymore.</p>
            </div>
          </>
        )}

        {state === "ready" && counts && (
          <>
            <h2 className="mt-10 font-display text-2xl">CASEBOOK · FAST TRAVEL</h2>
            <ol className="mt-4 space-y-2">
              {CASEBOOK.map((e) => {
                const done = caseSolved(e, counts);
                return (
                  <li key={e.key}>
                    <Link to={e.to} className="flex items-start gap-3 rounded border border-border bg-card/40 p-3 backdrop-blur hover:border-signal">
                      <span className={done ? "text-signal" : "text-muted-foreground"}>{done ? "■" : "□"}</span>
                      <span className="flex-1">
                        <span className="block text-xs">{e.title}</span>
                        <span className="block text-[11px] text-muted-foreground">{done ? e.clue : "Evidence not yet recovered."}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">{Math.min(counts[e.key] ?? 0, e.total)}/{e.total}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </main>
  );
}
