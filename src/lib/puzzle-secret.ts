/**
 * Puzzle secrets (a found private key, a signed sweep) live ONLY in page
 * memory. They are never written in readable form to browser storage (the only
 * stored copy is the passphrase-encrypted backup in key-vault.ts),
 * never logged, and every message shown or reported is passed through
 * redactSecrets first. A backup file is written only when the finder clicks.
 */
export const LEGACY_FOUND_KEY = "bitmap.puzzle.found";

/** Strip anything that looks like a private key, signed tx or WIF. */
export function redactSecrets(text: string): string {
  return text
    .replace(/(?:0x)?[0-9a-fA-F]{40,}/g, "[REDACTED]")
    .replace(/\b[5KLc9][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "[REDACTED]");
}

/** Safe, user-facing text for any caught error. */
export function safeError(e: unknown): string {
  return redactSecrets(e instanceof Error ? e.message : String(e ?? "Unknown error")).slice(0, 200);
}

/** One-time migration: move a key saved by an older version into memory and erase it from storage. */
export function takeLegacyStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const k = window.localStorage.getItem(LEGACY_FOUND_KEY);
    window.localStorage.removeItem(LEGACY_FOUND_KEY);
    return k && /^[0-9a-f]{64}$/i.test(k) ? k : null;
  } catch { return null; }
}

/** Finder-initiated backup only. */
export function downloadKeyBackup(keyHex: string) {
  const url = URL.createObjectURL(new Blob([`PUZZLE #71 KEY\n${keyHex}\n`], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url; a.download = "puzzle71-key.txt"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Warn before closing the tab while a key exists only in memory. */
export function guardUnload(on: boolean) {
  if (typeof window === "undefined") return;
  window.onbeforeunload = on ? (e) => { e.preventDefault(); return ""; } : null;
}

/** The exact phrase the finder must type before a Slipstream submission. */
export const CONFIRM_PHRASE = "SUBMIT TO MARA";
export const confirmMatches = (typed: string) => typed.trim().toUpperCase() === CONFIRM_PHRASE;
