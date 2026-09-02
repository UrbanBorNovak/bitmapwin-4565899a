import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Visit counting. The underlying `record_bitmap_view` routine is trusted-server
 * only, so browsers go through this validated server function instead of calling
 * the database helper directly.
 */
export const recordBitmapViewFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        height: z.number().int().min(0).max(10_000_000),
        visitor: z.string().trim().min(8).max(128),
        address: z.string().trim().min(14).max(120).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("record_bitmap_view", {
      _height: data.height,
      _visitor: data.visitor,
      ...(data.address ? { _address: data.address } : {}),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
