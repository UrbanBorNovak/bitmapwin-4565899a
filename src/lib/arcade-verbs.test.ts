import { describe, expect, it } from "vitest";
import { feeOrderCorrect, HASH_TARGET, resolveArcadeVerb, toyHash } from "./arcade-verbs";

const none = { feeWon: false, hashWon: false, prize: false };

describe("mempool arcade", () => {
  it("fee sorter wants highest fee rate first", () => {
    expect(feeOrderCorrect([118, 66, 42, 23, 7])).toBe(true);
    expect(feeOrderCorrect([7, 23, 42, 66, 118])).toBe(false);
  });
  it("hash target can be reached", () => {
    expect(Array.from({ length: 256 }, (_, i) => toyHash(i)).includes(HASH_TARGET)).toBe(true);
  });
  it("prize needs both high scores", () => {
    expect(resolveArcadeVerb("pickup", "prize", { ...none, feeWon: true }).effect).toBeNull();
    expect(resolveArcadeVerb("pickup", "prize", { ...none, feeWon: true, hashWon: true }).effect).toBe("prize");
  });
  it("opening the claw machine zaps you", () => {
    expect(resolveArcadeVerb("open", "claw", none).effect).toBe("zap");
  });
});
