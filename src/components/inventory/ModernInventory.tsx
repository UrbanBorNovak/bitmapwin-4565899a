/**
 * MODERN INVENTORY — a three-panel kit screen: character, bag, crafting.
 *
 * Presentation only. Every number comes from the same personal play state the
 * Oasis already keeps (skill book, backpack, worn gear); nothing here invents
 * items and nothing here claims chain ownership. Gear slots flip the same
 * switches the in-world shelf uses, so what you toggle is what you walk with.
 */

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Boxes,
  CircleDot,
  Flame,
  Footprints,
  Gem,
  Glasses,
  Hammer,
  HardHat,
  Search,
  Shapes,
  Sparkles,
  Swords,
  ToyBrick,
  Utensils,
  Watch,
} from "lucide-react";
import { ITEM_LABELS, BACKPACK_SLOTS, SKILL_LABELS, useWorldSkills, type ItemId, type SkillId } from "@/lib/world-skills";
import {
  FOODS,
  toggleComic,
  toggleGoggles,
  toggleNecklace,
  toggleRing,
  toggleShoes,
  toggleWatch,
  cycleToy,
  cycleCompanion,
  toySpec,
  companionSpec,
  useGear,
} from "@/lib/world-gear";
import { BAR_COST } from "@/lib/world-smelt";
import { STRUCTURES } from "@/lib/world-build";
import { RIDES } from "@/lib/world-vehicle";
import { SWORD_INSCRIPTION, SWORD_TWO_INSCRIPTION } from "@/components/game/weapons";
import { ordContentUrl } from "@/lib/oci";
import { GoldBarIcon } from "@/components/GoldBarIcon";
import { RationIcon } from "@/components/game/RationIcon";
import { CharacterPortrait } from "@/components/game/CharacterPortrait";
import type { Character } from "@/lib/character";

/** Short tile glyphs so every backpack stack reads at a glance. */
const ITEM_GLYPH: Record<ItemId, string> = {
  "gold-bar": "BAR",
  "gold-nugget": "NUG",
  mineral: "MIN",
  "ore-chunk": "ORE",
  hide: "HID",
  fang: "FNG",
  relic: "RLC",
  key: "KEY",
};

const BAG_ORDER: ItemId[] = ["gold-bar", "gold-nugget", "mineral", "ore-chunk", "hide", "fang", "relic", "key"];

type Recipe = {
  id: string;
  name: string;
  blurb: string;
  cost: Partial<Record<ItemId, number>>;
  group: "FURNACE" | "BY HAND" | "FIELD RATIONS";
  where: string;
};

