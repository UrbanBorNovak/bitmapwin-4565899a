import { supabaseAdmin } from "@/integrations/supabase/client.server";

const HEX64 = /^[0-9a-f]{64}$/;

export type ShadowEventPublic = {
  slug: string;
  territoryBlock: number;
  title: string;
  subtitle: string;
  description: string;
  maxPasses: number;
  passesIssued: number;
  isActive: boolean;
};

export type ShadowWhisper = {
  id: string;
  nullifier: string;
  content: string;
  createdAt: string;
};

export async function readShadowEvent(slug: string): Promise<ShadowEventPublic | null> {
  const { data, error } = await supabaseAdmin
    .from("shadow_events")
    .select("slug, territory_block, title, subtitle, description, max_passes, passes_issued, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    slug: data.slug,
    territoryBlock: Number(data.territory_block),
    title: data.title,
    subtitle: data.subtitle,
    description: data.description,
    maxPasses: data.max_passes,
    passesIssued: data.passes_issued,
    isActive: data.is_active,
  };
}

export async function readShadowEventsForBlock(height: number): Promise<ShadowEventPublic[]> {
  const { data, error } = await supabaseAdmin
    .from("shadow_events")
    .select("slug, territory_block, title, subtitle, description, max_passes, passes_issued, is_active")
    .eq("territory_block", height)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((d) => ({
    slug: d.slug,
    territoryBlock: Number(d.territory_block),
    title: d.title,
    subtitle: d.subtitle,
    description: d.description,
    maxPasses: d.max_passes,
    passesIssued: d.passes_issued,
    isActive: d.is_active,
  }));
}

export async function claimShadowPass(slug: string, commitment: string) {
  if (!HEX64.test(commitment)) return { ok: false as const, reason: "MALFORMED PASS PROOF", passIndex: 0 };
  const { data, error } = await supabaseAdmin.rpc("shadow_claim_pass", {
    _slug: slug,
    _commitment: commitment,
  });
  if (error) return { ok: false as const, reason: "GATE UNAVAILABLE", passIndex: 0 };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false as const, reason: "GATE UNAVAILABLE", passIndex: 0 };
  return {
    ok: Boolean(row.ok),
    reason: String(row.reason ?? ""),
    passIndex: Number(row.pass_index ?? 0),
    passesIssued: Number(row.passes_issued ?? 0),
    maxPasses: Number(row.max_passes ?? 0),
  };
}

export async function verifyShadowPass(slug: string, commitment: string): Promise<boolean> {
  if (!HEX64.test(commitment)) return false;
  const { data, error } = await supabaseAdmin.rpc("shadow_verify_pass", {
    _slug: slug,
    _commitment: commitment,
  });
  if (error) return false;
  return data === true;
}

export async function readShadowWhispers(slug: string): Promise<ShadowWhisper[]> {
  const { data: ev } = await supabaseAdmin.from("shadow_events").select("id").eq("slug", slug).maybeSingle();
  if (!ev) return [];
  const { data, error } = await supabaseAdmin
    .from("shadow_whispers")
    .select("id, nullifier_hash, content, created_at")
    .eq("event_id", ev.id)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error || !data) return [];
  return data.map((d) => ({
    id: d.id,
    nullifier: d.nullifier_hash,
    content: d.content,
    createdAt: d.created_at,
  }));
}

export async function postShadowWhisper(
  slug: string,
  commitment: string,
  nullifier: string,
  content: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!HEX64.test(commitment) || !HEX64.test(nullifier)) return { ok: false, reason: "MALFORMED PASS PROOF" };
  const trimmed = content.trim().slice(0, 500);
  if (!trimmed) return { ok: false, reason: "EMPTY TRANSMISSION" };
  const { data, error } = await supabaseAdmin.rpc("shadow_post_whisper", {
    _slug: slug,
    _commitment: commitment,
    _nullifier: nullifier,
    _content: trimmed,
  });
  if (error) return { ok: false, reason: "GATE UNAVAILABLE" };
  if (data !== true) return { ok: false, reason: "NO VALID PASS" };
  return { ok: true };
}

