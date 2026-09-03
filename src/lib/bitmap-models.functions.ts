import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const height = z.number().int().min(0).max(999_999);
const inscriptionId = z.string().trim().regex(/^[0-9a-fA-F]{64}i\d+$/);

export const publishBitmapModelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    height,
    inscriptionId,
    scale: z.number().min(0.1).max(4),
    rotationY: z.number().min(-Math.PI * 2).max(Math.PI * 2),
    heightOffset: z.number().min(0).max(2),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { publishBitmapModel } = await import("@/lib/bitmap-models.server");
    return publishBitmapModel(context.userId, data);
  });

export const removeBitmapModelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ height }).parse(input))
  .handler(async ({ data, context }) => {
    const { removeBitmapModel } = await import("@/lib/bitmap-models.server");
    return removeBitmapModel(context.userId, data.height);
  });