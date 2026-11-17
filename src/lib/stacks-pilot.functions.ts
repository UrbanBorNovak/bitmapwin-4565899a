import { createServerFn } from "@tanstack/react-start";

export type PilotAttestResult =
  | { ok: true; epoch: number; height: number; weight: number; issued: number; signature: string; daysHeld: number; clock: "chain" | "unknown"; baseWeight: number; tier: 1 | 2 | 3; reasons: string[] }
  | { ok: false; status: "rejected" | "unavailable"; reason: string };

const MAX_PER_HOUR = 6;

/**
 * Testnet pilot oracle. Public, but signs only after: a fresh BIP-322 binding from
 * the Taproot address, that address holding the canonical BITMAP right now, and a
 * testnet Stacks address. Weight is computed here; the browser supplies none of it.
 */
export const pilotAttestFn = createServerFn({ method: "POST" })
  .inputValidator((d: { height: number; btcAddress: string; stxAddress: string; issuedAt: number; signature: string }) => ({
    height: Number(d?.height), btcAddress: String(d?.btcAddress ?? ""), stxAddress: String(d?.stxAddress ?? ""),
    issuedAt: Number(d?.issuedAt), signature: String(d?.signature ?? "").slice(0, 400),
  }))
  .handler(async ({ data }): Promise<PilotAttestResult> => {
    const { validateBinding, bindingMessage, bindingFresh, stakeWeight } = await import("@/lib/stacks-softstake");
    const reject = (reason: string): PilotAttestResult => ({ ok: false, status: "rejected", reason });
    const unavailable = (reason: string): PilotAttestResult => ({ ok: false, status: "unavailable", reason });
    const binding = { ...data, network: "testnet" as const };
    const bad = validateBinding(binding);
    if (bad) return reject(bad);
    if (!bindingFresh(data.issuedAt, Math.floor(Date.now() / 1000))) return reject("Signature expired — sign again");

    const { Verifier } = await import("bip322-js");
    let valid = false;
    try { valid = Verifier.verifySignature(data.btcAddress, bindingMessage(binding), data.signature); } catch { valid = false; }
    if (!valid) return reject("Wallet signature does not verify");

    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 3600_000).toISOString();
    const recent = await db.from("stake_pilot_attestations").select("id", { count: "exact", head: true })
      .eq("btc_address", data.btcAddress).gte("created_at", since);
    if (recent.error) return unavailable("Pilot log unavailable");
    if ((recent.count ?? 0) >= MAX_PER_HOUR) return reject("Too many requests from this address — try again in an hour");

    const { bitmapHolderNow } = await import("@/lib/nostr/bitchat-landowner.server");
    const holder = await bitmapHolderNow(data.height);
    if (holder.status === "unavailable") return unavailable(holder.reason);
    if (holder.status === "none") return reject("No canonical BITMAP found for this block");
    if (holder.holder !== data.btcAddress) return reject("This address does not hold this BITMAP right now");

    let daysHeld = 0; let clock: "chain" | "unknown" = "unknown";
    try {
      const { lastMoveBlocks } = await import("@/lib/bitmap-custody.server");
      const [moves, tipRes] = await Promise.all([
        lastMoveBlocks([data.height]),
        fetch("https://mempool.space/api/blocks/tip/height", { signal: AbortSignal.timeout(6000) }),
      ]);
      const last = moves.get(data.height); const tip = Number(await tipRes.text());
      if (last != null && Number.isInteger(tip) && tip >= last) { daysHeld = Math.floor((tip - last) / 144); clock = "chain"; }
    } catch (e) { console.error("pilot custody clock", e); }
    const baseWeight = stakeWeight(daysHeld, null);
    const { stakeTier, tieredWeight } = await import("@/lib/stake-tiers");
    const { readTierProofs } = await import("@/lib/stake-tiers.server");
    const { tier, reasons } = stakeTier(await readTierProofs(data.height));
    const weight = tieredWeight(baseWeight, tier);

    const { signAttestation, testnetBurnHeight, PILOT_ORACLE_EPOCH } = await import("@/lib/stacks-pilot.server");
    let issued: number;
    try { issued = await testnetBurnHeight(); } catch { return unavailable("Stacks testnet unavailable"); }
    const att = { epoch: PILOT_ORACLE_EPOCH, height: data.height, owner: data.stxAddress, weight, issued };
    const signature = signAttestation(att);
    const log = await db.from("stake_pilot_attestations").insert({
      height: data.height, btc_address: data.btcAddress, stx_address: data.stxAddress,
      weight, epoch: PILOT_ORACLE_EPOCH, issued, network: "testnet",
    });
    if (log.error) { console.error("pilot log", log.error); return unavailable("Pilot log unavailable"); }
    return { ok: true, ...att, signature, daysHeld, clock, baseWeight, tier, reasons };
  });
