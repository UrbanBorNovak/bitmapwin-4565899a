/** Batcave and Island Hotel puzzle steps, recorded on the server in order. No BIT is paid for either room. */
export type HideoutRoom = "batcave" | "island";
export const HIDEOUT_STEPS: Record<HideoutRoom, readonly [string, string]> = {
  batcave: ["batcave:fuse", "batcave:computer"],
  island: ["island:coconut", "island:urban"],
};
/** Each room is its own quest id in the shared step table. */
export const hideoutQuestId = (room: HideoutRoom) => room;
/** Server step count → room state (the item is held between step 1 and 2). */
export const hideoutStateFromCount = (n: number) => ({ got: n === 1, solved: n >= 2 });
