import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  prompt: z.string().trim().min(4).max(1200),
  height: z.number().int().nonnegative().max(3_000_000).default(36095),
  category: z.string().trim().max(40).default("world-systems"),
  existingCode: z.string().max(24_000).default(""),
});

/** Writes extender SDK code from a plain-English brief. Signed-in builders only. */
export const generateExtenderCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ code: string }> => {
    const { writeExtenderCode } = await import("@/lib/extender-ai.server");
    const code = await writeExtenderCode(data);
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
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { buildExtenderPackage } = await import("@/lib/extender-ai.server");
    return buildExtenderPackage(data);
  });
