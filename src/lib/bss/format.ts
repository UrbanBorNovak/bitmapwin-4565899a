/**
 * BSS reader: BMP pixels → binary payload → opcode stream → scene data.
 *
 * The format is not published as source anywhere off-chain; the layout below is
 * read directly from real inscriptions (verified against BITMAP 156700's script
 * `676ddb94…c953i0`, `BSS 0 0 14`, 62 resources, 62 objects, which walks to the
 * exact byte count declared in its header). Every field is byte aligned and all
 * numbers are big endian. Unknown opcodes stop the walk instead of guessing —
 * a desynced stream would invent geometry that is not on chain.
 */

import type { BssObject, BssObjectKind, BssResource, BssScene, BssVersion } from "./types";

export const BSS_MAGIC = [0x42, 0x53] as const; // "BS"
export const BSS_HEADER_BYTES = 9; // magic(2) + version(3) + declared size(4)
/** The format clamps every coordinate to this range. */
export const BSS_LIMIT = 10_100;
/** One BITMAP is 10_000 BSS units across. */
export const BSS_SPAN = 10_000;

const OP = {
  RESOURCE: 0x01,
  ROTATE: 0x0d,
  TRANSLATE_XYZ: 0x0f,
  TRANSLATE_X: 0x10,
  TRANSLATE_Y: 0x11,
  TRANSLATE_Z: 0x12,
  BLOCK: 0x13,
  END_OBJECT: 0x1a,
  SUNSET: 0x20,
  QUAD: 0x23,
  MODEL: 0x24,
  BILLBOARD: 0x25,
  MOSAIC: 0x26,
  SCALE: 0x27,
  TRANSLATE_XY: 0x2c,
  TRANSLATE_YZ: 0x2e,
} as const;

const OBJECT_OPS: Record<number, BssObjectKind> = {
  [OP.QUAD]: "quad",
  [OP.MODEL]: "model",
  [OP.BILLBOARD]: "billboard",
  [OP.MOSAIC]: "mosaic",
};

/** Strip the BMP container and row padding, returning the raw payload bytes. */
export function bssPayloadFromBmp(bytes: Uint8Array): { payload: Uint8Array } | { error: string } {
  if (bytes.length < 54) return { error: "File is too small to be a BMP script" };
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) return { error: "Not a BMP file" };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = view.getUint32(10, true);
  const width = view.getInt32(18, true);
  const height = Math.abs(view.getInt32(22, true));
  const bpp = view.getUint16(28, true);
  if (bpp !== 24) return { error: `Unsupported BMP depth (${bpp} bits)` };
  if (width <= 0 || height <= 0) return { error: "BMP has no pixel data" };
  const stride = Math.ceil((width * bpp) / 32) * 4;
  const rowBytes = width * 3;
  if (offset + stride * height > bytes.length) return { error: "BMP pixel data is truncated" };
  const payload = new Uint8Array(rowBytes * height);
  for (let row = 0; row < height; row++) {
    payload.set(bytes.subarray(offset + row * stride, offset + row * stride + rowBytes), row * rowBytes);
  }
  return { payload };
}

function versionLabel(v: BssVersion) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

const clamp = (n: number) => Math.max(-BSS_LIMIT, Math.min(BSS_LIMIT, n));

