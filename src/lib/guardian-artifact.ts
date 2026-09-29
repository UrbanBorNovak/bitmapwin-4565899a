/**
 * Guardian inscription artwork.
 *
 * Two artifact forms, both built only from public block DNA plus the summon
 * txid, so nothing about a wallet or an account is written to Bitcoin:
 *
 *  - `guardianArtifactHtml`  an interactive recursive HTML inscription. It draws
 *    a live voxel Guardian with its own tiny renderer, and pulls the on-chain
 *    `simplex` noise module through `/content/<id>` for its drifting backdrop,
 *    falling back to an internal hash noise when a viewer blocks recursion.
 *  - `guardianHoloCardSvg`  a holographic vector card for viewers that only
 *    render still images.
 */
import { guardianLevel, guardianShieldDigest, shapeOf, type GuardianDna } from "@/lib/bitmon";

/** On-chain modules referenced recursively by the inscription. */
export const ONCHAIN_LIBS = {
  simplex: "1a6f2eb401df978e1e92c7eb710d42e6d854318cff8f573f38deec45004cf749i0",
  pixelfont: "a1f5a259aab4651425b7e6869435fd6747eaf4d6b063d1971466d966841dd7b4i0",
  baseTexture: "dbb64a250ef86a6aa338a08d9fbf659b9e17119d6e30f8dc5c15aa274926bf5bi0",
} as const;

export type GuardianArtifactKind = "html" | "svg";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ *
 * Interactive recursive HTML inscription
 * ------------------------------------------------------------------ */

export function guardianArtifactHtml(dna: GuardianDna, summonTxid: string): string {
  const digest = guardianShieldDigest(dna, summonTxid);
  const meta = {
    h: dna.height,
    sp: dna.species,
    sh: shapeOf(dna.species),
    ra: dna.rarity,
    ep: dna.epoch,
    ab: dna.ability,
    hp: dna.hp,
    bi: dna.bite,
    sd: dna.speed,
    ar: dna.armor,
    lv: guardianLevel(dna),
    body: dna.body,
    accent: dna.accent,
    dnaHash: dna.dnaHash,
    summon: summonTxid,
    shield: digest,
  };

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>BLOCK-DNA GUARDIAN ${dna.height}.BITMAP</title>
<style>
html,body{margin:0;height:100%;background:#04060a;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-user-select:none;user-select:none;touch-action:none}
#c{display:block;width:100%;height:100%}
#o{position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.34) 0 1px,rgba(0,0,0,0) 1px 3px);mix-blend-mode:multiply;opacity:.55}
#v{position:fixed;inset:0;pointer-events:none;box-shadow:inset 0 0 180px 60px #000}
</style></head><body>
<canvas id="c"></canvas><div id="o"></div><div id="v"></div>
<script>
var G=${JSON.stringify(meta)};
var LIB="/content/${ONCHAIN_LIBS.simplex}";
/* ---- deterministic hash stream from the shield digest ---- */
var HX=G.shield, hp=0;
function hb(){var v=parseInt(HX.substr((hp*2)%64,2),16);hp++;return (isNaN(v)?7:v)/255}
function noise2(x,y){ // fallback value noise, used when recursion is blocked
  var n=Math.sin(x*12.9898+y*78.233)*43758.5453;return (n-Math.floor(n))*2-1;
}
var SN=null;
(function(){ // try the on-chain simplex module; the art works either way
  var s=document.createElement("script");s.src=LIB;
  s.onload=function(){try{
    var F=window.SimplexNoise||window.Simplex||window.simplex;
    if(typeof F==="function"){var i=new F(G.dnaHash);if(i&&i.noise2D)SN=function(x,y){return i.noise2D(x,y)};}
  }catch(e){}};
  document.head.appendChild(s);
})();
function N(x,y){return SN?SN(x,y):noise2(x,y)}

var c=document.getElementById("c"),g=c.getContext("2d"),W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1);
function fit(){W=c.clientWidth;H=c.clientHeight;c.width=W*DPR;c.height=H*DPR;g.setTransform(DPR,0,0,DPR,0,0)}
window.addEventListener("resize",fit);

/* ---- colour helpers ---- */
function mix(a,b,t){function p(h){h=h.replace("#","");return[parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)]}
 var A=p(a),B=p(b),o="#";for(var i=0;i<3;i++){var v=Math.round(A[i]+(B[i]-A[i])*t);o+=("0"+Math.max(0,Math.min(255,v)).toString(16)).slice(-2)}return o}
