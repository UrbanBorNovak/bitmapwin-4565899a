/**
 * BITERNAM BACKROOMS — the Ch.5 Vault and Ch.6 Lair open only with a Shadow
 * Vault pass. The pass is earned by solving the previous room (checked on the
 * server) and then lives only on this device; entry checks its fingerprint.
 */
import type { HideoutRoom } from "@/lib/hideout-progress";

export const BACKROOMS: Partial<Record<HideoutRoom, { slug: string; earnedBy: HideoutRoom; earnedByName: string; title: string }>> = {
  vault: { slug: "biternam-backroom-vault", earnedBy: "island", earnedByName: "URBAN'S ISLAND HOTEL", title: "THE 1138 BACKROOM" },
  lair: { slug: "biternam-backroom-lair", earnedBy: "vault", earnedByName: "CH.5 · BENEATH 1138", title: "THE RE-ORG BACKROOM" },
};

export const backroomFor = (room: HideoutRoom) => BACKROOMS[room] ?? null;
/** A pass is earned once the earning room has both its steps recorded. */
export const earnedFrom = (stepCount: number) => stepCount >= 2;
