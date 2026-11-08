import { describe, expect, it } from "vitest";
import { buildBeacon, buildMod, buildPage, buildSkin } from "./addon-payloads";

const ID = "a3a5a15e80460a794e452dc65ddce9bb289fc7dd1bd69ac47a7bd7b1fceca9b4i0";
const blankPage = { title: "", status: "", bio: "", likes: "", dislikes: "", top8: "", accent: "", x: "", pfp: "" };

describe("add-on payloads", () => {
  it("module header matches what the Master parses", () => {
    const r = buildMod({ id: "weather", label: "Weather", goal: 0, code: "api.on(()=>{})" });
    expect(r.text.startsWith('BW-MOD-1\n{"id":"WEATHER","label":"Weather","goal":0}\n')).toBe(true);
    expect(r.problems).toEqual([]);
  });
  it("page starts with the exact 10-char header and parses", () => {
    const r = buildPage({ ...blankPage, bio: "hi", likes: "a, b", pfp: ID });
    expect(r.text.slice(0, 10)).toBe("BW-PAGE-1\n");
    expect(JSON.parse(r.text.slice(10))).toEqual({ bio: "hi", likes: ["a", "b"], pfp: ID });
  });
  it("page refuses a non-id top 8 entry", () => {
    expect(buildPage({ ...blankPage, top8: "nope" }).problems.length).toBeGreaterThan(0);
  });
  it("skin needs a frame or mask", () => {
    expect(buildSkin({ name: "", frame: "", mask: "", accent: "", scan: 0 }).problems).toContain("ADD A FRAME OR MASK IMAGE ID");
  });
  it("beacon refuses a legacy address", () => {
    expect(buildBeacon("1BoatSLRHtKNngkdXEeobR76b53LETtpyT").problems.length).toBe(1);
  });
});
