import { describe, expect, it } from "vitest";
import { parseBrc420 } from "./pixel-texture";

const T = "e4d14cac0179c85a6285bb31f7af2e9f741a324f98f5cba9f806493309714507i0";
const M = "5e2d04efb32bc584af0f86ca9d0744186c680ced298a33235dc913a5f13e2f34i0";

describe("parseBrc420", () => {
  it("reads absolute mirror URLs for texture, model and name", () => {
    const b = parseBrc420(`<metaverse p="brc-420" src="https://static.unisat.space/content/${M}" srctype="glb" name="Roaring Bitty 3000"><materialdata><texture src="https://static.unisat.space/content/${T}" srctype="png"></texture></materialdata></metaverse>`);
    expect(b).toMatchObject({ texture: T, model: M, name: "Roaring Bitty 3000" });
  });
  it("reads relative /content texture", () => {
    expect(parseBrc420(`<texture src="/content/${T}">`).texture).toBe(T);
  });
  it("follows a plain text pointer", () => {
    expect(parseBrc420(`/content/${M}\n`).pointer).toBe(M);
  });
});
