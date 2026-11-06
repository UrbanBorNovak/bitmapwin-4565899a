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

/** Default horizon backdrop parent: Genesis Consensus (Watsny's Mind: Consensus Drift children). */
export const BG_PARENT_ID = "81e34a81adaa8152f09ee31ef554a9de22de0cf9b5a2266c90513c315463b376i0";

const threeBlock = (id: string) => String.raw`<script type="module">
/* ================= V8-THREE: WebGL creature painter from on-chain Three.js ================= */
/* ---- Exact parcels: /r/block/<height> raw hex -> each tx's total output sats -> Bitmap side
   class floor(log10(sats))-4 clamped 1..8 (bitfeed / bitmap.trade rule), packed by the same mondrian().
   Any doubt (fetch error, bad parse, tx count mismatch, >12k txs) keeps the seeded land untouched. ---- */
const parseBlockValues=(hx)=>{if(typeof hx!=="string"||hx.length<162||hx.length%2||!/^[0-9a-f]+$/i.test(hx.slice(0,200)))return null;
  let p=160;const L=hx.length;
  const b=()=>{if(p+2>L)throw 0;const v=parseInt(hx.substr(p,2),16);p+=2;return v};
  const u32=()=>{const v=b()|b()<<8|b()<<16|(b()<<24>>>0);return v>>>0};
  const vi=()=>{const f=b();if(f<253)return f;if(f===253)return b()|b()<<8;if(f===254)return u32();const lo=u32(),hi=u32();if(hi)throw 0;return lo};
  const skip=(n)=>{p+=n*2;if(p>L)throw 0};
  try{const n=vi(),out=[];if(n<1||n>12000)return null;
    for(let i=0;i<n;i++){skip(4);let sw=false,ni=vi();if(ni===0){if(b()!==1)return null;sw=true;ni=vi()}
      for(let k=0;k<ni;k++){skip(36);skip(vi());skip(4)}
      const no=vi();let sum=0;for(let k=0;k<no;k++){const lo=u32(),hi=u32();sum+=lo+hi*4294967296;skip(vi())}
      if(sw)for(let k=0;k<ni;k++){const w=vi();for(let q=0;q<w;q++)skip(vi())}
      skip(4);out.push(sum)}
    return p===L?out:null}catch(_){return null}};
window.BW_PARCELS="seeded";
(async()=>{try{
  for(let i=0;i<120&&!(typeof G!=="undefined"&&G&&LAND);i++)await new Promise(r=>setTimeout(r,500));
  if(!(G&&LAND)||!(G.h>0))return;
  const r=await fetch("/r/block/"+G.h);if(!r.ok)return;const hx=(await r.text()).trim().replace(/^"|"$/g,"");
  if(hx.length>16e6)return;
  const vals=parseBlockValues(hx);if(!vals||vals.length!==LAND.n)return;
  const sizes=vals.map(v=>Math.max(1,Math.min(8,Math.floor(Math.log10(Math.max(1,v)))-4)));
  const M=mondrian(sizes),side=Math.max(M.w,M.h),S=28/side,half=14,p=[],OR=["#f7931a","#f9a23c","#e8850e","#ffb03a","#d97a0a"];
  for(let i=0;i<M.sq.length;i++){const q=M.sq[i];p.push([q.x*S-half+(side-M.w)*S/2,q.y*S-half+(side-M.h)*S/2,q.r*S,OR[(h32(G.dna+":"+i)>>>3)%OR.length]])}
  LAND={p,half,depth:LAND.depth,n:LAND.n,exact:true};window.BW_PARCELS="block";
}catch(_){window.BW_PARCELS="seeded"}})();
try{
  const cv=document.createElement("canvas");
  {const t=document.createElement("canvas");if(!(t.getContext("webgl2")||t.getContext("webgl")))throw 0}
  const T=await import("/content/${id}");
  const R=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
  R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.setClearColor(0,0);
  R.shadowMap.enabled=true;R.outputColorSpace=T.SRGBColorSpace;R.toneMapping=T.ACESFilmicToneMapping;
  const S=new T.Scene(),C=new T.OrthographicCamera(-1,1,1,-1,.1,800);
  S.add(new T.HemisphereLight(0xbcd2ee,0x1a1410,1.5));
  const K=new T.DirectionalLight(0xfff1dc,2.6);K.position.set(30,60,25);K.castShadow=true;K.shadow.mapSize.set(512,512);
  Object.assign(K.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:160});K.shadow.bias=-.0008;S.add(K,K.target);
  const RIM=new T.DirectionalLight(0x3fe0d0,1.2);RIM.position.set(-30,20,-30);S.add(RIM);
  const FL=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.38}));FL.rotation.x=-Math.PI/2;FL.receiveShadow=true;S.add(FL);
  const N=4096,M=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({roughness:.55,metalness:.15}),N);
  M.castShadow=true;M.frustumCulled=false;M.instanceMatrix.setUsage(T.DynamicDrawUsage);S.add(M);
  const o=new T.Object3D(),col=new T.Color(),gray=new T.Color("#6b6f74"),dk=new T.Color("#2a2d31");
  M.setColorAt(0,col);window.BW_MOON2D=true;
  const paint2d=drawVox;
  drawVox=function(pulse,stone,t){
    if(XR||AR||!VOX)return paint2d(pulse,stone,t);
    shadow();
    const w=Math.max(1,W),h=Math.max(1,H);if(cv.width!==Math.round(w*R.getPixelRatio()))R.setSize(w,h,false);
    C.left=-OX/SC;C.right=(w-OX)/SC;C.top=OY/SC;C.bottom=-(h-OY)/SC;
    C.position.set(SY*CP*300,SP*300,CY*CP*300);C.up.set(0,1,0);C.lookAt(0,0,0);C.updateProjectionMatrix();
    if(R.xr.isPresenting)return;
    fill(pulse,stone,t);
    R.render(S,C);g.shadowBlur=0;if(!stone)moon2d(w,h,t);g.drawImage(cv,0,0,w,h);
    const ad=adventDay();if(ad&&!stone&&!(w<600&&h<760)){const left=Math.max(1,Math.ceil((864e5-Date.now()%864e5)/36e5)),nar=w<600;
      g.font="15px monospace";g.fillStyle="rgba(234,246,255,.85)";g.textAlign=nar?"center":"right";
      g.fillText(ad>=24?"\u2605 CHRISTMAS EVE \u2605":"ADVENT DAY "+ad+" \u00b7 NEXT GIFT IN "+left+"H",nar?w/2:w-12,nar?Math.max(122,window.BW_TOPY||0):h-14);g.textAlign="left"}
    if(!stone)eventHud(w,h);
  };
  function fill(pulse,stone,t,vr){
    let n=0;const put=(v,c,gl)=>{if(n>=N)return;o.position.set(v[0],v[1],v[2]);o.scale.set(Math.max(.01,v[3]),Math.max(.01,v[4]),Math.max(.01,v[5]));
      o.updateMatrix();M.setMatrixAt(n,o.matrix);col.set(c);if(gl>0)col.lerp(new T.Color(1,1,1),Math.min(.45,gl*.18*(1+pulse*.5)));M.setColorAt(n,col);n++};
    if(VOX)for(let i=0;i<VOX.length;i++){const v=anim(VOX[i],t,!stone);put(v,stone?gray.clone().lerp(dk,(i%5)/6).getStyle():v[6],stone?0:v[7])}
    if(AGE&&!stone){const ne=Math.min(16,AGE.ep);for(let i=0;i<ne;i++){const a=i/ne*Math.PI*2+t*.25;
      put([Math.sin(a)*16,3+Math.sin(t*1.5+i)*1.2+(i%3)*2,Math.cos(a)*16,.55,.55,.55],"#f7931a",1.4)}}
    if(!stone){advent(put,t);sky(put,t);chainFx(put,t);for(const f of window.BW_HOOKS.slice()){try{f(put,t)}catch(_){window.BW_HOOKS.splice(window.BW_HOOKS.indexOf(f),1)}}}
    /* VR: the 2D land is painted on the canvas, so in the headset the BITMAP parcels become thin voxel tiles */
    if(vr&&LAND&&LAND.p)for(let i=0;i<LAND.p.length&&n<N-64;i++){const q=LAND.p[i],s=Math.max(.05,q[2]-.08);put([q[0]+q[2]/2,-.06,q[1]+q[2]/2,s,.12,s],q[3],0)}
    M.count=n;M.instanceMatrix.needsUpdate=true;if(M.instanceColor)M.instanceColor.needsUpdate=true;
  }
  /* ================= WebXR: stand beside your Guardian (Quest / Vision Pro / Android + viewer) =================
     1 voxel = 10 cm. Left stick walks (head-relative), right stick snap-turns 30deg, trigger cycles stance,
     grip = REC-free ROAR. The button appears only when navigator.xr reports immersive-vr. */
  R.xr.enabled=true;
  const WORLD=new T.Group();S.remove(M,FL);WORLD.add(M,FL);S.add(WORLD);
  const RIG=new T.Group(),PC=new T.PerspectiveCamera(70,1,.05,200);RIG.add(PC);S.add(RIG);
  const STARS=new T.Points((()=>{const gm=new T.BufferGeometry(),a=new Float32Array(1800);for(let i=0;i<600;i++){const q=(k)=>{const x=Math.sin(k*12.9898)*43758.5453;return x-Math.floor(x)},u=q(i+3000)*2-1,ph=q(i+4000)*6.283,r=60,s=Math.sqrt(1-u*u);
    a[i*3]=Math.cos(ph)*s*r;a[i*3+1]=Math.abs(u)*r;a[i*3+2]=Math.sin(ph)*s*r}gm.setAttribute("position",new T.BufferAttribute(a,3));return gm})(),new T.PointsMaterial({color:0xcfe8ff,size:.25}));
  STARS.visible=false;S.add(STARS);
  /* ================= Horizon backdrop: children of a parent collection, rendered by the parent's own on-chain engine =================
     Default parent = Genesis Consensus (WMCD). Child seeds come from each child's own wmcd-child-meta JSON and must name this parent;
     the art is drawn by the parent's window.WM_RENDER (same-origin /content iframe). ?bg=<parent_id> swaps, ?bg=off hides. Any failure = no backdrop. */
  const BG_DEF="${BG_PARENT_ID}";const bgQ=new URLSearchParams(location.search).get("bg")||window.BW_BG||BG_DEF;
  const BGR=new T.Group();BGR.visible=false;BGR.renderOrder=-1;S.add(BGR);
  if(bgQ!=="off"&&/^[0-9a-f]{64}i\d+$/.test(bgQ))(async()=>{try{
    const r=await fetch("/r/children/"+bgQ);if(!r.ok)return;const ids=((await r.json()).ids||[]).filter(x=>/^[0-9a-f]{64}i\d+$/.test(x));if(!ids.length)return;
    const NT=8,off=(typeof G!=="undefined"&&G&&G.h>0?G.h:0)%ids.length,pick=[];for(let i=0;i<Math.min(NT,ids.length);i++)pick.push(ids[(off+i*Math.max(1,Math.floor(ids.length/NT)))%ids.length]);
    const metas=(await Promise.all(pick.map(async id=>{try{const t=await (await fetch("/content/"+id)).text();const m=t.match(/<script id="wmcd-child-meta" type="application\/json">([^<]+)<\/script>/);
      if(!m)return null;const j=JSON.parse(m[1]);return j.parent_inscription_id===bgQ&&Number.isFinite(+j.seed)?j:null}catch(_){return null}}))).filter(Boolean);
    if(!metas.length)return;
    const fr=document.createElement("iframe");fr.style.cssText="position:fixed;width:1px;height:1px;left:-9px;top:-9px;opacity:0;pointer-events:none;border:0";fr.src="/content/"+bgQ;
    document.body.appendChild(fr);await new Promise((ok,no)=>{fr.onload=ok;setTimeout(no,15e3)});
    const RND=fr.contentWindow&&fr.contentWindow.WM_RENDER;if(typeof RND!=="function")return;
    const TS=256,cvb=document.createElement("canvas");cvb.width=TS*metas.length;cvb.height=TS;const bx=cvb.getContext("2d");
    const tile=document.createElement("canvas");tile.width=tile.height=TS;const tx=tile.getContext("2d");
    metas.forEach((m,i)=>{try{tx.setTransform(1,0,0,1,0,0);RND(tx,+m.seed,TS,m.paletteType||"monochrome");bx.drawImage(tile,i*TS,0)}catch(_){}});
    fr.remove();
    const tex=new T.CanvasTexture(cvb);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=T.RepeatWrapping;tex.repeat.x=2;
    const cyl=new T.Mesh(new T.CylinderGeometry(46,46,22,64,1,true),new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.22,side:T.BackSide,depthWrite:false,blending:T.AdditiveBlending,fog:false}));
    cyl.position.y=16;cyl.renderOrder=-1;BGR.add(cyl);BGR.visible=true;window.BW_BG_TILES=metas.length;
    (function spin(){BGR.rotation.y=performance.now()*2e-5;requestAnimationFrame(spin)})();
  }catch(_){}})();
  const pads=[];for(let i=0;i<2;i++){const c=R.xr.getController(i);RIG.add(c);
    const ray=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-1)]),new T.LineBasicMaterial({color:0xf7931a}));ray.scale.z=2;c.add(ray);
    c.addEventListener("selectstart",()=>{if(typeof stance==="function")stance(((typeof STANCE!=="undefined"?STANCE:0)+1)%4)});
    c.addEventListener("squeezestart",()=>{if(typeof stance==="function")stance(3)});
    c.addEventListener("connected",(e)=>{c.userData.src=e.data});c.addEventListener("disconnected",()=>{c.userData.src=null});pads.push(c)}
  /* movement options (device-local): MOVE = teleport (default) or smooth walk; SEAT raises the eyes ~45 cm for seated play.
     In VR: left X button toggles MOVE, left Y button toggles SEAT. Snap turn (right stick, 30deg) stays in every mode. */
  const VO={move:"tp",seat:false};try{const j=JSON.parse(localStorage.getItem("bw-vr")||"{}");if(j.move==="smooth")VO.move="smooth";VO.seat=!!j.seat}catch(_){}
  const voSave=()=>{try{localStorage.setItem("bw-vr",JSON.stringify(VO))}catch(_){}};
  const SEAT_H=.45,lim=()=>Math.max(3,(LAND&&LAND.half?LAND.half:14)*.1+2),clampRig=()=>{const l=lim();RIG.position.x=Math.max(-l,Math.min(l,RIG.position.x));RIG.position.z=Math.max(-l,Math.min(l,RIG.position.z))};
  const TPM=new T.Mesh(new T.RingGeometry(.18,.26,32),new T.MeshBasicMaterial({color:0x3fe0d0,transparent:true,opacity:.9}));TPM.rotation.x=-Math.PI/2;TPM.visible=false;S.add(TPM);
  let turnLock=false,tpAim=false,tpOk=false,vt0=performance.now(),vlast=0;const fw=new T.Vector3(),rt=new T.Vector3(),cp=new T.Vector3(),cd=new T.Vector3(),hp=new T.Vector3(),tp=new T.Vector3(),cq=new T.Quaternion();
  const btn=(gp,i)=>!!(gp.buttons[i]&&gp.buttons[i].pressed);
  const vrFrame=()=>{const now=performance.now(),t=(now-vt0)/1e3+50,dt=vlast?Math.min(.1,(now-vlast)/1e3):1/72;vlast=now;
    for(const c of pads){const src=c.userData.src;if(!src||!src.gamepad)continue;const gp=src.gamepad,ax=gp.axes,x=ax[2]||0,y=ax[3]||0;
      if(src.handedness==="right"){if(Math.abs(x)>.7&&!turnLock){RIG.rotation.y-=Math.sign(x)*Math.PI/6;turnLock=true}else if(Math.abs(x)<.3)turnLock=false;continue}
      const bx=btn(gp,4),by=btn(gp,5);
      if(bx&&!c.userData.bx){VO.move=VO.move==="tp"?"smooth":"tp";voSave();vbSync()}
      if(by&&!c.userData.by){VO.seat=!VO.seat;voSave();RIG.position.y=VO.seat?SEAT_H:0;vbSync()}
      c.userData.bx=bx;c.userData.by=by;
      if(VO.move==="smooth"){if(Math.abs(x)+Math.abs(y)>.15){PC.getWorldDirection(fw);fw.y=0;fw.normalize();rt.crossVectors(fw,RIG.up);
        RIG.position.addScaledVector(fw,-y*1.4*dt).addScaledVector(rt,x*1.4*dt);clampRig()}continue}
      /* teleport: push stick forward to aim from the controller to the floor, release to jump there */
      if(y<-.6){tpAim=true;c.getWorldPosition(cp);c.getWorldQuaternion(cq);cd.set(0,-.35,-1).applyQuaternion(cq).normalize();
        tpOk=cd.y<-.05;if(tpOk){const k=-cp.y/cd.y;tp.copy(cp).addScaledVector(cd,Math.min(k,12));tp.y=0;const l=lim();tpOk=Math.abs(tp.x)<=l&&Math.abs(tp.z)<=l}
        TPM.visible=true;TPM.position.set(tp.x,.01,tp.z);TPM.material.color.setHex(tpOk?0x3fe0d0:0xb3261e)}
      else if(tpAim&&y>-.3){tpAim=false;TPM.visible=false;if(tpOk){PC.getWorldPosition(hp);RIG.position.x+=tp.x-hp.x;RIG.position.z+=tp.z-hp.z;clampRig()}}}
    const stone=typeof STATE!=="undefined"&&STATE==="RELIC";
    fill(0,stone,t,true);R.render(S,PC)};
  const vrStart=async()=>{try{const s=await navigator.xr.requestSession("immersive-vr",{optionalFeatures:["local-floor","bounded-floor"]});
    R.xr.setReferenceSpaceType("local-floor");await R.xr.setSession(s);RIG.position.set(0,VO.seat?SEAT_H:0,2.4);RIG.rotation.set(0,0,0);STARS.visible=true;WORLD.scale.setScalar(.1);
    R.setClearColor(0x04060a,1);vlast=0;R.setAnimationLoop(vrFrame);VB.textContent="EXIT VR";
    s.addEventListener("end",()=>{R.setAnimationLoop(null);STARS.visible=false;TPM.visible=false;tpAim=false;WORLD.scale.setScalar(1);R.setClearColor(0,0);VB.textContent="\u{1F97D} ENTER VR"})}catch(_){VB.textContent="VR REFUSED"}};
  /* VR bar: hidden unless the device reports immersive-vr, so the normal screen layout is untouched */
  const VBAR=document.createElement("div");VBAR.style.cssText="position:fixed;left:50%;bottom:2%;transform:translateX(-50%);z-index:6;display:none;gap:6px;align-items:center";
  const mk=(txt,bg)=>{const b=document.createElement("button");b.textContent=txt;b.style.cssText="font:bold 13px ui-monospace,monospace;letter-spacing:.06em;white-space:nowrap;color:#04060a;background:"+bg+";border:0;padding:7px 10px;cursor:pointer";VBAR.appendChild(b);return b};
  const VB=mk("\u{1F97D} ENTER VR","#3fe0d0"),VM=mk("","#f7931a"),VS=mk("","#f7931a");
  const vbSync=()=>{VM.textContent=VO.move==="tp"?"MOVE: TELEPORT":"MOVE: SMOOTH";VS.textContent=VO.seat?"SEATED":"STANDING"};vbSync();
  VB.onclick=(e)=>{e.stopPropagation();const s=R.xr.getSession();if(s)s.end();else vrStart()};
  VM.onclick=(e)=>{e.stopPropagation();VO.move=VO.move==="tp"?"smooth":"tp";voSave();vbSync()};
  VS.onclick=(e)=>{e.stopPropagation();VO.seat=!VO.seat;voSave();if(R.xr.isPresenting)RIG.position.y=VO.seat?SEAT_H:0;vbSync()};
  document.body.appendChild(VBAR);
  window.BW_VR={RIG,VO,TPM,WORLD,STARS,PC,R};
  try{if(navigator.xr&&navigator.xr.isSessionSupported)navigator.xr.isSessionSupported("immersive-vr").then(ok=>{if(ok)VBAR.style.display="flex"},()=>{})}catch(_){}
  /* ================= Sky, chain events and community modules ================= */
  /* Sky: viewer's real date (UTC). Moon phase from the mean synodic month; blood moon / solar eclipse only on listed
     real eclipse dates; meteor showers on their yearly peak windows; zodiac = tropical sun sign. ?sky=YYYY-MM-DD previews. */
  const QS=new URLSearchParams(location.search);
  const skyDate=()=>{const q=QS.get("sky")||window.BW_SKY;const d=q?new Date(q+"T22:00:00Z"):new Date();return isNaN(d.getTime())?new Date():d};
  const moonAge=(d)=>{const a=((d.getTime()-Date.UTC(2000,0,6,18,14))/864e5)%29.530588853;return a<0?a+29.530588853:a};
  const ZOD=["CAPRICORN","AQUARIUS","PISCES","ARIES","TAURUS","GEMINI","CANCER","LEO","VIRGO","LIBRA","SCORPIO","SAGITTARIUS"],ZCUT=[20,19,21,20,21,21,23,23,23,23,22,22];
  const zodiac=(d)=>{const m=d.getUTCMonth();return d.getUTCDate()<ZCUT[m]?m:(m+1)%12};
  const SHOWERS=[[0,2,4,"QUADRANTIDS"],[3,21,23,"LYRIDS"],[4,5,7,"ETA AQUARIIDS"],[7,11,13,"PERSEIDS"],[9,20,22,"ORIONIDS"],[10,16,18,"LEONIDS"],[11,13,15,"GEMINIDS"]];
  const BLOODMOON=["2025-03-14","2025-09-07","2026-03-03","2028-12-31","2029-06-26","2029-12-20"],SOLARECL=["2026-08-12","2027-08-02","2028-07-22"];
  const PHASES=["NEW MOON","WAXING CRESCENT","FIRST QUARTER","WAXING GIBBOUS","FULL MOON","WANING GIBBOUS","LAST QUARTER","WANING CRESCENT"];
  const skyNow=()=>{const d=skyDate(),iso=d.toISOString().slice(0,10),age=moonAge(d),m=d.getUTCMonth(),day=d.getUTCDate();
    const sh=SHOWERS.find(s=>s[0]===m&&day>=s[1]&&day<=s[2]);
    return{age,phase:PHASES[Math.floor((age/29.530588853*8+.5))%8],z:zodiac(d),shower:sh?sh[3]:"",blood:BLOODMOON.includes(iso),ecl:SOLARECL.includes(iso)}};
  let SKY=skyNow();setInterval(()=>{SKY=skyNow()},6e4);
  /* moon: pinned in screen space (left, below the stats column / clear of the centre HUD) so orbiting never drags it over text */
  function moon2d(w,h,t){const s=SKY,nar=w<600,px=nar?7:8,R=3.2,k=Math.cos(s.age/29.530588853*Math.PI*2),wax=s.age<14.765;
    const cx=nar?w-px*5:Math.round(w*.62),cy=nar?Math.round(h*.30):Math.round(h*.30);
    for(let iy=-3;iy<=3;iy++)for(let ix=-3;ix<=3;ix++){const x=ix/R,y=iy/R;if(x*x+y*y>1)continue;const xt=k*Math.sqrt(1-y*y);
      const lit=s.ecl?false:s.blood?true:(wax?x>xt:x<-xt);
      g.fillStyle=s.ecl?"#05070a":s.blood?"rgba(179,38,30,"+(.8+Math.sin(t*2)*.2)+")":lit?"#eef1e6":"#1b2230";g.fillRect(cx+ix*px-px/2,cy+iy*px-px/2,px-1,px-1)}
    if(s.ecl){g.fillStyle="#ffd23f";for(let i=0;i<20;i++){const a=i/20*Math.PI*2+t*.2;g.fillRect(cx+Math.cos(a)*px*4.2-2,cy+Math.sin(a)*px*4.2-2,4,4)}}}
  function sky(put,t){const s=SKY;
    /* zodiac season: 7 stylised stars of the current sign, fixed per sign, twinkling */
    for(let i=0;i<7;i++){const a=hr(s.z*31+i),b=hr(s.z*17+i+5);put([4+a*13,13+b*6,-18+hr(i+s.z)*3,.35,.35,.35],"#cfe8ff",1.2+Math.sin(t*2+i)*.8)}
    /* meteor shower peak: streaks across the sky */
    if(s.shower)for(let i=0;i<6;i++){const ph=(t*.35+hr(i+900))%1,sx=-30+hr(i+910)*40+ph*40,sy=30-ph*14,sz=-26+hr(i+920)*20;
      for(let j=0;j<5;j++)put([sx-j*.9,sy+j*.35,sz,.3,.3,.3],"#ffffff",2.4-j*.45)}}
  /* Chain events: polls /r/blockheight every 60s; each new block fires a shockwave, and special heights add their own scene.
     ?fx=HEIGHT previews one block's event. Tags come only from the height and /r/blockinfo. */
  let TIP=0;const FX=[];
  const fxTags=(h,info)=>{const L=[],s=String(h);if(h%210000===0)L.push("HALVING");if(h%2016===0)L.push("DIFFICULTY ADJUSTMENT");
    if(s.length>2&&s===s.split("").reverse().join(""))L.push("PALINDROME");if(h%1000===0)L.push("MILESTONE");
    if(typeof G!=="undefined"&&G&&G.h>0&&h%1000===G.h%1000)L.push("ECHO OF "+G.h);
    if(info&&info.transaction_count>=5000)L.push("TX SURGE");if(info&&info.transaction_count===1)L.push("EMPTY BLOCK");return L};
  const onBlock=async(h)=>{let info=null;try{const r=await fetch("/r/blockinfo/"+h);if(r.ok)info=await r.json()}catch(_){}
    FX.push({h,t0:performance.now()/1e3,tags:fxTags(h,info),n:info?info.transaction_count:0});if(FX.length>3)FX.shift()};
  (async()=>{const pf=+(QS.get("fx")||window.BW_FX||0);if(pf>0){onBlock(pf);return}
    const poll=async()=>{try{const r=await fetch("/r/blockheight");if(!r.ok)return;const h=+(await r.text());if(!(h>0))return;if(TIP&&h>TIP)onBlock(h);TIP=Math.max(TIP,h)}catch(_){}};
    poll();setInterval(poll,6e4)})();
  function chainFx(put,t){const now=performance.now()/1e3;
    for(const f of FX){const a=now-f.t0;if(a>45)continue;const has=(x)=>f.tags.some(g2=>g2.startsWith(x));
      if(a<4){const r=a*9;for(let i=0;i<32;i++){const q=i/32*Math.PI*2;put([Math.sin(q)*r,.5,Math.cos(q)*r,.6,.6,.6],"#f7931a",2*(1-a/4))}
        for(let j=0;j<10;j++)put([0,j*2.5+a*6,0,.5,.5,.5],"#ffd23f",1.6*(1-a/4))}
      if(has("HALVING"))for(let i=0;i<40;i++){const y=28-((t*4+hr(i+60)*28)%28);put([(hr(i+61)-.5)*36,y,(hr(i+62)-.5)*36,.8,.8,.2],"#ffd23f",1.4)}
      if(has("DIFFICULTY"))for(let i=0;i<48;i++){const x=-24+i;put([x,20+Math.sin(t+i*.25)*1.5,-18+Math.cos(t*.6+i*.15)*3,1,2.4,.3],["#3fe0d0","#4cff8a","#9b6bff"][i%3],1.1+Math.sin(t*2+i*.3)*.5)}
      if(has("PALINDROME"))for(let i=0;i<24;i++){const q=i/24*Math.PI*2;for(const d of[1,-1])put([Math.sin(q+t*d)*11,6+d*1.5,Math.cos(q+t*d)*11,.5,.5,.5],d>0?"#3fe0d0":"#f7931a",1.5)}
      if(has("MILESTONE"))for(let b=0;b<3;b++){const p=(t*.5+b/3)%1,cx=(hr(b+70)-.5)*30,cz=(hr(b+71)-.5)*30,cy=14+p*8;
        for(let i=0;i<14;i++){const q=i/14*Math.PI*2;put([cx+Math.sin(q)*p*5,cy,cz+Math.cos(q)*p*5,.4,.4,.4],["#ff3b3b","#ffd23f","#3fe0d0"][b],2.2*(1-p))}}
      if(has("ECHO"))for(let i=0;i<20;i++){const q=i/20*Math.PI*2+t*.8;put([Math.sin(q)*4.5,9,Math.cos(q)*4.5,.4,.4,.4],"#f7931a",2)}
      if(has("TX SURGE"))for(let i=0;i<10;i++){const ph=(t*.6+hr(i+80))%1;put([-30+ph*60,26-ph*12,(hr(i+81)-.5)*30,.6,.6,.6],"#9be8ff",2)}
      if(has("EMPTY"))for(let i=0;i<30;i++)put([(hr(i+90)-.5)*30,.8+Math.sin(t+i)*.3,(hr(i+91)-.5)*30,2,.4,2],"#9aa3ad",.1)}}
  /* Community modules: children of the master (window.BW_MASTER_ID, set when the master is inscribed). Only the master's
     holder can inscribe them. "BW-MOD-1\n{id,label,goal,spk,addr}\n<js>" defines a module; goal 0 runs at once.
     "BW-FUND-1 <ID> <txid>..." lists contributions; each tx is read from /r/tx and only outputs paying the manifest
     scriptPubKey count. "BW-FREEZE" stops every later child from loading. A module only receives the api below and
     any error removes its hook, so it can never stop the Guardian rendering. */
  window.BW_HOOKS=window.BW_HOOKS||[];const MODS=[];window.BW_MODS=MODS;
  const parseTxOuts=(hx)=>{if(typeof hx!=="string"||hx.length<120||hx.length%2||!/^[0-9a-f]+$/i.test(hx))return null;let p=0;const L=hx.length;
    const b=()=>{if(p+2>L)throw 0;const v=parseInt(hx.substr(p,2),16);p+=2;return v};
    const u32=()=>(b()|b()<<8|b()<<16|(b()<<24>>>0))>>>0;
    const vi=()=>{const f=b();if(f<253)return f;if(f===253)return b()|b()<<8;if(f===254)return u32();const lo=u32(),hi=u32();if(hi)throw 0;return lo};
    const skip=(n)=>{p+=n*2;if(p>L)throw 0};
    try{skip(4);let ni=vi();if(ni===0){if(b()!==1)return null;ni=vi()}for(let k=0;k<ni;k++){skip(36);skip(vi());skip(4)}
      const no=vi(),o=[];for(let k=0;k<no;k++){const lo=u32(),hi=u32(),n2=vi(),spk=hx.substr(p,n2*2).toLowerCase();skip(n2);o.push([lo+hi*4294967296,spk])}return o}catch(_){return null}};
  const runMod=(m)=>{if(m.on)return;m.on=true;try{new Function("api",m.code)({T,scene:S,G:typeof G!=="undefined"?G:null,hr,on:(f)=>{if(typeof f==="function")window.BW_HOOKS.push(f)}})}catch(_){m.err=true}};
  (async()=>{const mid=window.BW_MASTER_ID||(typeof MASTER!=="undefined"&&MASTER&&typeof SELF!=="undefined"?SELF:"");if(!/^[0-9a-f]{64}i\d+$/.test(mid||""))return;
    try{let ids=[];for(let pg=0;pg<4;pg++){const r=await fetch("/r/children/"+mid+"/"+pg);if(!r.ok)break;const j=await r.json();ids=ids.concat(j.ids||[]);if(!j.more)break}
      const funds={};
      for(const id of ids.slice(0,60)){let s="";try{const r=await fetch("/content/"+id);if(!r.ok)continue;s=await r.text()}catch(_){continue}
        if(s.startsWith("BW-FREEZE"))break;
        if(s.startsWith("BW-MOD-1\n")){const nl=s.indexOf("\n",9);if(nl<0)continue;let man;try{man=JSON.parse(s.slice(9,nl))}catch(_){continue}
          if(!man||typeof man.id!=="string"||!/^[A-Z0-9_-]{1,24}$/.test(man.id)||MODS.some(x=>x.id===man.id))continue;
          MODS.push({id:man.id,label:String(man.label||man.id).slice(0,40),goal:Math.max(0,+man.goal||0),spk:String(man.spk||"").toLowerCase(),addr:String(man.addr||""),code:s.slice(nl+1),got:0,read:true,ins:id})}
        else if(s.startsWith("BW-FUND-1 ")){const w=s.trim().split(/\s+/);const L2=funds[w[1]]=funds[w[1]]||new Set();for(const x of w.slice(2))if(/^[0-9a-f]{64}$/.test(x))L2.add(x)}}
      for(const m of MODS){if(!m.goal){runMod(m);continue}if(!/^[0-9a-f]{4,140}$/.test(m.spk)){m.read=false;continue}
        for(const tx of [...(funds[m.id]||[])].slice(0,40)){try{const r=await fetch("/r/tx/"+tx);if(!r.ok){m.read=false;continue}
          const outs=parseTxOuts((await r.text()).trim().replace(/^"|"$/g,""));if(!outs){m.read=false;continue}
          for(const o of outs)if(o[1]===m.spk)m.got+=o[0]}catch(_){m.read=false}}
        if(m.got>=m.goal)runMod(m)}
    }catch(_){}})();
  const fmtS=(v)=>v>=1e6?(v/1e6).toFixed(2).replace(/\.?0+$/,"")+"M":v>=1e3?Math.round(v/1e3)+"k":String(v);
  function eventHud(w,h){const nar=w<600,lines=[],now=performance.now()/1e3;
    for(const m of MODS)lines.push(m.on?"\u2605 "+m.label+" \u00b7 COMMUNITY UNLOCKED":m.goal?m.label+" \u00b7 "+fmtS(m.got)+" / "+fmtS(m.goal)+" SATS"+(m.read?"":" \u00b7 SOME TXS UNREADABLE")+(m.addr?" \u00b7 SEND "+m.addr.slice(0,6)+"\u2026"+m.addr.slice(-6):""):"");
    const f=FX[FX.length-1];if(f&&now-f.t0<45)lines.push("\u25c6 NEW BLOCK "+f.h.toLocaleString("en-US")+(f.n?" \u00b7 "+f.n.toLocaleString("en-US")+" TX":"")+(f.tags.length?" \u00b7 "+f.tags.join(" \u00b7 "):""));
    lines.push((SKY.ecl?"\u25cf SOLAR ECLIPSE":SKY.blood?"\u263e BLOOD MOON":"\u263e "+SKY.phase)+" \u00b7 "+ZOD[SKY.z]+" SEASON"+(SKY.shower?" \u00b7 "+SKY.shower+" PEAK":""));
    if(nar&&h<760){const ad=adventDay();if(ad)lines.unshift(ad>=24?"\u2605 CHRISTMAS EVE \u2605":"ADVENT DAY "+ad);
      /* short phones: one rotating line so the Guardian keeps its space */
      const L=lines.filter(Boolean);if(L.length){const s=L[Math.floor(now/4)%L.length];g.font="13px monospace";const mw=g.measureText(s).width;if(mw>w-16)g.font=Math.max(10,Math.floor(13*(w-16)/mw))+"px monospace";
        g.textAlign="center";g.fillStyle=s.startsWith("\u25c6")?"rgba(247,147,26,.95)":s.startsWith("\u2605")?"rgba(76,255,138,.9)":"rgba(207,232,255,.82)";g.fillText(s,w/2,Math.max(122,window.BW_TOPY||0));g.textAlign="left"}return}
    g.font=(nar?"13px":"15px")+" monospace";g.textAlign="center";
    for(let i=0;i<lines.length;i++){const s=lines[lines.length-1-i];if(!s)continue;const fz=nar?13:15;g.font=fz+"px monospace";const mw=g.measureText(s).width;if(mw>w-16)g.font=Math.max(10,Math.floor(fz*(w-16)/mw))+"px monospace";g.fillStyle=s.startsWith("\u25c6")?"rgba(247,147,26,.95)":s.startsWith("\u2605")?"rgba(76,255,138,.9)":"rgba(207,232,255,.82)";
      g.fillText(s,w/2,(nar?Math.max(140,(window.BW_TOPY||0)+(adventDay()?20:0)):72)+(lines.length-1-i)*(nar?18:20))}g.textAlign="left"}
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
    /* everything sits on the BITMAP slab (LAND.half) so nothing floats over the void */
    const S=LAND&&LAND.half>4?LAND.half:14,TX=S*.72,TZ=-S*.68;
    if(d>=4){const cov=Math.min(120,(d-3)*6);for(let i=0;i<cov;i++){const sz=.8+hr(i+700)*1.6,lim=S-sz/2-.2;
      put([(hr(i+500)*2-1)*lim,.06,(hr(i+600)*2-1)*lim,sz,.1+d*.004,.8+hr(i+800)*1.6],"#eef6ff",.25)}}
    if(d>=8)tree(put,-TX,TZ,t,0);
    if(d>=12)tree(put,TX,TZ,t,3);
    if(d>=15){const er=Math.min(10,S*.8),ea=t*.4,ex=Math.sin(ea)*er,ez=Math.cos(ea)*er,bob=Math.abs(Math.sin(t*6))*.3;
      put([ex,.9+bob,ez,.7,1,.5],"#2e8b3a",0);put([ex,1.75+bob,ez,.55,.55,.55],"#f1c6a0",0);
      put([ex,2.25+bob,ez,.5,.4,.5],"#d62828",0);put([ex,2.6+bob,ez,.2,.35,.2],"#d62828",0);put([ex,2.85+bob,ez,.16,.16,.16],"#ffffff",1)}
    if(d>=19){const gn=Math.min(10,(d-18)*2);for(let i=0;i<gn;i++){const tx=i%2?TX:-TX;gift(put,tx+(hr(i+40)-.5)*5,TZ+3+hr(i+50)*2,i)}}
    if(d>=21&&d<24){const a=t*.35,R1=S+3;deer(put,Math.sin(a)*R1,12,Math.cos(a)*R1,a+Math.PI/2,t,d>=22)}
    if(d>=24){const a=t*.3,R0=S+4,y=12+Math.sin(t)*1.2;
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
  let s = guardianMasterGeneratorHtmlV8();
  /* night sky disc yields to the phase moon once the WebGL painter is running (BW_MOON2D) */
  const disc = "g.beginPath();g.arc(sx,sy,day>0?18:12,0,6.283);g.fill();";
  if (s.split(disc).length !== 2) throw new Error("V8-THREE: sky disc changed, refusing to patch");
  s = s.replace(disc, "g.beginPath();if(day>0||!window.BW_MOON2D)g.arc(sx,sy,day>0?18:12,0,6.283);g.fill();");
  /* keep the sun below the top HUD lines (they end near 25% of the height) */
  const sun = "sy=h*(.6-Math.abs(el)*.45);";
  if (s.split(sun).length !== 2) throw new Error("V8-THREE: sun path changed, refusing to patch");
  s = s.replace(sun, "sy=h*Math.max(.34,.6-Math.abs(el)*.45);");
  const end = "</script></body></html>";
  if (!s.endsWith(end)) throw new Error("V8-THREE: V8 tail changed, refusing to patch");
  const out = s.slice(0, -"</body></html>".length) + threeBlock(threeId) + "</body></html>";
  if (threeId === THREE_R163_MODULE_ID) cached = out;
  return out;
}

export function guardianV8ThreeByteSize(): number {
  return new TextEncoder().encode(guardianMasterGeneratorHtmlV8Three()).length;
}
