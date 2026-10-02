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
