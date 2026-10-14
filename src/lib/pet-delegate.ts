/**
 * Pet Master Delegate (Tag 11). The master HTML is inscribed once; every lean pet
 * inscribes no body, points Tag 11 at the master and carries its baked voxels in
 * Tag 5 metadata: { p:"BITMAPWIN-PET", sire, dam, g, sh, ra, c, C:[colours], v:"x,y,z,w,h,d,ci,e;…" }
 * (geometry ×10, integers). The master reads /r/metadata/<self> and paints it.
 */
import { petVoxels } from "@/lib/pet-artifact";
import type { PetGenome } from "@/lib/guardian-genetics";

/** Set once the master is inscribed; until then pets inscribe the standalone HTML. */
export const PET_MASTER_DELEGATE_ID: string | null = null;

export function petLeanGeometry(pet: PetGenome): { C: string[]; v: string } {
  const C: string[] = [];
  const rows = petVoxels(pet).map((x) => {
    let ci = C.indexOf(x[6]); if (ci < 0) { C.push(x[6]); ci = C.length - 1; }
    return [x[0], x[1], x[2], x[3], x[4], x[5]].map((n) => Math.round(n * 10)).concat([ci, x[7] ? 1 : 0]).join(",");
  });
  return { C, v: rows.join(";") };
}

export function petMasterHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="bitmapwin" content="PET;master"><title>BITMAPWIN PET</title><style>html,body{margin:0;height:100%;background:#05080f;overflow:hidden}canvas{width:100%;height:100%;display:block}</style></head><body><canvas id="c"></canvas><script>
const SELF=(location.pathname.match(/[0-9a-f]{64}i\\d+/)||[])[0];
function cb(b){let i=0;const L=a=>a<24?a:a==24?b[i++]:a==25?(i+=2,b[i-2]<<8|b[i-1]):a==26?(i+=4,(b[i-4]<<24>>>0)+(b[i-3]<<16)+(b[i-2]<<8)+b[i-1]):0;
const I=()=>{const x=b[i++],t=x>>5,a=x&31;if(t==0)return L(a);if(t==1)return-1-L(a);if(t==2||t==3){if(a==31){let s="";while(b[i]!=255)s+=I();i++;return s}const n=L(a),s=b.slice(i,i+n);i+=n;return t==3?new TextDecoder().decode(s):s}
if(t==4){const n=L(a),r=[];for(let k=0;k<n;k++)r.push(I());return r}if(t==5){const n=L(a),o={};for(let k=0;k<n;k++){const key=I();o[key]=I()}return o}return null};return I()}
let M={g:0,ra:""},C=["#f7931a"],V=[];
const c=document.getElementById("c"),g=c.getContext("2d");
function sh(col,k){const t=document.createElement("canvas").getContext("2d");t.fillStyle=col;const h=t.fillStyle;let n=parseInt(h.slice(1),16);if(isNaN(n))return col;let r=n>>16,G=n>>8&255,b=n&255;const f=x=>Math.max(0,Math.min(255,Math.round(k<0?x*(1+k):x+(255-x)*k)));return"rgb("+f(r)+","+f(G)+","+f(b)+")"}
let S=[];
function draw(t){const w=c.width=innerWidth*devicePixelRatio,h=c.height=innerHeight*devicePixelRatio,k=Math.min(w,h)/34,a=t/3000,ca=Math.cos(a),sa=Math.sin(a),bob=Math.sin(t/400)*k*.4;
g.fillStyle="#05080f";g.fillRect(0,0,w,h);
const P=V.map(v=>({v,x:v[0]*ca-v[2]*sa,z:v[0]*sa+v[2]*ca})).sort((p,q)=>p.z-q.z||p.v[1]-q.v[1]);
for(const p of P){const v=p.v,bw=Math.max(v[3],v[5])*k*.9,bh=v[4]*k,px=w/2+p.x*k-bw/2,py=h*.82-(v[1]+p.z*.25)*k-bh/2+bob,s=S[v[6]]||S[0];
g.fillStyle=s[0];g.fillRect(px,py,bw,bh);g.fillStyle=s[2];g.fillRect(px+bw*.12,py,bw*.76,bh);g.fillStyle=s[1];g.fillRect(px,py,bw,Math.max(1,bh*.3));
if(v[7]){g.shadowColor=C[v[6]];g.shadowBlur=10;g.fillRect(px,py,bw,bh*.3);g.shadowBlur=0}}
g.fillStyle="#f7931a";g.font=(12*devicePixelRatio)+"px monospace";g.fillText(V.length?"BITMAPWIN PET · GEN "+M.g+" · "+M.ra:"BITMAPWIN PET · MASTER RENDERER",12*devicePixelRatio,20*devicePixelRatio);
requestAnimationFrame(draw)}
(async()=>{try{if(SELF){const r=await fetch("/r/metadata/"+SELF);if(r.ok){const hx=(await r.json()).replace(/[^0-9a-f]/gi,"");const b=new Uint8Array(hx.length/2);for(let k=0;k<b.length;k++)b[k]=parseInt(hx.substr(k*2,2),16);const m=cb(b);
if(m&&m.p==="BITMAPWIN-PET"&&typeof m.v==="string"){M=m;C=m.C||C;V=m.v.split(";").map(r=>r.split(",").map(Number)).map(a=>[a[0]/10,a[1]/10,a[2]/10,a[3]/10,a[4]/10,a[5]/10,a[6],a[7]])}}}}catch(e){}
S=C.map(x=>[sh(x,-.36),sh(x,.2),x]);requestAnimationFrame(draw)})();
</script></body></html>`;
}
