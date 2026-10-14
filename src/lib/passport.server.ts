import type { Passport, PassportStamp, PassportUnlock, ProvenanceEvent, ProofLevel, StampKey } from "@/lib/passport";
import type { Json } from "@/integrations/supabase/types";
import { STAMP_RULES, UNLOCK_RULES } from "@/lib/passport";

async function db() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin; }
function event(row: any): ProvenanceEvent { return { id: row.id, sourceKey: row.source_key, eventType: row.event_type, actorWallet: row.actor_wallet, bitmapHeight: row.bitmap_height === null ? null : Number(row.bitmap_height), sourceType: row.source_type, sourceId: row.source_id, proofLevel: row.proof_level as ProofLevel, title: row.title, summary: row.summary, metadata: row.metadata ?? {}, occurredAt: row.occurred_at }; }
function stamp(row: any): PassportStamp { return { id: row.id, walletAddress: row.wallet_address, stampKey: row.stamp_key, name: row.name, description: row.description, evidenceEventId: row.evidence_event_id, evidenceSourceType: row.evidence_source_type, evidenceSourceId: row.evidence_source_id, bitmapHeight: row.bitmap_height === null ? null : Number(row.bitmap_height), ruleVersion: row.rule_version, inscriptionId: row.inscription_id, earnedAt: row.earned_at }; }
function unlock(row: any): PassportUnlock { return { id: row.id, walletAddress: row.wallet_address, capabilityKey: row.capability_key, name: row.name, description: row.description, grantedByStampId: row.granted_by_stamp_id, grantedAt: row.granted_at }; }

