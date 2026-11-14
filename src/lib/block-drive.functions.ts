import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DriveFile = { id: string; number: number | null; contentType: string | null; length: number | null; timestamp: number | null };
export type DriveListing =
  | { ok: true; height: number; bitmapId: string; sat: string; files: DriveFile[]; more: boolean }
  | { ok: false; height: number; error: string };

const ORD = "https://ordinals.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
async function ordJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${ORD}${path}`, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Everything inscribed on a BITMAP's own sat, newest first, read live from ordinals.com. Public chain data only. */
export const driveContentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000) }).parse(d))
  .handler(async ({ data }): Promise<DriveListing> => {
    const { height } = data;
    let bitmapId: string | null = null;
    try {
      const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
      bitmapId = (await locateBitmapHolder(height)).inscriptionId;
    } catch {
      return { ok: false, height, error: `${height}.bitmap isn't indexed yet, or its record couldn't be read.` };
    }
    const meta = await ordJson<{ sat?: number | string | null }>(`/r/inscription/${bitmapId}`);
    if (meta?.sat == null) return { ok: false, height, error: "The chain source didn't answer. Try again in a moment." };
    const sat = String(meta.sat);
    const list = await ordJson<{ ids?: string[]; more?: boolean }>(`/r/sat/${sat}`);
    if (!list) return { ok: false, height, error: "The chain source didn't answer. Try again in a moment." };
    const ids = [...(list.ids ?? [])].filter((id) => id !== bitmapId).reverse().slice(0, 40);
    const files = await Promise.all(
      ids.map(async (id): Promise<DriveFile> => {
        const i = await ordJson<{ number?: number; content_type?: string; content_length?: number; timestamp?: number }>(`/r/inscription/${id}`);
        return { id, number: i?.number ?? null, contentType: i?.content_type ?? null, length: i?.content_length ?? null, timestamp: i?.timestamp ?? null };
      }),
    );
    return { ok: true, height, bitmapId: bitmapId!, sat, files, more: !!list.more || (list.ids?.length ?? 0) - 1 > 40 };
  });
