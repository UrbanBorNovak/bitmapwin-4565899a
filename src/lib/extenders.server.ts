import { locateBitmap } from "@/lib/locate-bitmap.server";

/**
 * Server-side authority for the extender ecosystem.
 *
 * Nothing here trusts the browser: land-touching writes (deploy, undeploy,
 * grant) re-check live on-chain ownership through `locateBitmap`, or an
 * explicit authorisation the owner already recorded (a land grant or an active
 * lease). Creator-owned records (extenders, versions, dependencies,
 * permissions) are scoped to the caller's account id.
 */

type LandPermission = "view" | "enter" | "build" | "edit" | "deploy" | "manage" | "lease" | "monetize";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function linkedAddresses(userId: string): Promise<string[]> {
  const db = await admin();
  const { data, error } = await db.from("wallet_links").select("address").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.address);
}

/** The linked address that actually holds this BITMAP on chain right now. */
async function liveOwnerAddress(userId: string, height: number): Promise<string | null> {
  const addresses = await linkedAddresses(userId);
  for (const address of addresses) {
    const location = await locateBitmap({ height, address });
    if (location.heldByAddress) return address;
  }
  return null;
}

export type DeployAuthorisation = { address: string; grantedVia: "owner" | "grant" | "lease" };

/**
 * Who may deploy on a tile: the live on-chain holder, a builder the holder
 * granted `deploy`/`build` rights to, or the lessee of a running lease.
 */
export async function authoriseDeploy(userId: string, height: number): Promise<DeployAuthorisation> {
  const owner = await liveOwnerAddress(userId, height);
  if (owner) return { address: owner, grantedVia: "owner" };

  const addresses = await linkedAddresses(userId);
  if (addresses.length === 0) throw new Error("LINK A BITCOIN WALLET BEFORE DEPLOYING AN EXTENDER");

  const db = await admin();
  const nowIso = new Date().toISOString();

  const { data: grants, error: grantError } = await db
    .from("land_grants")
    .select("grantee_address, permissions, expires_at")
    .eq("bitmap_height", height)
    .in("grantee_address", addresses);
  if (grantError) throw grantError;
  const grant = (grants ?? []).find(
    (row) =>
      (!row.expires_at || row.expires_at > nowIso) &&
      ((row.permissions ?? []) as LandPermission[]).some((p) => p === "deploy" || p === "build"),
  );
  if (grant) return { address: grant.grantee_address, grantedVia: "grant" };

  const { data: leases, error: leaseError } = await db
    .from("leases")
    .select("lessee_address, status, ends_at")
    .eq("bitmap_height", height)
    .in("lessee_address", addresses)
    .eq("status", "active");
  if (leaseError) throw leaseError;
  const lease = (leases ?? []).find((row) => row.ends_at > nowIso);
  if (lease) return { address: lease.lessee_address, grantedVia: "lease" };

  throw new Error("YOU DO NOT OWN, LEASE OR HOLD A BUILD GRANT ON THIS BITMAP");
}

export async function requireLiveOwner(userId: string, height: number): Promise<string> {
  const owner = await liveOwnerAddress(userId, height);
  if (!owner) throw new Error("YOUR LINKED WALLETS DO NOT HOLD THIS BITMAP ON CHAIN");
  return owner;
}

export type ExtenderDraft = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  isAiBuilt: boolean;
  license: string;
  monetization: "free" | "paid" | "lease";
  priceSats: number;
  priceBit: number;
  iconInscriptionId: string | null;
  previewInscriptionId: string | null;
};

export async function createExtender(userId: string, draft: ExtenderDraft) {
  const db = await admin();
  const addresses = await linkedAddresses(userId);
  const { data, error } = await db
    .from("extenders")
    .insert({
      slug: draft.slug,
      name: draft.name,
      summary: draft.summary,
      description: draft.description,
      category: draft.category,
      tags: draft.tags,
      creator_user_id: userId,
      creator_address: addresses[0] ?? null,
      icon_inscription_id: draft.iconInscriptionId,
      preview_inscription_id: draft.previewInscriptionId,
      is_ai_built: draft.isAiBuilt,
      license: draft.license,
      monetization: draft.monetization,
      price_sats: draft.priceSats,
      price_bit: draft.priceBit,
      status: "draft",
    })
    .select("id, slug")
    .single();
  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate")) {
      throw new Error("THAT EXTENDER ID IS ALREADY TAKEN");
    }
    throw error;
  }
  return data;
}