export function ModernInventory({ who, character }: { who: string; character: Character | null }) {
  const skills = useWorldSkills();
  const gear = useGear();
  const [query, setQuery] = useState("");

  const recipes = useMemo<Recipe[]>(() => {
    const smelt: Recipe = {
      id: "gold-bar",
      name: "SOLID GOLD BAR",
      blurb: "Melt mined nuggets down into one solid bar.",
      cost: BAR_COST,
      group: "FURNACE",
      where: "STAND AT A SMELTING FURNACE",
    };
    const built = STRUCTURES.map((structure) => ({
      id: structure.id,
      name: structure.name,
      blurb: structure.blurb,
      cost: structure.cost,
      group: "BY HAND" as const,
      where: "PLACE ON OPEN GROUND IN THE OASIS",
    }));
    const rations = Object.values(FOODS).map((food) => ({
      id: `ration-${food.id}`,
      name: food.label,
      blurb: `+${food.bite} HP A BITE · ${food.buff.label} FOR ${Math.round(food.buff.ms / 1000)}S`,
      cost: {},
      group: "FIELD RATIONS" as const,
      where: "OPEN RATIONS IN THE OASIS WITH E",
    }));
    return [smelt, ...built, ...rations];
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (!needle) return recipes;
    return recipes.filter(
      (recipe) =>
        recipe.name.includes(needle) ||
        recipe.blurb.toUpperCase().includes(needle) ||
        Object.keys(recipe.cost).some((item) => ITEM_LABELS[item as ItemId].includes(needle)),
    );
  }, [recipes, query]);

  const [selectedId, setSelectedId] = useState<string>("gold-bar");
  const selected = filtered.find((recipe) => recipe.id === selectedId) ?? filtered[0] ?? null;

  const canMake = (recipe: Recipe) =>
    Object.entries(recipe.cost).every(([item, amount]) => skills.items[item as ItemId] >= (amount ?? 0));

  const slots: { key: string; label: string; Icon: typeof Glasses; on: boolean; toggle: () => void; note: string }[] = [
    { key: "head", label: "GOGGLES", Icon: Glasses, on: gear.goggles, toggle: toggleGoggles, note: "NIGHT VISION" },
    { key: "neck", label: "NECKLACE", Icon: Gem, on: gear.necklace, toggle: toggleNecklace, note: "STEADIER RECOVERY" },
    { key: "wrist", label: "WATCH", Icon: Watch, on: gear.watch, toggle: toggleWatch, note: "WORN AT THE WRIST" },
    { key: "ring", label: "RING", Icon: CircleDot, on: gear.ring, toggle: toggleRing, note: "WORN ON THE HAND" },
    { key: "feet", label: "DESERT SHOES", Icon: Footprints, on: gear.shoes, toggle: toggleShoes, note: "QUICKER STRIDE" },
    { key: "pack", label: "COMIC", Icon: HardHat, on: gear.comic, toggle: toggleComic, note: "CARRIED READING" },
  ];

  const toy = toySpec(gear.toy);
  const pet = companionSpec(gear.companion);

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
      {/* ─────────── CHARACTER ─────────── */}
      <section className="border border-border bg-card">
        <Panel title="CHARACTER" />
        <div className="border-b border-border">
          <CharacterPortrait model={character?.avatarModel ?? null} className="h-64" />
        </div>
        <div className="p-4">
          <p className="display text-sm">{character?.name?.trim() || "UNNAMED DRIFTER"}</p>
          <p className="label mt-1 text-bitcoin">{character?.title ?? "NO SHEET WRITTEN YET"}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{who}</p>
        </div>

        <div className="border-t border-border p-4">
          <p className="label">WORN</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {slots.map((slot) => (
              <button
                key={slot.key}
                type="button"
                onClick={slot.toggle}
                title={`${slot.label} — ${slot.note}`}
                className={`flex aspect-square flex-col items-center justify-center gap-1 border text-[8px] uppercase tracking-[0.12em] transition-colors ${
                  slot.on
                    ? "border-bitcoin bg-bitcoin/10 text-bitcoin"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                <slot.Icon className="size-4" />
                <span className="px-1 text-center leading-tight">{slot.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={cycleToy}
              className="flex items-center gap-2 border border-border p-2 text-left text-[9px] uppercase tracking-[0.12em] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            >
              <ToyBrick className="size-3.5 shrink-0" />
              <span className="truncate">{toy.label}</span>
            </button>
            <button
              type="button"
              onClick={cycleCompanion}
              className="flex items-center gap-2 border border-border p-2 text-left text-[9px] uppercase tracking-[0.12em] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            >
              <Sparkles className="size-3.5 shrink-0" />
              <span className="truncate">{pet.label}</span>
            </button>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <p className="label">SKILLS</p>
          <ul className="mt-3 space-y-3">
            {(Object.keys(SKILL_LABELS) as SkillId[]).map((id) => {
              const skill = skills.skills[id];
              const pct = Math.min(100, Math.round((skill.intoLevel / skill.nextLevel) * 100));
              return (
                <li key={id}>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[11px] uppercase text-foreground">{SKILL_LABELS[id]}</span>
                    <span className="display text-sm">{skill.level}</span>
                  </div>
                  <div className="mt-1 h-[3px] w-full bg-border">
                    <div className="h-full bg-bitcoin" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                    {skill.intoLevel} / {skill.nextLevel} XP INTO LEVEL
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ─────────── BAG ─────────── */}
      <section className="border border-border bg-card">
        <Panel title="BAG" />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <p className="label flex items-center gap-2">
            <Boxes className="size-3.5" /> BACKPACK
          </p>
          <p className="font-mono text-xs">
            <span className={skills.full ? "text-bitcoin" : "text-foreground"}>{skills.carried}</span>
            <span className="text-muted-foreground"> / {BACKPACK_SLOTS} SLOTS</span>
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-6 lg:grid-cols-8">
          {BAG_ORDER.map((item) => {
            const count = skills.items[item];
            return (
              <div
                key={item}
                title={ITEM_LABELS[item]}
                className={`relative flex aspect-square flex-col items-center justify-center gap-1 border ${
                  count > 0 ? "border-border bg-secondary/30" : "border-dashed border-border/60"
                }`}
              >
                {item === "gold-bar" ? (
                  <GoldBarIcon size={16} />
                ) : (
                  <span className={`font-mono text-[10px] ${count > 0 ? "text-bitcoin" : "text-muted-foreground/50"}`}>
                    {ITEM_GLYPH[item]}
                  </span>
                )}
                <span className={`display text-sm ${count > 0 ? "" : "text-muted-foreground/40"}`}>{count}</span>
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-bitcoin/60" style={{ opacity: count > 0 ? 1 : 0 }} />
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, 24 - BAG_ORDER.length) }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square border border-dashed border-border/40" />
          ))}
        </div>

        <div className="border-t border-border p-4">
          <p className="label flex items-center gap-2">
            <Utensils className="size-3.5" /> FIELD RATIONS
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.values(FOODS).map((food) => {
              const active = gear.eating?.food === food.id;
              return (
                <div
                  key={food.id}
                  className={`flex items-center gap-3 border p-3 ${active ? "border-bitcoin" : "border-border"}`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center border border-border text-bitcoin">
                    <RationIcon id={food.id} className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="display truncate text-xs">{food.label}</p>
                    <p className="label mt-0.5 truncate">
                      +{food.bite} HP · {food.buff.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border p-4">
          <p className="label flex items-center gap-2">
            <Shapes className="size-3.5" /> RIDES — ON-CHAIN
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {RIDES.map((ride) => (
              <a
                key={ride.id}
                href={ordContentUrl(ride.inscription)}
                target="_blank"
                rel="noreferrer"
                className="border border-border p-3 hover:border-bitcoin"
              >
                <p className="display text-xs">{ride.label}</p>
                <p className="label mt-1">
                  {ride.kind === "ground" ? "LAND" : ride.kind === "water" ? "SEA ONLY" : "FLIES"} · {ride.speed}× WALK
                </p>
              </a>
            ))}
          </div>
        </div>

        <div className="border-t border-border p-4">
          <p className="label flex items-center gap-2">
            <Swords className="size-3.5" /> HOTBAR — BLADES IN HAND
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { label: "RIGHT-HAND BLADE", inscription: SWORD_INSCRIPTION },
              { label: "LEFT-HAND BLADE", inscription: SWORD_TWO_INSCRIPTION },
            ].map((blade) => (
              <a
                key={blade.inscription}
                href={ordContentUrl(blade.inscription)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 border border-border p-3 hover:border-bitcoin"
              >
                <span className="display text-xs">{blade.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {blade.inscription.slice(0, 6)}…{blade.inscription.slice(-4)}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── CRAFTING ─────────── */}
      <section className="border border-border bg-card">
        <Panel title="CRAFTING" />
        <label className="flex items-center gap-2 border-b border-border p-3">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="SEARCH RECIPES OR MATERIALS"
            className="w-full bg-transparent font-mono text-[11px] uppercase tracking-[0.1em] outline-none placeholder:text-muted-foreground/60"
          />
        </label>

        <div className="max-h-[420px] overflow-y-auto">
          {(["FURNACE", "BY HAND", "FIELD RATIONS"] as const).map((group) => {
            const rows = filtered.filter((recipe) => recipe.group === group);
            if (!rows.length) return null;
            return (
              <div key={group}>
                <p className="label border-b border-border bg-secondary/20 px-3 py-2">{group}</p>
                <ul>
                  {rows.map((recipe) => {
                    const ready = canMake(recipe);
                    const active = selected?.id === recipe.id;
                    return (
                      <li key={recipe.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(recipe.id)}
                          className={`flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-left ${
                            active ? "bg-bitcoin/10" : "hover:bg-secondary/20"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {recipe.group === "FURNACE" ? (
                              <Flame className="size-3.5 shrink-0 text-bitcoin" />
                            ) : recipe.group === "FIELD RATIONS" ? (
                              <Utensils className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <Hammer className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="display truncate text-[11px]">{recipe.name}</span>
                          </span>
                          <span
                            className={`shrink-0 font-mono text-[9px] uppercase ${
                              Object.keys(recipe.cost).length === 0
                                ? "text-muted-foreground"
                                : ready
                                  ? "text-bitcoin"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {Object.keys(recipe.cost).length === 0 ? "IN PACK" : ready ? "MATERIALS OK" : "SHORT"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {selected ? (
          <div className="border-t border-border p-4">
            <p className="display text-lg">{selected.name}</p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">{selected.blurb}</p>

            {Object.keys(selected.cost).length ? (
              <ul className="mt-4 space-y-2">
                {(Object.entries(selected.cost) as [ItemId, number][]).map(([item, amount]) => {
                  const have = skills.items[item];
                  const ok = have >= amount;
                  return (
                    <li key={item} className="flex items-center justify-between border border-border px-3 py-2">
                      <span className="font-mono text-[11px] uppercase">{ITEM_LABELS[item]}</span>
                      <span className={`font-mono text-[11px] ${ok ? "text-bitcoin" : "text-muted-foreground"}`}>
                        {have} / {amount}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 border border-border p-3 font-mono text-[10px] text-muted-foreground">
                &gt; NO MATERIALS NEEDED — THIS IS ALREADY IN YOUR PACK
              </p>
            )}

            <p className="label mt-4 text-bitcoin">{selected.where}</p>
            <Link to="/oasis" className="btn-term mt-3 inline-flex w-full justify-center">
              [ ENTER THE OASIS TO CRAFT ]
            </Link>
            <p className="mt-3 font-mono text-[9px] leading-relaxed text-muted-foreground">
              &gt; CRAFTING HAPPENS WHERE YOU STAND — AT A FURNACE, OR ON THE GROUND YOU BUILD ON
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Panel({ title }: { title: string }) {
  return (
    <header className="border-b border-border bg-secondary/30 px-4 py-2.5">
      <h2 className="display text-sm tracking-[0.18em]">{title}</h2>
    </header>
  );
}
