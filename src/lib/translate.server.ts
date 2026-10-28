/**
 * Machine translation of interface strings with a permanent database cache.
 *
 * Only strings that have never been translated for a language hit the AI
 * gateway; everything else is served from `public.ui_translations`, so a page
 * a visitor has already seen in Greek costs nothing to show again.
 */

const MODEL = "google/gemini-3.7-flash";

export type Lang =
  | "el"
  | "es"
  | "de"
  | "ru"
  | "hi"
  | "fr"
  | "zh"
  | "sl"
  | "hr"
  | "sr"
  | "bs"
  | "mk"
  | "uk";

export const LANG_NAMES: Record<Lang, string> = {
  el: "Greek",
  es: "Spanish",
  de: "German",
  ru: "Russian",
  hi: "Hindi",
  fr: "French",
  zh: "Simplified Chinese",
  sl: "Slovenian",
  hr: "Croatian",
  sr: "Serbian (Cyrillic script)",
  bs: "Bosnian",
  mk: "Macedonian",
  uk: "Ukrainian",
};

/** Stable cache key for a source string (hex sha-256). */
export async function sourceKey(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function translateBatch(lang: Lang, texts: string[]): Promise<string[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Translation is not configured");

  const prompt = [
    `Translate each string in the JSON array from English into ${LANG_NAMES[lang]}.`,
    "This is the interface of a Bitcoin marketplace with a terminal aesthetic.",
    "Rules: keep the exact same array length and order; keep ALL CAPS strings in caps;",
    "never translate ticker symbols, block numbers, addresses, transaction ids, or the words",
    "BITMAP, BITCOIN, BTC, SATS, BIT, PSBT, UNHINGED, ORDINALS, MEMPOOL;",
    "keep punctuation, brackets, arrows and underscores exactly as they appear.",
    'Reply with JSON only: {"translations": ["...", "..."]}',
    JSON.stringify(texts),
  ].join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Translation failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content ?? "{}";
  let parsed: { translations?: unknown };
  try {
    parsed = JSON.parse(raw) as { translations?: unknown };
  } catch {
    throw new Error("Translation returned malformed JSON");
  }
  const list = Array.isArray(parsed.translations) ? parsed.translations : [];
  return texts.map((source, i) => {
    const value = list[i];
    return typeof value === "string" && value.trim() ? value : source;
  });
}

const AI_TRANSLATE_OFF = true;

/** Translate the given strings, reading and filling the shared cache. */
export async function translateStrings(
  lang: Lang,
  texts: string[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(texts.map((t) => t.trim()).filter(Boolean))).slice(0, 120);
  if (unique.length === 0) return {};

  const keys = await Promise.all(unique.map(sourceKey));
  const byKey = new Map(keys.map((k, i) => [k, unique[i] as string]));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cached } = await supabaseAdmin
    .from("ui_translations")
    .select("source_key, source, translated")
    .eq("lang", lang)
    .in("source_key", keys);

  const out: Record<string, string> = {};
  const hit = new Set<string>();
  for (const row of cached ?? []) {
    out[row.source] = row.translated;
    hit.add(row.source_key);
  }

  const missingKeys = keys.filter((k) => !hit.has(k));
  if (missingKeys.length === 0) return out;

  // AI translation is switched off: only already-cached translations are served,
  // new strings stay in English so no AI credits are spent.
  if (AI_TRANSLATE_OFF) return out;
  const missing = missingKeys.map((k) => byKey.get(k) as string);
  const translated = await translateBatch(lang, missing);

  const rows = missing.map((source, i) => ({
    lang,
    source_key: missingKeys[i] as string,
    source,
    translated: translated[i] as string,
  }));
  for (const row of rows) out[row.source] = row.translated;

  await supabaseAdmin.from("ui_translations").upsert(rows, { onConflict: "lang,source_key" });
  return out;
}
