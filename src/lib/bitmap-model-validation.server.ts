const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TRIANGLES = 100_000;
const MAX_TEXTURES = 8;
const MAX_ANIMATIONS = 4;

type GlbJson = {
  asset?: { version?: string };
  accessors?: Array<{ count?: number }>;
  meshes?: Array<{ primitives?: Array<{ mode?: number; indices?: number; attributes?: Record<string, number> }> }>;
  textures?: unknown[];
  animations?: unknown[];
  images?: Array<{ uri?: string; bufferView?: number }>;
  buffers?: Array<{ uri?: string; byteLength?: number }>;
  extensionsUsed?: string[];
};

export type ValidatedBitmapModel = {
  contentType: string;
  bodyBytes: number;
  triangleCount: number;
  textureCount: number;
  animationCount: number;
};

const textDecoder = new TextDecoder();

function triangleCount(json: GlbJson) {
  let total = 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const count = primitive.indices === undefined
        ? Number(json.accessors?.[primitive.attributes?.["POSITION"] ?? -1]?.count ?? 0)
        : Number(json.accessors?.[primitive.indices]?.count ?? 0);
      const mode = primitive.mode ?? 4;
      if (mode === 4) total += Math.floor(count / 3);
      else if (mode === 5 || mode === 6) total += Math.max(0, count - 2);
      else throw new Error("ONLY TRIANGLE GLB GEOMETRY IS SUPPORTED");
    }
  }
  return total;
}

export async function validateOnChainGlb(inscriptionId: string): Promise<ValidatedBitmapModel> {
  const response = await fetch(`https://ordinals.com/content/${inscriptionId}`, {
    headers: { accept: "model/gltf-binary,application/octet-stream", "user-agent": "bitmap-marketplace/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("ON-CHAIN MODEL COULD NOT BE READ");
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error("GLB EXCEEDS THE 2 MB LIMIT");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new Error("GLB MUST BE BETWEEN 1 BYTE AND 2 MB");
  if (bytes.byteLength < 20) throw new Error("INVALID GLB HEADER");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error("ONLY BINARY GLB 2.0 IS SUPPORTED");
  if (view.getUint32(8, true) !== bytes.byteLength) throw new Error("INVALID GLB LENGTH");
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > bytes.byteLength) throw new Error("INVALID GLB JSON CHUNK");

  let json: GlbJson;
  try {
    json = JSON.parse(textDecoder.decode(bytes.subarray(20, 20 + jsonLength)).replace(/\0+$/g, "")) as GlbJson;
  } catch {
    throw new Error("INVALID GLB JSON");
  }
  if (json.asset?.version !== "2.0") throw new Error("ONLY GLTF 2.0 MODELS ARE SUPPORTED");
  if ((json.buffers ?? []).some((buffer) => Boolean(buffer.uri))) throw new Error("GLB MUST EMBED ALL BUFFERS");
  if ((json.images ?? []).some((image) => Boolean(image.uri))) throw new Error("GLB MUST EMBED ALL TEXTURES");
  if ((json.extensionsUsed ?? []).some((extension) => extension.includes("draco"))) throw new Error("DRACO-COMPRESSED GLB IS NOT SUPPORTED");

  const triangles = triangleCount(json);
  const textures = json.textures?.length ?? 0;
  const animations = json.animations?.length ?? 0;
  if (triangles <= 0) throw new Error("GLB CONTAINS NO TRIANGLE GEOMETRY");
  if (triangles > MAX_TRIANGLES) throw new Error("GLB EXCEEDS 100,000 TRIANGLES");
  if (textures > MAX_TEXTURES) throw new Error("GLB EXCEEDS 8 TEXTURES");
  if (animations > MAX_ANIMATIONS) throw new Error("GLB EXCEEDS 4 ANIMATIONS");

  return {
    contentType: response.headers.get("content-type")?.split(";")[0] ?? "model/gltf-binary",
    bodyBytes: bytes.byteLength,
    triangleCount: triangles,
    textureCount: textures,
    animationCount: animations,
  };
}