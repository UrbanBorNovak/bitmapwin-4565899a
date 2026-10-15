import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public: reads an inscribed Land Forge piece from Bitcoin so the studio can snap it in. */
export const forgePieceFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().regex(/^[0-9a-f]{64}i\d+$/) }).parse(d))
  .handler(async ({ data }) => {
    const { forgePieceBlocks } = await import("@/lib/forge.server");
    const blocks = await forgePieceBlocks(data.id);
    if (!blocks || !blocks.length) return { ok: false as const, error: "NO LAND FORGE VOXELS FOUND IN THAT INSCRIPTION" };
    if (blocks.length > 12000) return { ok: false as const, error: "THAT PIECE IS TOO BIG TO SNAP IN" };
    return { ok: true as const, blocks };
  });
