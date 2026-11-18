import { describe, it, expect } from "vitest";
import { indexEntries, missingUtx, isLocalBridgeUrl, packageKey } from "./game-folder";
const e = (name: string) => ({ name, path: name, size: 1, open: async () => new File([], name) });
describe("game folder", () => {
  it("indexes packages by lowercase name and skips other files", () => {
    const m = indexEntries([e("LineageNPCs.ukx"), e("l2.exe"), e("T_Fighter.UTX")]);
    expect([...m.keys()].sort()).toEqual(["lineagenpcs.ukx", "t_fighter.utx"]);
    expect(packageKey("SysTextures/Foo.utx")).toBe("foo");
  });
  it("reads the missing texture package from a reason", () => {
    expect(missingUtx('Texture "x" lives in T_Fighter.utx — load that file too')).toBe("t_fighter.utx");
    expect(missingUtx("no list")).toBeNull();
  });
  it("only allows local gameserver bridges", () => {
    expect(isLocalBridgeUrl("ws://localhost:8888")).toBe(true);
    expect(isLocalBridgeUrl("ws://example.com:8888")).toBe(false);
    expect(isLocalBridgeUrl("http://localhost")).toBe(false);
  });
});
