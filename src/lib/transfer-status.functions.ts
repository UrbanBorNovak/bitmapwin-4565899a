import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Live transfer check for a purchase: is the tx confirmed, and does the
 * inscription now sit at the buyer's address? Read straight from the chain.
 */
export const transferStatusFn = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        txid: z.string().regex(/^[0-9a-f]{64}$/i),
        inscriptionId: z.string().regex(/^[0-9a-f]{64}i\d+$/i).optional(),
        buyerAddress: z.string().min(10).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    let seen = false;
    let confirmed = false;
    let blockHeight: number | null = null;
    for (const host of ["https://mempool.space/api", "https://blockstream.info/api"]) {
      try {
        const r = await fetch(`${host}/tx/${data.txid}/status`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) continue;
        const s = (await r.json()) as { confirmed?: boolean; block_height?: number };
        seen = true;
        confirmed = !!s.confirmed;
        blockHeight = s.block_height ?? null;
        break;
      } catch {
        // next mirror
      }
    }
    let owner: string | null = null;
    let landed = false;
    if (data.inscriptionId) {
      try {
        const r = await fetch(`https://ordinals.com/inscription/${data.inscriptionId}`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (r.ok) {
          const j = (await r.json()) as { address?: string | null; satpoint?: string };
          owner = j.address ?? null;
          landed = owner === data.buyerAddress && (j.satpoint ?? "").startsWith(data.txid);
        }
      } catch {
        // indexer unavailable; report unknown
      }
    }
    return { seen, confirmed, blockHeight, owner, landed };
  });
