type BridgeReply = { ok: boolean; error?: string; nonce?: string; expiresAt?: number };
export async function callAccountBridge(base: string, secret: string, action: "health" | "challenge" | "create", data: unknown): Promise<BridgeReply> {
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return { ok: false };
    const response = await fetch(new URL(`/v1/${action}`, url.origin), {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(12_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify(data),
    });
    if (!response.ok) return { ok: false };
    const reply = await response.json() as BridgeReply;
    if (reply.ok !== true) {
      const allowed = ["This login or wallet already has an account.", "Challenge expired or already used.", "Too many registration attempts. Try again later."];
      return { ok: false, ...(reply.error && allowed.includes(reply.error) ? { error: reply.error } : {}) };
    }
    return reply;
  } catch { return { ok: false }; }
}