/** Decode a BSS BMP inscription into scene data. Never throws. */
export function bssDecode(bytes: Uint8Array, source: string): BssScene | { error: string } {
  const unwrapped = bssPayloadFromBmp(bytes);
  if ("error" in unwrapped) return unwrapped;
  const payload = unwrapped.payload;
  if (payload.length < BSS_HEADER_BYTES) return { error: "Script payload is too small" };
  if (payload[0] !== BSS_MAGIC[0] || payload[1] !== BSS_MAGIC[1])
    return { error: "Missing BSS signature — this BMP is not a script" };

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const version: BssVersion = { major: payload[2]!, minor: payload[3]!, patch: payload[4]! };
  // 0.0.9 / 0.0.10 use a different, smaller opcode set and carry no size field.
  if (version.major === 0 && version.minor === 0 && (version.patch === 9 || version.patch === 10))
    return bssDecodeLegacy(payload, version, source);
  const declaredSize = view.getUint32(5, false);

  const diagnostics: string[] = [];
  if (version.major !== 0 || version.minor !== 0)
    diagnostics.push(`Unknown BSS generation ${versionLabel(version)}`);
  if (version.patch < 9)
    diagnostics.push(`BSS ${versionLabel(version)} predates the readable versions (0.0.9+)`);
  if (version.patch > 16)
    diagnostics.push(`BSS ${versionLabel(version)} is newer than this reader (up to 0.0.16)`);

  const limit = declaredSize > 0 && declaredSize <= payload.length ? declaredSize : payload.length;
  if (declaredSize > payload.length)
    diagnostics.push(`Header declares ${declaredSize} bytes but only ${payload.length} were recovered`);

  const resources: BssResource[] = [];
  const objects: BssObject[] = [];
  let blockTarget: number | null = null;
  let sunsetTarget: number | null = null;

  // Transform state accumulates until an object opcode consumes it, then the
  // END_OBJECT opcode closes that object out.
  let pos = { x: 0, y: 0, z: 0 };
  let rot = { x: 0, y: 0, z: 0 };
  let scale = 1;
  const reset = () => {
    pos = { x: 0, y: 0, z: 0 };
    rot = { x: 0, y: 0, z: 0 };
    scale = 1;
  };

  let i = BSS_HEADER_BYTES;
  const f32 = () => {
    const v = view.getFloat32(i, false);
    i += 4;
    return Number.isFinite(v) ? v : 0;
  };
  const u32 = () => {
    const v = view.getUint32(i, false);
    i += 4;
    return v;
  };
  const name = () => {
    const len = payload[i] ?? 0;
    i += 1;
    let out = "";
    for (let k = 0; k < len; k++) out += String.fromCharCode(payload[i + k] ?? 0);
    i += len;
    return out;
  };
  const room = (n: number) => i + n <= limit;

  walk: while (i < limit) {
    const op = payload[i]!;
    i += 1;
    switch (op) {
      case OP.RESOURCE: {
        if (!room(1)) break walk;
        const resourceName = name();
        if (!room(36)) break walk;
        // Resource txids are stored in display order, not little-endian.
        let txid = "";
        for (let k = 0; k < 32; k++) txid += (payload[i + k] ?? 0).toString(16).padStart(2, "0");
        i += 32;
        const index = u32();
        resources.push({ name: resourceName, inscriptionId: `${txid}i${index}` });
        break;
      }
      case OP.BLOCK: {
        if (!room(4)) break walk;
        blockTarget = u32();
        break;
      }
      case OP.SUNSET: {
        if (!room(4)) break walk;
        const value = u32();
        sunsetTarget = value > 0 ? value : sunsetTarget;
        break;
      }
      case OP.SCALE: {
        if (!room(4)) break walk;
        scale = f32();
        break;
      }
      case OP.ROTATE: {
        if (!room(4)) break walk;
        rot = { ...rot, y: f32() };
        break;
      }
      case OP.TRANSLATE_XYZ: {
        if (!room(12)) break walk;
        pos = { x: clamp(f32()), y: clamp(f32()), z: clamp(f32()) };
        break;
      }
      case OP.TRANSLATE_X: {
        if (!room(4)) break walk;
        pos = { ...pos, x: clamp(f32()) };
        break;
      }
      case OP.TRANSLATE_Y: {
        if (!room(4)) break walk;
        pos = { ...pos, y: clamp(f32()) };
        break;
      }
      case OP.TRANSLATE_Z: {
        if (!room(4)) break walk;
        pos = { ...pos, z: clamp(f32()) };
        break;
      }
      case OP.TRANSLATE_XY: {
        if (!room(4)) break walk;
        const v = clamp(f32());
        pos = { ...pos, x: v, y: v };
        break;
      }
      case OP.TRANSLATE_YZ: {
        if (!room(4)) break walk;
        const v = clamp(f32());
        pos = { ...pos, y: v, z: v };
        break;
      }
      case OP.END_OBJECT: {
        reset();
        break;
      }
      default: {
        const kind = OBJECT_OPS[op];
        if (!kind) {
          diagnostics.push(`Stopped at byte ${i - 1}: unsupported opcode 0x${op.toString(16)}`);
          break walk;
        }
        if (!room(1)) break walk;
        const bind = name();
        const resource = resources.find((r) => r.name === bind) ?? null;
        objects.push({
          kind,
          bind: bind || null,
          inscriptionId: resource?.inscriptionId ?? null,
          position: { ...pos },
          rotation: { ...rot },
          scale,
        });
        break;
      }
    }
  }

  const consumed = Math.min(i, limit);
  if (consumed < limit) diagnostics.push(`${limit - consumed} declared bytes were not read`);

  return {
    version,
    versionLabel: versionLabel(version),
    source,
    blockTarget,
    sunsetTarget,
    resources,
    objects,
    declaredSize,
    payloadSize: payload.length,
    consumed,
    ok: objects.length > 0 && consumed === limit,
    diagnostics,
  };
}

