import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Typed RPC boundary for the extender ecosystem. Every handler runs behind an
 * authenticated session and delegates to `extenders.server.ts`, which re-checks
 * live on-chain land rights before writing anything.
 */

const uuid = z.string().uuid();
const height = z.number().int().min(0).max(999_999);
const slug = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{2,59}$/, "USE LOWERCASE LETTERS, NUMBERS AND DASHES");
const semver = z.string().trim().regex(/^\d+\.\d+\.\d+$/, "USE A VERSION LIKE 1.0.0");
const permission = z.enum(["view", "enter", "build", "edit", "deploy", "manage", "lease", "monetize"]);
const address = z.string().trim().min(20).max(100);

export const createExtenderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        slug,
        name: z.string().trim().min(2).max(80),
        summary: z.string().trim().max(200).default(""),
        description: z.string().trim().max(4000).default(""),
        category: z.string().trim().min(2).max(40),
        tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
        isAiBuilt: z.boolean().default(false),
        license: z.string().trim().max(60).default("all-rights-reserved"),
        monetization: z.enum(["free", "paid", "lease"]).default("free"),
        priceSats: z.number().int().min(0).max(2_100_000_000_000).default(0),
        priceBit: z.number().int().min(0).max(100_000_000).default(0),
        iconInscriptionId: z.string().trim().regex(/^[0-9a-fA-F]{64}i\d+$/).nullable().default(null),
        previewInscriptionId: z.string().trim().regex(/^[0-9a-fA-F]{64}i\d+$/).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { createExtender } = await import("@/lib/extenders.server");
    return createExtender(context.userId, data);
  });

export const setExtenderStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ extenderId: uuid, status: z.enum(["draft", "published", "archived"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setExtenderStatus } = await import("@/lib/extenders.server");
    return setExtenderStatus(context.userId, data.extenderId, data.status);
  });

export const updateExtenderMetadataFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        extenderId: uuid,
        name: z.string().trim().min(2).max(80).optional(),
        summary: z.string().trim().max(200).optional(),
        description: z.string().trim().max(4000).optional(),
        category: z.string().trim().min(2).max(40).optional(),
        tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
        license: z.string().trim().max(60).optional(),
        monetization: z.enum(["free", "paid", "lease"]).optional(),
        priceBit: z.number().int().min(0).max(100_000_000).optional(),
        iconInscriptionId: z.string().trim().regex(/^[0-9a-fA-F]{64}i\d+$/).nullable().optional(),
        previewInscriptionId: z.string().trim().regex(/^[0-9a-fA-F]{64}i\d+$/).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { updateExtenderMetadata } = await import("@/lib/extenders.server");
    return updateExtenderMetadata(context.userId, data);
  });

export const publishVersionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        extenderId: uuid,
        semver,
        sdkVersion: z.string().trim().max(12).default("0.2"),
        changelog: z.string().trim().max(2000).default(""),
        manifest: z.record(z.string(), z.unknown()).default({}),
        publish: z.boolean().default(true),
        dependencies: z.array(z.object({ extenderId: uuid, versionRange: z.string().trim().max(24).default("*") })).max(16).default([]),
        permissions: z.array(z.object({ permission, reason: z.string().trim().max(200).default("") })).max(8).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { publishVersion } = await import("@/lib/extenders.server");
    return publishVersion(context.userId, data);
  });

export const deployExtenderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        extenderId: uuid,
        versionId: uuid,
        height,
        config: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { deployExtender } = await import("@/lib/extenders.server");
    return deployExtender(context.userId, data);
  });

export const undeployExtenderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deploymentId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { undeployExtender } = await import("@/lib/extenders.server");
    return undeployExtender(context.userId, data);
  });

export const grantLandFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        height,
        granteeAddress: address,
        permissions: z.array(permission).min(1).max(8),
        note: z.string().trim().max(200).nullable().default(null),
        days: z.number().int().min(1).max(3650).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { grantLand } = await import("@/lib/extenders.server");
    return grantLand(context.userId, data);
  });

export const revokeLandGrantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ grantId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { revokeLandGrant } = await import("@/lib/extenders.server");
    return revokeLandGrant(context.userId, data.grantId);
  });

export const foundCityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        slug,
        name: z.string().trim().min(2).max(60),
        description: z.string().trim().max(1000).default(""),
        height,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { foundCity } = await import("@/lib/extenders.server");
    return foundCity(context.userId, data);
  });

export const joinCityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cityId: uuid, height }).parse(input))
  .handler(async ({ data, context }) => {
    const { joinCity } = await import("@/lib/extenders.server");
    return joinCity(context.userId, data);
  });
