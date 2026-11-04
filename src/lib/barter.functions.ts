import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public read: current satpoints for up to 60 inscriptions, from ordinals.com. Null when unreadable. */
export const inscriptionSatpointsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().regex(/^[0-9a-f]{64}i\d+$/)).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const out: Record<string, string | null> = {};
    const queue = [...new Set(data.ids)];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try {
          const r = await fetch(`https://ordinals.com/r/inscription/${id}`, {
            headers: { accept: "application/json", "user-agent": "bitmap-marketplace/1.0" },
            signal: AbortSignal.timeout(10_000),
          });
          const j = r.ok ? ((await r.json()) as { satpoint?: string }) : null;
          out[id] = typeof j?.satpoint === "string" ? j.satpoint : null;
        } catch {
          out[id] = null;
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return out;
  });
