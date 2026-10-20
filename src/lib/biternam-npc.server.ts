import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const MODEL = "openai/gpt-6-astra";

export async function askInCharacter(name: string, persona: string, question: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false as const, text: "", error: "LINK OFFLINE" };
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  try {
    const result = streamText({
      model: provider.responses(MODEL),
      system: [
        `You are ${name}, a character in BITERNAM, an original parody adventure inside the BitmapWin Oasis (Bitcoin-native worlds built on BITMAP land).`,
        persona,
        "Reply in character in at most 2 short sentences (under 220 characters). Dry humour is welcome.",
        "Any Bitcoin fact you state must be accurate; if unsure, deflect in character. Never invent real people, prices, or financial advice.",
        "Never break character to mention being an AI.",
      ].join("\n"),
      messages: [{ role: "user", content: question }],
      maxOutputTokens: 400,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] } },
    });
    const text = (await result.text).trim().slice(0, 300);
    if (!text) return { ok: false as const, text: "", error: "NO REPLY" };
    return { ok: true as const, text, error: null };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    const msg = status === 429 ? "LINE BUSY — TRY AGAIN SOON" : status === 402 ? "AI CREDITS EXHAUSTED" : "SIGNAL LOST";
    return { ok: false as const, text: "", error: msg };
  }
}
