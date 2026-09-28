import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const slug = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/);
const op = z.enum(["gate", "pass", "spend"]);

const walletShape = {
  payerAddress: z.string().trim().min(14).max(90),
  tapInternalKeyHex: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  paymentPublicKeyHex: z.union([z.string(), z.array(z.string()).max(4)]).optional(),
};

/**
 * Checks the requested note is legitimate before any transaction is built.
 * A gate note may only be anchored by the holder who opened the gate; a pass or
 * spend note must match a commitment the gate already recognises.
 */
async function resolveTarget(
  input: { op: "gate" | "pass" | "spend"; slug: string; digest: string },
  userId: string | null,
): Promise<{ ok: true; target: { op: "gate" | "pass" | "spend"; slug: string; height: number; index: number; digest: string } } | { ok: false; reason: string }> {
  const { gateForNote, readShadowNoteByDigest } = await import("@/lib/shadow-l1.server");
  const gate = await gateForNote(input.slug);
  if (!gate) return { ok: false, reason: "THIS GATE DOES NOT EXIST" };

  const already = await readShadowNoteByDigest(input.digest);
  if (already) return { ok: false, reason: "THIS NOTE IS ALREADY ON BITCOIN" };

  if (input.op === "gate") {
    if (!userId || gate.issuer_user_id !== userId) {
      return { ok: false, reason: "ONLY THE HOLDER WHO OPENED THIS GATE CAN ANCHOR IT" };
    }
    return {
      ok: true,
      target: { op: "gate", slug: gate.slug, height: Number(gate.territory_block), index: 0, digest: input.digest },
    };
  }

  const { verifyShadowPass } = await import("@/lib/shadow-assets.server");
  const valid = await verifyShadowPass(input.slug, input.digest);
  if (input.op === "pass" && !valid) return { ok: false, reason: "THIS PASS IS NOT RECOGNISED AT THE GATE" };

  return {
    ok: true,
    target: {
      op: input.op,
      slug: gate.slug,
      height: Number(gate.territory_block),
      index: Math.min(65535, Number(gate.passes_issued ?? 0)),
      digest: input.digest,
    },
  };
}

export const quoteShadowNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ op, slug, digest: hex64, ...walletShape }).parse(d))
  .handler(async ({ data }) => {
    const resolved = await resolveTarget(data, null);
    if (!resolved.ok && data.op === "gate") return { ok: false as const, reason: resolved.reason };
    if (!resolved.ok) return { ok: false as const, reason: resolved.reason };
    const { quoteShadowNote } = await import("@/lib/shadow-l1.server");
    try {
      const quote = await quoteShadowNote({
        target: resolved.target,
        payerAddress: data.payerAddress,
        ...(data.tapInternalKeyHex ? { tapInternalKeyHex: data.tapInternalKeyHex } : {}),
        ...(data.paymentPublicKeyHex ? { paymentPublicKeyHex: data.paymentPublicKeyHex } : {}),
      });
      return { ok: true as const, quote };
    } catch (error) {
      return { ok: false as const, reason: (error as Error).message.toUpperCase() };
    }
  });

/** Gate genesis notes are signed by the holder, so this path requires auth. */
export const quoteShadowGateNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug, digest: hex64, ...walletShape }).parse(d))
  .handler(async ({ data, context }) => {
    const resolved = await resolveTarget({ op: "gate", slug: data.slug, digest: data.digest }, context.userId);
    if (!resolved.ok) return { ok: false as const, reason: resolved.reason };
    const { quoteShadowNote } = await import("@/lib/shadow-l1.server");
    try {
      const quote = await quoteShadowNote({
        target: resolved.target,
        payerAddress: data.payerAddress,
        ...(data.tapInternalKeyHex ? { tapInternalKeyHex: data.tapInternalKeyHex } : {}),
        ...(data.paymentPublicKeyHex ? { paymentPublicKeyHex: data.paymentPublicKeyHex } : {}),
      });
      return { ok: true as const, quote };
    } catch (error) {
      return { ok: false as const, reason: (error as Error).message.toUpperCase() };
    }
  });

export const submitShadowNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ op, slug, digest: hex64, psbt: z.string().min(40).max(200_000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const resolved = await resolveTarget(data, null);
    if (!resolved.ok) return { ok: false as const, reason: resolved.reason };
    const { submitShadowNote } = await import("@/lib/shadow-l1.server");
    return submitShadowNote({ target: resolved.target, psbtBase64: data.psbt });
  });

export const submitShadowGateNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug, digest: hex64, psbt: z.string().min(40).max(200_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const resolved = await resolveTarget({ op: "gate", slug: data.slug, digest: data.digest }, context.userId);
    if (!resolved.ok) return { ok: false as const, reason: resolved.reason };
    const { submitShadowNote } = await import("@/lib/shadow-l1.server");
    return submitShadowNote({ target: resolved.target, psbtBase64: data.psbt });
  });

export const getShadowNotesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug }).parse(d))
  .handler(async ({ data }) => {
    const { readShadowNotes } = await import("@/lib/shadow-l1.server");
    return readShadowNotes(data.slug);
  });

export const getShadowNoteFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ digest: hex64 }).parse(d))
  .handler(async ({ data }) => {
    const { readShadowNoteByDigest } = await import("@/lib/shadow-l1.server");
    return readShadowNoteByDigest(data.digest);
  });