var BODY=G.body,ACC=G.accent,DARK=mix(BODY,"#000000",.55),LIGHT=mix(BODY,"#ffffff",.26),MID=mix(BODY,ACC,.2);

/* ---- voxel blueprint: [x,y,z,w,h,d,colour,glow] in guardian units ---- */
function box(x,y,z,w,h,d,col,glow){return[x,y,z,w,h,d,col,glow||0]}
function blueprint(){
  var V=[],s=G.sh,i,k,f;
  function sym(x,y,z,w,h,d,col,glow){V.push(box(x,y,z,w,h,d,col,glow));V.push(box(-x,y,z,w,h,d,col,glow))}
  if(s==="golem"){
    V.push(box(0,10,0,9,8,6,BODY));V.push(box(0,11,-3.4,6,5,1.2,DARK));
    V.push(box(0,11,3.2,6,4,.6,mix(ACC,"#000",.3),.5));V.push(box(0,10.6,3.8,1.6,1.6,.4,ACC,1));
    for(i=-1;i<2;i++)V.push(box(i*2.3,14.2,-3.8,1.6,1,1.6,i?MID:ACC,i?0:.6));
    V.push(box(0,16.6,.2,5.6,4.4,4.8,BODY));V.push(box(0,18.8,0,4.4,1.2,3.8,LIGHT));
    sym(1.4,17.2,2.8,1,.6,.4,ACC,1);
    sym(6.7,14.2,0,4.2,3.6,5.4,BODY);sym(7.2,15.8,0,4.8,1.3,5.8,ACC,.4);
    sym(6.6,10.3,0,2.2,4.6,2.6,DARK);sym(6.6,5.8,1,3.8,3.4,4.2,BODY);
    sym(2.6,5.5,0,3.1,5,3.4,BODY);sym(2.6,.7,1.3,4.2,1.4,5.5,BODY);
    sym(2.6,4.3,1.9,3.4,2,.8,ACC,.3);
  } else if(s==="bird"){
    V.push(box(0,8.2,-.8,5.2,5.4,10.5,BODY));V.push(box(0,12.8,4.8,4.2,4.2,4.2,BODY));
    V.push(box(0,12.2,7.8,2.8,2,2.8,LIGHT));V.push(box(0,11.8,9.6,1.6,1.2,1.8,ACC,.8));
    sym(1.2,13.6,7,.9,.7,.4,ACC,1);
    for(i=0;i<5;i++){sym(7.2+i*1.9,9.7-i*.6,-1-i,4.4-i*.35,.5,1.6,i%2?LIGHT:BODY);}
    for(i=0;i<3;i++){sym(4.8+i*1.8,11.1-i*.25,1.7-i*1.4,3.3,.7,1.9,i===1?ACC:MID,i===1?.3:0);}
    sym(1.7,3.5,3.5,1.2,5.5,1.2,LIGHT);sym(1.7,.8,4.9,2,1,3,BODY);
    for(i=-1;i<2;i++)V.push(box(i*1.3,7.3,-8.3,1.2,.7,7.2,i?LIGHT:ACC,i?0:.3));
    for(i=0;i<4;i++)V.push(box((i-1.5)*1,15.5,3.8,.5,2.4,.5,i%2?ACC:LIGHT,i%2?.5:0));
  } else if(s==="wisp"){
    V.push(box(0,12,0,4.6,4.6,4.6,BODY,.7));V.push(box(0,14.8,-.8,6.5,1.8,5.2,DARK));
    sym(2.7,12.9,.5,2,4.8,4.8,DARK);V.push(box(0,10.6,3.5,3.8,3.4,.8,DARK));
    sym(1.05,12,4.1,.8,.5,.3,ACC,1);
    sym(7,9.6,.8,2.5,2,2.8,MID);
    for(i=0;i<6;i++){var a=i*1.047;V.push(box(Math.sin(a)*7.2,11+Math.sin(a*2)*2.2,Math.cos(a)*7.2,1.4,1.4,1.4,ACC,.9))}
    for(i=0;i<5;i++){var b=i*1.256;V.push(box(Math.sin(b)*(1.8+(i%2)*1.4),4.4-(i%3)*.8,Math.cos(b)*(1.8+(i%2)*1.4),1.6,3.6,1.6,i%2?ACC:BODY,i%2?.5:0))}
  } else if(s==="wyrm"){
    for(i=0;i<5;i++){k=(i-2)*3.6;f=Math.abs(i-2);
      V.push(box(0,6.2+(2-f)*.45,k,5.4-f*.45,4.2,4.2,i%2?MID:BODY));
      V.push(box(0,8.6,k,4.2-f*.35,.9,3,i%2?LIGHT:ACC,i%2?0:.4));}
    V.push(box(0,8.8,9.6,4.8,4.2,5.6,BODY));V.push(box(0,8,13,3.4,2.5,4.2,LIGHT));
    V.push(box(0,7.2,15.1,2.8,1.3,1.8,DARK));
    sym(1.4,9.8,12.1,.9,.7,.4,ACC,1);
    sym(1.6,12,9.1,1.1,3.4,1.1,ACC,.5);
    for(i=0;i<4;i++)V.push(box(0,10.5,-5.2+i*4,1.2+i*.1,2.4+i*.35,1.2,ACC,.35));
    for(i=0;i<2;i++){sym(2.9,4.2,i?4.2:-4,1.7,3,1.8,BODY);sym(3.4,2.7,i?4.7:-3.5,2.2,1.4,2.2,ACC,.2);}
    for(i=0;i<4;i++)V.push(box(Math.sin(i*.38)*1.3,6-i*.55,-10.2-i*3.3,3.8-i*.7,3-i*.35,4.2,i%2?MID:BODY));
    V.push(box(1.3,3.5,-22.5,1.8,4.6,1.8,ACC,.6));
  } else {
    V.push(box(0,7.2,-.8,5.4,5.8,11.4,BODY));V.push(box(0,9.1,2,6.2,2.5,5.5,MID));
    sym(3.4,9.2,2.8,2.4,2.4,4.2,ACC,.3);
    V.push(box(0,11.8,5.8,4.8,4.8,5,BODY));V.push(box(0,10.8,9.3,3.4,2.5,4.2,LIGHT));
    V.push(box(0,10.8,11.7,2.4,1.6,1.2,DARK));
    sym(1.4,13,8.4,.9,.7,.4,ACC,1);
    sym(2,15.7,4.8,1.5,5.6,1.9,BODY);sym(2,15.9,5.9,.7,3.2,.4,ACC,.5);
    for(i=0;i<2;i++){sym(2.5,4.7,i?3.8:-3.4,1.9,4.3,2.2,BODY);sym(2.7,1.3,i?4.4:-2.8,2.8,1,3.4,BODY);sym(2.7,2.8,i?3.2:-4,2.2,1.6,2.5,ACC,.2);}
    for(i=0;i<4;i++)V.push(box(Math.sin(i*.55)*1.8,7.6+i*.9,-7.8-i*2.7,2-i*.25,2-i*.25,3.4,i%2?ACC:BODY,i%2?.3:0));
  }
  /* rarity crown */
  var pts=G.ra==="MYTHIC"?8:G.ra==="EPIC"?6:G.ra==="RARE"?4:0;
  for(i=0;i<pts;i++){var an=i/pts*Math.PI*2,r=G.ra==="MYTHIC"?7.6:6.6;
    V.push(box(Math.sin(an)*r,(G.sh==="golem"?21.5:G.sh==="wyrm"?13.5:17.5),Math.cos(an)*r,.7,G.ra==="MYTHIC"?2.6:1.7,.7,ACC,1));}
  return V;
}
var VOX=blueprint();

