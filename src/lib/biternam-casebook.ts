import { HEIST_STEPS } from "@/lib/void-heist";
import { VOID_STEPS } from "@/lib/void-progress";
import { HIDEOUT_STEPS } from "@/lib/hideout-progress";

export type CaseKey = "heist" | "void" | "batcave" | "island" | "vault" | "lair" | "basement" | "archive" | "holders" | "handshake" | "fortress" | "canon" | "receipt";
export type CaseEntry = { key: CaseKey; title: string; to: string; total: number; clue: string };

/** Story-ordered case file; each clue is the evidence that chapter put on the record. */
export const CASEBOOK: CaseEntry[] = [
  { key: "heist", title: "CH.4 · THE VOID HEIST", to: "/biternam/arcade", total: HEIST_STEPS.length, clue: "Seven rooms, one chain of items. The trapdoor opens." },
  { key: "void", title: "THE MEMPOOL VOID", to: "/biternam/void", total: VOID_STEPS.length, clue: "The ghost of 1138 speaks: he was orphaned on purpose." },
  { key: "batcave", title: "DEV9'S BATCAVE", to: "/biternam/batcave", total: HIDEOUT_STEPS.batcave.length, clue: "The Marauder log names a second hand in the fork." },
  { key: "island", title: "URBAN'S ISLAND HOTEL", to: "/biternam/island", total: HIDEOUT_STEPS.island.length, clue: "Urban's real blueprint, hidden under a hangover." },
  { key: "vault", title: "CH.5 · BENEATH 1138", to: "/biternam/vault", total: HIDEOUT_STEPS.vault.length, clue: "Forty thousand forged confirmations. Will's printer." },
  { key: "lair", title: "CH.6 · THE RE-ORG LAIR", to: "/biternam/lair", total: HIDEOUT_STEPS.lair.length, clue: "The siphon breaks. The rig was real hashpower." },
  { key: "basement", title: "CH.7 · THE VOID BASEMENT", to: "/biternam/basement", total: HIDEOUT_STEPS.basement.length, clue: "Will's map: fake tiles over real Bedrock." },
  { key: "archive", title: "CH.8 · THE MISSING PAGES", to: "/biternam/archive", total: HIDEOUT_STEPS.archive.length, clue: "Page Two: the list of BITMAPs they meant to copy." },
  { key: "holders", title: "CH.9 · PAGE THREE", to: "/biternam/holders", total: HIDEOUT_STEPS.holders.length, clue: "A drawn signature moves no sat. Page Three goes blank." },
  { key: "handshake", title: "CH.10 · THE HANDSHAKE", to: "/biternam/handshake", total: HIDEOUT_STEPS.handshake.length, clue: "Row 1138: a third address paid the fee. Iman's pattern." },
  { key: "fortress", title: "CH.11 · THE KEY FORTRESS", to: "/biternam/fortress", total: HIDEOUT_STEPS.fortress.length, clue: "The bait key. Limitless takes it straight to Iman." },
  { key: "canon", title: "CH.12 · THE CANONICAL BLOCK", to: "/biternam/canon", total: HIDEOUT_STEPS.canon.length, clue: "Iman signed the bait with his own address. Fork orphaned." },
  { key: "receipt", title: "CH.13 · THE MARSHAL'S RECEIPT", to: "/biternam/receipt", total: HIDEOUT_STEPS.receipt.length, clue: "Wierdamoto's old signature. UNPAID: ONE MEMORY. BENEFICIARY: THE DARKSIDE." },
];

export type CaseCounts = Partial<Record<CaseKey, number>>;

export function caseSolved(e: CaseEntry, counts: CaseCounts): boolean {
  return (counts[e.key] ?? 0) >= e.total;
}

/** The Aftermath opens only once the Canonical Block is fully solved on the account. */
export function aftermathUnlocked(counts: CaseCounts): boolean {
  return caseSolved(CASEBOOK.find((c) => c.key === "canon")!, counts);
}
