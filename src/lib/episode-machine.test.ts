import { describe, expect, it } from "vitest";
import { beatsToEpisode, type BeatSheet } from "./episode-machine";

const sheet: BeatSheet = {
  title: "Espresso Dispute", verdict: "Works.", score: 8, cast: [{ name: "GENESIS GARY" }, { name: "INSCRIBER IVY" }],
  scenes: [
    { set: "cafe", lines: [{ speaker: 0, text: "One espresso. I'll pay in sats.", style: "speech", emote: "happy" }, { speaker: 1, text: "Those coins haven't moved since 2009.", style: "shout", emote: "surprised" }] },
    { set: "cafe", lines: [{ speaker: 9, text: "Exactly.", style: "speech", emote: "none" }] },
    { set: "cafe", lines: [{ speaker: 1, text: "Cash only.", style: "speech", emote: "none" }] },
  ],
};

describe("episode machine", () => {
  it("builds a playable 3-scene episode", () => {
    const e = beatsToEpisode(sheet);
    expect(e.scenes).toHaveLength(3);
    expect(e.scenes[0]!.set).toBe("cafe");
  });
  it("clamps out-of-range speakers to the cast", () => {
    expect(beatsToEpisode(sheet).scenes[1]!.lines[0]!.speaker).toBe(1);
  });
  it("ends on a close-up punchline", () => {
    expect(beatsToEpisode(sheet).scenes[2]!.lines.at(-1)!.cam).toBe("close");
  });
  it("is deterministic", () => {
    expect(beatsToEpisode(sheet)).toEqual(beatsToEpisode(sheet));
  });
});
