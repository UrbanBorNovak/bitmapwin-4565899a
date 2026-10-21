/** Mempool Void puzzle chain, recorded on the server in order. No BIT is paid for the Void. */
export const VOID_QUEST_ID = "void";
export const VOID_STEPS = ["void:ghost", "void:block", "void:confirm"] as const;
export type VoidSave = { heard: boolean; hasBlock: boolean; confirmed: boolean };
/** Server step count → room state (the block is held between step 2 and 3). */
export const voidStateFromCount = (n: number): VoidSave => ({ heard: n >= 1, hasBlock: n === 2, confirmed: n >= 3 });
