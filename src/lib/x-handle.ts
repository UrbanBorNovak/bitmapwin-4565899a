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
