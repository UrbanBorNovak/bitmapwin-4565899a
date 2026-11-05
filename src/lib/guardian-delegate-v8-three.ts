/**
 * V8-THREE: the V8 draft master with its creature drawn by Three.js loaded
 * recursively from Bitcoin (/content/<id>), not bundled. Built from V8 by one
 * checked insertion, so the DNA, blueprint, animation, land and HUD are the
 * same code; only the creature's painter changes.
 *
 * Fallback: if the library can't load or WebGL is missing, the original
 * Canvas 2D painter keeps running, so the Guardian always renders.
 * Draft, not inscribed; V7 stays the active Tag 11 delegate.
 */
import { guardianMasterGeneratorHtmlV8 } from "@/lib/guardian-delegate-v8";

/** Three.js r163 ES module inscribed on Bitcoin (checked live on ordinals.com: 200, text/javascript, 671,193 bytes). */
export const THREE_R163_MODULE_ID = "0d013bb60fc5bf5a6c77da7371b07dc162ebc7d7f3af0ff3bd00ae5f0c546445i0";

const threeBlock = (id: string) => String.raw`<script type="module">
/* ================= V8-THREE: WebGL creature painter from on-chain Three.js ================= */
try{
  const T=await import("/content/${id}");
  const cv=document.createElement("canvas"),R=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
  R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.setClearColor(0,0);
  R.shadowMap.enabled=true;R.outputColorSpace=T.SRGBColorSpace;R.toneMapping=T.ACESFilmicToneMapping;
  const S=new T.Scene(),C=new T.OrthographicCamera(-1,1,1,-1,.1,800);
  S.add(new T.HemisphereLight(0xbcd2ee,0x1a1410,1.5));
  const K=new T.DirectionalLight(0xfff1dc,2.6);K.position.set(30,60,25);K.castShadow=true;K.shadow.mapSize.set(1024,1024);
  Object.assign(K.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:160});K.shadow.bias=-.0008;S.add(K,K.target);
  const RIM=new T.DirectionalLight(0x3fe0d0,1.2);RIM.position.set(-30,20,-30);S.add(RIM);
  const FL=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.38}));FL.rotation.x=-Math.PI/2;FL.receiveShadow=true;S.add(FL);
  const N=4096,M=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({roughness:.55,metalness:.15}),N);
  M.castShadow=true;M.frustumCulled=false;M.instanceMatrix.setUsage(T.DynamicDrawUsage);S.add(M);
  const o=new T.Object3D(),col=new T.Color(),gray=new T.Color("#6b6f74"),dk=new T.Color("#2a2d31");
  M.setColorAt(0,col);
  const paint2d=drawVox;
  drawVox=function(pulse,stone,t){
    if(XR||AR||!VOX)return paint2d(pulse,stone,t);
    shadow();
    const w=Math.max(1,W),h=Math.max(1,H);if(cv.width!==Math.round(w*R.getPixelRatio()))R.setSize(w,h,false);
    C.left=-OX/SC;C.right=(w-OX)/SC;C.top=OY/SC;C.bottom=-(h-OY)/SC;
    C.position.set(SY*CP*300,SP*300,CY*CP*300);C.up.set(0,1,0);C.lookAt(0,0,0);C.updateProjectionMatrix();
    let n=0;const put=(v,c,gl)=>{if(n>=N)return;o.position.set(v[0],v[1],v[2]);o.scale.set(Math.max(.01,v[3]),Math.max(.01,v[4]),Math.max(.01,v[5]));
      o.updateMatrix();M.setMatrixAt(n,o.matrix);col.set(c);if(gl>0)col.lerp(new T.Color(1,1,1),Math.min(.45,gl*.18*(1+pulse*.5)));M.setColorAt(n,col);n++};
    for(let i=0;i<VOX.length;i++){const v=anim(VOX[i],t,!stone);put(v,stone?gray.clone().lerp(dk,(i%5)/6).getStyle():v[6],stone?0:v[7])}
    if(AGE&&!stone){const ne=Math.min(16,AGE.ep);for(let i=0;i<ne;i++){const a=i/ne*Math.PI*2+t*.25;
      put([Math.sin(a)*16,3+Math.sin(t*1.5+i)*1.2+(i%3)*2,Math.cos(a)*16,.55,.55,.55],"#f7931a",1.4)}}
    M.count=n;M.instanceMatrix.needsUpdate=true;if(M.instanceColor)M.instanceColor.needsUpdate=true;
    R.render(S,C);g.shadowBlur=0;g.drawImage(cv,0,0,w,h);
  };
  window.GUARDIAN_RENDERER="three-r"+T.REVISION;
}catch(e){window.GUARDIAN_RENDERER="canvas2d"}
</script>`;

let cached: string | null = null;

/** The draft V8 master with the on-chain Three.js creature painter. */
export function guardianMasterGeneratorHtmlV8Three(threeId: string = THREE_R163_MODULE_ID): string {
  if (cached && threeId === THREE_R163_MODULE_ID) return cached;
  const s = guardianMasterGeneratorHtmlV8();
  const end = "</script></body></html>";
  if (!s.endsWith(end)) throw new Error("V8-THREE: V8 tail changed, refusing to patch");
  const out = s.slice(0, -"</body></html>".length) + threeBlock(threeId) + "</body></html>";
  if (threeId === THREE_R163_MODULE_ID) cached = out;
  return out;
}

export function guardianV8ThreeByteSize(): number {
  return new TextEncoder().encode(guardianMasterGeneratorHtmlV8Three()).length;
}
