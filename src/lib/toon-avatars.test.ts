import { describe, expect, it } from "vitest";
import { isAvatar, limbPose } from "./toon-avatars";
import { parseEpisode } from "./toon-script";

const ep = (avatar: unknown, pose = "wave") => JSON.stringify({ title: "t", aspect: "16:9", scenes: [{ block: 1, duration: 3, shot: "wide", lines: [], cast: [{ height: 1, name: "a", x: 0, z: 0, pose, avatar }] }] });

describe("toon avatars", () => {
  it("keeps a valid avatar and the new poses", () => {
    const a = parseEpisode(ep({ model: "bot", skin: "cyber" })).scenes[0]!.cast[0]!;
    expect(a.avatar).toEqual({ model: "bot", skin: "cyber" });
    expect(parseEpisode(ep(undefined, "dance")).scenes[0]!.cast[0]!.pose).toBe("dance");
  });
  it("drops an unknown model or texture", () => {
    expect(parseEpisode(ep({ model: "dragon", skin: "cyber" })).scenes[0]!.cast[0]!.avatar).toBeUndefined();
    expect(isAvatar({ model: "bot", skin: "plaid" })).toBe(false);
  });
  it("animates limbs deterministically from time", () => {
    expect(limbPose("wave", 1.3, false)).toEqual(limbPose("wave", 1.3, false));
    expect(limbPose("walk", 0.2, false).armL).not.toBe(0);
  });
});
