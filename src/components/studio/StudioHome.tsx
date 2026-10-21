import { Link } from "@tanstack/react-router";
import { Boxes, Clapperboard, Code2, Hammer, Layers, Package, Store, Users } from "lucide-react";
import type { ReactNode } from "react";

type Tool = {
  title: string;
  note: string;
  icon: ReactNode;
  link: ReactNode;
};

function card(to: string, children: ReactNode, search?: Record<string, string>) {
  return { to, children, search };
}
void card;

function Section({ index, title, lead, tools }: { index: string; title: string; lead: string; tools: Tool[] }) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] text-signal" data-no-translate>{index}</span>
        <h2 className="display text-xl md:text-2xl">{title}</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{lead}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tools.map((t) => (
          <div key={t.title} className="flex flex-col border border-border bg-surface p-4 transition-colors hover:border-bitcoin">
            <div className="flex items-center gap-2 text-bitcoin">{t.icon}<span className="label">{t.title}</span></div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{t.note}</p>
            <div className="mt-4">{t.link}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const cta = "btn-term-ghost w-full justify-center";

export function StudioHome() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8 md:py-14">
      <div className="label text-bitcoin">CREATION · STUDIO</div>
      <h1 className="display mt-3 text-4xl md:text-6xl">BITMAPWIN STUDIO</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        One place to make things for Bitcoin-native worlds: build on your BITMAP, shape reusable pieces, script
        experiences and take them to market. Everything you inscribe is proven by Bitcoin, not by us.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/forge" className="btn-term">[ OPEN LAND FORGE ]</Link>
        <Link to="/studio" search={{ tool: "extenders" }} className="btn-term-ghost">[ BUILD AN EXTENDER ]</Link>
        <Link to="/create" className="btn-term-ghost">[ DESCRIBE A PLACE ]</Link>
      </div>

      <Section
        index="01"
        title="BUILD"
        lead="Shape voxel builds on BITMAPs you hold and inscribe them onto the land itself."
        tools={[
          { title: "LAND FORGE", icon: <Hammer className="h-4 w-4" />, note: "Compose builds from prefabs and community pieces, then reinscribe onto your BITMAP.", link: <Link to="/forge" className={cta}>OPEN</Link> },
          { title: "CO-FORGE", icon: <Users className="h-4 w-4" />, note: "Build together with other makers on the same canvas.", link: <Link to="/co-forge" className={cta}>OPEN</Link> },
          { title: "TINY STUDIO", icon: <Boxes className="h-4 w-4" />, note: "Quick small pieces and props for your land.", link: <Link to="/tiny-studio" className={cta}>OPEN</Link> },
          { title: "PARCEL FOUNDRY", icon: <Layers className="h-4 w-4" />, note: "One Outpost per transaction parcel, clipped to its own cells.", link: <Link to="/kennels" className={cta}>OPEN</Link> },
        ]}
      />

      <Section
        index="02"
        title="EXPERIENCES"
        lead="Script what happens on a tile: games, shops, galleries and live places."
        tools={[
          { title: "EXTENDERS", icon: <Code2 className="h-4 w-4" />, note: "Describe it in plain words, test it on a tile, publish and deploy.", link: <Link to="/studio" search={{ tool: "extenders" }} className={cta}>OPEN</Link> },
          { title: "DESCRIBE A PLACE", icon: <Package className="h-4 w-4" />, note: "Turn a sentence into a working place on your land.", link: <Link to="/create" className={cta}>OPEN</Link> },
          { title: "SDK", icon: <Code2 className="h-4 w-4" />, note: "Reference and playground for the world code.", link: <Link to="/sdk" className={cta}>READ</Link> },
          { title: "CLIPS", icon: <Clapperboard className="h-4 w-4" />, note: "Record and cut short clips of your world.", link: <Link to="/clips" className={cta}>OPEN</Link> },
        ]}
      />

      <Section
        index="03"
        title="ASSETS & MARKET"
        lead="Publish reusable pieces, browse what others made and sell what you hold."
        tools={[
          { title: "MODEL REGISTRY", icon: <Layers className="h-4 w-4" />, note: "Open BWVX pieces you can stamp into builds; makers earn royalties.", link: <Link to="/registry" className={cta}>BROWSE</Link> },
          { title: "COLLECTIONS", icon: <Boxes className="h-4 w-4" />, note: "BITMAP collections: Pixels, Emporium, Free Ross, Guardians.", link: <Link to="/collections" className={cta}>BROWSE</Link> },
          { title: "MARKETPLACE", icon: <Store className="h-4 w-4" />, note: "List and buy with wallet-signed transactions.", link: <Link to="/marketplace" className={cta}>OPEN</Link> },
          { title: "STORE KIT", icon: <Package className="h-4 w-4" />, note: "Package builds as kits for other makers.", link: <Link to="/store-kit" className={cta}>OPEN</Link> },
        ]}
      />
    </div>
  );
}
