import { createServerFn } from "@tanstack/react-start";

/** Count matching leading hex characters (0–40). */
export function matchedChars(a: string, b: string) {
  let n = 0;
  while (n < 40 && a[n] === b[n]) n++;
  return n;
}

/** Community best near miss: server re-derives the Hash160 from the key, so records can't be forged. */
export const submitNearRecordFn = createServerFn({ method: "POST" })
  .inputValidator((d: { keyHex: string }) => ({ keyHex: String(d?.keyHex ?? "").toLowerCase().replace(/^0x/, "") }))
  .handler(async ({ data }) => {
    if (!/^[0-9a-f]{1,64}$/.test(data.keyHex)) return { ok: false as const, reason: "bad key" };
    const { PUZZLE_71, hash160Of } = await import("@/lib/puzzle-sweep");
    const k = BigInt("0x" + data.keyHex);
    if (k < BigInt("0x" + PUZZLE_71.startHex) || k > BigInt("0x" + PUZZLE_71.endHex)) return { ok: false as const, reason: "out of range" };
    const { secp256k1 } = await import("@noble/curves/secp256k1.js");
    const { sha256 } = await import("@noble/hashes/sha2.js");
    const { ripemd160 } = await import("@noble/hashes/legacy.js");
    const priv = new Uint8Array(32);
    const hexKey = data.keyHex.padStart(64, "0");
    for (let i = 0; i < 32; i++) priv[i] = parseInt(hexKey.slice(i * 2, i * 2 + 2), 16);
    const h = ripemd160(sha256(secp256k1.getPublicKey(priv, true)));
    const hx = Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
    const tgt = Array.from(hash160Of(PUZZLE_71.address), (b) => b.toString(16).padStart(2, "0")).join("");
    const n = matchedChars(hx, tgt);
    if (n >= 40) return { ok: false as const, reason: "full key — never send this" };
    if (n < 5) return { ok: false as const, reason: "below record threshold" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("puzzle_near_records").upsert({ nibbles: n, hash: hx }, { onConflict: "hash", ignoreDuplicates: true });
    return { ok: true as const, nibbles: n };
  });

export const nearRecordsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: top } = await supabaseAdmin.from("puzzle_near_records").select("nibbles, hash, found_at").order("nibbles", { ascending: false }).order("found_at").limit(1);
  const { data: rows } = await supabaseAdmin.from("puzzle_near_records").select("nibbles");
  const counts: Record<number, number> = {};
  for (const r of rows ?? []) counts[r.nibbles] = (counts[r.nibbles] ?? 0) + 1;
  return { best: top?.[0] ?? null, counts };
});
