// Sovereign storefront: one self-contained HTML file that needs no BitmapWin server.
// Listings come from public Nostr relays (kind 30402, carrying the seller's signed
// PSBT); every card is re-checked on chain (PSBT signature present, UTXO unspent,
// inscription in that UTXO, canonical first-is-first BITMAP via the on-chain LiveOCI
// module); BUY builds the buyer half in the page and the buyer's own wallet signs
// and broadcasts. The page never holds keys and never signs for anyone.
import { DEFAULT_STORE, type StoreConfig } from "@/lib/store-template";
import { LISTING_KIND, LISTING_TAG, NOSTR_RELAYS } from "@/lib/nostr-listing";
import { MOSAIC_CSS, MOSAIC_JS, mosaicConfig } from "@/lib/store-mosaic";

/** On-chain LiveOCI sat cache module (exports getBitmapInscriptionId). */
export const OCI_MODULE_ID = "970c183ec1e8cb10d25e53140b520bbda5dcf4381d830ea4dfda507b9af4f926i0";
export const OCI_LAST = 969_999;

const HEX = /^#[0-9a-fA-F]{6}$/;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

const SCRIPT = String.raw`
const g=document.getElementById('g'),s=document.getElementById('s'),w=document.getElementById('w');
const H=location.hostname,ORD=(/ordinals\.com$|ord\.io$|^ordiscan|ordinals/.test(H)||location.pathname.indexOf('/content/')===0)?'':'https://ordinals.com';
const MP='https://mempool.space/api';
const btc=v=>(v/1e8).toFixed(8).replace(/0+$/,'').replace(/\.$/,'')+' BTC',sat=v=>Number(v).toLocaleString('en-US')+' sats';
const say=t=>{s.innerHTML='<span class="k">'+t+'</span>'};
const J=u=>fetch(u).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});
/* ---------- tiny PSBT v0 codec ---------- */
const b2u=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0)),u2b=u=>{let x='';for(const c of u)x+=String.fromCharCode(c);return btoa(x)};
const hx=u=>Array.from(u,b=>b.toString(16).padStart(2,'0')).join(''),uh=h=>Uint8Array.from(h.match(/../g)||[],x=>parseInt(x,16));
function R(u){let o=0;const r={u,get end(){return o>=u.length},b(n){const v=u.slice(o,o+n);if(v.length<n)throw new Error('short');o+=n;return v},v(){const f=u[o++];if(f<253)return f;if(f===253){const v=u[o]|u[o+1]<<8;o+=2;return v}const v=(u[o]|u[o+1]<<8|u[o+2]<<16)+u[o+3]*16777216;o+=f===254?4:8;return v},n(k){let v=0;for(let i=0;i<k;i++)v+=u[o+i]*Math.pow(256,i);o+=k;return v}};return r}
function vi(n){return n<253?[n]:n<65536?[253,n&255,n>>8]:[254,n&255,n>>8&255,n>>16&255,n>>>24]}
function le(n,k){const a=[];for(let i=0;i<k;i++){a.push(n%256);n=Math.floor(n/256)}return a}
function rmap(r){const m=[];for(;;){const kl=r.v();if(!kl)return m;const k=r.b(kl),v=r.b(r.v());m.push([k,v])}}
function ptx(u){const r=R(u),t={ver:r.n(4),ins:[],outs:[]};let n=r.v();for(let i=0;i<n;i++){const id=r.b(32),vo=r.n(4);r.b(r.v());t.ins.push({id,vo,seq:r.n(4)})}n=r.v();for(let i=0;i<n;i++){const val=r.n(8);t.outs.push({val,sc:r.b(r.v())})}t.lock=r.n(4);return t}
function stx(t){const a=[...le(t.ver,4),...vi(t.ins.length)];for(const i of t.ins)a.push(...i.id,...le(i.vo,4),0,...le(i.seq,4));a.push(...vi(t.outs.length));for(const o of t.outs)a.push(...le(o.val,8),...vi(o.sc.length),...o.sc);a.push(...le(t.lock||0,4));return a}
function pp(b64){const u=b2u(b64),r=R(u);if(hx(r.b(5))!=='70736274ff')throw new Error('not a psbt');const gl=rmap(r),ut=gl.find(e=>e[0].length===1&&e[0][0]===0);if(!ut)throw new Error('no tx');const tx=ptx(ut[1]);return{tx,ins:tx.ins.map(()=>rmap(r)),outs:tx.outs.map(()=>rmap(r))}}
function wm(m){const a=[];for(const [k,v] of m)a.push(...vi(k.length),...k,...vi(v.length),...v);a.push(0);return a}
function sp(tx,ins,outs){const t=stx(tx);return u2b(Uint8Array.from([0x70,0x73,0x62,0x74,0xff,...vi(1),0,...vi(t.length),...t,0,...ins.flatMap(wm),...outs.flatMap(wm)]))}
const op=i=>hx(i.id.slice().reverse())+':'+i.vo;
const signed=m=>m.some(e=>[2,7,8,0x13].includes(e[0][0]));
/* ---------- Nostr orderbook ---------- */
function pull(){return new Promise(done=>{const ev=new Map();let left=C.relays.length;const fin=()=>{if(--left===0)done([...ev.values()])};
 for(const url of C.relays){let ok=false,ws;const t=setTimeout(()=>{if(!ok){ok=true;try{ws.close()}catch(e){}fin()}},6000);
  try{ws=new WebSocket(url)}catch(e){clearTimeout(t);fin();continue}
  ws.onopen=()=>ws.send(JSON.stringify(['REQ','b',{kinds:[C.kind],'#t':[C.tag],limit:500}]));
  ws.onmessage=m=>{try{const d=JSON.parse(m.data);if(d[0]==='EVENT'){const e=d[2],dt=(e.tags.find(x=>x[0]==='d')||[])[1];if(!dt)return;const key=e.pubkey+dt,o=ev.get(key);if(!o||o.created_at<e.created_at)ev.set(key,e)}else if(d[0]==='EOSE'&&!ok){ok=true;clearTimeout(t);ws.close();fin()}}catch(x){}};
  ws.onerror=()=>{if(!ok){ok=true;clearTimeout(t);fin()}};}
 if(!left)done([])})}
const tag=(e,k)=>(e.tags.find(x=>x[0]===k)||[])[1];
let oci=null;function canon(h){if(h>C.ociLast)return Promise.resolve(null);oci=oci||import(ORD+'/content/'+C.oci+(ORD?'?origin='+ORD:''));return oci.then(m=>m.getBitmapInscriptionId(h)).catch(()=>null)}
async function check(e){const h=Number(tag(e,'height')),id=String(tag(e,'inscription')||''),ut=String(tag(e,'utxo')||''),price=Number(tag(e,'price')),b=tag(e,'psbt');
 if(!(h>=0)||!/^[0-9a-f]{64}i\d+$/.test(id)||!/^[0-9a-f]{64}:\d+$/.test(ut)||!b)return null;
 const p=pp(b);if(p.tx.ins.length!==1||p.tx.outs.length!==1||op(p.tx.ins[0])!==ut||p.tx.outs[0].val!==price||!signed(p.ins[0]))return null;
 const wu=p.ins[0].find(x=>x[0][0]===1);if(!wu)return null;
 const [tx,vo]=ut.split(':'),sp1=await J(MP+'/tx/'+tx+'/outspend/'+vo);if(sp1.spent)return null;
 const u=await J(ORD+'/r/utxo/'+ut);if(!(u.inscriptions||[]).includes(id))return null;
 const c=await canon(h);if(c!==id)return null;
 return{h,id,ut,price,p,value:u.value,seller:tag(e,'seller')||''}}
function boxed(){return /(^|\\.)ordinals\\.com$/.test(H)&&location.pathname.indexOf('/content/')===0}
async function load(){if(boxed()){say('ORDINALS.COM SANDBOX');g.innerHTML='<div class="e"><b>NOSTR IS BLOCKED ON ORDINALS.COM</b>ordinals.com does not let inscriptions open outside connections, so this shop cannot read listings here. Download it and open the file on your computer, or host it on GitHub Pages — the same file then loads live listings.<br><br><a id="dl" href="#">DOWNLOAD THIS SHOP</a></div>';const a=document.getElementById('dl');a.onclick=e=>{e.preventDefault();const u=URL.createObjectURL(new Blob(['<!doctype html>'+document.documentElement.outerHTML],{type:'text/html'}));a.href=u;a.download='bitmap-shop.html';a.onclick=null;a.click()};return}
 say('ASKING NOSTR RELAYS…');let E=await pull();
 E=E.filter(e=>{const h=Number(tag(e,'height')),pr=Number(tag(e,'price'));return(C.min==null||h>=C.min)&&(C.max==null||h<=C.max)&&(!C.maxSats||pr<=C.maxSats)&&(!C.seller||tag(e,'seller')===C.seller)});
 say('CHECKING '+E.length+' LISTINGS ON BITCOIN…');
 const L=[];for(let i=0;i<E.length;i+=6){const r=await Promise.all(E.slice(i,i+6).map(e=>check(e).catch(()=>null)));for(const x of r)if(x)L.push(x)}
 const best=new Map();for(const x of L){const o=best.get(x.id);if(!o||x.price<o.price)best.set(x.id,x)}
 const V=[...best.values()].sort((a,b)=>C.sort==='price_desc'?b.price-a.price:C.sort==='recent'?b.h-a.h:a.price-b.price);
 const fl=V.length?Math.min(...V.map(o=>o.price)):null;
 s.innerHTML='<span class="k"><b>'+V.length+'</b> FOR SALE</span>'+(fl!=null?'<span class="k f">FLOOR <b>'+sat(fl)+'</b> · '+btc(fl)+'</span>':'')+'<span class="k">● NOSTR + CHAIN VERIFIED · '+(E.length-V.length)+' DROPPED</span>';
 g.innerHTML='';if(!V.length){g.innerHTML='<div class="e"><b>NO VERIFIED LISTINGS RIGHT NOW</b>Only listings whose signed offer still matches Bitcoin appear here.</div>';return}
 for(const o of V){const el=document.createElement('div');el.className='c';el.innerHTML='<div class="v"><div>'+o.h+'<small>BLOCK</small></div></div><div class="b"><div class="h">'+o.h+'.bitmap</div><div class="p">'+sat(o.price)+'</div><div class="q">'+btc(o.price)+'</div><span class="o ok">✓ LIVEOCI CANONICAL</span></div><a href="#">BUY</a>';
  el.querySelector('a').onclick=ev=>{ev.preventDefault();buy(o)};g.appendChild(el);BM.draw(el.querySelector('.v'),o.h)}}
/* ---------- in-page checkout (UniSat) ---------- */
const note=t=>{w.textContent=t;w.style.display='block'};
async function clean(a){const U=(await J(MP+'/address/'+a+'/utxo')).sort((x,y)=>x.value-y.value).slice(0,24),out=[];
 for(const u of U){try{const r=await J(ORD+'/r/utxo/'+u.txid+':'+u.vout);if(!(r.inscriptions||[]).length&&!Object.keys(r.runes||{}).length)out.push(u)}catch(e){}}return out}
async function buy(o){const W=window.unisat;if(!W){note('Install the UniSat wallet extension and open this page in its own tab to buy.');return}
 try{note('Connecting wallet…');const a=(await W.requestAccounts())[0];if(!/^bc1[qp]/.test(a))throw new Error('Use a bc1q… or bc1p… address in UniSat.');
  const pk=await W.getPublicKey(),sc=uh((await J(MP+'/v1/validate-address/'+a)).scriptPubKey),tr=sc[0]===0x51;
  note('Checking your coins…');const U=await clean(a);if(U.length<3)throw new Error('You need 3 separate plain coins (two small ones keep the BITMAP from landing on the wrong output). Send yourself two payments of 600 sats, then try again.');
  const fr=Math.max(1,(await J(MP+'/v1/fees/recommended')).halfHourFee),pads=U.slice(0,2),rest=U.slice(2).reverse(),insV=Math.max(o.value,546);
  const used=[];let f=0,fee=0,need=0;for(const u of rest){used.push(u);f+=u.value;fee=Math.ceil((11+(3+used.length)*58+4*43)*fr);need=o.price+(insV-o.value)+fee;if(f>=need+546)break}
  if(f<need)throw new Error('Not enough funds: need about '+sat(need)+'.');
  let ch=f-need;if(ch<546){fee+=ch;ch=0}
  const mk=u=>{const m=[[[1],Uint8Array.from([...le(u.value,8),...vi(sc.length),...sc])]];if(tr)m.push([[0x17],uh(pk.length===66?pk.slice(2):pk)]);return m};
  const ti=u=>({id:uh(u.txid).reverse(),vo:u.vout,seq:0xfffffffd});
  const tx={ver:2,lock:0,ins:[ti(pads[0]),ti(pads[1]),o.p.tx.ins[0],...used.map(ti)],outs:[{val:pads[0].value+pads[1].value,sc},{val:insV,sc},o.p.tx.outs[0]]};if(ch)tx.outs.push({val:ch,sc});
  const psbt=sp(tx,[mk(pads[0]),mk(pads[1]),o.p.ins[0],...used.map(mk)],tx.outs.map((_,i)=>i===2?o.p.outs[0]:[]));
  if(!confirm('Buy '+o.h+'.bitmap\n\nPrice to seller: '+sat(o.price)+'\nNetwork fee: '+sat(fee)+' ('+fr+' sat/vB)\nTotal: '+sat(o.price+fee+(insV-o.value))+'\n\nThe BITMAP arrives at '+a+'. Your wallet will ask you to sign.'))return note('Cancelled — nothing was signed.');
  const idx=[0,1,...used.map((_,i)=>3+i)].map(index=>({index,address:a}));
  const sh=await W.signPsbt(hx(b2u(psbt)),{autoFinalized:true,toSignInputs:idx});
  const txid=await W.pushPsbt(sh);note('Sent! Transaction '+txid+' — the BITMAP is yours once it confirms.');
 }catch(e){note('Not bought: '+(e&&e.message||e))}}
load().catch(()=>say('COULD NOT REACH NOSTR RELAYS — TRY AGAIN SOON'));
`;

