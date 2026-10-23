import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Checks whether https://<height>.bitmap.stream has a channel (non-404 embed).
export const probeBitmapStream = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ height: z.number().int().min(0) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`https://${data.height}.bitmap.stream/player-embed`, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(6000),
      });
      return { exists: res.ok };
    } catch {
      return { exists: false };
    }
  });

/** Live status of a channel from its own /api/status: live, offline, or unknown when it can't be confirmed. */
export const streamLiveStatusFn = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ height: z.number().int().min(0) }).parse(data))
  .handler(async ({ data }): Promise<{ status: "live" | "offline" | "unknown" }> => {
    try {
      const res = await fetch(`https://${data.height}.bitmap.stream/api/status`, {
        headers: { "User-Agent": "bitmapwin/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 404) return { status: "offline" };
      if (!res.ok) return { status: "unknown" };
      const j = (await res.json()) as { online?: unknown };
      if (j.online === true) return { status: "live" };
      if (j.online === false) return { status: "offline" };
      return { status: "unknown" };
    } catch {
      return { status: "unknown" };
    }
  });
