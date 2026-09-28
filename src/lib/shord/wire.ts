/**
 * SHORD — Shielded Ordinals transfer envelope on Bitcoin L1.
 *
 * Every shielded transfer is one Bitcoin transaction spending the shared
 * shielded pool UTXO. All private state travels inside a single OP_RETURN
 * output carrying a 462-byte envelope:
 *
 *   magic        5 B   ASCII "SHORD"
 *   version      1 B   0x01
 *   op           1 B   0x01 transfer · 0x02 shield (deposit) · 0x03 unshield
 *   anchor      32 B   Merkle state root the spend proof is made against
 *   nullifier   32 B   retires the consumed note without revealing it
 *   commitment  32 B   the new owner's note commitment (Poseidon)
 *   ephemeral   32 B   sender's one-time BabyJubjub public key (DH)
 *   proof      256 B   Groth16 proof over BN254 (A 64 · B 128 · C 64)
 *   ciphertext  71 B   AEAD note payload, opened only by the viewing key
 *
 * Nothing on the wire names a sender, a recipient, an amount or a satpoint.
 * This decoder is read-only: it never needs any key material.
 */

export const SHORD_MAGIC_HEX = "53484f5244";
export const SHORD_VERSION = 0x01;
export const SHORD_PAYLOAD_BYTES = 462;

export const SHORD_OPS = { transfer: 0x01, shield: 0x02, unshield: 0x03 } as const;
export type ShordOp = keyof typeof SHORD_OPS;

export const SHORD_OP_LABEL: Record<ShordOp, string> = {
  transfer: "PRIVATE TRANSFER",
  shield: "SHIELD (DEPOSIT)",
  unshield: "UNSHIELD (EXIT)",
};

/** Field layout, in bytes, after magic + version + op. */
const FIELD_SIZES = {
  anchor: 32,
  nullifier: 32,
  commitment: 32,
  ephemeral: 32,
  proof: 256,
  ciphertext: 71,
} as const;

export type ShordEnvelope = {
  version: number;
  op: ShordOp;
  anchor: string;
  nullifier: string;
  commitment: string;
  ephemeral: string;
  proof: string;
  ciphertext: string;
};

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(value: string): Uint8Array {
  const clean = value.trim().toLowerCase().replace(/^0x/, "");
  if (clean.length % 2 !== 0 || /[^0-9a-f]/.test(clean)) throw new Error("Invalid hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Reads a SHORD envelope out of raw payload hex. Null when it is not ours. */
export function decodeShordEnvelope(payloadHex: string): ShordEnvelope | null {
  let bytes: Uint8Array;
  try {
    bytes = hexToBytes(payloadHex);
  } catch {
    return null;
  }
  if (bytes.length !== SHORD_PAYLOAD_BYTES) return null;
  if (bytesToHex(bytes.subarray(0, 5)) !== SHORD_MAGIC_HEX) return null;
  const version = bytes[5]!;
  const opByte = bytes[6]!;
  const op = (Object.keys(SHORD_OPS) as ShordOp[]).find((k) => SHORD_OPS[k] === opByte);
  if (!op) return null;

  let off = 7;
  const take = (n: number) => {
    const slice = bytesToHex(bytes.subarray(off, off + n));
    off += n;
    return slice;
  };
  return {
    version,
    op,
    anchor: take(FIELD_SIZES.anchor),
    nullifier: take(FIELD_SIZES.nullifier),
    commitment: take(FIELD_SIZES.commitment),
    ephemeral: take(FIELD_SIZES.ephemeral),
    proof: take(FIELD_SIZES.proof),
    ciphertext: take(FIELD_SIZES.ciphertext),
  };
}

/** Builds the 462-byte envelope hex. Every field must already be the right size. */
export function encodeShordEnvelope(env: Omit<ShordEnvelope, "version">): string {
  const parts = [
    SHORD_MAGIC_HEX,
    SHORD_VERSION.toString(16).padStart(2, "0"),
    SHORD_OPS[env.op].toString(16).padStart(2, "0"),
    env.anchor,
    env.nullifier,
    env.commitment,
    env.ephemeral,
    env.proof,
    env.ciphertext,
  ];
  const hex = parts.join("").toLowerCase();
  if (hex.length !== SHORD_PAYLOAD_BYTES * 2) throw new Error("SHORD envelope is malformed");
  return hex;
}

/**
 * scriptPubKey for the note output: OP_RETURN OP_PUSHDATA2 <len LE> <462 bytes>.
 * 0x6a = OP_RETURN, 0x4d = PUSHDATA2, length is little-endian uint16.
 */
export function shordScriptHex(payloadHex: string): string {
  const clean = payloadHex.trim().toLowerCase();
  if (clean.length !== SHORD_PAYLOAD_BYTES * 2) throw new Error("SHORD envelope is malformed");
  const len = SHORD_PAYLOAD_BYTES;
  const le = `${(len & 0xff).toString(16).padStart(2, "0")}${((len >> 8) & 0xff).toString(16).padStart(2, "0")}`;
  return `6a4d${le}${clean}`;
}

/** Pulls a SHORD payload back out of an OP_RETURN scriptPubKey. */
export function shordPayloadFromScript(scriptHex: string): string | null {
  const clean = scriptHex.trim().toLowerCase();
  if (!clean.startsWith("6a")) return null;
  let off = 2;
  const opcode = parseInt(clean.slice(off, off + 2), 16);
  off += 2;
  let length: number;
  if (opcode === 0x4c) {
    length = parseInt(clean.slice(off, off + 2), 16);
    off += 2;
  } else if (opcode === 0x4d) {
    const lo = parseInt(clean.slice(off, off + 2), 16);
    const hi = parseInt(clean.slice(off + 2, off + 4), 16);
    length = lo | (hi << 8);
    off += 4;
  } else if (opcode <= 0x4b) {
    length = opcode;
  } else {
    return null;
  }
  const payload = clean.slice(off, off + length * 2);
  return decodeShordEnvelope(payload) ? payload : null;
}
