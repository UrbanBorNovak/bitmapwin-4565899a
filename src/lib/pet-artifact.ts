/** Self-rendering HTML for an inscribed Guardian pet: baked voxels + a tiny rotating painter. */
import { blueprint, type Vox } from "@/lib/onchain-guardian";
import type { PetGenome } from "@/lib/guardian-genetics";

const r1 = (n: number) => Math.round(n * 10) / 10;

export function petVoxels(pet: PetGenome): Vox[] {
  return blueprint(pet);
}

export function petArtifactHtml(pet: PetGenome, sire: string, dam: string): string {
  const cols: string[] = [];
  const data = petVoxels(pet).map((v) => {
    let ci = cols.indexOf(v[6]); if (ci < 0) { cols.push(v[6]); ci = cols.length - 1; }
    return [r1(v[0]), r1(v[1]), r1(v[2]), r1(v[3]), r1(v[4]), r1(v[5]), ci, v[7] ? 1 : 0];
  });
  const meta = JSON.stringify({ g: pet.gen, sire, dam, ra: pet.ra, sh: pet.sh });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BITMAPWIN PET · GEN ${pet.gen}</title><style>html,body{margin:0;height:100%;background:#05080f;overflow:hidden}canvas{width:100%;height:100%;display:block}</style></head><body><canvas id="c"></canvas><script>
const M=${meta},C=${JSON.stringify(cols)},V=${JSON.stringify(data)};
const c=document.getElementById("c"),g=c.getContext("2d");
function sh(col,k){const t=document.createElement("canvas").getContext("2d");t.fillStyle=col;const h=t.fillStyle;let n=parseInt(h.slice(1),16);if(isNaN(n))return col;let r=n>>16,G=n>>8&255,b=n&255;const f=x=>Math.max(0,Math.min(255,Math.round(k<0?x*(1+k):x+(255-x)*k)));return"rgb("+f(r)+","+f(G)+","+f(b)+")"}
const S=C.map(x=>[sh(x,-.36),sh(x,.2),x]);
function draw(t){const w=c.width=innerWidth*devicePixelRatio,h=c.height=innerHeight*devicePixelRatio,k=Math.min(w,h)/34,a=t/3000,ca=Math.cos(a),sa=Math.sin(a),bob=Math.sin(t/400)*k*.4;
g.fillStyle="#05080f";g.fillRect(0,0,w,h);
const P=V.map(v=>({v,x:v[0]*ca-v[2]*sa,z:v[0]*sa+v[2]*ca})).sort((p,q)=>p.z-q.z||p.v[1]-q.v[1]);
for(const p of P){const v=p.v,bw=Math.max(v[3],v[5])*k*.9,bh=v[4]*k,px=w/2+p.x*k-bw/2,py=h*.82-(v[1]+p.z*.25)*k-bh/2+bob,s=S[v[6]];
g.fillStyle=s[0];g.fillRect(px,py,bw,bh);g.fillStyle=s[2];g.fillRect(px+bw*.12,py,bw*.76,bh);g.fillStyle=s[1];g.fillRect(px,py,bw,Math.max(1,bh*.3));
if(v[7]){g.shadowColor=C[v[6]];g.shadowBlur=10;g.fillRect(px,py,bw,bh*.3);g.shadowBlur=0}}
g.fillStyle="#f7931a";g.font=(12*devicePixelRatio)+"px monospace";g.fillText("BITMAPWIN PET · GEN "+M.g+" · "+M.ra,12*devicePixelRatio,20*devicePixelRatio);
requestAnimationFrame(draw)}requestAnimationFrame(draw);
</script></body></html>`;
}
