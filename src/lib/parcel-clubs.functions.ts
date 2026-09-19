import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getParcelClubBadges = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ address: z.string().trim().min(8).max(128) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { readParcelClubBadges } = await import("@/lib/parcel-clubs.server");
    return readParcelClubBadges(data.address);
  });
