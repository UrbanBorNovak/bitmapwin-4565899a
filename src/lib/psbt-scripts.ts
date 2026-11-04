/**
 * Script helpers shared by the listing and buying PSBT builders.
 *
 * Nested-segwit addresses (P2SH-P2WPKH, the default Xverse payment address)
 * cannot be signed from a witnessUtxo alone: the wallet needs the redeemScript
 * so it knows the input is really a P2WPKH wrapped in P2SH. Without it wallets
 * reject the PSBT with "inputType: sh without redeemScript".
 */

import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";

function hexToBytes(hex: string): number[] {
  const clean = hex.trim().replace(/^0x/, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

function toHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** hash160 = ripemd160(sha256(data)) */
export function hash160(bytes: number[]): number[] {
  return Array.from(ripemd160(sha256(Uint8Array.from(bytes))));
}

/** True for a P2SH scriptPubKey: OP_HASH160 <20 bytes> OP_EQUAL. */
export function isP2shScript(script: number[]): boolean {
  return script.length === 23 && script[0] === 0xa9 && script[1] === 0x14 && script[22] === 0x87;
}

/** True for a P2TR scriptPubKey: OP_1 <32 bytes>. */
export function isP2trScript(script: number[]): boolean {
  return script.length === 34 && script[0] === 0x51;
}

/** True for a legacy P2PKH scriptPubKey. */
export function isP2pkhScript(script: number[]): boolean {
  return (
    script.length === 25 &&
    script[0] === 0x76 &&
    script[1] === 0xa9 &&
    script[2] === 0x14 &&
    script[23] === 0x88 &&
    script[24] === 0xac
  );
}

export function normalizeCompressedPubKey(publicKeyHex: string | undefined): number[] | null {
  if (!publicKeyHex) return null;
  const clean = publicKeyHex.trim().replace(/^0x/, "").toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean)) return null;
  if (clean.length === 66 && (clean.startsWith("02") || clean.startsWith("03"))) {
    return hexToBytes(clean);
  }
  if (clean.length === 130 && clean.startsWith("04")) {
    // uncompressed → compress
    const bytes = hexToBytes(clean);
    const x = bytes.slice(1, 33);
    const yLast = bytes[64]!;
    return [yLast % 2 === 0 ? 0x02 : 0x03, ...x];
  }
  return null;
}

/**
 * The P2SH-P2WPKH redeemScript (`0x0014<hash160(pubkey)>`) for a P2SH input,
 * verified against the scriptPubKey hash so we never attach a wrong script.
 * Returns null when the public key does not match this P2SH address.
 */
export function p2shP2wpkhRedeemScript(
  scriptPubKey: number[],
  publicKeyHex: string | undefined,
): number[] | null {
  if (!isP2shScript(scriptPubKey)) return null;
  const pubkey = normalizeCompressedPubKey(publicKeyHex);
  if (!pubkey) return null;
  const redeem = [0x00, 0x14, ...hash160(pubkey)];
  const expected = toHex(scriptPubKey.slice(2, 22));
  return toHex(hash160(redeem)) === expected ? redeem : null;
}

/* ── maker signing keys for BW-BARTER-1 swaps ───────────────────────── */

function taggedHash(tag: string, data: number[]): Uint8Array {
  const t = sha256(new TextEncoder().encode(tag));
  return sha256(Uint8Array.from([...t, ...t, ...data]));
}

/** True when this x-only (or compressed) key, BIP-86 tweaked, is the P2TR output key in `script`. */
export function taprootKeyMatches(script: number[], publicKeyHex: string): boolean {
  if (!isP2trScript(script)) return false;
  const clean = publicKeyHex.trim().replace(/^0x/, "").toLowerCase();
  const x = clean.length === 66 ? clean.slice(2) : clean;
  if (!/^[0-9a-f]{64}$/.test(x)) return false;
  try {
    const P = secp256k1.Point.fromHex("02" + x);
    const t = BigInt("0x" + toHex(taggedHash("TapTweak", hexToBytes(x))));
    const Q = P.add(secp256k1.Point.BASE.multiply(t)).toAffine();
    return Q.x.toString(16).padStart(64, "0") === toHex(script.slice(2));
  } catch {
    return false;
  }
}

export type MakerKeys =
  | { ok: true; tapKeyHex?: string; publicKeys: string[] }
  | { ok: false; reason: string };

/**
 * Picks and validates the key details a wallet needs to sign the maker's asset
 * input: the BIP-86 internal key for taproot, the matching public key for
 * nested segwit. Legacy addresses are refused.
 */
export function makerSigningKeys(script: number[], keys: (string | undefined)[]): MakerKeys {
  const list = keys.filter((k): k is string => typeof k === "string" && k.length >= 64);
  if (isP2trScript(script)) {
    const hit = list.find((k) => taprootKeyMatches(script, k));
    if (!hit) {
      return { ok: false, reason: list.length === 0
        ? "Your wallet didn't share the key for your ordinals address. Disconnect and reconnect the wallet, then try again."
        : "The key your wallet shared doesn't match the address holding this item. Switch to the account that holds it and reconnect." };
    }
    const x = hit.length === 66 ? hit.slice(2) : hit;
    return { ok: true, tapKeyHex: x, publicKeys: [] };
  }
  if (isP2shScript(script)) {
    const hit = list.find((k) => p2shP2wpkhRedeemScript(script, k));
    return hit ? { ok: true, publicKeys: [hit] } : { ok: false, reason: "Your wallet didn't share a key matching this nested-segwit (3…) address. Reconnect the wallet." };
  }
  if (script.length === 22 && script[0] === 0x00 && script[1] === 0x14) return { ok: true, publicKeys: [] };
  if (isP2pkhScript(script)) return { ok: false, reason: "Legacy (1…) addresses can't sign swaps here." };
  return { ok: false, reason: "This address type can't sign swaps here." };
}
