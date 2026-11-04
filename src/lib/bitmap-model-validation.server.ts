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

/** A uri is self-contained only when the bytes travel inside the inscription. */
const isEmbedded = (uri?: string) => !uri || uri.startsWith("data:");

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

/** Pulls the glTF JSON out of a binary GLB container. */
function glbJson(bytes: Uint8Array): GlbJson {
  if (bytes.byteLength < 20) throw new Error("INVALID GLB HEADER");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("ONLY BINARY GLB 2.0 IS SUPPORTED");
  if (view.getUint32(4, true) !== 2) throw new Error("ONLY BINARY GLB 2.0 IS SUPPORTED");
  // Some inscribed GLBs carry trailing padding, so the declared total length is
  // allowed to be shorter than the body — only a longer claim is malformed.
  if (view.getUint32(8, true) > bytes.byteLength) throw new Error("INVALID GLB LENGTH");
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > bytes.byteLength) {
    throw new Error("INVALID GLB JSON CHUNK");
  }
  try {
    return JSON.parse(textDecoder.decode(bytes.subarray(20, 20 + jsonLength)).replace(/\0+$/g, "")) as GlbJson;
  } catch {
    throw new Error("INVALID GLB JSON");
  }
}

/** Reads a plain .gltf JSON inscription, which must embed every resource. */
function gltfJson(bytes: Uint8Array): GlbJson {
  try {
    return JSON.parse(textDecoder.decode(bytes)) as GlbJson;
  } catch {
    throw new Error("INVALID GLTF JSON");
  }
}

export async function validateOnChainGlb(inscriptionId: string): Promise<ValidatedBitmapModel> {
  const response = await fetch(`https://ordinals.com/content/${inscriptionId}`, {
    headers: {
      accept: "model/gltf-binary,model/gltf+json,application/octet-stream,*/*",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("ON-CHAIN MODEL COULD NOT BE READ");
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error("GLB EXCEEDS THE 2 MB LIMIT");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new Error("GLB MUST BE BETWEEN 1 BYTE AND 2 MB");

  const served = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const view = new DataView(bytes.buffer, bytes.byteOffset, Math.min(4, bytes.byteLength));
  const isBinary = bytes.byteLength >= 4 && view.getUint32(0, true) === 0x46546c67;
  const looksJson = served.includes("gltf+json") || served.includes("json") || bytes[0] === 0x7b;
  if (!isBinary && !looksJson) throw new Error("ONLY model/gltf-binary (GLB) OR model/gltf+json IS SUPPORTED");

  const json = isBinary ? glbJson(bytes) : gltfJson(bytes);
  if (json.asset?.version !== "2.0") throw new Error("ONLY GLTF 2.0 MODELS ARE SUPPORTED");
  if ((json.buffers ?? []).some((buffer) => !isEmbedded(buffer.uri))) throw new Error("GLB MUST EMBED ALL BUFFERS");
  if ((json.images ?? []).some((image) => !isEmbedded(image.uri))) throw new Error("GLB MUST EMBED ALL TEXTURES");
  const triangles = triangleCount(json);
  const textures = json.textures?.length ?? 0;
  const animations = json.animations?.length ?? 0;
  if (triangles <= 0) throw new Error("GLB CONTAINS NO TRIANGLE GEOMETRY");
  if (triangles > MAX_TRIANGLES) throw new Error("GLB EXCEEDS 100,000 TRIANGLES");
  if (textures > MAX_TEXTURES) throw new Error("GLB EXCEEDS 8 TEXTURES");
  if (animations > MAX_ANIMATIONS) throw new Error("GLB EXCEEDS 4 ANIMATIONS");

  return {
    contentType: served || (isBinary ? "model/gltf-binary" : "model/gltf+json"),
    bodyBytes: bytes.byteLength,
    triangleCount: triangles,
    textureCount: textures,
    animationCount: animations,
  };
}
