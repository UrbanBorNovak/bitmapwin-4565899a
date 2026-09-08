import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthSession, accountLabel } from "@/lib/auth";
import { useWorldSkills, ITEM_LABELS, type ItemId } from "@/lib/world-skills";
import { FOODS, useGear, gearSnapshot } from "@/lib/world-gear";
import { RIDES } from "@/lib/world-vehicle";
import { SWORD_INSCRIPTION, SWORD_TWO_INSCRIPTION } from "@/components/game/weapons";
import { ordContentUrl } from "@/lib/oci";

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

/** Backpack spoils worth surfacing, in the order a miner thinks about them. */
const SPOIL_ORDER: ItemId[] = ["gold-bar", "gold-nugget", "mineral", "ore-chunk", "hide", "fang", "relic", "key"];

function InventoryPage() {
  const { user, loading } = useAuthSession();
  const skills = useWorldSkills();
  const gear = useGear();

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
  const eating = gear.eating ? FOODS[gear.eating.food] : null;
  const buff = gear.buff && gear.buff.until > Date.now() ? gear.buff : null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-8">
      <p className="label">INVENTORY</p>
      <h1 className="display mt-4 text-4xl md:text-6xl">YOUR KIT</h1>
      <p className="mt-4 max-w-[70ch] font-mono text-sm text-muted-foreground">
        &gt; {accountLabel(user)} — WHAT YOU CARRY THROUGH THE OASIS, KEPT IN YOUR OWN PACK
        <span className="blink">_</span>
      </p>

      <section className="mt-10 grid grid-cols-2 border border-border md:grid-cols-4">
        <Stat k="GOLD BARS" v={String(bars)} />
        <Stat k="GOLD NUGGETS" v={`${nuggets} / 4 TO A BAR`} />
        <Stat k="PACK LOAD" v={`${skills.carried} / 28`} />
        <Stat k="ACTIVE BUFF" v={buff ? buff.label : "NONE"} />
      </section>

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">SPOILS</h2>
          <p className="label mt-2">MINED, HUNTED AND SMELTED — YOUR BACKPACK</p>
        </header>
        <ul className="grid grid-cols-2 divide-border sm:grid-cols-4">
          {SPOIL_ORDER.map((item) => (
            <li key={item} className="border-b border-r border-border p-5">
              <p className="label">{ITEM_LABELS[item]}</p>
              <p className="display mt-2 text-2xl">{skills.items[item]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">FIELD RATIONS</h2>
          <p className="label mt-2">EAT IN THE WORLD WITH U — A BITE HEALS, A MEAL BUFFS</p>
        </header>
        <ul className="divide-y divide-border">
          {Object.values(FOODS).map((food) => {
            const active = eating?.id === food.id;
            return (
              <li key={food.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="display text-sm">{food.label}</p>
                  <p className="label mt-1">
                    +{food.bite} HP A BITE · {food.buff.label} FOR {Math.round(food.buff.ms / 1000)}S
                  </p>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {active ? "EATING NOW…" : "IN YOUR PACK"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">RIDES</h2>
          <p className="label mt-2">ON-CHAIN VEHICLES YOU CAN CALL ANYWHERE IN THE OASIS</p>
        </header>
        <ul className="divide-y divide-border">
          {RIDES.map((ride) => (
            <li key={ride.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="display text-sm">{ride.label}</p>
                <p className="label mt-1">
                  {ride.kind === "ground" ? "LAND" : ride.kind === "water" ? "SEA ONLY" : "FLIES"} ·{" "}
                  {ride.speed}× WALK SPEED
                </p>
              </div>
              <a
                href={ordContentUrl(ride.inscription)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-bitcoin"
              >
                {ride.inscription.slice(0, 10)}…{ride.inscription.slice(-4)}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">BLADES</h2>
          <p className="label mt-2">DUAL BLADES — ONE ON-CHAIN SWORD PER HAND</p>
        </header>
        <ul className="divide-y divide-border">
          {[
            { label: "RIGHT-HAND BLADE", inscription: SWORD_INSCRIPTION },
            { label: "LEFT-HAND BLADE", inscription: SWORD_TWO_INSCRIPTION },
          ].map((blade) => (
            <li key={blade.inscription} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="display text-sm">{blade.label}</p>
              <a
                href={ordContentUrl(blade.inscription)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-bitcoin"
              >
                {blade.inscription.slice(0, 10)}…{blade.inscription.slice(-4)}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 font-mono text-[11px] text-muted-foreground">
        &gt; YOUR KIT IS PERSONAL PLAY STATE — SPOILS LIVE IN YOUR BROWSER, THE MODELS THEMSELVES ARE ON-CHAIN
        <span className="blink">_</span>
      </p>
      <Link to="/map" className="btn-term mt-6 inline-flex">
        [ ENTER THE OASIS ]
      </Link>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-r border-b border-border p-5 last:border-r-0">
      <div className="label">{k}</div>
      <div className="display mt-2 text-lg break-all">{v}</div>
    </div>
  );
}

// Touch the gear snapshot so the buff countdown reads fresh on first render.
void gearSnapshot;
