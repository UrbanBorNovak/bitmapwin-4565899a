import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Opens a WebRTC (WHIP) ingest on the edge relay and restreams it over RTMP to Kick.
// The stream key passes through once and is never stored.
const CF = "https://api.cloudflare.com/client/v4/accounts";

// The relay spends the site's Cloudflare account, so only admins may open or close one.
async function isAdmin(context: { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return data === true;
}

export const openKickRelay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rtmpUrl: z.string().trim().regex(/^rtmps?:\/\/[^\s]+$/).max(300),
        streamKey: z.string().trim().min(8).max(300),
        label: z.string().trim().max(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) return { ok: false as const, reason: "ADMINS ONLY" };
    const account = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const token = process.env["CLOUDFLARE_STREAM_TOKEN"];
    if (!account || !token) return { ok: false as const, reason: "THE LIVE RELAY IS NOT SET UP YET" };
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const li = await fetch(`${CF}/${account}/stream/live_inputs`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ meta: { name: `bitmapwin ${data.label}` }, recording: { mode: "off" }, deleteRecordingAfterDays: 1 }),
    }).then((r) => r.json() as Promise<any>);
    const uid: string | undefined = li?.result?.uid;
    const whip: string | undefined = li?.result?.webRTC?.url;
    if (!uid || !whip) return { ok: false as const, reason: "THE RELAY COULD NOT OPEN A SESSION" };
    const out = await fetch(`${CF}/${account}/stream/live_inputs/${uid}/outputs`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ url: data.rtmpUrl, streamKey: data.streamKey, enabled: true }),
    }).then((r) => r.json() as Promise<any>);
    if (!out?.success) {
      await fetch(`${CF}/${account}/stream/live_inputs/${uid}`, { method: "DELETE", headers: h });
      return { ok: false as const, reason: "KICK REJECTED THE STREAM URL OR KEY" };
    }
    return { ok: true as const, uid, whipUrl: whip };
  });

export const closeKickRelay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ uid: z.string().regex(/^[a-f0-9]{32}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) return { ok: false };
    const account = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const token = process.env["CLOUDFLARE_STREAM_TOKEN"];
    if (!account || !token) return { ok: false };
    await fetch(`${CF}/${account}/stream/live_inputs/${data.uid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: true };
  });