async function ownExtender(userId: string, extenderId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("extenders")
    .select("id, creator_user_id")
    .eq("id", extenderId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.creator_user_id !== userId) throw new Error("YOU ARE NOT THE CREATOR OF THIS EXTENDER");
  return data.id;
}

export async function setExtenderStatus(userId: string, extenderId: string, status: "draft" | "published" | "archived") {
  await ownExtender(userId, extenderId);
  const db = await admin();
  const { error } = await db.from("extenders").update({ status }).eq("id", extenderId);
  if (error) throw error;
  return { ok: true };
}

export async function updateExtenderMetadata(
  userId: string,
  input: Partial<{
    extenderId: string;
    name: string;
    summary: string;
    description: string;
    category: string;
    tags: string[];
    license: string;
    monetization: "free" | "paid" | "lease";
    priceBit: number;
    iconInscriptionId: string | null;
    previewInscriptionId: string | null;
  }>,
) {
  await ownExtender(userId, input.extenderId!);
  const db = await admin();
  const update: Record<string, string | string[] | number | null | undefined> = {};
  if (input.name !== undefined) update["name"] = input.name;
  if (input.summary !== undefined) update["summary"] = input.summary;
  if (input.description !== undefined) update["description"] = input.description;
  if (input.category !== undefined) update["category"] = input.category;
  if (input.tags !== undefined) update["tags"] = input.tags;
  if (input.license !== undefined) update["license"] = input.license;
  if (input.monetization !== undefined) update["monetization"] = input.monetization;
  if (input.priceBit !== undefined) update["price_bit"] = input.priceBit;
  if (input.iconInscriptionId !== undefined) update["icon_inscription_id"] = input.iconInscriptionId;
  if (input.previewInscriptionId !== undefined) update["preview_inscription_id"] = input.previewInscriptionId;

  const { error } = await db.from("extenders").update(update).eq("id", input.extenderId!);
  if (error) throw error;
  return { ok: true };
}

export type VersionDraft = {
  extenderId: string;
  semver: string;
  sdkVersion: string;
  changelog: string;
  manifest: Record<string, unknown>;
  publish: boolean;
  dependencies: { extenderId: string; versionRange: string }[];
  permissions: { permission: LandPermission; reason: string }[];
};

export async function publishVersion(userId: string, draft: VersionDraft) {
  await ownExtender(userId, draft.extenderId);
  const db = await admin();
  const { data, error } = await db
    .from("extender_versions")
    .insert({
      extender_id: draft.extenderId,
      semver: draft.semver,
      sdk_version: draft.sdkVersion,
      changelog: draft.changelog,
      manifest: draft.manifest as Record<string, never>,
      status: draft.publish ? "published" : "draft",
      published_at: draft.publish ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("duplicate")) throw new Error("THAT VERSION NUMBER ALREADY EXISTS");
    throw error;
  }

  if (draft.dependencies.length > 0) {
    const { error: depError } = await db.from("extender_dependencies").insert(
      draft.dependencies.map((dep) => ({
        version_id: data.id,
        depends_on_extender_id: dep.extenderId,
        version_range: dep.versionRange,
      })),
    );
    if (depError) throw depError;
  }
  if (draft.permissions.length > 0) {
    const { error: permError } = await db.from("extender_permissions").insert(
      draft.permissions.map((perm) => ({
        version_id: data.id,
        permission: perm.permission,
        reason: perm.reason,
      })),
    );
    if (permError) throw permError;
  }
  if (draft.publish) {
    const { error: statusError } = await db
      .from("extenders")
      .update({ status: "published" })
      .eq("id", draft.extenderId);
    if (statusError) throw statusError;
  }
  return { versionId: data.id };
}

