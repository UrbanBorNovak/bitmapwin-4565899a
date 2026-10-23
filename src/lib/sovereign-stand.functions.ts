import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { StandConfig } from "@/lib/sovereign-stand";

const addressSchema = z.string().trim().regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, "Not a valid Bitcoin address");
const standIdSchema = z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}i\d+$/, "Not an inscription id");

export type StandSeat = { seat: number; address: string; heldBitmap: number; issuedAt: string; signature: string; createdAt: string };

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(input, { ...init, headers: h }); } },
  });
}

/** Inscription content mirrors, tried in order. Content behind an id never changes, and every body is strictly parsed as BW-STAND-1. */
const CONTENT_SOURCES = [
  (id: string) => `https://ordinals.com/content/${id}`,
  (id: string) => `https://static.unisat.io/content/${id}`,
  (id: string) => `https://ord-mirror.magiceden.dev/content/${id}`,
  (id: string) => `https://turbo.ordinalswallet.com/inscription/content/${id}`,
];

type Loaded = { config: StandConfig; error: null } | { config: null; error: "NOT_A_STAND" | "UNAVAILABLE" };

/** Reads the stand's inscribed config from the first source that answers; a body that isn't BW-STAND-1 means not a stand. */
async function loadConfig(id: string): Promise<Loaded> {
  const { parseStandConfig } = await import("@/lib/sovereign-stand");
  let answered = false;
  for (const src of CONTENT_SOURCES) {
    try {
      const r = await fetch(src(id), { headers: { "User-Agent": "bitmapwin/1.0" }, signal: AbortSignal.timeout(6000) });
      if (r.status === 404) continue;
      if (!r.ok) continue;
      const text = await r.text();
      if (text.length > 8000) { answered = true; continue; }
      let json: unknown;
      try { json = JSON.parse(text); } catch { answered = true; continue; }
      const config = parseStandConfig(json);
      if (config) return { config, error: null };
      answered = true;
    } catch { /* source down — try the next */ }
  }
  return { config: null, error: answered ? "NOT_A_STAND" : "UNAVAILABLE" };
}

type Row = { seat_number: number; address: string; held_bitmap: number; issued_at: string; signature: string; created_at: string };
const toSeat = (r: Row): StandSeat => ({ seat: r.seat_number, address: r.address, heldBitmap: r.held_bitmap, issuedAt: r.issued_at, signature: r.signature, createdAt: r.created_at });

export const getStandFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: standIdSchema }).parse(d))
  .handler(async ({ data }) => {
    const { config, error } = await loadConfig(data.id);
    if (!config) return { config: null, seats: [] as StandSeat[], error };
    const sb = await publicClient();
    const { data: rows } = await sb.from("stand_seats").select("seat_number,address,held_bitmap,issued_at,signature,created_at").eq("stand_id", data.id).order("seat_number").limit(1000);
    return { config, seats: ((rows ?? []) as Row[]).map(toSeat), error: null as "NOT_A_STAND" | "UNAVAILABLE" | null };
  });

/** Seats a wallet: fresh BIP-322 signature bound to this stand + a live BITMAP holding inside the stand's range. */
export const claimStandSeatFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: standIdSchema, address: addressSchema, issuedAt: z.string().max(40), signature: z.string().min(8).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const { standMessage, qualifyingBitmap } = await import("@/lib/sovereign-stand");
    const { SEAT_MESSAGE_TTL_MS } = await import("@/lib/launch-seats");
    const issued = Date.parse(data.issuedAt);
    if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > SEAT_MESSAGE_TTL_MS) return { ok: false as const, error: "Signature expired — try again" };
    const { Verifier } = await import("bip322-js");
    let valid = false;
    try { valid = Verifier.verifySignature(data.address, standMessage(data.id, data.address, data.issuedAt), data.signature); } catch { valid = false; }
    if (!valid) return { ok: false as const, error: "Signature does not match this address" };
    const { config, error } = await loadConfig(data.id);
    if (!config) return { ok: false as const, error: error === "UNAVAILABLE" ? "Inscription sources are unreachable — try again" : "No BW-STAND-1 config at this inscription" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await supabaseAdmin.from("stand_seats").select("seat_number,address,held_bitmap,issued_at,signature,created_at").eq("stand_id", data.id).ilike("address", data.address).maybeSingle();
    if (existing.data) return { ok: true as const, seat: toSeat(existing.data as Row), already: true };
    let heights: number[];
    try {
      const { fetchWallet } = await import("@/lib/wallet.server");
      const snap = await fetchWallet(data.address);
      heights = snap.utxos.flatMap((u) => u.inscriptions).map((i) => i.bitmapHeight).filter((h): h is number => h !== null);
    } catch { return { ok: false as const, error: "Wallet scan unavailable — try again" }; }
    const held = qualifyingBitmap(config, heights);
    if (held === null) return { ok: false as const, error: "NO_BITMAP" };
    const ins = await supabaseAdmin.from("stand_seats").insert({ stand_id: data.id, seat_number: 0, address: data.address, held_bitmap: held, issued_at: data.issuedAt, signature: data.signature }).select("seat_number,address,held_bitmap,issued_at,signature,created_at").single();
    if (ins.error) return { ok: false as const, error: "Could not take a seat — try again" };
    return { ok: true as const, seat: toSeat(ins.data as Row), already: false };
  });

/** Convention Badge: distinct stands a wallet holds a signed seat in, and its tier. */
export const conventionBadgeFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ address: addressSchema }).parse(d))
  .handler(async ({ data }) => {
    const { conventionTier } = await import("@/lib/sovereign-stand");
    const sb = await publicClient();
    const { data: rows, error } = await sb.from("stand_seats").select("stand_id,seat_number").ilike("address", data.address).limit(500);
    if (error) return { stands: [] as { standId: string; seat: number }[], tier: null, error: "Badge unavailable" };
    const stands = (rows ?? []).map((r) => ({ standId: r.stand_id as string, seat: r.seat_number as number }));
    return { stands, tier: conventionTier(stands.length), error: null as string | null };
  });