export type ShadowGateSpot = { slug: string; title: string; territoryBlock: number; isActive: boolean };

/** Every gate's territory, for placing archways in the Oasis. No holder data. */
export async function readAllShadowGates(): Promise<ShadowGateSpot[]> {
  const { data, error } = await supabaseAdmin
    .from("shadow_events")
    .select("slug, title, territory_block, is_active")
    .not("slug", "like", "biternam-backroom-%")
    .limit(500);
  if (error || !data) return [];
  return data.map((d) => ({ slug: d.slug, title: d.title, territoryBlock: Number(d.territory_block), isActive: d.is_active }));
}

type Db = { from: (t: string) => any };

export async function readMyShadowEvents(userId: string): Promise<ShadowEventPublic[]> {
  const { data } = await supabaseAdmin
    .from("shadow_events")
    .select("slug, territory_block, title, subtitle, description, max_passes, passes_issued, is_active")
    .eq("issuer_user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((d) => ({
    slug: d.slug,
    territoryBlock: Number(d.territory_block),
    title: d.title,
    subtitle: d.subtitle,
    description: d.description,
    maxPasses: d.max_passes,
    passesIssued: d.passes_issued,
    isActive: d.is_active,
  }));
}

/** Only the verified holder of a BITMAP may open a gate on it. Denials are results. */
export async function issueShadowEvent(
  userDb: Db,
  userId: string,
  input: { height: number; title: string; subtitle: string; description: string; maxPasses: number },
): Promise<{ ok: boolean; reason?: string; slug?: string }> {
  const { data: links } = await userDb.from("wallet_links").select("address").eq("user_id", userId);
  const mine = new Set(((links ?? []) as { address: string }[]).map((l) => l.address));
  if (!mine.size) return { ok: false, reason: "VERIFY A WALLET FIRST ON THE WALLET PAGE" };
  const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
  let holder: string | null = null;
  try {
    holder = (await locateBitmapHolder(input.height)).ownerAddress;
  } catch {
    return { ok: false, reason: "COULD NOT CONFIRM WHO HOLDS THIS BITMAP — TRY AGAIN" };
  }
  if (!holder || !mine.has(holder)) return { ok: false, reason: "ONLY THE HOLDER OF THIS BITMAP CAN OPEN A GATE ON IT" };

  const { count } = await supabaseAdmin
    .from("shadow_events")
    .select("id", { count: "exact", head: true })
    .eq("issuer_user_id", userId)
    .eq("is_active", true);
  if ((count ?? 0) >= 5) return { ok: false, reason: "CLOSE ONE OF YOUR 5 OPEN GATES FIRST" };

  const base = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "gate";
  const slug = `${base}-${input.height}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabaseAdmin.from("shadow_events").insert({
    slug,
    territory_block: input.height,
    title: input.title,
    subtitle: input.subtitle,
    description: input.description,
    max_passes: input.maxPasses,
    issuer_user_id: userId,
  });
  if (error) return { ok: false, reason: "GATE COULD NOT BE OPENED — TRY AGAIN" };
  return { ok: true, slug };
}

export async function setShadowEventActive(userId: string, slug: string, active: boolean) {
  const { data, error } = await supabaseAdmin
    .from("shadow_events")
    .update({ is_active: active })
    .eq("slug", slug)
    .eq("issuer_user_id", userId)
    .select("slug");
  if (error || !data?.length) return { ok: false, reason: "NOT YOUR GATE" };
  return { ok: true };
}

export async function transferShadowPass(slug: string, salt: string, newCommitment: string) {
  if (!HEX64.test(salt) || !HEX64.test(newCommitment)) return { ok: false as const, reason: "MALFORMED TRANSFER" };
  const { data, error } = await supabaseAdmin.rpc("shadow_transfer_pass" as never, {
    _slug: slug,
    _salt: salt,
    _new_commitment: newCommitment,
  } as never);
  if (error) return { ok: false as const, reason: "GATE UNAVAILABLE" };
  const row = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; reason?: string } | null;
  return { ok: Boolean(row?.ok), reason: String(row?.reason ?? "GATE UNAVAILABLE") };
}
