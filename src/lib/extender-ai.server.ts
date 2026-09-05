import { RUNTIME_LIMITS, SDK_TYPES } from "@/lib/extender-sdk";

/**
 * AI code writer for extenders.
 *
 * Turns a plain-English description of a place into real SDK code that runs in
 * the same sandbox the world uses. The model only ever sees the SDK surface —
 * it cannot reach the page, the chain or the database.
 */

const MODEL = "google/gemini-3.7-flash";

const RULES = [
  "You write JavaScript for the BITMAPWIN extender sandbox.",
  "Output ONLY runnable JavaScript — no markdown fences, no explanation, no imports, no exports.",
  "There is no DOM, no window, no fetch, no setTimeout. Only the declared globals exist.",
  "Coordinates are strides, tile-local: the tile is 10 strides across, 0,0 is the centre.",
  `Keep every prop within x/z in [-${RUNTIME_LIMITS.maxReach}, ${RUNTIME_LIMITS.maxReach}] and y below ${RUNTIME_LIMITS.maxHeight}.`,
  `Create at most ${RUNTIME_LIMITS.maxProps} props and at most ${RUNTIME_LIMITS.maxQuests} quests.`,
  "Build the scene at top level, then use on('tick') for motion and on('interact') / on('enter') for interaction.",
  "Prefer loops over long repetitive lists. Use hex colour strings.",
  "Add 1-3 quests when the description implies something to do, and one short log() line at the end.",
  `Total code must stay under ${RUNTIME_LIMITS.maxCodeBytes} bytes.`,
  "Write compact, commented, readable code that runs forever without errors.",
].join("\n");

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:javascript|js|ts)?\s*([\s\S]*?)```$/i.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

/**
 * Real 3D asset catalogue.
 *
 * The only 3D models that exist are GLB/GLTF inscriptions already validated on
 * chain and registered in `bitmap_models`. The builder hands that list to the
 * model so generated code places genuine on-chain geometry instead of inventing
 * inscription ids that would render as nothing.
 */
export type ModelAsset = {
  inscriptionId: string;
  height: number;
  triangleCount: number;
  animationCount: number;
};

export async function listModelCatalogue(limit = 20): Promise<ModelAsset[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("bitmap_models")
    .select("inscription_id, bitmap_height, triangle_count, animation_count, validation_status")
    .eq("validation_status", "approved")
    .order("validated_at", { ascending: false })
    .limit(limit * 3);
  if (error) return [];
  const seen = new Set<string>();
  const out: ModelAsset[] = [];
  for (const row of data ?? []) {
    const id = String(row.inscription_id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      inscriptionId: id,
      height: Number(row.bitmap_height ?? 0),
      triangleCount: Number(row.triangle_count ?? 0),
      animationCount: Number(row.animation_count ?? 0),
    });
    if (out.length >= limit) break;
  }
  return out;
}

const INSCRIPTION_RE = /inscriptionId\s*:\s*(["'`])([^"'`]*)\1/g;

/**
 * Keeps generated code honest about 3D assets: any inscription id the model
 * invented is swapped for a real catalogue entry, and when no validated model
 * exists at all the model calls degrade to primitives so the scene still runs.
 */
function reconcileModels(code: string, catalogue: ModelAsset[]): { code: string; used: ModelAsset[]; downgraded: number } {
  const ids = catalogue.map((m) => m.inscriptionId);
  if (ids.length === 0) {
    const downgraded = (code.match(/world\.model\s*\(/g) ?? []).length;
    return { code: code.replace(/world\.model\s*\(/g, "world.prop("), used: [], downgraded };
  }
  let cursor = 0;
  const used = new Set<string>();
  const next = code.replace(INSCRIPTION_RE, (_match, quote: string, value: string) => {
    const id = ids.includes(value) ? value : (ids[cursor++ % ids.length] as string);
    used.add(id);
    return `inscriptionId: ${quote}${id}${quote}`;
  });
  return {
    code: next,
    used: catalogue.filter((m) => used.has(m.inscriptionId)),
    downgraded: 0,
  };
}

export async function writeExtenderCode(input: {
  prompt: string;
  height: number;
  category: string;
  existingCode: string;
  models?: ModelAsset[];
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI code generation is not configured");

  const models = input.models ?? [];
  const modelBrief = models.length > 0
    ? `Real on-chain 3D models you MAY place with world.model({ inscriptionId, x, z, y, w, rotationY }). Use ONLY these ids verbatim — no other inscription id exists:\n${models
        .map((m) => `- ${m.inscriptionId} (from ${m.height}.BITMAP, ${m.triangleCount} tris${m.animationCount > 0 ? ", animated" : ""})`)
        .join("\n")}`
    : "No validated on-chain 3D models are available, so do NOT call world.model — build everything from primitives.";

  const user = [
    `Tile: ${input.height}.BITMAP. Category: ${input.category}.`,
    modelBrief,
    input.existingCode.trim()
      ? `Revise the existing code below to satisfy the request. Keep what still works.\n\n--- EXISTING CODE ---\n${input.existingCode.slice(0, 12_000)}\n--- END ---`
      : "There is no existing code — write it from scratch.",
    `Request: ${input.prompt}`,
  ].join("\n\n");


  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: `${RULES}\n\nAvailable API:\n${SDK_TYPES}` },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is rate limited right now — try again shortly");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace");
    throw new Error(`AI generation failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const code = stripFences(payload.choices?.[0]?.message?.content ?? "");
  if (!code) throw new Error("AI returned nothing runnable");
  const bytes = new TextEncoder().encode(code).length;
  if (bytes > RUNTIME_LIMITS.maxCodeBytes) {
    throw new Error(`AI wrote ${bytes} bytes, over the ${RUNTIME_LIMITS.maxCodeBytes} byte limit — ask for something simpler`);
  }
  return code;
}

/**
 * Design pass. Before any code is written the model produces the structured
 * package plan a real build needs: name, category, tags, build stages and the
 * assets the scene will contain. Nothing here is canned — if the call fails the
 * caller surfaces the failure instead of inventing a plan.
 */
export type ExtenderDesign = {
  name: string;
  summary: string;
  category: string;
  tags: string[];
  stages: Array<{ label: string; detail: string }>;
  assets: Array<{ name: string; kind: string; note: string }>;
};

const CATEGORY_IDS = [
  "games",
  "construction",
  "combat",
  "world-systems",
  "economy",
  "rpg",
  "vehicles",
  "art",
  "cities",
  "ai",
  "dev-tools",
];

const DESIGN_RULES = [
  "You are the planner of the BITMAPWIN extender builder.",
  "Given a plain-English brief for one BITMAP tile, return the build plan as JSON only.",
  "Shape: {\"name\":string,\"summary\":string,\"category\":string,\"tags\":string[],\"stages\":[{\"label\":string,\"detail\":string}],\"assets\":[{\"name\":string,\"kind\":string,\"note\":string}]}",
  `category must be exactly one of: ${CATEGORY_IDS.join(", ")}.`,
  "name: 2-6 words, uppercase-friendly. summary: one sentence under 160 characters.",
  "stages: 4-6 build stages in order (for example ENVIRONMENT, ASSETS, NPC, INTERACTION, ECONOMY), each with a short concrete detail.",
  "assets: 3-10 things that will actually exist in the scene. kind is one of prop, structure, npc, quest, effect, model.",
  "No markdown fences, no prose outside the JSON.",
].join("\n");

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = stripFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(slice) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("AI plan was not an object");
  return parsed as Record<string, unknown>;
}

async function callGateway(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI building is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is rate limited right now — try again shortly");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace");
    throw new Error(`AI planning failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? "";
}

function str(value: unknown, fallback: string, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return (text.length > 0 ? text : fallback).slice(0, max);
}

export async function designExtender(input: { prompt: string; height: number }): Promise<ExtenderDesign> {
  const raw = await callGateway([
    { role: "system", content: DESIGN_RULES },
    { role: "user", content: `Tile: ${input.height}.BITMAP.\nBrief: ${input.prompt}` },
  ]);
  const parsed = parseJsonObject(raw);

  const category = typeof parsed["category"] === "string" && CATEGORY_IDS.includes(parsed["category"])
    ? (parsed["category"] as string)
    : "world-systems";

  const stagesRaw = Array.isArray(parsed["stages"]) ? parsed["stages"] : [];
  const stages = stagesRaw
    .slice(0, 8)
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      return { label: str(row["label"], "STAGE", 40).toUpperCase(), detail: str(row["detail"], "", 200) };
    })
    .filter((s) => s.detail.length > 0);

  const assetsRaw = Array.isArray(parsed["assets"]) ? parsed["assets"] : [];
  const assets = assetsRaw.slice(0, 12).map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    return {
      name: str(row["name"], "ASSET", 60),
      kind: str(row["kind"], "prop", 20).toLowerCase(),
      note: str(row["note"], "", 160),
    };
  });

  const tagsRaw = Array.isArray(parsed["tags"]) ? parsed["tags"] : [];
  const tags = tagsRaw
    .slice(0, 8)
    .map((t) => str(t, "", 24).toLowerCase())
    .filter(Boolean);

  if (stages.length === 0) throw new Error("AI returned no build plan");

  return {
    name: str(parsed["name"], "UNTITLED EXTENDER", 80),
    summary: str(parsed["summary"], "", 200),
    category,
    tags,
    stages,
    assets,
  };
}

/** Full build: plan the package, then write the code that implements the plan. */
export async function buildExtenderPackage(input: {
  prompt: string;
  height: number;
}): Promise<{ design: ExtenderDesign; code: string }> {
  const design = await designExtender(input);
  const brief = [
    `Package: ${design.name} — ${design.summary}`,
    `Build stages: ${design.stages.map((s) => `${s.label}: ${s.detail}`).join(" | ")}`,
    design.assets.length > 0
      ? `Assets that must exist: ${design.assets.map((a) => `${a.name} (${a.kind})`).join(", ")}`
      : "",
    `Original brief: ${input.prompt}`,
  ]
    .filter(Boolean)
    .join("\n");
  const code = await writeExtenderCode({
    prompt: brief,
    height: input.height,
    category: design.category,
    existingCode: "",
  });
  return { design, code };
}
