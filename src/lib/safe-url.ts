/**
 * URL hardening for builder-supplied links. Only http(s) links may be stored or
 * rendered, so a build page cannot smuggle a `javascript:` or `data:` URI into
 * an anchor href and run code in a visitor's session.
 */

export function isSafeExternalUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const raw = value.trim();
  if (raw === "") return false;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns the URL when it is a safe http(s) link, otherwise null. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  return isSafeExternalUrl(raw) ? raw : null;
}

/** Same as safeExternalUrl but throws, for use on write paths. */
export function assertSafeExternalUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const safe = safeExternalUrl(value);
  if (!safe) throw new Error("LINKS MUST START WITH HTTP:// OR HTTPS://");
  return safe;
}
