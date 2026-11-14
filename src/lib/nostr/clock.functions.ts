import { createServerFn } from "@tanstack/react-start";

/** Trusted server time, used to correct drifting device clocks before signing Nostr events. */
export const serverNowFn = createServerFn({ method: "GET" }).handler(async () => ({ now: Date.now() }));