/** World columns per row on the BSS map (block = row * 1000 + column). */
const LEGACY_COLUMNS = 1000;

/**
 * BSS 0.0.9 / 0.0.10 reader, matching the official on-chain app's reader for
 * those versions: header is magic(2) + version(3) with no size field; opcodes
 * 0x01 sunset image (u16 column, u16 row, 32-byte txid, u32 index),
 * 0x02 colour (u24), 0x03 painted BITMAP list, 0x04 pixel colours (u16 n, n × u24),
 * 0x05 palette-indexed pixels. Any other byte (including zero padding) ends the script.
 */
function bssDecodeLegacy(payload: Uint8Array, version: BssVersion, source: string): BssScene {
  const diagnostics: string[] = [];
  const resources: BssResource[] = [];
  const objects: BssObject[] = [];
  const painted: number[] = [];
  const n = payload.length;
  let i = 5;
  let clean = true;
  const u8 = () => payload[i++]!;
  const u16 = () => (u8() << 8) | u8();
  const u32 = () => ((u8() << 24) | (u8() << 16) | (u8() << 8) | u8()) >>> 0;

  walk: while (i < n) {
    const op = payload[i]!;
    if (op < 1 || op > 5) break;
    i += 1;
    switch (op) {
      case 0x01: {
        if (i + 40 > n) { clean = false; break walk; }
        u16(); u16(); // map column / row of the sunset billboard
        let txid = "";
        for (let k = 0; k < 32; k++) txid += u8().toString(16).padStart(2, "0");
        const inscriptionId = `${txid}i${u32()}`;
        const name = `res${resources.length}`;
        resources.push({ name, inscriptionId });
        for (const kind of ["billboard", "mosaic"] as const)
          objects.push({ kind, bind: name, inscriptionId, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 });
        break;
      }
      case 0x02: {
        if (i + 3 > n) { clean = false; break walk; }
        i += 3;
        break;
      }
      case 0x03: {
        if (i + 2 > n) { clean = false; break walk; }
        const groups = u16();
        for (let g = 0; g < groups; g++) {
          if (i + 3 > n) { clean = false; break walk; }
          const col8 = u8(), row8 = u8(), rows = u8();
          for (let r = 0; r < 8; r++) {
            if (!(rows & (1 << r))) continue;
            if (i >= n) { clean = false; break walk; }
            const cols = u8();
            for (let c = 0; c < 8; c++)
              if (cols & (1 << c)) painted.push((8 * row8 + r) * LEGACY_COLUMNS + (8 * col8 + c));
          }
        }
        break;
      }
      case 0x04: {
        if (i + 2 > n) { clean = false; break walk; }
        const count = u16();
        if (i + count * 3 > n) { clean = false; break walk; }
        i += count * 3;
        break;
      }
      default: {
        diagnostics.push(`Palette pixel lists (byte ${i - 1}) are not drawn by this reader yet`);
        clean = false;
        break walk;
      }
    }
  }

  const consumed = i;
  for (let k = consumed; k < n; k++)
    if (payload[k] !== 0) { diagnostics.push(`Unread data after byte ${consumed}`); clean = false; break; }

  return {
    version,
    versionLabel: versionLabel(version),
    source,
    blockTarget: painted[0] ?? null,
    sunsetTarget: null,
    resources,
    objects,
    declaredSize: consumed,
    payloadSize: n,
    consumed,
    ok: clean && objects.length > 0,
    diagnostics,
  };
}
