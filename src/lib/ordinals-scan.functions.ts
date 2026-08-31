import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { scanBlock, scanRecentBlocks } from "@/lib/ordinals-scan.server";

export const getRecentInscriptions = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        blocks: z.number().int().min(1).max(12).default(6),
        txPages: z.number().int().min(1).max(12).default(4),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => scanRecentBlocks(data.blocks, data.txPages));

export const getBlockInscriptions = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        height: z.number().int().min(0),
        txPages: z.number().int().min(1).max(12).default(6),
      })
      .parse(data),
  )
  .handler(async ({ data }) => scanBlock(data.height, data.txPages));

export const getBitmapOwners = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ txids: z.array(z.string().regex(/^[0-9a-fA-F]{64}$/)).min(1).max(60) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { resolveOwners } = await import("@/lib/ordinals-scan.server");
    return resolveOwners(data.txids);
  });
