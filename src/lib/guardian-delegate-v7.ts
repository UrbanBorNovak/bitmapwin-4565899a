/**
 * V7 of the Block-DNA Guardian master generator.
 *
 * Built from the V6 source by exact, checked replacements (so V6 stays
 * byte-identical for the live collection) plus one V7 block:
 *
 *   · LiveOCI — first-is-first check against Bop's live on-chain indexer, no 942k cap
 *   · tribute paid to the current treasury
 *   · block mutations read from /r/blockinfo (nonce, merkle root, time, weight)
 *   · motor rhythm wired from the on-chain fly connectome (edges folded to 8 cells)
 *   · on-chain collection navigator: PREV / NEXT / RANDOM through /r/children
 *
 * Not active until V7 is inscribed and its id is set as the master.
 */
import { TRIBUTE_ADDRESS, TRIBUTE_SCRIPT, guardianMasterGeneratorHtml } from "@/lib/guardian-delegate";

export const LIVE_OCI_MODULE_ID = "0c18b83ca6aa6f5653bb57dafb491ac786b7fa738b6c5190f4542d1d7f15c43ai0";
export const BLOCK_PARSER_MODULE_ID = "bbbb2172ebca174579884df1ad7487196c39e860b3aacdf4e052a33bf5ec31fai0";
export const V7_CONNECTOME_ID = "18cacc9e069063e09fe3a0d3f96fd49117ffb2e6d9bcb68f1ccf79206afdef0ai0";
const OLD_OCI = "942b5886158d57fc70cb8fb7d9bd4d37aa95b8b145be1a351326336b087262dbi0";

/** Treasury the V7 generator checks the tribute against. */
export const V7_TRIBUTE_ADDRESS = "bc1qgunjcn7a7njky4xzj4ahj79cg6muzj4qg5pfpv";
/** P2WPKH output script of V7_TRIBUTE_ADDRESS (round-trip verified). */
export const V7_TRIBUTE_SCRIPT = "001447272c4fddf4e56254c2957b7978b846b7c14aa0";

