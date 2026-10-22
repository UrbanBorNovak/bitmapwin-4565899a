import { Group } from "three";
import { GLTFLoader } from "three-stdlib";

/**
 * If an on-chain GLB can't be fetched (ordinals.com outage, rate limit, 403),
 * resolve it as an empty model instead of throwing, so one missing inscription
 * never takes down the whole Oasis. Successful loads are untouched.
 */
const FLAG = "__bwGltfResilient";
const proto = GLTFLoader.prototype as unknown as Record<string, unknown> & {
  load: (url: string, onLoad: (g: unknown) => void, onProgress?: unknown, onError?: (e: unknown) => void) => void;
};
if (!proto[FLAG]) {
  proto[FLAG] = true;
  const original = proto.load;
  proto.load = function (url, onLoad, onProgress, onError) {
    return original.call(this, url, onLoad, onProgress, (error: unknown) => {
      console.warn("Model unavailable, drawing nothing in its place:", url);
      const scene = new Group();
      onLoad({ scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: null, userData: {}, nodes: {}, materials: {} });
      void error;
      void onError;
    });
  };
}