export function buildSovereignStoreHtml(c: StoreConfig): string {
  const accent = HEX.test(c.accent) ? c.accent : DEFAULT_STORE.accent;
  const cfg = JSON.stringify({
    relays: NOSTR_RELAYS,
    kind: LISTING_KIND,
    tag: LISTING_TAG,
    oci: OCI_MODULE_ID,
    ociLast: OCI_LAST,
    seller: c.seller || null,
    min: Number.isFinite(c.minHeight) ? c.minHeight : null,
    max: Number.isFinite(c.maxHeight) ? c.maxHeight : null,
    maxSats: c.maxSats && c.maxSats > 0 ? Math.floor(c.maxSats) : null,
    sort: c.sort,
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.name)}</title><meta name="description" content="${esc(c.tagline)}">
<style>
:root{--a:${accent};--bg:#0b0d10;--fg:#e8e6e1;--mut:#8a8f98;--ln:#ffffff1a}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at top,color-mix(in srgb,var(--a) 10%,transparent),transparent 60%),var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
header{padding:44px 24px 20px;max-width:1100px;margin:auto}h1{margin:0;font:700 34px/1.1 ui-monospace,monospace;letter-spacing:.04em;color:var(--a)}
p.t{color:var(--mut);margin:8px 0 0}
#s{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;font:11px ui-monospace,monospace;letter-spacing:.08em}
.k{border:1px solid var(--ln);border-radius:999px;padding:5px 12px;background:#ffffff08;color:var(--mut)}.k b{color:var(--fg)}.k.f b{color:var(--a)}
#w{display:none;max-width:1052px;margin:0 auto 12px;border:1px solid var(--a);border-radius:10px;padding:10px 14px;font:12px/1.6 ui-monospace,monospace;word-break:break-all}
main{max-width:1100px;margin:auto;padding:8px 24px 48px;display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.c{border:1px solid var(--ln);border-radius:12px;overflow:hidden;background:linear-gradient(#ffffff0a,#ffffff03);transition:transform .2s,border-color .2s,box-shadow .2s}
.c:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--a) 60%,transparent);box-shadow:0 10px 30px -12px var(--a)}
.v{aspect-ratio:1;display:grid;place-items:center;border-bottom:1px solid var(--ln);background:repeating-linear-gradient(0deg,#ffffff06 0 1px,transparent 1px 16px),repeating-linear-gradient(90deg,#ffffff06 0 1px,transparent 1px 16px),#050607;font:700 26px ui-monospace,monospace;color:var(--a)}.v small{display:block;text-align:center;color:var(--mut);font-size:10px;letter-spacing:.2em}
.b{padding:12px}.h{font:700 15px ui-monospace,monospace}.p{color:var(--a);font:700 16px ui-monospace,monospace;margin-top:6px}.q{color:var(--mut);font:11px ui-monospace,monospace}
.c a{display:block;margin:0 12px 12px;padding:9px;text-align:center;border-radius:8px;background:var(--a);color:#000;font:700 12px ui-monospace,monospace;text-decoration:none;letter-spacing:.1em}
.e{grid-column:1/-1;border:1px dashed var(--ln);border-radius:12px;padding:40px 20px;text-align:center;color:var(--mut);font:12px/1.7 ui-monospace,monospace}.e b{display:block;color:var(--fg);font-size:14px;margin-bottom:6px}
footer{text-align:center;color:var(--mut);font:11px/1.7 ui-monospace,monospace;padding:24px}
${MOSAIC_CSS}
</style></head><body>
<header><h1>${esc(c.name)}</h1><p class="t">${esc(c.tagline)}</p><div id="s"><span class="k">LOADING…</span></div></header>
<div id="w"></div><main id="g"></main>
<footer>Sovereign shop · listings from open Nostr relays · every offer re-checked on Bitcoin with bop's LiveOCI · you sign in your own wallet · no middleman fee</footer>
<script>const MZ=${mosaicConfig(DEFAULT_STORE.apiBase)};${MOSAIC_JS}</script><script>const C=${cfg};</script><script type="module">${SCRIPT}</script></body></html>`;
}
