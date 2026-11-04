import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type BlockCircuit = {
  height: number;
  hash: string;
  timestamp: number;
  size: number;
  weight: number;
  txCount: number;
  inscriptions: { ids: string[]; more: boolean } | null;
};

/** Real block header from the chain plus the inscriptions ordinals.com indexes in that block. */
export const getBlockCircuit = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ height: z.number().int().min(0).max(5_000_000) }).parse(d))
  .handler(async ({ data }): Promise<BlockCircuit | { error: string }> => {
    try {
      const { fetchBlockMeta } = await import("@/lib/block-bytes.server");
      const meta = await fetchBlockMeta(data.height);
      let inscriptions: BlockCircuit["inscriptions"] = null;
      try {
        const r = await fetch(`https://ordinals.com/inscriptions/block/${data.height}`, {
          headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
          signal: AbortSignal.timeout(8000),
        });
        if (r.ok) {
          const html = await r.text();
          const ids = [...new Set(html.match(/[0-9a-f]{64}i\d+/g) ?? [])];
          inscriptions = { ids: ids.slice(0, 100), more: html.includes(`/inscriptions/block/${data.height}/1`) };
        }
      } catch {
        inscriptions = null;
      }
      return { ...meta, inscriptions };
    } catch (e) {
      console.error("block circuit", e);
      return { error: "Block data unavailable right now" };
    }
  });
