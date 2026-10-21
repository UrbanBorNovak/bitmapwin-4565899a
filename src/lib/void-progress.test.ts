import { describe, expect, it } from "vitest";
import { VOID_STEPS, voidStateFromCount } from "./void-progress";

describe("void progress", () => {
  it("has three ordered steps", () => expect(VOID_STEPS).toEqual(["void:ghost", "void:block", "void:confirm"]));
  it("block is held only between pickup and confirm", () => {
    expect(voidStateFromCount(1)).toEqual({ heard: true, hasBlock: false, confirmed: false });
    expect(voidStateFromCount(2).hasBlock).toBe(true);
    expect(voidStateFromCount(3)).toEqual({ heard: true, hasBlock: false, confirmed: true });
  });
});
