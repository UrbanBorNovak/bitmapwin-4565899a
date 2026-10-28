/**
 * One shared texture holding the 8×8 front face of every soldier's Pixel skin,
 * so a whole army of faces is drawn by a single instanced mesh.
 */
import * as THREE from "three";
import { resolvePixelTexture } from "@/lib/pixel-texture";

export const ATLAS_GRID = 32; // 32×32 cells of 8px = 256px, up to 1024 faces
const CELL = 8;

let active = 0;
const queue: (() => void)[] = [];
function limited<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => { active++; job().then(resolve, reject).finally(() => { active--; queue.shift()?.(); }); };
    if (active < 6) run(); else queue.push(run);
  });
}

const bitmaps = new Map<string, Promise<ImageBitmap | null>>();
function skinBitmap(pixelId: string): Promise<ImageBitmap | null> {
  let p = bitmaps.get(pixelId);
  if (!p) {
    p = limited(async () => {
      const tex = await resolvePixelTexture(pixelId);
      if (!tex) return null;
      const r = await fetch(`/api/public/inscription/${tex}`);
      if (!r.ok) return null;
      return createImageBitmap(await r.blob());
    }).catch(() => null);
    bitmaps.set(pixelId, p);
  }
  return p;
}

/** Builds the atlas; faces stream in and the texture refreshes as they arrive. */
export function buildFaceAtlas(pixelIds: string[]): { texture: THREE.CanvasTexture; dispose: () => void } {
  const c = document.createElement("canvas");
  c.width = c.height = ATLAS_GRID * CELL;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#e8c39e"; g.fillRect(0, 0, c.width, c.height);
  const texture = new THREE.CanvasTexture(c);
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
  let live = true, pending = false;
  const refresh = () => { if (pending) return; pending = true; setTimeout(() => { pending = false; if (live) texture.needsUpdate = true; }, 250); };
  pixelIds.slice(0, ATLAS_GRID * ATLAS_GRID).forEach((id, i) => {
    skinBitmap(id).then((bmp) => {
      if (!live || !bmp) return;
      const x = (i % ATLAS_GRID) * CELL, y = Math.floor(i / ATLAS_GRID) * CELL;
      const k = bmp.width / 64;
      g.drawImage(bmp, 8 * k, 8 * k, 8 * k, 8 * k, x, y, CELL, CELL);
      if (bmp.height >= bmp.width) g.drawImage(bmp, 40 * k, 8 * k, 8 * k, 8 * k, x, y, CELL, CELL);
      refresh();
    });
  });
  return { texture, dispose: () => { live = false; texture.dispose(); } };
}

/** Plane geometry whose UVs come from a per-instance atlas cell. */
export function atlasFaceMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ map });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 cell;")
      .replace("#include <uv_vertex>", `#include <uv_vertex>\nvMapUv = (cell + vec2(uv.x, 1.0 - uv.y)) / ${ATLAS_GRID.toFixed(1)};\nvMapUv.y = 1.0 - vMapUv.y;`);
  };
  return m;
}
