import { describe, expect, it } from "vitest";
import { isAvatar, isPixelSkin, limbPose, pixelSkin, rigClipFor, rigGesture } from "./toon-avatars";
import { PIXELS_HOMECOMING } from "./toon-teaser";
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

describe("on-chain rig poses", () => {
  const names = ["Armature|Falling", "Armature|Idle", "Armature|Walking"];
  it("maps poses to the baked clips", () => {
    expect(rigClipFor(names, "idle", false).name).toBe("Armature|Idle");
    expect(rigClipFor(names, "walk", false).name).toBe("Armature|Walking");
    expect(rigClipFor(names, "idle", true).name).toBe("Armature|Walking");
    expect(rigClipFor(names, "jump", false).name).toBe("Armature|Falling");
    expect(rigClipFor(names, "dance", false)).toEqual({ name: "Armature|Walking", speed: 1.6 });
    expect(rigClipFor(names, "talk", false).name).toBe("Armature|Idle");
  });
  it("raises the arm when waving and never while walking", () => {
    expect(rigGesture("wave", 0, false).armR).toBeLessThan(-2);
    expect(rigGesture("wave", 0, true)).toEqual({ armL: 0, armR: 0, head: 0, legL: 0, legR: 0 });
  });
  it("pixels trailer is longer than four scenes and parses intact", () => {
    expect(PIXELS_HOMECOMING.scenes.length).toBeGreaterThan(4);
    expect(parseEpisode(JSON.stringify(PIXELS_HOMECOMING))?.scenes.length).toBe(PIXELS_HOMECOMING.scenes.length);
  });
});

describe("standing limbs", () => {
  it("moves legs in idle, talk and dance poses", () => {
    for (const p of ["idle", "talk", "dance"]) {
      const a = rigGesture(p, 0.7, false), b = rigGesture(p, 1.4, false);
      expect(a.legL).not.toBe(b.legL);
    }
  });
});
