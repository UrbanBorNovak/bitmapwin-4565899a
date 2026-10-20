import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MuseumInterior } from "@/components/biternam/MuseumInterior";
import { TracyCom } from "@/components/game/TracyCom";
import { npcById, questStore } from "@/lib/biternam-quests";

export const Route = createFileRoute("/biternam/museum")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bit Museum Interior · Biternam Chapter 1 | BITMAPWIN" },
      { name: "description", content: "Step inside the Bit Museum: a retro fixed-camera adventure room where the curator tells chain-proven history." },
      { property: "og:title", content: "Bit Museum Interior · Biternam" },
      { property: "og:description", content: "A 1992-style adventure room in BITERNAM. Talk to the curator, then head back to the Oasis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MuseumPage,
});

function MuseumPage() {
  const curator = npcById("curator")!;
  const [call, setCall] = useState(0);
  const navigate = useNavigate();
  return (
    <main className="relative h-[calc(100vh-4rem)] min-h-[520px] bg-background">
      <MuseumInterior onCurator={() => setCall(Date.now())} onExit={() => navigate({ to: "/map" })} />
      <div className="pointer-events-none absolute left-4 top-4 font-mono">
        <div className="text-[11px] tracking-[0.3em] text-signal">BITERNAM · CHAPTER 1</div>
        <div className="font-display text-2xl text-foreground">BIT MUSEUM · ARCHIVE HALL</div>
        <div className="text-[11px] text-muted-foreground">Click the curator to talk. Click the glowing door to leave.</div>
      </div>
      <Link to="/biternam" className="absolute right-4 top-4 rounded border border-border bg-background/70 px-3 py-1 font-mono text-[11px] hover:border-signal">[ STORY ]</Link>
      {call ? (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <TracyCom key={call} script={curator.script} voice={curator.voice} onEnd={() => { questStore.record("talk", "curator"); setCall(0); }} />
        </div>
      ) : null}
    </main>
  );
}
