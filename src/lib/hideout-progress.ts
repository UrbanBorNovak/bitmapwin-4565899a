/** Batcave and Island Hotel puzzle steps, recorded on the server in order. No BIT is paid for either room. */
export type HideoutRoom = "batcave" | "island" | "vault" | "lair" | "basement" | "archive" | "holders" | "handshake" | "fortress" | "canon";
export const HIDEOUT_STEPS: Record<HideoutRoom, readonly [string, string]> = {
  batcave: ["batcave:fuse", "batcave:computer"],
  island: ["island:coconut", "island:urban"],
  vault: ["vault:ledger", "vault:blueprint"],
  lair: ["lair:handle", "lair:breaker"],
  basement: ["basement:map", "basement:monument"],
  archive: ["archive:page", "archive:reader"],
  holders: ["holders:page", "holders:mirror"],
  handshake: ["handshake:trace", "handshake:table"],
  fortress: ["fortress:key", "fortress:scanner"],
  canon: ["canon:sat", "canon:node"],
};
/** Each room is its own quest id in the shared step table. */
export const hideoutQuestId = (room: HideoutRoom) => room;
/** Server step count → room state (the item is held between step 1 and 2). */
export const hideoutStateFromCount = (n: number) => ({ got: n === 1, solved: n >= 2 });
/** Rooms that open only after another room is solved on the server (story order). */
export const HIDEOUT_REQUIRES: Partial<Record<HideoutRoom, HideoutRoom>> = { vault: "island", lair: "vault", basement: "lair", archive: "basement", holders: "archive", handshake: "holders", fortress: "handshake", canon: "fortress" };
