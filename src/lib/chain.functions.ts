import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadChainBlocks } from "@/lib/chain.server";

export const getChainBlocks = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ pages: z.number().int().min(1).max(6).default(2) }).parse(data ?? {}),
  )
  .handler(async ({ data }) => loadChainBlocks(data.pages));