const V7_BLOCK = String.raw`
/* ================= V7 ================= */
/* ---------- 7a. block mutations from /r/blockinfo ---------- */
var TAILS=["PLAIN","STINGER","MACE","FAN","ANCHOR"];
function mutate(G,blk){
  G.mx=[];if(!blk)return;
  var nonce=Number(blk.nonce),mr=String(blk.merkle_root||""),ts=Number(blk.timestamp||blk.time||0),wt=Number(blk.weight||0),sz=Number(blk.size||0);
  if(nonce>0&&nonce%21===0){G.gc=1;G.mx.push(["Crown","GOLDEN NONCE"])}
  if(mr.length>2&&parseInt(mr.slice(-2),16)<40){G.mr=1;G.mx.push(["Runes","MERKLE RUNES"])}
  if(ts>0){var hr=Math.floor((ts%86400)/3600);G.as=hr>=6&&hr<18?"SOLAR":"VOID";G.mx.push(["Aspect",G.as==="SOLAR"?"DAYBORN":"VOIDBORN"])}
  if(wt>0&&sz>0){G.dn=wt/(sz*4)>.9?"CARAPACE":"CHITIN";G.mx.push(["Density",G.dn==="CARAPACE"?"HEAVY CARAPACE":"CRYSTAL CHITIN"])}
  if(G.sh!=="serpent"&&G.sh!=="floater"){var tk=h32(G.dna+":tail:"+mr)%5;if(tk>0){G.tl=TAILS[tk];G.mx.push(["Tail",TAILS[tk]+" TAIL"])}}
}
function extras(G,V){
  var hy=-1e9,hz=0,hn=0,tz=1e9,tx=0,ty=0,i;
  for(i=0;i<V.length;i++){var v=V[i];if(v[8]===4){hy=Math.max(hy,v[1]+v[4]/2);hz+=v[2];hn++}if(v[8]===3&&v[2]<tz){tz=v[2];tx=v[0];ty=v[1]}}
  hz=hn?hz/hn:0;
  if(G.gc&&hy>-1e9)for(i=0;i<8;i++){var a=i/8*Math.PI*2;V.push([Math.sin(a)*2.2,hy+.9+(i%2)*.5,hz+Math.cos(a)*2.2,.55,.9+(i%2)*.6,.55,"#ffd23a",1.3,4,0])}
  if(G.mr)for(i=0;i<V.length;i++)if(V[i][8]===0&&i%3===0)V[i][7]=Math.max(V[i][7],.45);
  if(G.dn==="CHITIN")for(i=0;i<V.length;i++)if(V[i][8]===0&&V[i][7]===0)V[i][7]=.12;
  if(G.dn==="CARAPACE")for(i=0;i<V.length;i++)if(V[i][8]===0){V[i][4]*=1.06;V[i][3]*=1.04}
  if(G.as){var col=G.as==="SOLAR"?"#ffb03a":"#3fe0d0";for(i=0;i<6;i++){var b=i/6*Math.PI*2+.5;V.push([Math.sin(b)*12,4+i,Math.cos(b)*12,.45,.45,.45,col,1.2,5,b])}}
  if(tz<1e9&&G.tl){
    if(G.tl==="STINGER")for(i=0;i<3;i++)V.push([tx,ty+1+i*1.1,tz-.6+i*.7,.7-i*.15,1.1,.7-i*.15,i===2?G.accent:"#e9e0c8",i===2?1:0,3,4])
    else if(G.tl==="MACE"){V.push([tx,ty,tz-1.2,1.8,1.8,1.8,"#4a4f56",0,3,4]);for(i=0;i<6;i++){var c=i/6*Math.PI*2;V.push([tx+Math.sin(c)*1.1,ty+Math.cos(c)*1.1,tz-1.2,.5,.5,.5,G.accent,.6,3,4])}}
    else if(G.tl==="FAN")for(i=0;i<5;i++){var f=(i-2)*.35;V.push([tx+Math.sin(f)*2,ty+Math.cos(f)*2,tz-.8,.5,2.2,.3,i%2?G.accent:G.body,i===2?.8:.3,3,4])}
    else if(G.tl==="ANCHOR"){V.push([tx,ty-.8,tz-1,.5,2,.5,"#9aa3ab",0,3,4]);V.push([tx,ty-1.8,tz-1,2.4,.5,.5,"#9aa3ab",0,3,4])}
  }
}
/* ---------- 7b. motor rhythm from the on-chain fly connectome ----------
   the EFCB edge list is folded into 8 cells; signs are our assignment.
   cells 0-3 take senses, 4 roar urge, 5 head yaw, 6 head pitch, 7 gait drive. */
var BRAIN=${JSON.stringify(V7_CONNECTOME_ID)};
var NB={W:null,r:[0,0,0,0,0,0,0,0],o:[0,0,0,0],px:0,py:0,lt:0,lr:0,src:"NEURAL RHYTHM \u00B7 READING CONNECTOME"};
(function(){var W=[],i,k,s=h32(SELF||"g");for(i=0;i<8;i++){W.push([]);for(k=0;k<8;k++)W[i].push(((h32(s+":"+i+":"+k)%200)/100-1)*.35)}NB.W=W})();
function vint(b,c){var r=0,m=1,x;do{x=b[c.i++];r+=(x&127)*m;m*=128}while((x&128)&&c.i<b.length);return r}
function loadBrain(){
  if(!window.DecompressionStream){NB.src="NEURAL RHYTHM \u00B7 PROCEDURAL";return}
  fetch("/content/"+BRAIN).then(function(r){if(!r.ok)throw 0;return r.arrayBuffer()}).then(function(buf){
    var u=new Uint8Array(buf);if(String.fromCharCode(u[0],u[1],u[2],u[3])!=="EFCB")throw 0;
    var hl=u[8]|(u[9]<<8);
    return new Response(new Blob([u.subarray(hl)]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }).then(function(ab){
    var p=new Uint8Array(ab),c={i:0},src=0,e=0,W=[],i,k,mx=0,s=h32(SELF||"g");
    for(i=0;i<8;i++){W.push([0,0,0,0,0,0,0,0])}
    while(c.i<p.length&&e<8000){src+=vint(p,c);var fo=vint(p,c);
      for(k=0;k<fo&&e<8000;k++){var post=vint(p,c),w=vint(p,c);vint(p,c);var nt=vint(p,c);
        var a=(Math.imul(src,2654435761)^s)>>>0,b=(Math.imul(post,2246822519)^s)>>>0;
        W[a%8][b%8]+=(nt===1||nt===2?-1:1)*Math.log(1+w);e++}}
    for(i=0;i<8;i++)for(k=0;k<8;k++)mx=Math.max(mx,Math.abs(W[i][k]));
    if(!e||!mx)throw 0;
    for(i=0;i<8;i++)for(k=0;k<8;k++)W[i][k]=W[i][k]/mx*1.4;
    NB.W=W;NB.src="FLY CONNECTOME \u00B7 "+e.toLocaleString()+" SYNAPSES";
  }).catch(function(){NB.src="NEURAL RHYTHM \u00B7 PROCEDURAL"})}
function nstep(t){
  var dt=Math.min(.05,Math.max(0,t-NB.lt));NB.lt=t;if(!NB.W||!dt)return;
  var I=[NB.px,NB.py,Math.sin(t*.9)*.6,Math.cos(t*.53)*.6,0,0,0,0],r=NB.r,n=[],i,k;
  for(i=0;i<8;i++){var a=I[i];for(k=0;k<8;k++)a+=NB.W[k][i]*r[k];n.push(r[i]+dt*3*(-r[i]+Math.tanh(a)))}
  NB.r=n;NB.o=[n[5],n[6],Math.max(0,n[7]),n[4]];
  if(STATE==="AWAKE"&&!MASTER&&n[4]>.85&&t-NB.lr>25&&t>8){NB.lr=t;ACT={k:"roar",t:t}}
}
function sense(x,y){NB.px=Math.max(-1,Math.min(1,(x/(W||1)-.5)*2));NB.py=Math.max(-1,Math.min(1,(y/(H||1)-.5)*2))}
window.addEventListener("mousemove",function(e){sense(e.clientX,e.clientY)});
window.addEventListener("touchmove",function(e){var p=e.touches&&e.touches[0];if(p)sense(p.clientX,p.clientY)},{passive:true});
/* ---------- 7c. on-chain collection navigator ---------- */
function go(id){if(!id||id===SELF)return;var s=location.pathname.split("/");s[s.length-1]=id;location.pathname=s.join("/")}
function step(d){if(!COLL||!COLL.ids||!COLL.ids.length)return;var L=COLL.ids,i=L.indexOf(SELF);
  if(d===0)go(L[Math.floor(Math.random()*L.length)]);else go(L[i<0?(d>0?0:L.length-1):(i+d+L.length)%L.length])}
function navbar(){if(!COLL||!COLL.ids||!COLL.ids.length){if(!navbar.n||navbar.n++<20){navbar.n=(navbar.n||0)+1;setTimeout(navbar,1500)}return}
  var d=document.createElement("div");d.style.cssText="position:fixed;left:50%;top:2.5%;transform:translateX(-50%);display:flex;gap:4px;z-index:2";
  [["[ PREV",function(){step(-1)}],["RANDOM",function(){step(0)}],["NEXT ]",function(){step(1)}]].forEach(function(b){var e=document.createElement("button");
    e.textContent=b[0];e.style.cssText="font:10px ui-monospace,monospace;letter-spacing:.08em;color:#3fe0d0;background:rgba(4,6,10,.7);border:1px solid #3fe0d055;padding:4px 7px;cursor:pointer";
    e.onclick=function(ev){ev.stopPropagation();b[1]()};d.appendChild(e)});document.body.appendChild(d)}
window.addEventListener("keydown",function(e){if(e.key==="[")step(-1);else if(e.key==="]")step(1)});
loadBrain();setTimeout(navbar,1200);
/* ================= /V7 ================= */
`;

