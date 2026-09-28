/**
 * Sovereign client vault for Shadow Assets (Phase A).
 *
 * A shadow pass is never stored against a wallet or an account. The device
 * holds two secrets; the server only ever learns their hashes:
 *
 *   commitment = sha256("bitmapwin:shadow:commit" | slug | salt)
 *   nullifier  = sha256("bitmapwin:shadow:null"   | slug | nullifierSecret)
 *
 * The commitment proves membership. The nullifier gives a stable, unlinkable
 * pen name inside a private room.
 */
import { sha256 } from "@noble/hashes/sha2.js";

const STORAGE_KEY = "bitmapwin:shadow-vault";

export type ShadowPass = {
  slug: string;
  salt: string;
  nullifierSecret: string;
  commitment: string;
  nullifier: string;
  passIndex: number;
  claimedAt: string;
};

type VaultShape = Record<string, ShadowPass>;

const enc = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function digest(domain: string, slug: string, secret: string): string {
  return toHex(sha256(enc.encode(`${domain}|${slug}|${secret}`)));
}

export function commitmentFor(slug: string, salt: string): string {
  return digest("bitmapwin:shadow:commit", slug, salt);
}

export function nullifierFor(slug: string, nullifierSecret: string): string {
  return digest("bitmapwin:shadow:null", slug, nullifierSecret);
}

function readVault(): VaultShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VaultShape;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeVault(vault: VaultShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  } catch {
    /* storage unavailable — pass stays in memory for this session only */
  }
}

export function getPass(slug: string): ShadowPass | null {
  return readVault()[slug] ?? null;
}

/** Fresh secrets for a claim that has not been registered yet. */
export function draftPass(slug: string): Pick<ShadowPass, "slug" | "salt" | "nullifierSecret" | "commitment" | "nullifier"> {
  const salt = randomSecret();
  const nullifierSecret = randomSecret();
  return {
    slug,
    salt,
    nullifierSecret,
    commitment: commitmentFor(slug, salt),
    nullifier: nullifierFor(slug, nullifierSecret),
  };
}

export function savePass(pass: ShadowPass) {
  const vault = readVault();
  vault[pass.slug] = pass;
  writeVault(vault);
}

export function forgetPass(slug: string) {
  const vault = readVault();
  delete vault[slug];
  writeVault(vault);
}

/** Portable backup string. Whoever holds this holds the pass. */
export function exportPass(pass: ShadowPass): string {
  return `SHADOW-PASS-v1.${pass.slug}.${pass.salt}.${pass.nullifierSecret}`;
}

export function importPass(backup: string): ShadowPass | null {
  const parts = backup.trim().split(".");
  if (parts.length !== 4 || parts[0] !== "SHADOW-PASS-v1") return null;
  const [, slug, salt, nullifierSecret] = parts as [string, string, string, string];
  if (!slug || salt.length !== 64 || nullifierSecret.length !== 64) return null;
  return {
    slug,
    salt,
    nullifierSecret,
    commitment: commitmentFor(slug, salt),
    nullifier: nullifierFor(slug, nullifierSecret),
    passIndex: 0,
    claimedAt: new Date().toISOString(),
  };
}

/** Short, stable, unlinkable display handle derived from the nullifier. */
export function shadowHandle(nullifier: string): string {
  return `SHADOW-${nullifier.slice(0, 6).toUpperCase()}`;
}

/* ── Private transfer ─────────────────────────────────────────────
 * The recipient makes fresh secrets on their own device and shares only
 * a receive code (the new commitment). The sender reveals their old salt
 * once to retire their pass; the server swaps old commitment for new.
 * No wallet, account or IP-to-pass link is stored.
 */
const PENDING_KEY = "bitmapwin:shadow-receive";

type Pending = Record<string, Pick<ShadowPass, "slug" | "salt" | "nullifierSecret" | "commitment" | "nullifier">>;

function readPending(): Pending {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_KEY) || "{}") as Pending;
  } catch {
    return {};
  }
}

function writePending(p: Pending) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function getPendingReceive(slug: string) {
  return readPending()[slug] ?? null;
}

export function createPendingReceive(slug: string) {
  const p = readPending();
  p[slug] = p[slug] ?? draftPass(slug);
  writePending(p);
  return p[slug]!;
}

export function clearPendingReceive(slug: string) {
  const p = readPending();
  delete p[slug];
  writePending(p);
}

export function receiveCodeFor(slug: string, commitment: string) {
  return `SHADOW-RECV-v1.${slug}.${commitment}`;
}

export function parseReceiveCode(code: string): { slug: string; commitment: string } | null {
  const parts = code.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "SHADOW-RECV-v1") return null;
  const [, slug, commitment] = parts as [string, string, string];
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[0-9a-f]{64}$/.test(commitment)) return null;
  return { slug, commitment };
}
