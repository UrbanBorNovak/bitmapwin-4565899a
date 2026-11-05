/**
 * V8 of the Block-DNA Guardian master generator (draft, not inscribed).
 *
 * Built from the V7 source by checked replacements plus one V8 block, so the
 * V7 bytes stay untouched:
 *
 *   · Citadel — reads the newest reinscription on the BITMAP parent's sat
 *     (/r/inscription/<bmp> → sat → /r/sat/<sat>/at/-1); if it is a Land Forge
 *     build (BWVX1 or BWVX2) its surface voxels are drawn on the land.
 *   · Micro ambient occlusion — each top face is darkened by how many of its
 *     8 neighbours sit one level higher.
 *
 * Draws nothing extra when no build is found. Not active until inscribed and
 * set as the master; V7 stays the active Tag 11 delegate.
 */
import { guardianMasterGeneratorHtmlV7 } from "@/lib/guardian-delegate-v7";
import { BLOCKS } from "@/lib/voxel-world";

const v8Block = () => String.raw`
/* ================= V8 ================= */
var CIT=null,CITP=${JSON.stringify(BLOCKS.map((b) => [b.top, b.side]))};
function unpackBWVX(r){var B=[],c=function(i){return r.charCodeAt(i)};
  if(r.length>3&&c(0)==66&&c(1)==87&&c(2)==50&&c(3)==0){for(var i=4;i+6<r.length;i+=7)for(var x=c(i);x<=c(i+3);x++)for(var y=c(i+1);y<=c(i+4);y++)for(var z=c(i+2);z<=c(i+5);z++)B.push([x,y,z,c(i+6)])}
  else for(var k=0;k+3<r.length;k+=4)B.push([c(k),c(k+1),c(k+2),c(k+3)]);return B}
function citadelPrep(B){var occ={},i,b,key=function(x,y,z){return x+","+y+","+z};
  for(i=0;i<B.length;i++){b=B[i];occ[key(b[0],b[1],b[2])]=1}
  var S=[],mx=0;for(i=0;i<B.length;i++){b=B[i];if(occ[key(b[0],b[1]+1,b[2])])continue;
    var ao=0;for(var dx=-1;dx<2;dx++)for(var dz=-1;dz<2;dz++)if((dx||dz)&&occ[key(b[0]+dx,b[1]+1,b[2]+dz)])ao++;
    S.push([b[0],b[1],b[2],b[3],Math.max(.62,1-ao*.06)]);if(b[0]>mx)mx=b[0];if(b[2]>mx)mx=b[2]}
  S.sort(function(p,q){return(p[1]-q[1])||((p[0]+p[2])-(q[0]+q[2]))});
  return{s:S.slice(0,6000),span:mx>63?128:64}}
function citadelLoad(tries){
  if(!BMP){if(tries<40)setTimeout(function(){citadelLoad(tries+1)},500);return}
  j("/r/inscription/"+BMP).then(function(ins){if(!ins||ins.sat==null)throw 0;return t("/r/sat/"+ins.sat+"/at/-1")})
  .then(function(r){var id=String(r).replace(/[^a-f0-9i]/gi,"");if(!id||id===BMP)throw 0;return t("/content/"+id)})
  .then(function(h){var m=h.match(/<script id="bwvx"[^>]*>([\s\S]*?)<\/script>/)||h.match(/data-b="([A-Za-z0-9+\/=]+)"/);if(!m)return;
    var B=unpackBWVX(atob(m[1].replace(/\s/g,"")));if(B.length)CIT=citadelPrep(B)}).catch(function(){})}
function shade(h,f){var n=parseInt(h.slice(1),16);return"rgb("+[(n>>16)&255,(n>>8)&255,n&255].map(function(v){return Math.round(v*f)}).join(",")+")"}
var _dl8=drawLand;
drawLand=function(pulse){_dl8(pulse);if(!CIT||!LAND)return;var L=LAND,u=2*L.half/CIT.span,o=-L.half,i;
  for(i=0;i<CIT.s.length;i++){var v=CIT.s[i],x=o+v[0]*u,z=o+v[2]*u,y=(v[1]+1)*u,c=CITP[v[3]]||CITP[0];
    var a=P3(x,y,z),b=P3(x+u,y,z),cc=P3(x+u,y,z+u),d=P3(x,y,z+u),e=P3(x,y-u,z+u),f=P3(x+u,y-u,z+u);
    poly([d,cc,f,e],shade(c[1],.7*v[4]));poly([a,b,cc,d],shade(c[0],v[4]))}};
setTimeout(function(){citadelLoad(0)},1200);
/* readable HUD cards: 11px floor, near-solid panels, brighter labels, roomier rows; both start closed */
function hudBox(x,y,w,h,edge){g.globalAlpha=LM?.96:.92;g.fillStyle=LM?"#f4f5f2":"#04060a";g.fillRect(x,y,w,h);
  g.globalAlpha=.8;g.strokeStyle=edge;g.lineWidth=1;g.strokeRect(x,y,w,h);g.globalAlpha=1}
timelineHud=function(w,h){if(!GTLON)return;var pad=Math.max(14,w*.035),fs=Math.max(11,Math.min(13,w*.015)),hs=fs+1.5,lh=fs*1.6,
    pw=Math.min(w-pad*2,560),x=pad,y=pad+Math.max(8,Math.min(13,w*.016))*19+hs,rows=GTL.length||1,ph=hs*1.6+lh*(rows+.6);
  if(y+ph>h-pad)y=Math.max(pad+hs,h-pad-ph);
  hudBox(x-10,y-hs*1.3,pw+20,ph,"#f7931a");
  var pn=PCY.n<0?"WAITING":["PULL-IN","PARCEL WAVE","ROAR + LIGHTNING","SPINE SURGE"][PCY.n],left=Math.max(0,4-(performance.now()/1000-PCY.t));
  txt("PACK CHAIN TIMELINE · LATEST 12",x,y,hs,"#f7931a");
  if(pw>420)txt("PULSE · "+pn+" · "+left.toFixed(1)+"S",x+pw*.6,y,fs,"#3fe0d0");
  if(!GTL.length){txt("READING GUARDIANS FROM THE CHAIN…",x,y+lh*1.2,fs,"#c5d0d9");return}
  for(var i=0;i<GTL.length;i++){var r=GTL[i],yy=y+lh*(i+1.15),em=r.h%2016,bm=r.h>0&&(em>=1944||em<=72),date=r.at?new Date(r.at*(r.at<1e12?1000:1)).toISOString().slice(0,10):"CHAIN";
    txt((i+1)+" · "+r.h+".BITMAP",x,yy,fs,r.id===SELF?"#f7931a":"#3fe0d0");
    txt("D "+fmtD(r.df)+" · W "+(r.wt?(r.wt/1e6).toFixed(2)+"M":"…")+(pw>420?" · "+date:"")+(bm?" · BLOOD MOON":""),x+pw*.38,yy,fs,bm?"#ff5a4a":"#ffffff")}};
chainHud=function(w,h){if(!G||!PROOFON)return;
  var fs=Math.max(11,Math.min(13,w*.016)),hs=fs+1.5,lh=fs*1.65,pad=Math.max(14,w*.035),pw=Math.min(w-pad*2,340),x=w-pw-pad,y=pad+fs*5.2;
  var arm=G.th==="CLAY"?"GENESIS CLAY":G.th==="TERA"?"TERAHASH ARMOUR":"FORGED STEEL",ms=G.ms==="TITAN"?"TITAN":G.ms==="WRAITH"?"WRAITH":"STANDARD";
  var cr=[];if(G.tp)cr.push("TAPROOT");if(G.sw)cr.push("SEGWIT");if(G.lz)cr.push("SUPER-ZERO");
  var R=[["PARENT 1",G.h+".BITMAP","#3fe0d0"],["PARENT 2","ROOT 9d1da99c\u2026i0","#3fe0d0"],
    ["ARMOUR",arm+(G.df?" \u00B7 "+fmtD(G.df):""),"#ffffff"],["WEIGHT",(G.wt?(G.wt/1e6).toFixed(2)+" MWU":"\u2026")+" \u00B7 "+ms,"#ffffff"],
    ["CRESTS",cr.length?cr.join(" + "):"NONE (PRE-SEGWIT)",cr.length?"#f7931a":"#c5d0d9"]];
  hudBox(x-10,y-hs*1.3,pw+20,hs*1.5+lh*(R.length+.4),LM?"#0a8f84":"#3fe0d0");
  txt("ON-CHAIN PROOF",x,y,hs,"#f7931a");
  for(var i=0;i<R.length;i++){var yy=y+lh*(i+1.1);txt(R[i][0],x,yy,fs,"#c5d0d9");txt(R[i][1],x+pw*.32,yy,fs,R[i][2])}};
`;

