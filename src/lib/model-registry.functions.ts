import { createServerFn } from "@tanstack/react-start";
import { INSCRIPTION_ID_RE, isRegisteredModel } from "@/lib/model-registry";

/** Live check of a registered model's inscribed bytes on ordinals.com. */
export const verifyRegistryModelFn = createServerFn({ method: "POST" })
  .inputValidator((d: { inscription: string }) => {
    if (!INSCRIPTION_ID_RE.test(d?.inscription ?? "")) throw new Error("INVALID INSCRIPTION ID");
    return d;
  })
  .handler(async ({ data }) => {
    if (!isRegisteredModel(data.inscription)) return { ok: false as const, error: "NOT IN REGISTRY" };
    const { validateOnChainGlb } = await import("@/lib/bitmap-model-validation.server");
    try {
      return { ok: true as const, ...(await validateOnChainGlb(data.inscription)) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "CHECK FAILED" };
    }
  });