function swap(src: string, from: string, to: string, all = false): string {
  if (!src.includes(from)) throw new Error(`V7 build: missing anchor ${from.slice(0, 40)}`);
  return all ? src.split(from).join(to) : src.replace(from, to);
}

let cached: string | null = null;

/** The V7 master generator page, ready to inscribe. */
export function guardianMasterGeneratorHtmlV7(): string {
  if (cached) return cached;
  let s = guardianMasterGeneratorHtml();
  s = swap(s, "<title>BLOCK-DNA GUARDIAN</title>", "<title>BLOCK-DNA GUARDIAN V7</title>");
  s = swap(s, JSON.stringify(TRIBUTE_ADDRESS), JSON.stringify(V7_TRIBUTE_ADDRESS));
  s = swap(s, JSON.stringify(TRIBUTE_SCRIPT), JSON.stringify(V7_TRIBUTE_SCRIPT));
  s = swap(s, `/content/${OLD_OCI}`, `/content/${LIVE_OCI_MODULE_ID}`);
  s = swap(s, "if(hh>=942000)return hh;", "");
  s = swap(s, "rank:ids.indexOf(SELF)+1,", "ids:ids,rank:ids.indexOf(SELF)+1,");
  s = swap(
    s,
    "LAND=land(txs,hash);VOX=blueprint(G);G.tr=traitsOf(G);",
    "LAND=land(txs,hash);mutate(G,blk);VOX=blueprint(G);extras(G,VOX);G.tr=traitsOf(G).concat(G.mx||[]);",
  );
  s = swap(s, "s=G.gait*(STANCE===1?2.4:1)", "s=G.gait*(STANCE===1?2.4:1)*(1+NB.o[2]*.6)");
  s = swap(
    s,
    "else if(pt===4){y+=Math.sin(t*1.6)*.18;x+=Math.sin(t*.7)*.15}",
    "else if(pt===4){y+=Math.sin(t*1.6)*.18+NB.o[1]*.5;x+=Math.sin(t*.7)*.15+NB.o[0]*.9}",
  );
  s = swap(s, "var t=(now-t0)/1000,pulse=(Math.sin(t*2.2)+1)/2;", "var t=(now-t0)/1000,pulse=(Math.sin(t*2.2)+1)/2;nstep(t);");
  s = swap(s, 'txt("STANCE "+STN[STANCE]', 'txt(NB.src,w-pad-small*11.5,pad+small*4.4,small*.7,"#3fe0d0",.7);txt("STANCE "+STN[STANCE]');
  s = swap(s, "FIRST-IS-FIRST BITMAP (OCI)", "FIRST-IS-FIRST BITMAP (LIVEOCI)");
  s = swap(s, "0 TO 6 TRAIT GUARDIANS", "0 TO 11 TRAIT GUARDIANS");
  s = swap(s, "bar();fit();requestAnimationFrame(frame);", V7_BLOCK + "bar();fit();requestAnimationFrame(frame);");
  cached = s;
  return s;
}
