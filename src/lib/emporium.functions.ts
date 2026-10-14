import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public: anyone (or any agent) may check Emporium residency for an address. */
export const verifyEmporiumResidentFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ address: z.string().trim().min(8).max(128) }).parse(data))
  .handler(async ({ data }) => {
    const { verifyEmporiumResident } = await import("@/lib/emporium.server");
    return verifyEmporiumResident(data.address);
  });