export async function deployExtender(
  userId: string,
  input: { extenderId: string; versionId: string; height: number; config: Record<string, unknown> },
) {
  const auth = await authoriseDeploy(userId, input.height);
  const db = await admin();

  const { data: version, error: versionError } = await db
    .from("extender_versions")
    .select("id, extender_id, status")
    .eq("id", input.versionId)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version || version.extender_id !== input.extenderId) throw new Error("VERSION DOES NOT BELONG TO THIS EXTENDER");
  if (version.status !== "published") throw new Error("ONLY PUBLISHED VERSIONS CAN BE DEPLOYED");

  const { data, error } = await db
    .from("extender_deployments")
    .upsert(
      {
        extender_id: input.extenderId,
        version_id: input.versionId,
        bitmap_height: input.height,
        deployed_by_user_id: userId,
        deployed_by_address: auth.address,
        granted_via: auth.grantedVia,
        config: input.config as Record<string, never>,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bitmap_height,extender_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return { deploymentId: data.id, grantedVia: auth.grantedVia };
}

export async function undeployExtender(userId: string, input: { deploymentId: string }) {
  const db = await admin();
  const { data: deployment, error } = await db
    .from("extender_deployments")
    .select("id, bitmap_height, deployed_by_user_id")
    .eq("id", input.deploymentId)
    .maybeSingle();
  if (error) throw error;
  if (!deployment) throw new Error("DEPLOYMENT NOT FOUND");

  if (deployment.deployed_by_user_id !== userId) {
    // Anyone who is not the deployer must be the current on-chain land holder.
    await requireLiveOwner(userId, Number(deployment.bitmap_height));
  }
  const { error: deleteError } = await db.from("extender_deployments").delete().eq("id", input.deploymentId);
  if (deleteError) throw deleteError;
  return { ok: true };
}

export async function grantLand(
  userId: string,
  input: { height: number; granteeAddress: string; permissions: LandPermission[]; note: string | null; days: number | null },
) {
  const ownerAddress = await requireLiveOwner(userId, input.height);
  const db = await admin();
  const expiresAt = input.days ? new Date(Date.now() + input.days * 86_400_000).toISOString() : null;
  const { data, error } = await db
    .from("land_grants")
    .upsert(
      {
        bitmap_height: input.height,
        owner_user_id: userId,
        owner_address: ownerAddress,
        grantee_address: input.granteeAddress,
        permissions: input.permissions,
        note: input.note,
        expires_at: expiresAt,
      },
      { onConflict: "bitmap_height,grantee_address" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return { grantId: data.id };
}

export async function revokeLandGrant(userId: string, grantId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("land_grants")
    .select("id, owner_user_id")
    .eq("id", grantId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.owner_user_id !== userId) throw new Error("ONLY THE LAND OWNER CAN REVOKE THIS GRANT");
  const { error: deleteError } = await db.from("land_grants").delete().eq("id", grantId);
  if (deleteError) throw deleteError;
  return { ok: true };
}

export async function foundCity(
  userId: string,
  input: { slug: string; name: string; description: string; height: number },
) {
  const founderAddress = await requireLiveOwner(userId, input.height);
  const db = await admin();
  const { data, error } = await db
    .from("cities")
    .insert({
      slug: input.slug,
      name: input.name,
      description: input.description,
      founder_user_id: userId,
      founder_address: founderAddress,
    })
    .select("id, slug")
    .single();
  if (error) {
    if (error.message.includes("duplicate")) throw new Error("THAT CITY NAME IS ALREADY TAKEN");
    throw error;
  }
  const { error: memberError } = await db.from("city_bitmaps").insert({
    city_id: data.id,
    bitmap_height: input.height,
    member_address: founderAddress,
    member_user_id: userId,
  });
  if (memberError) throw memberError;
  return data;
}

export async function joinCity(userId: string, input: { cityId: string; height: number }) {
  const memberAddress = await requireLiveOwner(userId, input.height);
  const db = await admin();
  const { error } = await db.from("city_bitmaps").upsert(
    {
      city_id: input.cityId,
      bitmap_height: input.height,
      member_address: memberAddress,
      member_user_id: userId,
    },
    { onConflict: "city_id,bitmap_height" },
  );
  if (error) throw error;
  return { ok: true };
}
