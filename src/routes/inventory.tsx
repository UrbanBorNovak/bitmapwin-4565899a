import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthSession, accountLabel } from "@/lib/auth";
import { useWorldSkills } from "@/lib/world-skills";
import { useGear, gearSnapshot } from "@/lib/world-gear";
import { GoldBarIcon } from "@/components/GoldBarIcon";
import { BitmapPixelsCollection } from "@/components/BitmapPixelsCollection";
import { MyGuardians } from "@/components/bitmon/MyGuardians";
import { ModernInventory } from "@/components/inventory/ModernInventory";
import { readCharacter, type Character } from "@/lib/character";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Your Kit, Spoils and Rides" },
      {
        name: "description",
        content:
          "A signed-in player's personal kit: smelted gold bars, field rations, on-chain vehicles and the dual blades they carry in the Oasis.",
      },
      { property: "og:title", content: "Inventory — Your Kit, Spoils and Rides" },
      {
        property: "og:description",
        content:
          "Gold bars, cheese slices, vehicles and blades — the personal loadout a player carries through the Oasis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryPage,
});

/** The figure you walk as, kept in this browser and written on the character page. */
function useCharacter() {
  const [character, setCharacter] = useState<Character | null>(null);
  useEffect(() => {
    setCharacter(readCharacter());
    const onChange = (event: Event) => setCharacter((event as CustomEvent<Character>).detail);
    window.addEventListener("bitmapwin:character", onChange);
    return () => window.removeEventListener("bitmapwin:character", onChange);
  }, []);
  return character;
}

function InventoryPage() {
  const { user, loading } = useAuthSession();
  const skills = useWorldSkills();
  const gear = useGear();
  const character = useCharacter();

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-20 md:px-8">
        <p className="label">INVENTORY</p>
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          &gt; CHECKING YOUR SESSION<span className="blink">_</span>
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-20 md:px-8">
        <p className="label">INVENTORY</p>
        <h1 className="display mt-4 text-4xl md:text-6xl">YOUR KIT</h1>
        <p className="mt-4 max-w-[70ch] font-mono text-sm text-muted-foreground">
          &gt; YOUR GOLD BARS, RATIONS, RIDES AND BLADES ARE YOURS — SIGN IN TO OPEN YOUR KIT
          <span className="blink">_</span>
        </p>
        <Link to="/auth" className="btn-term mt-8 inline-flex">
          [ SIGN IN ]
        </Link>
      </div>
    );
  }

  const bars = skills.items["gold-bar"];
  const nuggets = skills.items["gold-nugget"];
  const buff = gear.buff && gear.buff.until > Date.now() ? gear.buff : null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">INVENTORY</p>
          <h1 className="display mt-3 text-4xl md:text-6xl">YOUR KIT</h1>
        </div>
        <Link to="/oasis" className="btn-term inline-flex">
          [ CLOSE · ENTER THE OASIS ]
        </Link>
      </div>
      <p className="mt-4 max-w-[70ch] font-mono text-sm text-muted-foreground">
        &gt; WHAT YOU CARRY THROUGH THE OASIS, KEPT IN YOUR OWN PACK<span className="blink">_</span>
      </p>

      <section className="mt-8 grid grid-cols-2 border border-border md:grid-cols-4">
        <Stat k="GOLD BARS" v={String(bars)} icon />
        <Stat k="GOLD NUGGETS" v={`${nuggets} / 4 TO A BAR`} />
        <Stat k="PACK LOAD" v={`${skills.carried} / 28`} />
        <Stat k="ACTIVE BUFF" v={buff ? buff.label : "NONE"} />
      </section>

      <div className="mt-4">
        <ModernInventory who={accountLabel(user)} character={character} />
      </div>

      <MyGuardians />
      <BitmapPixelsCollection />

      <p className="mt-8 font-mono text-[11px] text-muted-foreground">
        &gt; YOUR KIT IS PERSONAL PLAY STATE — SPOILS LIVE IN YOUR BROWSER, THE MODELS THEMSELVES ARE ON-CHAIN
        <span className="blink">_</span>
      </p>
      <Link to="/character" className="btn-term mt-6 inline-flex">
        [ {character ? "EDIT CHARACTER" : "CREATE CHARACTER"} ]
      </Link>
    </div>
  );
}

function Stat({ k, v, icon }: { k: string; v: string; icon?: boolean }) {
  return (
    <div className="border-r border-b border-border p-5 last:border-r-0">
      <div className="label flex items-center gap-1.5">
        {icon ? <GoldBarIcon size={12} /> : null}
        {k}
      </div>
      <div className="display mt-2 text-lg break-all">{v}</div>
    </div>
  );
}

// Touch the gear snapshot so the buff countdown reads fresh on first render.
void gearSnapshot;
