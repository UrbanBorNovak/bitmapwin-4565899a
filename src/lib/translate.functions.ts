import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LANGS = ["el", "es", "de", "ru", "hi"] as const;

/** Public: translate a batch of interface strings into a supported language. */
export const translateStringsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        lang: z.enum(LANGS),
        texts: z.array(z.string().min(1).max(600)).min(1).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { translateStrings } = await import("@/lib/translate.server");
    return translateStrings(data.lang, data.texts);
  });
