/**
 * BW-SLAB-MASTER-1: the Living Slab master renderer (Tag 11 delegate).
 * The master HTML is inscribed once. Each lean grade inscribes an empty body,
 * points Tag 11 at the master and carries its facts in Tag 5 metadata
 * (the same SlabCertFacts object as BW-SLAB-1). The master reads
 * /r/metadata/<self>, draws the card, then runs the newest BW-SLAB-MOD-1 module.
 */
import { SLAB_MODULE_ANCHOR, SLAB_MODULE_HEADER, SLAB_PROTOCOL, type SlabCertFacts } from "@/lib/slab-cert";

/** Set once the master is inscribed; until then grades inscribe the standalone card. */
export const SLAB_MASTER_DELEGATE_ID: string | null = null;
export const SLAB_MASTER_PROTOCOL = "BW-SLAB-MASTER-1";

export const isSlabMasterDelegate = (id: string | null | undefined) =>
  !!id && !!SLAB_MASTER_DELEGATE_ID && id === SLAB_MASTER_DELEGATE_ID;

/** Tag 5 metadata for a lean grade: exactly the certificate facts. */
export function slabDelegateMetadata(f: SlabCertFacts): Record<string, unknown> {
  return { ...f };
}

/** Facts from decoded Tag 5 metadata, or null when it is not a slab grade. */
export function parseSlabMeta(m: unknown): SlabCertFacts | null {
  if (!m || typeof m !== "object") return null;
  const f = m as SlabCertFacts;
  if (f.p !== SLAB_PROTOCOL || !Number.isInteger(f.h) || !Number.isInteger(f.grade)) return null;
  if (typeof f.name !== "string" || typeof f.cert !== "string" || !f.subs || typeof f.subs !== "object") return null;
  return f;
}

export function slabMasterHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="bitmapwin" content="${SLAB_MASTER_PROTOCOL}"><title>BITMAPWIN LIVING SLAB</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b11;font:14px monospace;color:#111}.s{width:300px;border:10px solid #c8102e;background:#f7f5f0;padding:16px}h1{font:bold 22px sans-serif;margin:0}.g{font:bold 40px sans-serif;color:#c8102e}ul{list-style:none;padding:0}li{display:flex;justify-content:space-between}small{color:#555}</style></head><body><div class="s"><h1 id="h">LIVING SLAB</h1><div class="g" id="g">MASTER</div><ul id="u"></ul><div id="c"></div><small>${SLAB_PROTOCOL} · BitmapWIN rubric from block facts, not an on-chain property.</small></div><script>
const SELF=(location.pathname.match(/[0-9a-f]{64}i\\d+/)||[])[0];
function cb(b){let i=0;const L=a=>a<24?a:a==24?b[i++]:a==25?(i+=2,b[i-2]<<8|b[i-1]):a==26?(i+=4,(b[i-4]<<24>>>0)+(b[i-3]<<16)+(b[i-2]<<8)+b[i-1]):0;
const I=()=>{const x=b[i++],t=x>>5,a=x&31;if(t==0)return L(a);if(t==1)return-1-L(a);if(t==2||t==3){if(a==31){let s="";while(b[i]!=255)s+=I();i++;return s}const n=L(a),s=b.slice(i,i+n);i+=n;return t==3?new TextDecoder().decode(s):s}
if(t==4){const n=L(a),r=[];for(let k=0;k<n;k++)r.push(I());return r}if(t==5){const n=L(a),o={};for(let k=0;k<n;k++){const key=I();o[key]=I()}return o}if(t==7)return a==21?true:a==20?false:null;return null};return I()}
const T=(id,v)=>{document.getElementById(id).textContent=v};
(async()=>{try{if(!SELF)return;const r=await fetch("/r/metadata/"+SELF);if(!r.ok)return;const hx=(await r.json()).replace(/[^0-9a-f]/gi,"");const b=new Uint8Array(hx.length/2);for(let k=0;k<b.length;k++)b[k]=parseInt(hx.substr(k*2,2),16);const F=cb(b);
if(!F||F.p!=="${SLAB_PROTOCOL}")return;T("h",F.h+".BITMAP");T("g",F.name+" "+F.grade);T("c","CERT "+F.cert);document.title=F.h+".bitmap "+F.name+" "+F.grade;
const u=document.getElementById("u");for(const k in F.subs){const li=document.createElement("li");li.textContent=k.toUpperCase();const x=document.createElement("b");x.textContent=F.subs[k];li.appendChild(x);u.appendChild(li)}
if(/[?&]mod=off/.test(location.search))return;const i=await(await fetch("/r/inscription/${SLAB_MODULE_ANCHOR}")).json();const s=i.sat;if(s==null)return;
for(let k=1;k<=6;k++){const q=await fetch("/r/sat/"+s+"/at/-"+k);if(!q.ok)break;const id=(await q.json()).id;if(!id)break;const t=await(await fetch("/content/"+id)).text();if(t.startsWith("${SLAB_MODULE_HEADER}\\n")){new Function("F","root","card",t.slice(${SLAB_MODULE_HEADER.length + 1}))(F,document.body,document.querySelector(".s"));return}}}catch(e){}})();
</script></body></html>`;
}