export async function appendProvenance(input: { sourceKey: string; eventType: string; userId?: string | null; wallet?: string | null; bitmapHeight?: number | null; sourceType: string; sourceId: string; proofLevel: ProofLevel; title: string; summary?: string; metadata?: Json; occurredAt?: string; visibility?: "public" | "private"; }) {
  const client = await db();
  const { data, error } = await client.from("provenance_events").upsert({ source_key: input.sourceKey, event_type: input.eventType, actor_user_id: input.userId ?? null, actor_wallet: input.wallet ?? null, bitmap_height: input.bitmapHeight ?? null, source_type: input.sourceType, source_id: input.sourceId, proof_level: input.proofLevel, title: input.title, summary: input.summary ?? "", metadata: input.metadata ?? {}, visibility: input.visibility ?? "public", occurred_at: input.occurredAt ?? new Date().toISOString() }, { onConflict: "source_key", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) throw error;
  if (data) return event(data);
  const found = await client.from("provenance_events").select("*").eq("source_key", input.sourceKey).single();
  if (found.error) throw found.error;
  return event(found.data);
}

async function sourceRows(userId: string, wallet: string) {
  const client = await db();
  const [views, builds, shared, deployments, trades, leases, ranked] = await Promise.all([
    client.from("bitmap_views").select("id, bitmap_height, created_at").eq("viewer_address", wallet).order("created_at", { ascending: true }).limit(100),
    client.from("player_builds").select("id, bitmap_height, kind, created_at").eq("user_id", userId).order("created_at", { ascending: true }).limit(200),
    client.from("world_structures").select("id, bitmap_height, kind, created_at").eq("builder_user_id", userId).order("created_at", { ascending: true }).limit(200),
    client.from("extender_deployments").select("id, bitmap_height, created_at, status").eq("deployed_by_user_id", userId).order("created_at", { ascending: true }).limit(100),
    client.from("trades").select("txid, bitmap_height, price_sats, block_time, created_at").or(`buyer_address.eq.${wallet},seller_address.eq.${wallet}`).limit(100),
    client.from("leases").select("id, bitmap_height, status, created_at").or(`owner_address.eq.${wallet},lessee_address.eq.${wallet}`).limit(100),
    client.from("rank_players").select("id").or(`user_id.eq.${userId},wallet.eq.${wallet}`).limit(10),
  ]);
  for (const result of [views, builds, shared, deployments, trades, leases, ranked]) {
    if (result.error) throw result.error;
  }
  return { views: views.data ?? [], builds: [...(builds.data ?? []), ...(shared.data ?? [])], deployments: deployments.data ?? [], trades: trades.data ?? [], leases: leases.data ?? [], playerIds: (ranked.data ?? []).map((r) => r.id) };
}

export async function syncPassport(userId: string): Promise<Passport> {
  const client = await db();
  const links = await client.from("wallet_links").select("address").eq("user_id", userId).not("verified_at", "is", null).order("verified_at", { ascending: false }).limit(1);
  if (links.error) throw links.error;
  const wallet = links.data?.[0]?.address ?? null;
  if (!wallet) return { wallet: null, events: [], stamps: [], unlocks: [] };
  const rows = await sourceRows(userId, wallet);
  const evidence: ProvenanceEvent[] = [];
  for (const row of rows.views) evidence.push(await appendProvenance({ sourceKey: `view:${row.id}`, eventType: "visit", userId, wallet, bitmapHeight: Number(row.bitmap_height), sourceType: "bitmap_view", sourceId: row.id, proofLevel: "WORLD", title: "BITMAP VISITED", summary: `Entered ${row.bitmap_height}.BITMAP`, occurredAt: row.created_at }));
  for (const row of rows.builds) evidence.push(await appendProvenance({ sourceKey: `build:${row.id}`, eventType: "build", userId, wallet, bitmapHeight: Number(row.bitmap_height), sourceType: "persistent_build", sourceId: row.id, proofLevel: "WORLD", title: "HISTORY BUILT", summary: `${String(row.kind).replaceAll("-", " ").toUpperCase()} placed on ${row.bitmap_height}.BITMAP`, occurredAt: row.created_at }));
  for (const row of rows.deployments) evidence.push(await appendProvenance({ sourceKey: `deployment:${row.id}`, eventType: "deployment", userId, wallet, bitmapHeight: Number(row.bitmap_height), sourceType: "extender_deployment", sourceId: row.id, proofLevel: "WORLD", title: "EXTENDER DEPLOYED", summary: `Software activated on ${row.bitmap_height}.BITMAP`, occurredAt: row.created_at }));
  for (const row of rows.trades) evidence.push(await appendProvenance({ sourceKey: `trade:${row.txid}:${row.bitmap_height}`, eventType: "trade", userId, wallet, bitmapHeight: Number(row.bitmap_height), sourceType: "bitcoin_trade", sourceId: row.txid, proofLevel: "CHAIN", title: "BITMAP TRADED", summary: `${row.bitmap_height}.BITMAP changed hands on Bitcoin`, metadata: { txid: row.txid, priceSats: Number(row.price_sats) }, occurredAt: row.block_time ?? row.created_at }));
  for (const row of rows.leases) evidence.push(await appendProvenance({ sourceKey: `lease:${row.id}`, eventType: "lease", userId, wallet, bitmapHeight: Number(row.bitmap_height), sourceType: "lease", sourceId: row.id, proofLevel: "ACCOUNT", title: "BUILD RIGHTS SHARED", summary: `A recorded lease touched ${row.bitmap_height}.BITMAP`, occurredAt: row.created_at }));
  if (rows.playerIds.length) {
    const pvp = await client.from("pvp_events").select("id, bitmap, district, created_at").or(`killer_id.in.(${rows.playerIds.join(",")}),victim_id.in.(${rows.playerIds.join(",")})`).limit(100);
    if (pvp.error) throw pvp.error;
    for (const row of pvp.data ?? []) evidence.push(await appendProvenance({ sourceKey: `combat:${row.id}`, eventType: "combat", userId, wallet, bitmapHeight: row.bitmap === null ? null : Number(row.bitmap), sourceType: "pvp_event", sourceId: row.id, proofLevel: "WORLD", title: "OASIS DUEL RECORDED", summary: row.district ? `Combat at ${row.district}` : "Combat entered the permanent record", occurredAt: row.created_at }));
  }
  evidence.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const distinctVisits = new Set(rows.views.map((r) => Number(r.bitmap_height))).size;
  const buildHeights = new Set(rows.builds.map((r) => Number(r.bitmap_height)));
  const held = buildHeights.size ? await client.from("bitmap_index").select("block_height").eq("owner_address", wallet).eq("is_valid", true).in("block_height", [...buildHeights]) : { data: [] as any[], error: null };
  if (held.error) throw held.error;
  const categories = new Set(evidence.map((e) => e.eventType));
  const candidates: { key: StampKey; evidence: ProvenanceEvent | undefined }[] = [
    { key: "first-arrival", evidence: evidence.find((e) => e.eventType === "visit") },
    { key: "world-walker", evidence: distinctVisits >= 5 ? [...evidence].reverse().find((e) => e.eventType === "visit") : undefined },
    { key: "first-mark", evidence: evidence.find((e) => e.eventType === "build") },
    { key: "builder", evidence: rows.builds.length >= 3 || buildHeights.size >= 2 ? [...evidence].reverse().find((e) => e.eventType === "build") : undefined },
    { key: "land-steward", evidence: (held.data?.length ?? 0) > 0 ? evidence.find((e) => e.eventType === "build" && held.data?.some((h) => Number(h.block_height) === e.bitmapHeight)) : undefined },
    { key: "deployer", evidence: evidence.find((e) => e.eventType === "deployment") },
    { key: "participant", evidence: evidence.find((e) => ["trade", "lease", "combat", "event", "clan"].includes(e.eventType)) },
    { key: "historian", evidence: categories.size >= 4 ? evidence[evidence.length - 1] : undefined },
  ];
  const hasEmporium = await client.from("passport_stamps").select("id").eq("user_id", userId).eq("stamp_key", "emporium-resident").maybeSingle();
  if (!hasEmporium.data) {
    try {
      const { verifyEmporiumResident } = await import("@/lib/emporium.server");
      const res = await verifyEmporiumResident(wallet);
      const proofId = res.portraits[0] ?? res.parcels[0]?.inscriptionId;
      if (res.resident && proofId) {
        const ev = await appendProvenance({ sourceKey: `emporium:${wallet}:${proofId}`, eventType: "residency", userId, wallet, bitmapHeight: 717328, sourceType: "inscription", sourceId: proofId, proofLevel: "CHAIN", title: "EMPORIUM RESIDENT", summary: res.portraits[0] ? "Holds a Resident portrait of 717328.BITMAP" : `Holds parcel ${res.parcels[0]!.index}.717328.bitmap`, metadata: { portraits: res.portraits.slice(0, 8), parcels: res.parcels.slice(0, 8).map((p) => p.inscriptionId) } });
        candidates.push({ key: "emporium-resident", evidence: ev });
      }
    } catch (e) { console.error("emporium residency check failed", e); }
  }
  for (const candidate of candidates) {
    if (!candidate.evidence) continue;
    const rule = STAMP_RULES[candidate.key];
    await client.from("passport_stamps").upsert({ user_id: userId, wallet_address: wallet, stamp_key: candidate.key, name: rule.name, description: rule.description, evidence_event_id: candidate.evidence.id, evidence_source_type: candidate.evidence.sourceType, evidence_source_id: candidate.evidence.sourceId, bitmap_height: candidate.evidence.bitmapHeight, ...(candidate.key === "emporium-resident" ? { inscription_id: candidate.evidence.sourceId } : {}) }, { onConflict: "user_id,stamp_key", ignoreDuplicates: true });
  }
  const stampsResult = await client.from("passport_stamps").select("*").eq("user_id", userId).order("earned_at", { ascending: false });
  if (stampsResult.error) throw stampsResult.error;
  const stamps = (stampsResult.data ?? []).map(stamp);
  for (const [capability, rule] of Object.entries(UNLOCK_RULES)) {
    const earned = stamps.find((s) => s.stampKey === rule.stamp) ?? (capability === "build.district-gate" ? stamps.find((s) => s.stampKey === "deployer") : undefined);
    if (earned) await client.from("passport_unlocks").upsert({ user_id: userId, wallet_address: wallet, capability_key: capability, name: rule.name, description: rule.description, granted_by_stamp_id: earned.id }, { onConflict: "user_id,capability_key", ignoreDuplicates: true });
  }
  const unlocksResult = await client.from("passport_unlocks").select("*").eq("user_id", userId).order("granted_at", { ascending: false });
  const eventsResult = await client.from("provenance_events").select("*").eq("actor_user_id", userId).order("occurred_at", { ascending: false }).limit(60);
  if (unlocksResult.error) throw unlocksResult.error;
  if (eventsResult.error) throw eventsResult.error;
  return { wallet, events: (eventsResult.data ?? []).map(event), stamps, unlocks: (unlocksResult.data ?? []).map(unlock) };
}

export async function readPublicPassport(wallet: string): Promise<Passport> {
  const client = await db();
  const [events, stamps, unlocks] = await Promise.all([
    client.from("provenance_events").select("*").eq("actor_wallet", wallet).eq("visibility", "public").order("occurred_at", { ascending: false }).limit(40),
    client.from("passport_stamps").select("*").eq("wallet_address", wallet).eq("visibility", "public").order("earned_at", { ascending: false }),
    client.from("passport_unlocks").select("*").eq("wallet_address", wallet).eq("visibility", "public").order("granted_at", { ascending: false }),
  ]);
  return { wallet, events: (events.data ?? []).map(event), stamps: (stamps.data ?? []).map(stamp), unlocks: (unlocks.data ?? []).map(unlock) };
}
export async function readPublicStream(input: { filter: string; limit: number; wallet?: string | undefined; bitmapHeight?: number | undefined }) {
  const client = await db();
  let query = client.from("provenance_events").select("*").eq("visibility", "public").order("occurred_at", { ascending: false }).limit(input.limit);
  if (input.wallet) query = query.eq("actor_wallet", input.wallet);
  if (input.bitmapHeight !== undefined) query = query.eq("bitmap_height", input.bitmapHeight);
  if (input.filter === "world") query = query.eq("proof_level", "WORLD");
  else if (input.filter === "chain") query = query.eq("proof_level", "CHAIN");
  else if (input.filter === "account") query = query.eq("proof_level", "ACCOUNT");
  else if (input.filter === "build") query = query.eq("event_type", "build");
  else if (input.filter === "stamp") query = query.eq("event_type", "stamp");
  const result = await query; if (result.error) throw result.error; return (result.data ?? []).map(event);
}
