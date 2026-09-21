import { describe, expect, it } from "vitest";
import { bssDecode, bssPayloadFromBmp } from "./format";

/** Wraps a BSS payload in a 24-bit BMP exactly as the on-chain files do. */
function wrapInBmp(payload: Uint8Array, width = 39): Uint8Array {
  const rowBytes = width * 3;
  const stride = Math.ceil((width * 24) / 32) * 4;
  const rows = Math.ceil(payload.length / rowBytes);
  const bytes = new Uint8Array(54 + stride * rows);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, rows, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  for (let row = 0; row < rows; row++) {
    bytes.set(payload.subarray(row * rowBytes, row * rowBytes + rowBytes), 54 + row * stride);
  }
  return bytes;
}

function buildPayload(): Uint8Array {
  const body: number[] = [];
  const f32 = (value: number) => {
    const buf = new DataView(new ArrayBuffer(4));
    buf.setFloat32(0, value, false);
    for (let i = 0; i < 4; i++) body.push(buf.getUint8(i));
  };
  const u32 = (value: number) => {
    body.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
  };
  // block 156700
  body.push(0x13);
  u32(156700);
  // resource ram0 -> <txid>i0
  body.push(0x01, 4, 0x72, 0x61, 0x6d, 0x30);
  for (let i = 0; i < 32; i++) body.push(i + 1);
  u32(0);
  // scale 1000, translate x 1500, translate y 500, rotate 90, quad ram0, end
  body.push(0x27);
  f32(1000);
  body.push(0x10);
  f32(1500);
  body.push(0x11);
  f32(500);
  body.push(0x0d);
  f32(90);
  body.push(0x23, 4, 0x72, 0x61, 0x6d, 0x30);
  body.push(0x1a);

  const payload = new Uint8Array(9 + body.length);
  payload[0] = 0x42;
  payload[1] = 0x53;
  payload[2] = 0;
  payload[3] = 0;
  payload[4] = 14;
  new DataView(payload.buffer).setUint32(5, payload.length, false);
  payload.set(body, 9);
  return payload;
}

describe("bss reader", () => {
  it("recovers the payload from BMP pixel data", () => {
    const payload = buildPayload();
    const result = bssPayloadFromBmp(wrapInBmp(payload));
    expect("payload" in result).toBe(true);
    if (!("payload" in result)) return;
    expect(Array.from(result.payload.subarray(0, payload.length))).toEqual(Array.from(payload));
  });

  it("decodes header, resources and objects", () => {
    const decoded = bssDecode(wrapInBmp(buildPayload()), "test-source");
    expect("error" in decoded).toBe(false);
    if ("error" in decoded) return;
    expect(decoded.versionLabel).toBe("0.0.14");
    expect(decoded.blockTarget).toBe(156700);
    expect(decoded.resources).toHaveLength(1);
    expect(decoded.resources[0]!.name).toBe("ram0");
    expect(decoded.resources[0]!.inscriptionId).toMatch(/^[0-9a-f]{64}i0$/);
    expect(decoded.objects).toHaveLength(1);
    const object = decoded.objects[0]!;
    expect(object.kind).toBe("quad");
    expect(object.inscriptionId).toBe(decoded.resources[0]!.inscriptionId);
    expect(object.position).toEqual({ x: 1500, y: 500, z: 0 });
    expect(object.rotation.y).toBe(90);
    expect(object.scale).toBe(1000);
    expect(decoded.ok).toBe(true);
    expect(decoded.consumed).toBe(decoded.declaredSize);
  });

  it("rejects files that are not BSS scripts", () => {
    const plain = wrapInBmp(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    const decoded = bssDecode(plain, "junk");
    expect("error" in decoded).toBe(true);
  });
});
