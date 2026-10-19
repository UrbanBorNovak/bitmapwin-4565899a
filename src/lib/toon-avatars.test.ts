import { describe, expect, it } from "vitest";
import { isAvatar, isPixelSkin, limbPose, pixelSkin } from "./toon-avatars";
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

describe("BITMAP Pixel skins", () => {
  const id = "5a8c5b891eed1f9975c74a1d4e40c4c3f37900236e3aba2068d9bde09e0bb324i0";
  it("keeps a valid on-chain pixel skin through the episode parser", () => {
    expect(parseEpisode(ep({ model: "runner", skin: `px:${id}` })).scenes[0]!.cast[0]!.avatar).toEqual({ model: "runner", skin: `px:${id}` });
  });
  it("normalises ids and rejects malformed pixel skins", () => {
    expect(pixelSkin(id.toUpperCase())).toBe(`px:${id}`);
    for (const bad of ["px:", "px:abc", `px:${id}x`, `px:../${id}`, id]) expect(isPixelSkin(bad)).toBe(false);
    expect(parseEpisode(ep({ model: "runner", skin: "px:nope" })).scenes[0]!.cast[0]!.avatar).toBeUndefined();
  });
});
