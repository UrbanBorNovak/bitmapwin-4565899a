import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BUILD_TIER_IDS, DEFAULT_BUILD_TIER, buildTier } from "@/lib/build-tiers";

/** Users may not build with AI; kept as a server-side switch so the browser cannot bypass it. */
const AI_BUILD_OFF = true;

const inputSchema = z.object({
  prompt: z.string().trim().min(4).max(1200),
  height: z.number().int().nonnegative().max(3_000_000).default(36095),
  category: z.string().trim().max(40).default("world-systems"),
  existingCode: z.string().max(24_000).default(""),
  tier: z.enum(BUILD_TIER_IDS).default(DEFAULT_BUILD_TIER),
});

/** Writes extender SDK code from a plain-English brief. Signed-in builders only. */
export const generateExtenderCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ code: string }> => {
    if (AI_BUILD_OFF) throw new Error("AI BUILDING IS SWITCHED OFF");
    const { writeExtenderCode, listModelCatalogue } = await import("@/lib/extender-ai.server");
    const models = await listModelCatalogue();
    const code = await writeExtenderCode({ ...data, models });
    return { code };

  });

/** Plans a package and writes its code in one pass. Signed-in builders only. */
export const buildExtenderPackageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        prompt: z.string().trim().min(8).max(1200),
        height: z.number().int().nonnegative().max(3_000_000).default(36095),
        tier: z.enum(BUILD_TIER_IDS).default(DEFAULT_BUILD_TIER),
        address: z.string().trim().min(16).max(120),
      })
      .parse(data),
  )

  .handler(async ({ data, context }) => {
    if (AI_BUILD_OFF) throw new Error("AI BUILDING IS SWITCHED OFF");
    const { buildExtenderPackage } = await import("@/lib/extender-ai.server");
    const { assertControls, bitBalance, spendBit } = await import("@/lib/coins.server");
    const tier = buildTier(data.tier);

    // The wallet must belong to this account, and it must be able to pay first.
    await assertControls(context.supabase, context.userId, data.address);
    const balance = await bitBalance(data.address);
    if (balance < tier.costBit) {
      throw new Error(
        `The ${tier.label} build costs ${tier.costBit} BIT and this wallet holds ${balance} BIT`,
      );
    }

    // Charge only once the build actually produced something runnable.
    const built = await buildExtenderPackage({ prompt: data.prompt, height: data.height, tier: data.tier });
    const charged = await spendBit({
      address: data.address,
      amount: tier.costBit,
      reason: "ai_build",
      ref: `${tier.id}:${data.height}`,
    });
    return { ...built, tier: tier.id, costBit: tier.costBit, balance: charged.balance };
  });
