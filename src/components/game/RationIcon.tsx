import {
  BriefcaseMedical,
  Candy,
  Cigarette,
  FlaskConical,
  IceCreamBowl,
  Pizza,
  Sandwich,
  Soup,
  Pill,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { FoodId } from "@/lib/world-gear";

const RATION_ICONS: Record<FoodId, LucideIcon> = {
  "ice-cream": IceCreamBowl,
  ramen: Utensils,
  "cheese-slice": Sandwich,
  candy: Candy,
  potion: FlaskConical,
  "peperoni-slice": Pizza,
  medkit: BriefcaseMedical,
  "crypto-soup": Soup,
  cigarette: Cigarette,
  "blue-pill": Pill,
};

export function RationIcon({ id, className = "size-5" }: { id: FoodId; className?: string }) {
  const Icon = RATION_ICONS[id];
  return <Icon aria-hidden="true" className={className} strokeWidth={1.7} />;
}