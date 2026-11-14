import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DriveFile = { id: string; number: number | null; contentType: string | null; length: number | null; timestamp: number | null };
export type DriveListing =
  | { ok: true; height: number; parcelIndex: number | null; bitmapId: string; sat: string; files: DriveFile[]; more: boolean; children: DriveFile[]; moreChildren: boolean }
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
  .inputValidator((d: unknown) => z.object({ height: z.number().int().min(0).max(10_000_000), parcelIndex: z.number().int().min(0).max(100_000).optional() }).parse(d))
  .handler(async ({ data }): Promise<DriveListing> => {
    const { height } = data;
    let bitmapId: string | null = null;
    const parcelIndex = data.parcelIndex ?? null;
    if (parcelIndex !== null) {
      const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
      const ph = await parcelHoldersFor(height).catch(() => null);
      if (!ph) return { ok: false, height, error: "The parcel scan couldn't be read right now. Try again in a moment." };
      const p = ph.parcels.find((x) => x.index === parcelIndex);
      if (!p) return { ok: false, height, error: `Parcel ${parcelIndex}.${height}.bitmap isn't a valid on-chain parcel.` };
      bitmapId = p.inscriptionId.toLowerCase();
    } else try {
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
    const kids = await ordJson<{ ids?: string[]; more?: boolean }>(`/r/children/${bitmapId}`);
    const childIds = [...(kids?.ids ?? [])].reverse().slice(0, 40);
    const read = (xs: string[]) => Promise.all(
      xs.map(async (id): Promise<DriveFile> => {
        const i = await ordJson<{ number?: number; content_type?: string; content_length?: number; timestamp?: number }>(`/r/inscription/${id}`);
        return { id, number: i?.number ?? null, contentType: i?.content_type ?? null, length: i?.content_length ?? null, timestamp: i?.timestamp ?? null };
      }),
    );
    const [files, children] = await Promise.all([read(ids), read(childIds)]);
    return { ok: true, height, parcelIndex, bitmapId: bitmapId!, sat, files, more: !!list.more || (list.ids?.length ?? 0) - 1 > 40, children, moreChildren: !!kids?.more || (kids?.ids?.length ?? 0) > 40 };
  });
