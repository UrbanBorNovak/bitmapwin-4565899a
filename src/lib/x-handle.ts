/** X (Twitter) handle rules: 1–15 letters, digits or underscores; "@" and profile URLs are stripped. */
export const X_HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

export function normalizeXHandle(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim()
    .replace(/^https?:\/\/(www\.|mobile\.)?(x\.com|twitter\.com)\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0] ?? "";
  return raw === "" ? null : raw;
}

export function isValidXHandle(handle: string | null): boolean {
  return handle === null || X_HANDLE_RE.test(handle);
}

/** Public tweet proof: a short token anyone can re-derive from the wallet address. */
export async function xProofToken(address: string): Promise<string> {
  const bytes = new TextEncoder().encode(`bitmapwin-x-proof:${address.trim().toLowerCase()}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash.slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function xProofText(address: string, token: string): string {
  return `Verifying my Bitcoin address ${address} on @bitmapwin\nProof: ${token}`;
}

/** Extract handle + tweet id from an x.com / twitter.com status link. */
export function parseTweetUrl(url: string): { handle: string; id: string } | null {
  const m = url.trim().match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})/i);
  return m ? { handle: m[1], id: m[2] } : null;
}

/** True when the tweet text (oEmbed html) names the address and the token. */
export function tweetProves(html: string, address: string, token: string): boolean {
  const text = html.replace(/<[^>]+>/g, " ").toLowerCase();
  return text.includes(address.toLowerCase()) && text.includes(`proof: ${token}`);
}
