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
    if(!stone)advent(put,t);
    M.count=n;M.instanceMatrix.needsUpdate=true;if(M.instanceColor)M.instanceColor.needsUpdate=true;
    R.render(S,C);g.shadowBlur=0;g.drawImage(cv,0,0,w,h);
    const ad=adventDay();if(ad&&!stone){const left=ad<24?Math.ceil((Date.UTC(new Date().getUTCFullYear(),11,ad+1)-Date.now())/36e5):0;
      g.font="11px monospace";g.fillStyle="rgba(234,246,255,.85)";g.textAlign="right";
      g.fillText(ad>=24?"\u2605 CHRISTMAS EVE \u2605":"ADVENT DAY "+ad+" \u00b7 NEXT GIFT IN "+Math.max(0,left)+"H",w-12,h-14);g.textAlign="left"}
  };
  /* ---- Advent engine: client UTC date; unlocks one more thing each December day. ?advent=DD previews. ---- */
  const adventDay=()=>{const q=+(new URLSearchParams(location.search).get("advent")||window.ADVENT_DAY||0);if(q>0)return Math.min(31,q);
    const d=new Date();return d.getUTCMonth()===11?d.getUTCDate():0};
  const hr=(i)=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)};
  const tree=(put,x,z,t,s)=>{put([x,1.2,z,.8,2.4,.8],"#5b3a1e",0);
    for(let k=0;k<4;k++){const r=4.2-k*1,y=2.6+k*1.6;put([x,y,z,r,1.4,r],k%2?"#1f6b34":"#17552a",0);
      for(let j=0;j<6;j++){const a=j/6*Math.PI*2+k;const on=Math.sin(t*3+j+k*2+s)>0;
        put([x+Math.sin(a)*r*.52,y,z+Math.cos(a)*r*.52,.32,.32,.32],["#ff3b3b","#ffd23f","#3fe0d0","#f7931a"][(j+k)%4],on?2.2:0)}}
    put([x,9.6,z,.7,.7,.7],"#ffd23f",2+Math.sin(t*4))};
  const gift=(put,x,z,i)=>{const s=.9+hr(i)*.8,c=["#d62828","#2a9d8f","#f7931a","#7b2cbf","#e9c46a"][i%5];
    put([x,s/2,z,s,s,s],c,.2);put([x,s/2,z,s*1.02,s*1.02,.18],"#fff6d5",.4);put([x,s/2,z,.18,s*1.02,s*1.02],"#fff6d5",.4)};
  const deer=(put,x,y,z,a,t,nose)=>{const ca=Math.cos(a),sa=Math.sin(a),P=(f,u,r)=>[x+sa*f+ca*r,y+u,z+ca*f-sa*r];
    const b=P(0,0,0);put([b[0],b[1],b[2],1,.8,1],"#8a5a33",0);const h=P(.9,.7,0);put([h[0],h[1],h[2],.6,.6,.6],"#8a5a33",0);
    const n=P(1.25,.7,0);put([n[0],n[1],n[2],.25,.25,.25],nose?"#ff2020":"#2b1a10",nose?2.5:0);
    for(const r of[-.25,.25]){const an=P(.8,1.25,r);put([an[0],an[1],an[2],.12,.5,.12],"#e8d8b0",0)}
    const k=Math.sin(t*10)*.25;for(const f of[-.4,.4])for(const r of[-.3,.3]){const l=P(f+(f*r>0?k:-k),-.7,r);put([l[0],l[1],l[2],.18,.6,.18],"#5b3a1e",0)}};
  function advent(put,t){const d=adventDay();if(!d)return;
    const flakes=Math.min(180,8+d*7);for(let i=0;i<flakes;i++){const fx=(hr(i)-.5)*60,fz=(hr(i+99)-.5)*60,sp=1.5+hr(i+7)*2;
      const fy=30-((t*sp+hr(i+3)*30)%30);put([fx+Math.sin(t+i)*.6,fy,fz,.22,.22,.22],"#ffffff",1.2)}
    if(d>=4){const cov=Math.min(140,(d-3)*7);for(let i=0;i<cov;i++){const a=hr(i+500)*Math.PI*2,r=9+hr(i+600)*16;
      put([Math.sin(a)*r,.08,Math.cos(a)*r,1+hr(i+700)*2.4,.16+d*.006,1+hr(i+800)*2.4],"#eef6ff",.3)}}
    if(d>=8)tree(put,-13,-9,t,0);
    if(d>=12)tree(put,13,-10,t,3);
    if(d>=15){const ea=t*.4,ex=Math.sin(ea)*10,ez=Math.cos(ea)*10,bob=Math.abs(Math.sin(t*6))*.3;
      put([ex,.9+bob,ez,.7,1,.5],"#2e8b3a",0);put([ex,1.75+bob,ez,.55,.55,.55],"#f1c6a0",0);
      put([ex,2.25+bob,ez,.5,.4,.5],"#d62828",0);put([ex,2.6+bob,ez,.2,.35,.2],"#d62828",0);put([ex,2.85+bob,ez,.16,.16,.16],"#ffffff",1)}
    if(d>=19){const gn=Math.min(10,(d-18)*2);for(let i=0;i<gn;i++){const tx=i%2?13:-13,tz=i%2?-10:-9;gift(put,tx+(hr(i+40)-.5)*6,tz+3+hr(i+50)*2,i)}}
    if(d>=21&&d<24){const a=t*.35;deer(put,Math.sin(a)*24,20,Math.cos(a)*24,a+Math.PI/2,t,d>=22)}
    if(d>=24){const a=t*.3,R0=22,y=18+Math.sin(t)*1.5;
      for(let k=0;k<6;k++){const ak=a+.13*(5-k)+.13;deer(put,Math.sin(ak)*R0,y,Math.cos(ak)*R0,ak+Math.PI/2,t,k===5)}
      const sx=Math.sin(a)*R0,sz=Math.cos(a)*R0;put([sx,y-.4,sz,2.4,1,1.6],"#b5121b",.3);put([sx,y-1,sz,2.8,.2,1.8],"#ffd23f",.8);
      put([sx,y+.6,sz,.9,1.1,.9],"#d62828",0);put([sx,y+1.35,sz,.6,.6,.6],"#f1c6a0",0);put([sx,y+1.1,sz,.7,.35,.7],"#ffffff",.6);
      put([sx,y+1.8,sz,.55,.45,.55],"#d62828",0);put([sx,y+.2,sz-.9,1,1,1],"#7b4a1e",0);
      for(let i=0;i<8;i++){const a2=i/8*Math.PI*2+.3;gift(put,Math.sin(a2)*6.5,Math.cos(a2)*6.5,i+20)}}}
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
