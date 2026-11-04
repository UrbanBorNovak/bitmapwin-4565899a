import { describe, expect, it } from "vitest";
import { flashboxSource } from "./build-sdk";
const ID = "a".repeat(64) + "i0";
describe("flashboxSource", () => {
  it("accepts an inscription id or content URL", () => {
    expect(flashboxSource(ID)).toEqual({ type: "inscription", id: ID });
    expect(flashboxSource(`https://ordinals.com/content/${ID}`)).toEqual({ type: "inscription", id: ID });
  });
  it("accepts YouTube links", () => {
    expect(flashboxSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ type: "youtube", id: "dQw4w9WgXcQ" });
    expect(flashboxSource("https://youtu.be/dQw4w9WgXcQ")).toEqual({ type: "youtube", id: "dQw4w9WgXcQ" });
  });
  it("refuses other sites", () => {
    expect(flashboxSource("https://evil.example/v.mp4")).toBeNull();
  });
});
