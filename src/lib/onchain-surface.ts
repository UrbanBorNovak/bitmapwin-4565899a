/**
 * ON-CHAIN SURFACES — water and lava, straight off four inscriptions.
 *
 * Each inscription below is a self-contained noise animation: a simplex-noise
 * field turned into colour, with bright crests where the noise peaks and, on the
 * "running" pair, white foam along the two edges of the flow. Those recipes are
 * reproduced here verbatim in GLSL so the same look runs on the GPU across a
 * whole sea instead of a 128x128 CPU buffer, and so it can be laid on any
 * surface in the world — flat pools, seas, and vertical falls.
 *
 * Nothing is downloaded at runtime: the maths is the payload.
 */
import * as THREE from "three";

/** The four source inscriptions these surfaces come from. */
export const SURFACE_INSCRIPTIONS = {
  water: "cb2949d6eb63fbde3400c2b48bcd03b4ef3963752ff5bc26550a05950bd562c3i0",
  waterRun: "97712b95fc832e874560981c7e9c415223f9eba070396c668a8a0959169758a8i0",
  lava: "1c6c762d23c33bce772f6386a88f2c246955f0a055862555feb10a85306ed1b3i0",
  lavaRun: "e67e9a8719888c497232dbda0705d16a2456ae5bb9f5217c8953042d2391896di0",
} as const;

export type SurfaceVariant = keyof typeof SURFACE_INSCRIPTIONS;

/** Shared clock for every on-chain surface, so seas and falls stay in step. */
export type SurfaceUniforms = {
  uTime: { value: number };
  /** noise field scale — the inscription's `scale * bufferSize` */
  uFieldScale: { value: number };
  /** flow speed multiplier */
  uFlow: { value: number };
};

export function surfaceUniforms(fieldScale = 6.4, flow = 1): SurfaceUniforms {
  return {
    uTime: { value: 0 },
    uFieldScale: { value: fieldScale },
    uFlow: { value: flow },
  };
}

/** Ashima's simplex noise, the GPU twin of the inscription's SimplexNoise. */
const SNOISE = /* glsl */ `
vec3 osMod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 osMod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 osPermute(vec4 x){ return osMod289(((x*34.0)+10.0)*x); }
vec4 osTaylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float osNoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = osMod289(i);
  vec4 p = osPermute(osPermute(osPermute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = osTaylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

/** The colour recipe of one inscription, in fragment-shader form. */
function recipe(variant: SurfaceVariant) {
  const running = variant === "waterRun" || variant === "lavaRun";
  const flowY = running ? "- osT" : "";
  const body =
    variant === "water" || variant === "waterRun"
      ? // turquoise base with ripple displacement, exactly as inscribed
        `float dx = sin(osT + nx) * 20.0 * value;
         float dy = cos(osT + ny) * 20.0 * value;
         vec3 col = vec3(0.0 + dx, 100.0 + value * 100.0, 200.0 + dy) / 255.0;
         float thr = ${variant === "water" ? "0.75" : "0.8"};
         float inten = ${variant === "water" ? "0.7" : "0.9"};`
      : variant === "lava"
        ? `vec3 col = vec3(255.0, 128.0 + value * 100.0, 0.0) / 255.0;
           col.r = min(col.r, 1.0);
           float thr = 0.7;
           float inten = 0.8;`
        : `vec3 col = vec3(200.0 + value * 55.0, 100.0 + value * 100.0, 0.0) / 255.0;
           float thr = 0.8;
           float inten = 0.9;`;

  // The running pair carries white foam down both edges of the flow; the lava
  // fall wobbles that foam with a second, faster noise lookup.
  const edge = running
    ? `float edgeFactor = min(osUv.x, 1.0 - osUv.x) / 0.1;
       if (edgeFactor < 1.0) {
         float wob = ${
           variant === "lavaRun"
             ? "0.5 + 0.5 * osNoise(vec3(osUv.x * 24.0, osUv.y * 24.0 - osT, osT))"
             : "1.0"
         };
         float edgeFoam = clamp((1.0 - edgeFactor) * inten * wob, 0.0, 1.0);
         col = mix(col, vec3(1.0), edgeFoam);
       }`
    : "";

  return /* glsl */ `
    float osT = uTime * uFlow;
    float nx = osUv.x * uFieldScale;
    float ny = osUv.y * uFieldScale ${flowY};
    float value = (osNoise(vec3(nx, ny, osT)) + 1.0) * 0.5;
    ${body}
    if (value > thr) {
      float foam = (value - thr) / (1.0 - thr) * inten;
      col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0));
    }
    ${edge}
    diffuseColor.rgb = col;
  `;
}

/**
 * Paint an inscription's surface onto any existing material.
 *
 * Patching rather than replacing keeps instancing, fog and lighting intact, so
 * the same call works for a single sea sheet and for hundreds of pooled
 * instances.
 *
 * @param uvFromWorld when true the noise is read from world XZ rather than the
 *   mesh's own UVs, so neighbouring sheets of one sea flow as a single body.
 */
export function patchSurface(
  material: THREE.Material,
  variant: SurfaceVariant,
  uniforms: SurfaceUniforms,
  uvFromWorld = false,
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms["uTime"] = uniforms.uTime;
    shader.uniforms["uFieldScale"] = uniforms.uFieldScale;
    shader.uniforms["uFlow"] = uniforms.uFlow;

    shader.vertexShader = `#define USE_UV\nvarying vec2 vOsWorld;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vec4 osWorld = modelMatrix * vec4(transformed, 1.0);
       vOsWorld = osWorld.xz;`,
    );

    shader.fragmentShader = `#define USE_UV
uniform float uTime;
uniform float uFieldScale;
uniform float uFlow;
varying vec2 vOsWorld;
${SNOISE}
${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       // World tiling: one noise tile per BITMAP, so a sea carries broad swell
       // rather than a fine speckle.
       vec2 osUv = ${uvFromWorld ? "fract(vOsWorld * 1.1)" : "vUv"};
       ${recipe(variant)}`,
    );
  };
  material.needsUpdate = true;
  return material;
}

/** Advance every on-chain surface by one frame. */
export function tickSurface(uniforms: SurfaceUniforms, delta: number) {
  uniforms.uTime.value += delta;
}
