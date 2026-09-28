/**
 * SHAD — the Shielded OP_RETURN note wire format (Bitcoin L1, direct protocol).
 *
 * Every shadow state transition is published as a single compact Bitcoin
 * transaction carrying one OP_RETURN output. The envelope is 43 bytes, well
 * inside the 80-byte standard relay limit, so notes propagate on every public
 * mempool without special relay rules.
 *
 *   magic      4 B   ASCII "SHAD"
 *   op         1 B   0x01 gate genesis · 0x02 pass commit · 0x03 pass spend
 *   height     4 B   big-endian uint32, the parent BITMAP block
 *   index      2 B   big-endian uint16, pass / edition slot
 *   digest    32 B   commitment (gate/pass) or nullifier (spend)
 *
 * Nothing here identifies a wallet, an account or a person: the chain only ever
 * sees a hash whose pre-image never leaves the holder's device.
 */

export const SHADOW_MAGIC = "shad";

export const SHADOW_OPS = { gate: 0x01, pass: 0x02, spend: 0x03 } as const;
export type ShadowOp = keyof typeof SHADOW_OPS;

export const SHADOW_PAYLOAD_BYTES = 43;

const HEX64 = /^[0-9a-f]{64}$/;

function hex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < value.length; i += 2) out.push(parseInt(value.slice(i, i + 2), 16));
  return out;
}

export type ShadowNote = {
  op: ShadowOp;
  /** parent BITMAP block height */
  height: number;
  /** pass / edition slot, 0 for a gate genesis note */
  index: number;
  /** 32-byte commitment or nullifier, lowercase hex */
  digest: string;
};

/** The 43-byte envelope as lowercase hex (86 characters). */
export function encodeShadowNote(note: ShadowNote): string {
  if (!HEX64.test(note.digest)) throw new Error("Shadow note digest must be 32 bytes of hex");
  if (!Number.isInteger(note.height) || note.height < 0 || note.height > 0xffffffff) {
    throw new Error("Shadow note height out of range");
  }
  if (!Number.isInteger(note.index) || note.index < 0 || note.index > 0xffff) {
    throw new Error("Shadow note index out of range");
  }
  const bytes: number[] = [
    0x53,
    0x48,
    0x41,
    0x44,
    SHADOW_OPS[note.op],
    (note.height >>> 24) & 0xff,
    (note.height >>> 16) & 0xff,
    (note.height >>> 8) & 0xff,
    note.height & 0xff,
    (note.index >>> 8) & 0xff,
    note.index & 0xff,
    ...hexToBytes(note.digest),
  ];
  if (bytes.length !== SHADOW_PAYLOAD_BYTES) throw new Error("Shadow note envelope is malformed");
  return hex(bytes);
}

/** Reads a SHAD envelope back out of raw payload hex. Null when it is not ours. */
export function decodeShadowNote(payloadHex: string): ShadowNote | null {
  const clean = payloadHex.trim().toLowerCase().replace(/^0x/, "");
  if (clean.length !== SHADOW_PAYLOAD_BYTES * 2) return null;
  const bytes = hexToBytes(clean);
  if (hex(bytes.slice(0, 4)) !== "53484144") return null;
  const opByte = bytes[4];
  const op = (Object.keys(SHADOW_OPS) as ShadowOp[]).find((k) => SHADOW_OPS[k] === opByte);
  if (!op) return null;
  const height = ((bytes[5]! << 24) | (bytes[6]! << 16) | (bytes[7]! << 8) | bytes[8]!) >>> 0;
  const index = (bytes[9]! << 8) | bytes[10]!;
  return { op, height, index, digest: hex(bytes.slice(11)) };
}

/**
 * scriptPubKey for the note output: OP_RETURN <push 43 bytes>.
 * 0x6a = OP_RETURN, 0x2b = direct push of 43 bytes.
 */
export function shadowNoteScriptHex(payloadHex: string): string {
  const clean = payloadHex.trim().toLowerCase();
  if (clean.length !== SHADOW_PAYLOAD_BYTES * 2) throw new Error("Shadow note envelope is malformed");
  return `6a2b${clean}`;
}

/** Pulls the SHAD payload back out of an OP_RETURN scriptPubKey. */
export function shadowPayloadFromScript(scriptHex: string): string | null {
  const clean = scriptHex.trim().toLowerCase();
  const expected = `6a2b`;
  if (!clean.startsWith(expected)) return null;
  const payload = clean.slice(expected.length);
  return decodeShadowNote(payload) ? payload : null;
}

export const SHADOW_OP_LABEL: Record<ShadowOp, string> = {
  gate: "GATE GENESIS",
  pass: "PASS COMMIT",
  spend: "PASS SPEND",
};
