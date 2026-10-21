import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Hammer, Layers, Users } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/build")({
  head: () => ({
    meta: [
      { title: "Build on your BITMAP — BITMAPWIN Studio" },
      { name: "description", content: "One starting point for building on BITMAP land: solo in Land Forge, with your crew, lightweight pieces, or from your parcel's Outpost." },
      { property: "og:title", content: "Build on your BITMAP — BITMAPWIN Studio" },
      { property: "og:description", content: "Choose how to build: solo, with crew, lightweight, or start from your parcel's Outpost." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildChooser,
});

type Choice = { key: string; title: string; icon: ReactNode; note: string; tool: string; to: "/forge" | "/co-forge" | "/tiny-studio" | "/kennels" };

const CHOICES: Choice[] = [
  { key: "solo", title: "SOLO", icon: <Hammer className="h-5 w-5" />, tool: "Land Forge", to: "/forge", note: "Compose a full build on a BITMAP you hold from prefabs and community pieces, then reinscribe it onto the land." },
  { key: "crew", title: "WITH CREW", icon: <Users className="h-5 w-5" />, tool: "Co-Forge", to: "/co-forge", note: "Build together with other makers on the same canvas in real time." },
  { key: "light", title: "LIGHTWEIGHT", icon: <Boxes className="h-5 w-5" />, tool: "Tiny Studio", to: "/tiny-studio", note: "Make quick small pieces and props without opening the full forge." },
  { key: "outpost", title: "START FROM MY PARCEL'S OUTPOST", icon: <Layers className="h-5 w-5" />, tool: "Parcel Foundry", to: "/kennels", note: "One Outpost per transaction parcel, clipped to its own cells on the BITMAP." },
];

function BuildChooser() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-28 pt-10 md:px-8 md:py-14">
      <Link to="/studio" className="label -ml-2 inline-block px-2 py-3 text-muted-foreground hover:text-bitcoin">← STUDIO</Link>
      <div className="label mt-4 text-bitcoin">BUILD · LAND FORGE</div>
      <h1 className="display mt-3 text-4xl md:text-5xl">HOW DO YOU WANT TO BUILD?</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Pick a starting point. Each choice opens the same tool you already know, with every feature intact.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {CHOICES.map((c) => (
          <Link key={c.key} to={c.to} className="group flex flex-col border border-border bg-surface p-5 transition-colors hover:border-bitcoin">
            <div className="flex items-center gap-2 text-bitcoin">{c.icon}<span className="label">{c.title}</span></div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{c.note}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-[10px] text-signal">OPENS {c.tool.toUpperCase()}</span>
              <span className="btn-term-ghost group-hover:border-bitcoin">OPEN</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
