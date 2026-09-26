/**
 * ON-CHAIN ENGINE REFERENCES — a library of inscribed world-building parts.
 *
 * Most of these are PlayCanvas scripts, so they can't run inside our Three.js
 * world as-is. Where the payload is maths (noise, shaders), the recipe is
 * ported to GLSL/TS and credited here. `usable` marks what is in use today.
 */
export type OnChainRef = {
  id: string;
  kind: "script" | "shader" | "texture" | "font";
  usable: "in-use" | "recipe" | "engine-only";
  note: string;
};

export const ONCHAIN_ENGINE: Record<string, OnChainRef> = {
  simplex: { id: "1a6f2eb401df978e1e92c7eb710d42e6d854318cff8f573f38deec45004cf749i0", kind: "script", usable: "in-use", note: "SimplexNoise — GPU twin used by on-chain water/lava surfaces" },
  sky: { id: "7b381ffe78f4f111820466fc5a9aed554208ac7719f71431fefa78469ad85f18i0", kind: "shader", usable: "in-use", note: "Horizon/zenith atmosphere, sun glint and height fog — blended into the Oasis sky dome" },
  terrain: { id: "4871d15640de4251471c95fadc8a9edf796c8d66a242cc5bdf7619089058e05ei0", kind: "script", usable: "recipe", note: "Simplex heightfield; Oasis terrain stays driven by real block data" },
  terrainColor: { id: "e6eb372a43e638dc05d069e83721e03447ab64522a01b6eacfcc99df77cf6c76i0", kind: "script", usable: "engine-only", note: "Flat colour terrain (PlayCanvas)" },
  terrainAsset: { id: "383f2e0daaed6ec13317aaecc985309671587b05cc3519c6907c008517fd4799i0", kind: "script", usable: "engine-only", note: "Textured terrain (PlayCanvas)" },
  skybox: { id: "b07156373544171bc53a1e09329364653738f6b788fb9014a03e1de561200a11i0", kind: "script", usable: "engine-only", note: "Image skybox loader (PlayCanvas)" },
  movement: { id: "365e4365eeb315d9b5a6fdb2bfd75f49342a6512da2fea523dbb6bbc88b2ed17i0", kind: "script", usable: "engine-only", note: "Character movement" },
  colliders: { id: "9e98f0c366464e6dec8c5069d8de83c938db9bc7c8e963b9e52189778da7f2c7i0", kind: "script", usable: "engine-only", note: "AutoColliders" },
  collisionPatch: { id: "3c32abc7d6fd1cfeccbe6d70f436756f783d99ebbb02a8f09f4249b266da6985i0", kind: "script", usable: "engine-only", note: "Collision patch" },
  touchJoystick: { id: "b4256950771021306e8bf82ec96d6980a58e62b0293face0173aad532108a4cfi0", kind: "script", usable: "engine-only", note: "Touch joystick" },
  touchInput: { id: "0c9c2f076371b365fd4bfbbe524b3fca4075fe27c453b6bd8e1115812690b9f3i0", kind: "script", usable: "engine-only", note: "Touch input" },
  tpi: { id: "cfe5a50c0b34302e2399d6592359986a4df35496f216cb0fe3776b8c17543dfei0", kind: "script", usable: "engine-only", note: "Third-person input" },
  orbitCamera: { id: "e53b49699d024de4093d8bc1e905ae011ff15fb0909c78a23bd61b4e1b83b8d8i0", kind: "script", usable: "engine-only", note: "Orbit camera" },
  endis: { id: "9f502e378558fbbc76c60ac1121625a204cc05aee7292761ba836d6936b882f6i0", kind: "script", usable: "engine-only", note: "Enable/disable" },
  dis: { id: "a2ba007b78e9f3e69c1b153325edd93d256353ae98ab014d42d089c66d663196i0", kind: "script", usable: "engine-only", note: "Disable" },
  en: { id: "2984330c4718d20619635e4b05de82f00bc1d1e879b86b766f12ee3cfb94a9dfi0", kind: "script", usable: "engine-only", note: "Enable" },
  customShader: { id: "ba70b86abfc8bc94d895638b5186db71df282074b38f574599ad17daa1dc9244i0", kind: "shader", usable: "recipe", note: "Custom shader 1" },
  customShader2: { id: "35b04d774a954655689735d5a29ef7e126ba4e8051f3f695a094c6037bc45b74i0", kind: "shader", usable: "recipe", note: "Custom shader 2" },
  customShader3: { id: "4f6464c5fe53deae5678137d1da8de051090d76b6d58f3bfcd5249b5877aff8ei0", kind: "shader", usable: "recipe", note: "Custom shader 3" },
  renderer: { id: "a2567e8733a1ca275c9128bb866f9786c3e1774514bce119d0dcb6ac74f85e29i0", kind: "script", usable: "engine-only", note: "Renderer core" },
  shadowControl: { id: "20a87bbf36f66a19710f19497290ff94c3aae87b893eb4c13b4da7ea1d8618a3i0", kind: "script", usable: "engine-only", note: "Shadow control" },
  raycaster: { id: "fd02d76da92a111b3e0d88e61173d514e85ff9244cd2f1b1e50864edbb91383ei0", kind: "script", usable: "engine-only", note: "Raycaster" },
  screen: { id: "7537cd8c4ac1d22005868ab63ffe5cdcb7fa3e7bf3a49827ed18053b449b2657i0", kind: "script", usable: "engine-only", note: "Screen" },
  baseTexture: { id: "dbb64a250ef86a6aa338a08d9fbf659b9e17119d6e30f8dc5c15aa274926bf5bi0", kind: "texture", usable: "recipe", note: "512px soft white disc" },
  arrowTexture: { id: "8656d26a274a3f0ec7ff46afe903accc15bab3e6df09400a16df472cbad82ac8i0", kind: "texture", usable: "recipe", note: "512px arrow marker" },
  pixelFontJson: { id: "a1f5a259aab4651425b7e6869435fd6747eaf4d6b063d1971466d966841dd7b4i0", kind: "font", usable: "recipe", note: "Pixel font metrics" },
  pixelFontPng: { id: "f240d09b2f6177f1dcad189132e8c2ed64df38b0d2f381f70b8304e2850d3bf2i0", kind: "font", usable: "recipe", note: "Pixel font atlas" },
};
