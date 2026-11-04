/**
 * Encrypted local recovery backup for a found Puzzle #71 key.
 *
 * The finder sets a passphrase ahead of time. That creates an ECDH P-256
 * keypair: the public half is stored in plain form, the private half is stored
 * only after AES-GCM encryption with a PBKDF2 key from the passphrase. When a
 * key is found (even unattended), it is sealed to the public half, so nothing
 * readable is ever written and the passphrase is never stored. Opening a backup
 * needs the passphrase. Nothing here talks to a server.
 *
 * Sealed backups are only removed by an explicit, typed user action — never
 * because a sweep was submitted.
 */
const VAULT_KEY = "bitmap.puzzle.vault.v1";
const SEALED_KEY = "bitmap.puzzle.vault.sealed.v1";
const ITER = 310_000;
export const VAULT_MIN_PASS = 10;
export const DELETE_PHRASE = "DELETE MY BACKUP";

type Vault = { pub: string; salt: string; iv: string; wrapped: string };
export type SealedBackup = { at: string; address?: string | undefined; epk: string; iv: string; ct: string; vault?: Vault };

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ls = () => (typeof window === "undefined" ? null : window.localStorage);
const subtle = () => globalThis.crypto.subtle;
const EC = { name: "ECDH", namedCurve: "P-256" } as const;

function readVault(): Vault | null {
  try { const v = ls()?.getItem(VAULT_KEY); return v ? (JSON.parse(v) as Vault) : null; } catch { return null; }
}
export const vaultConfigured = () => !!readVault();

export function listSealed(): SealedBackup[] {
  try { const v = ls()?.getItem(SEALED_KEY); return v ? (JSON.parse(v) as SealedBackup[]) : []; } catch { return []; }
}

async function passKey(pass: string, salt: Uint8Array) {
  const base = await subtle().importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Create (or replace) the vault. Existing sealed backups stay readable only with their old passphrase. */
export async function setupVault(pass: string): Promise<void> {
  if (pass.length < VAULT_MIN_PASS) throw new Error(`Passphrase must be at least ${VAULT_MIN_PASS} characters`);
  const kp = await subtle().generateKey(EC, true, ["deriveKey"]);
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const pkcs8 = await subtle().exportKey("pkcs8", kp.privateKey);
  const wrapped = await subtle().encrypt({ name: "AES-GCM", iv }, await passKey(pass, salt), pkcs8);
  const pub = await subtle().exportKey("raw", kp.publicKey);
  ls()?.setItem(VAULT_KEY, JSON.stringify({ pub: b64(pub), salt: b64(salt), iv: b64(iv), wrapped: b64(wrapped) } satisfies Vault));
}

async function shared(priv: CryptoKey, pub: CryptoKey) {
  return subtle().deriveKey({ name: "ECDH", public: pub }, priv, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Seal a found key with the vault's public half. Returns false when no vault is set up. Never throws. */
export async function sealFoundKey(keyHex: string, address?: string): Promise<boolean> {
  try {
    const v = readVault(); if (!v) return false;
    const vpub = await subtle().importKey("raw", unb64(v.pub), EC, false, []);
    const eph = await subtle().generateKey(EC, true, ["deriveKey"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle().encrypt({ name: "AES-GCM", iv }, await shared(eph.privateKey, vpub), new TextEncoder().encode(keyHex));
    const rec: SealedBackup = { at: new Date().toISOString(), address, epk: b64(await subtle().exportKey("raw", eph.publicKey)), iv: b64(iv), ct: b64(ct) };
    ls()?.setItem(SEALED_KEY, JSON.stringify([...listSealed(), rec]));
    return true;
  } catch { return false; }
}

/** Decrypt every sealed backup with the passphrase. Throws "Wrong passphrase" on failure. */
export async function openSealed(pass: string, items = listSealed(), vault = readVault()): Promise<string[]> {
  if (!vault) throw new Error("No backup vault on this device");
  const privs = new Map<string, CryptoKey | null>();
  const unlock = async (v: Vault) => {
    if (privs.has(v.wrapped)) return privs.get(v.wrapped)!;
    let k: CryptoKey | null = null;
    try {
      const pk = await subtle().decrypt({ name: "AES-GCM", iv: unb64(v.iv) }, await passKey(pass, unb64(v.salt)), unb64(v.wrapped));
      k = await subtle().importKey("pkcs8", pk, EC, false, ["deriveKey"]);
    } catch { k = null; }
    privs.set(v.wrapped, k); return k;
  };
  const out: string[] = [];
  for (const s of items) {
    const priv = await unlock(s.vault ?? vault);
    if (!priv) continue;
    try {
      const epk = await subtle().importKey("raw", unb64(s.epk), EC, false, []);
      const pt = await subtle().decrypt({ name: "AES-GCM", iv: unb64(s.iv) }, await shared(priv, epk), unb64(s.ct));
      out.push(new TextDecoder().decode(pt));
    } catch { /* record sealed to another vault or passphrase — skip */ }
  }
  if (!out.length && (items.length || !(await unlock(vault)))) throw new Error("Wrong passphrase");
  return out;
}

/** Encrypted file contents: safe to store anywhere, opens only with the passphrase. */
export function encryptedBackupText(): string | null {
  const vault = readVault(); const sealed = listSealed();
  if (!vault || !sealed.length) return null;
  return JSON.stringify({ format: "bitmapwin-puzzle-backup-v1", note: "Encrypted. Open at bitmapwin.app/puzzle with your passphrase.", vault, sealed }, null, 2);
}

/** Restore a vault + sealed backups from an encrypted backup file (e.g. on a new device). */
export function importBackupText(text: string): number {
  const j = JSON.parse(text);
  if (j?.format !== "bitmapwin-puzzle-backup-v1" || !j.vault || !Array.isArray(j.sealed)) throw new Error("Not a Bitmap backup file");
  const local = readVault();
  if (!local) ls()?.setItem(VAULT_KEY, JSON.stringify(j.vault));
  const foreign = local && local.pub !== j.vault.pub;
  const have = new Set(listSealed().map((s) => s.ct));
  const incoming = j.sealed.filter((s: SealedBackup) => !have.has(s.ct)).map((s: SealedBackup) => (foreign && !s.vault ? { ...s, vault: j.vault as Vault } : s));
  ls()?.setItem(SEALED_KEY, JSON.stringify([...listSealed(), ...incoming]));
  return j.sealed.length;
}

/** Explicit user deletion only. */
export function deleteSealed(typed: string): boolean {
  if (typed.trim().toUpperCase() !== DELETE_PHRASE) return false;
  ls()?.removeItem(SEALED_KEY);
  return true;
}

/** Download a text file. Returns a hint when the browser is likely to block it (e.g. inside an embedded frame). */
export function tryDownload(text: string, name: string): { likelyBlocked: boolean } {
  let framed = false;
  try { framed = window.self !== window.top; } catch { framed = true; }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch { return { likelyBlocked: true }; }
  return { likelyBlocked: framed };
}
