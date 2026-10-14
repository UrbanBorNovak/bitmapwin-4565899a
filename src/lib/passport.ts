import type { Json } from "@/integrations/supabase/types";

export type ProofLevel = "CHAIN" | "WORLD" | "ACCOUNT";
export type StampKey = "first-arrival" | "world-walker" | "first-mark" | "builder" | "land-steward" | "deployer" | "participant" | "historian" | "emporium-resident";
export type BuildCapability = "build.trail-marker" | "build.oasis-waystation" | "build.fortified-camp" | "build.district-gate";

export type ProvenanceEvent = {
  id: string; sourceKey: string; eventType: string; actorWallet: string | null;
  bitmapHeight: number | null; sourceType: string; sourceId: string; proofLevel: ProofLevel;
  title: string; summary: string; metadata: Json; occurredAt: string;
};
export type PassportStamp = {
  id: string; walletAddress: string; stampKey: StampKey; name: string; description: string;
  evidenceEventId: string; evidenceSourceType: string; evidenceSourceId: string;
  bitmapHeight: number | null; ruleVersion: number; inscriptionId: string | null; earnedAt: string;
};
export type PassportUnlock = {
  id: string; walletAddress: string; capabilityKey: BuildCapability; name: string;
  description: string; grantedByStampId: string; grantedAt: string;
};
export type Passport = { wallet: string | null; events: ProvenanceEvent[]; stamps: PassportStamp[]; unlocks: PassportUnlock[] };

export const STAMP_RULES: Record<StampKey, { name: string; description: string }> = {
  "first-arrival": { name: "FIRST ARRIVAL", description: "Entered a recorded BITMAP with a verified wallet." },
  "world-walker": { name: "WORLD WALKER", description: "Explored five distinct BITMAPs." },
  "first-mark": { name: "FIRST MARK", description: "Placed a persistent structure in the Oasis." },
  builder: { name: "BUILDER", description: "Maintained three persistent structures or built across two BITMAPs." },
  "land-steward": { name: "LAND STEWARD", description: "Created persistent history on a BITMAP held by this wallet." },
  deployer: { name: "DEPLOYER", description: "Activated an Extender on a BITMAP." },
  participant: { name: "PARTICIPANT", description: "Joined a recorded trade, lease, event, clan action, or duel." },
  historian: { name: "HISTORIAN", description: "Created verified history across four kinds of activity." },
  "emporium-resident": { name: "EMPORIUM RESIDENT", description: "Historical record: this wallet held a Resident portrait or valid parcel of 717328.BITMAP (Bitmap Emporium) when verified on chain. Current holding is checked live." },
};
export const UNLOCK_RULES: Record<BuildCapability, { name: string; description: string; stamp: StampKey }> = {
  "build.trail-marker": { name: "TRAIL MARKER", description: "A roadside marker for future travelers.", stamp: "first-arrival" },
  "build.oasis-waystation": { name: "OASIS WAYSTATION", description: "A welcoming fire, shelter, and marker.", stamp: "first-mark" },
  "build.fortified-camp": { name: "FORTIFIED CAMP", description: "A defended camp with walls and a watchtower.", stamp: "builder" },
  "build.district-gate": { name: "DISTRICT GATE", description: "A ceremonial gateway for established territory.", stamp: "land-steward" },
};
export function eventHref(event: ProvenanceEvent) {
  if (event.bitmapHeight !== null) return `/bitmap/${event.bitmapHeight}`;
  if (event.actorWallet) return `/profile/${event.actorWallet}`;
  return "/stream";
}
