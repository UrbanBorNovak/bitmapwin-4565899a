import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { MACHINE_EMOTES, MACHINE_SETS, type BeatSheet } from "./episode-machine";

const MODEL = "openai/gpt-6-astra";

const schema = z.object({
  title: z.string(),
  verdict: z.string(),
  score: z.number(),
  cast: z.array(z.object({ name: z.string() })),
  scenes: z.array(z.object({
    set: z.enum(MACHINE_SETS),
    lines: z.array(z.object({
      speaker: z.number(),
      text: z.string(),
      style: z.enum(["speech", "shout", "thought"]),
      emote: z.enum(MACHINE_EMOTES),
    })),
  })),
});

export async function writeBeatSheet(pitch: string): Promise<{ ok: true; beats: BeatSheet } | { ok: false; error: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: "WRITERS' ROOM OFFLINE" };
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  try {
    const result = streamText({
      model: provider.responses(MODEL),
      system: [
        "You are the writers' room of BITERNAM, an original cut-out cartoon set in BitmapWin (Bitcoin-native worlds on BITMAP land).",
        "Write a deadpan, fast satirical short in the spirit of crude-paper-cutout TV comedy, but original: no existing show characters, catchphrases or real people.",
        "Exactly 3 scenes: 1) hook/confrontation, 2) escalation with quick back-and-forth, 3) one short punchline. 2-5 lines per scene, every line under 90 characters.",
        "Cast: 2 or 3 invented Bitmapper characters with short punchy names. speaker is the 0-based cast index.",
        "Bitcoin facts must be accurate. No slurs, no financial advice, no prices.",
        "verdict: one sentence judging why the premise works (or how it was sharpened). score: 1-10 for comedic potential.",
      ].join("\n"),
      messages: [{ role: "user", content: `Premise: ${pitch}` }],
      output: Output.object({ schema }),
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] } },
    });
    const beats = (await result.output) as BeatSheet;
    if (!beats?.scenes?.length) return { ok: false, error: "THE WRITERS CAME BACK EMPTY" };
    return { ok: true, beats };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    console.error("episode machine failed", status, (e as Error).message);
    return { ok: false, error: status === 429 ? "WRITERS ARE BUSY — TRY AGAIN IN A MINUTE" : status === 402 ? "AI CREDITS EXHAUSTED" : status === 403 ? "THE WRITERS' ROOM REFUSED THIS PITCH" : "SCRIPT FAILED — TRY ANOTHER PITCH" };
  }
}