/* ---- isometric voxel painter ---- */
var yaw=.7,yawV=0,drag=null,t0=performance.now();
function project(x,y,z,cy,sy,sc,ox,oy){var rx=x*cy-z*sy,rz=x*sy+z*cy;
  return[ox+(rx-rz)*.866*sc, oy-(y*.92+(rx+rz)*.5)*sc, rx+rz];}
function face(p,col,a){g.fillStyle=col;g.globalAlpha=a;g.beginPath();g.moveTo(p[0][0],p[0][1]);for(var i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fill();}
function drawVox(sc,ox,oy,pulse){
  var cy=Math.cos(yaw),sy=Math.sin(yaw),list=[],i;
  for(i=0;i<VOX.length;i++){var v=VOX[i];
    var d=project(v[0],v[1],v[2],cy,sy,sc,ox,oy);list.push([d[2]+v[1]*.01,v,d])}
  list.sort(function(a,b){return a[0]-b[0]});
  for(i=0;i<list.length;i++){
    var v=list[i][1],hw=v[3]/2,hh=v[4]/2,hd=v[5]/2,x=v[0],y=v[1],z=v[2],col=v[6],gl=v[7];
    var P=function(dx,dy,dz){return project(x+dx,y+dy,z+dz,cy,sy,sc,ox,oy)};
    var top=[P(-hw,hh,-hd),P(hw,hh,-hd),P(hw,hh,hd),P(-hw,hh,hd)];
    var left=[P(-hw,hh,hd),P(-hw,-hh,hd),P(-hw,-hh,-hd),P(-hw,hh,-hd)];
    var right=[P(-hw,hh,hd),P(hw,hh,hd),P(hw,-hh,hd),P(-hw,-hh,hd)];
    if(gl>0){g.shadowColor=col;g.shadowBlur=16*gl*(1+pulse*.5)}else{g.shadowBlur=0}
    face(top,mix(col,"#ffffff",.22+gl*.25*pulse),1);
    face(left,mix(col,"#000000",.34),1);
    face(right,mix(col,"#000000",.14),1);
  }
  g.shadowBlur=0;g.globalAlpha=1;
}

/* ---- HUD ---- */
function txt(s,x,y,size,col,a){g.globalAlpha=a===undefined?1:a;g.fillStyle=col;g.font=size+"px ui-monospace,monospace";g.fillText(s,x,y);g.globalAlpha=1}
function hud(w,h,pulse){
  var pad=Math.max(14,w*.035),small=Math.max(8,Math.min(13,w*.016)),big=Math.max(18,Math.min(44,w*.055));
  g.strokeStyle=ACC;g.globalAlpha=.5;g.lineWidth=1;g.strokeRect(pad*.55,pad*.55,w-pad*1.1,h-pad*1.1);g.globalAlpha=1;
  txt("BLOCK-DNA GUARDIAN \\u00B7 "+G.h+".BITMAP",pad,pad+small*1.4,small,"#f7931a");
  txt(G.sp,pad,h-pad-small*7.4,big,"#e9eef0");
  txt(G.ra+" \\u00B7 LV "+G.lv+" \\u00B7 ERA "+G.ep,pad,h-pad-small*5.9,small,ACC);
  var stats=[["HP",G.hp],["BITE",G.bi],["SPEED",G.sd],["ARMOR",G.ar]],i,cw=(w-pad*2)/4;
  for(i=0;i<4;i++){txt(stats[i][0],pad+i*cw,h-pad-small*4,small*.85,"#87939b");
    txt(String(stats[i][1]),pad+i*cw,h-pad-small*2.5,small*1.5,"#e9eef0")}
  txt(G.ab,pad,h-pad-small*1.1,small,ACC,.7+pulse*.3);
  txt("DNA "+G.dnaHash+"  SHIELD "+G.shield.slice(0,20)+"\\u2026",pad,h-pad*.95,small*.7,"#5d676e");
  txt("DRAG TO ORBIT",w-pad-small*7.6,pad+small*1.4,small*.8,"#5d676e",.7);
}

/* ---- backdrop from the on-chain noise field ---- */
function backdrop(w,h,t){
  var grd=g.createRadialGradient(w/2,h*.55,10,w/2,h*.55,Math.max(w,h)*.75);
  grd.addColorStop(0,mix("#04060a",ACC,.09));grd.addColorStop(1,"#04060a");
  g.fillStyle=grd;g.fillRect(0,0,w,h);
  var cols=26,i,j,cw=w/cols;
  g.globalAlpha=.16;
  for(i=0;i<cols;i++)for(j=0;j<10;j++){
    var n=N(i*.22+t*.06,j*.3);
    if(n<.42)continue;
    g.fillStyle=n>.8?ACC:mix(BODY,"#000",.3);
    g.fillRect(i*cw,h-(j+1)*(h*.045)-h*.02,cw*.72,h*.03*n);
  }
  g.globalAlpha=1;
}

/* ---- fit the whole creature inside the frame, whatever its shape ---- */
var EXT=null;
function extents(){
  var ax=0,ymin=1e9,ymax=-1e9,k,i;
  for(k=0;k<12;k++){var a=k/12*Math.PI*2,cy=Math.cos(a),sy=Math.sin(a);
    for(i=0;i<VOX.length;i++){var v=VOX[i],dx,dy,dz;
      for(dx=-1;dx<2;dx+=2)for(dy=-1;dy<2;dy+=2)for(dz=-1;dz<2;dz+=2){
        var p=project(v[0]+dx*v[3]/2,v[1]+dy*v[4]/2,v[2]+dz*v[5]/2,cy,sy,1,0,0);
        if(Math.abs(p[0])>ax)ax=Math.abs(p[0]);
        if(p[1]<ymin)ymin=p[1];if(p[1]>ymax)ymax=p[1];
      }}}
  return {ax:ax,ymin:ymin,ymax:ymax};
}
function fitScale(){
  if(!EXT)EXT=extents();
  var availW=W*.84,availH=H*.58;
  return Math.min(availW/(EXT.ax*2||1),availH/((EXT.ymax-EXT.ymin)||1));
}
function frame(now){
  var t=(now-t0)/1000,pulse=(Math.sin(t*2.2)+1)/2;
  if(!drag){yaw+=.0045+yawV;yawV*=.92}
  g.clearRect(0,0,W,H);
  backdrop(W,H,t);
  if(!EXT)EXT=extents();
  var sc=fitScale();
  var oy=H*.46-((EXT.ymin+EXT.ymax)/2)*sc+Math.sin(t*1.5)*3;
  var baseY=oy+EXT.ymax*sc, rad=EXT.ax*sc*.95;
  g.save();
  g.translate(W/2,baseY+rad*.1);g.scale(1,.26);
  var gr=g.createRadialGradient(0,0,0,0,0,rad);
  gr.addColorStop(0,ACC);gr.addColorStop(.45,mix(ACC,"#000",.7));gr.addColorStop(1,"rgba(0,0,0,0)");
  g.globalAlpha=.32+pulse*.12;g.fillStyle=gr;g.beginPath();g.arc(0,0,rad,0,Math.PI*2);g.fill();
  g.restore();
  drawVox(sc,W/2,oy,pulse);

  hud(W,H,pulse);
  requestAnimationFrame(frame);
}

function px(e){return (e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX)}
c.addEventListener("pointerdown",function(e){drag=px(e)});
window.addEventListener("pointermove",function(e){if(drag===null)return;var x=px(e);yawV=(x-drag)*.00035;yaw+=(x-drag)*.006;drag=x});
window.addEventListener("pointerup",function(){drag=null});
fit();requestAnimationFrame(frame);
</script></body></html>`;
}

/* ------------------------------------------------------------------ *
 * Holographic vector card (still-image viewers)
 * ------------------------------------------------------------------ */

export function guardianHoloCardSvg(dna: GuardianDna, summonTxid: string): string {
  const digest = guardianShieldDigest(dna, summonTxid);
  const level = guardianLevel(dna);
  const byte = (i: number) => parseInt(digest.slice((i % 32) * 2, (i % 32) * 2 + 2), 16) || 0;

  // Isometric voxel sigil grown from the shield digest.
  const tiles: string[] = [];
  for (let i = 0; i < 128; i++) {
    const v = byte(i);
    if (((v >> (i % 6)) & 1) === 0) continue;
    const gx = i % 16;
    const gy = Math.floor(i / 16);
    const h = 6 + (v % 5) * 5;
    const x = 200 + (gx - gy) * 11;
    const y = 158 + (gx + gy) * 6 - h;
    const top = v % 7 === 0 ? dna.accent : dna.body;
    tiles.push(
      `<g><path d="M${x} ${y}l11 6-11 6-11-6z" fill="${top}" opacity="${(0.55 + (v % 40) / 100).toFixed(2)}"/>` +
        `<path d="M${x - 11} ${y + 6}v${h}l11 6V${y + 12}z" fill="${top}" opacity=".3"/>` +
        `<path d="M${x + 11} ${y + 6}v${h}l-11 6V${y + 12}z" fill="${top}" opacity=".16"/></g>`,
    );
  }

  const stat = (label: string, value: number, x: number) =>
    `<text x="${x}" y="376" fill="#87939b" font-family="monospace" font-size="9">${label}</text>` +
    `<text x="${x}" y="396" fill="#e9eef0" font-family="monospace" font-size="18">${value}</text>`;

  const rings =
    dna.rarity === "COMMON"
      ? ""
      : `<circle cx="200" cy="196" r="${dna.rarity === "MYTHIC" ? 148 : dna.rarity === "EPIC" ? 132 : 118}" fill="none" stroke="${dna.accent}" stroke-opacity=".3" stroke-dasharray="3 7"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520">
<defs>
<radialGradient id="bg" cx="50%" cy="42%" r="78%"><stop offset="0" stop-color="${dna.accent}" stop-opacity=".16"/><stop offset="1" stop-color="#04060a"/></radialGradient>
<filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<pattern id="sc" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".28"/></pattern>
</defs>
<rect width="400" height="520" fill="#04060a"/><rect width="400" height="520" fill="url(#bg)"/>
${rings}
<g filter="url(#gl)">${tiles.join("")}</g>
<rect width="400" height="520" fill="url(#sc)"/>
<path d="M14 14h372v492H14z" fill="none" stroke="${dna.accent}" stroke-opacity=".6"/>
<path d="M14 14h44M14 14v44M386 506h-44M386 506v-44" stroke="${dna.accent}" stroke-width="3" fill="none"/>
<text x="26" y="40" fill="#f7931a" font-family="monospace" font-size="11">BLOCK-DNA GUARDIAN · ${dna.height}.BITMAP</text>
<path d="M26 322h348" stroke="#253038"/>
<text x="26" y="312" fill="#e9eef0" font-family="monospace" font-weight="700" font-size="25">${esc(dna.species)}</text>
<text x="26" y="342" fill="${dna.accent}" font-family="monospace" font-size="10">${dna.rarity} · LV ${level} · ERA ${dna.epoch}</text>
${stat("HP", dna.hp, 26)}${stat("BITE", dna.bite, 116)}${stat("SPEED", dna.speed, 212)}${stat("ARMOR", dna.armor, 308)}
<path d="M26 412h348" stroke="#253038"/>
<text x="26" y="436" fill="${dna.accent}" font-family="monospace" font-size="11">${esc(dna.ability)}</text>
<text x="26" y="462" fill="#87939b" font-family="monospace" font-size="8">DNA ${dna.dnaHash}</text>
<text x="26" y="478" fill="#87939b" font-family="monospace" font-size="7">SUMMON ${summonTxid}</text>
<text x="26" y="494" fill="#87939b" font-family="monospace" font-size="7">SHIELD ${digest}</text>
</svg>`;
}
