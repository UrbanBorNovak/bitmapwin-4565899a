import { satToBlock } from "@/lib/sat-rarity";

export type HybridTribute = { id: string; label: string; note: string };

const pal = (n: number) => { const s = String(n); return s.length >= 3 && s === [...s].reverse().join(""); };

/** Block + sat combinations; each is a pure fact of (height, sat). */
export function hybridTributes(height: number, sat: number): HybridTribute[] {
  const mined = satToBlock(sat).height;
  const out: HybridTribute[] = [];
  if (pal(height) && pal(sat)) out.push({ id: "dual-palindrome", label: "DUAL PALINDROME", note: "Palindrome block on a palindrome sat." });
  if (height < 1_000 && mined < 1_000) out.push({ id: "vintage-on-vintage", label: "VINTAGE ON VINTAGE", note: "Sub-1K block inscribed on a sat mined before block 1,000." });
  if (mined === height) out.push({ id: "native-sat", label: "NATIVE SAT", note: "The sat was mined in this very block." });
  return out;
}