function swap(src: string, from: string, to: string): string {
  if (!src.includes(from)) throw new Error(`V8 build: missing anchor ${from.slice(0, 40)}`);
  return src.replace(from, to);
}

let cached: string | null = null;

/** The draft V8 master generator page. */
export function guardianMasterGeneratorHtmlV8(): string {
  if (cached) return cached;
  let s = guardianMasterGeneratorHtmlV7();
  s = swap(s, "<title>BLOCK-DNA GUARDIAN V7</title>", "<title>BLOCK-DNA GUARDIAN V8</title>");
  s = swap(s, "MASTER CODE DELEGATE V7", "MASTER CODE DELEGATE V8");
  s = swap(s, "GTLON=true,", "GTLON=false,PROOFON=false,");
  s = swap(s, 'tb=document.createElement("button");', 'tb=document.createElement("button"),pb=document.createElement("button");');
  s = swap(s, '"TIMELINE +"}', '"TIMELINE +";pb.textContent=PROOFON?"PROOF \u00D7":"PROOF +"}');
  s = swap(s, "[mb,tb].forEach", "[mb,tb,pb].forEach");
  s = swap(s, "GTLON=!GTLON;label()};", "GTLON=!GTLON;label()};pb.onclick=function(e){e.stopPropagation();PROOFON=!PROOFON;label()};");
  s = swap(s, "bar();fit();requestAnimationFrame(frame);", v8Block() + "bar();fit();requestAnimationFrame(frame);");
  cached = s;
  return s;
}

/** Byte size of the V8 page, for inscription cost checks. */
export function guardianV8ByteSize(): number {
  return new TextEncoder().encode(guardianMasterGeneratorHtmlV8()).length;
}
