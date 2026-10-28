import { createServerFn } from "@tanstack/react-start";
import { PITCH_MAX } from "./episode-machine";

export const writeEpisodeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { pitch: string }) => {
    const pitch = String(d?.pitch ?? "").replace(/\s+/g, " ").trim();
    if (pitch.length < 8) throw new Error("Pitch is too short.");
    return { pitch: pitch.slice(0, PITCH_MAX) };
  })
  .handler(async ({ data }) => {
    const { writeBeatSheet } = await import("./episode-machine.server");
    return writeBeatSheet(data.pitch);
  });
