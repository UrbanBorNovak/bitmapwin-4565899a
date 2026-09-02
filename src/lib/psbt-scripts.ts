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
