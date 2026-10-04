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
/** The original collection parent every Guardian stays under (V6 master, tag 3 parent). */
export const COLLECTION_ROOT_ID = "9d1da99caec6afbf69b89bdafdc0a7ab679c6dd67920f7b38d3a3fd116d0e21fi0";

/** Treasury the V7 generator checks the tribute against. */
export const V7_TRIBUTE_ADDRESS = "bc1qgunjcn7a7njky4xzj4ahj79cg6muzj4qg5pfpv";
/** P2WPKH output script of V7_TRIBUTE_ADDRESS (round-trip verified). */
export const V7_TRIBUTE_SCRIPT = "001447272c4fddf4e56254c2957b7978b846b7c14aa0";

const V7_BLOCK = String.raw`
/* ================= V7 ================= */
/* ---------- 7a. block mutations from /r/blockinfo ---------- */
var TAILS=["PLAIN","STINGER","MACE","FAN","ANCHOR"];
/* ---------- 7a'. inherited bitmap rarity: proven from the parent block height alone ---------- */
function isPrime(n){if(n<2)return false;if(n%2===0)return n===2;for(var d=3;d*d<=n;d+=2)if(n%d===0)return false;return true}
function isFib(n){var a=0,b=1;while(b<n){var c=a+b;a=b;b=c}return n===0||n===b}
function bmTraits(h,ts){var s=String(h),o=[],u=new Date(ts*1000);
  if(h===0)o.push(["Bitmap Tier","MYTHIC GENESIS"]);
  else if(h%210000===0)o.push(["Bitmap Tier","EPIC HALVING"]);
  else if(h%2016===0)o.push(["Bitmap Tier","RARE DIFFICULTY"]);
  if(s.length>1&&s===s.split("").reverse().join(""))o.push(["Numerology","PALINDROME"]);
  if(s.length>1&&/^(\d)\1+$/.test(s))o.push(["Numerology","SAME DIGITS"]);
  if(h>1&&/^[01]+$/.test(s))o.push(["Numerology","BINARY"]);
  if(h>=10&&/^10*$/.test(s))o.push(["Numerology","POWER OF 10"]);
  if(isFib(h)&&h>2)o.push(["Numerology","FIBONACCI"]);
  if(isPrime(h))o.push(["Numerology","PRIME"]);
  if(h===9)o.push(["Relic","BLOCK 9"]);if(h===78)o.push(["Relic","BLOCK 78 \u00B7 HAL"]);
  if(h===170)o.push(["Relic","FIRST TRANSACTION"]);if(h===57043)o.push(["Relic","PIZZA TRANSACTION"]);
  if(ts>0&&u.getUTCFullYear()===2010&&u.getUTCMonth()===4&&u.getUTCDate()===22)o.push(["Relic","PIZZA DAY"]);
  if(h>=660000&&h<=669999)o.push(["Club","66 DAO"]);
  var cl=h<10?"SUB-10":h<100?"SUB-100":h<1000?"SUB-1K":h<10000?"SUB-10K":h<100000?"SUB-100K":"";if(cl)o.push(["Club",cl]);
  return o}
function mutate(G,blk){
  G.mx=[];var ts0=blk?Number(blk.timestamp||blk.time||0):0,bt=bmTraits(G.h,ts0),i;
  for(i=0;i<bt.length;i++){G.mx.push(bt[i]);var v=bt[i][1];
    if(/EPIC|MYTHIC/.test(v))G.ep7=1;if(/RARE/.test(v))G.pr7=1;if(bt[i][0]==="Numerology")G.sg7=(G.sg7||0)+1;if(bt[i][0]==="Relic"||/SUB-1/.test(v))G.vt7=1}
  if(ts0>0){var mo=new Date(ts0*1000).getUTCMonth();if(mo===11||mo<2)G.au=1}
  if(G.ep7||G.pr7||G.sg7>1)G.au=1;
  if(!blk)return;
  var nonce=Number(blk.nonce),mr=String(blk.merkle_root||""),ts=ts0,wt=Number(blk.weight||0),sz=Number(blk.size||0);
  if(nonce>0&&nonce%21===0){G.gc=1;G.mx.push(["Crown","GOLDEN NONCE"])}
  if(mr.length>2&&parseInt(mr.slice(-2),16)<40){G.mr=1;G.mx.push(["Runes","MERKLE RUNES"])}
  if(ts>0){var hr=Math.floor((ts%86400)/3600);G.as=hr>=6&&hr<18?"SOLAR":"VOID";G.mx.push(["Aspect",G.as==="SOLAR"?"DAYBORN":"VOIDBORN"])}
  if(wt>0&&sz>0){G.dn=wt/(sz*4)>.9?"CARAPACE":"CHITIN";G.mx.push(["Density",G.dn==="CARAPACE"?"HEAVY CARAPACE":"CRYSTAL CHITIN"])}
  if(G.sh!=="serpent"&&G.sh!=="floater"){var tk=h32(G.dna+":tail:"+mr)%5;if(tk>0){G.tl=TAILS[tk];G.mx.push(["Tail",TAILS[tk]+" TAIL"])}}
  if(G.au)G.mx.push(["Sky","AURORA BOREALIS"]);
}
function extras(G,V){
  var hy=-1e9,hz=0,hn=0,tz=1e9,tx=0,ty=0,i;
  for(i=0;i<V.length;i++){var v=V[i];if(v[8]===4){hy=Math.max(hy,v[1]+v[4]/2);hz+=v[2];hn++}if(v[8]===3&&v[2]<tz){tz=v[2];tx=v[0];ty=v[1]}}
  hz=hn?hz/hn:0;
  /* inherited bitmap rarity visuals */
  if(G.ep7&&hy>-1e9)for(i=0;i<12;i++){var e=i/12*Math.PI*2;V.push([Math.sin(e)*3,hy+1.6+Math.abs(Math.sin(e*3))*1.4,hz+Math.cos(e)*3,.45,1.4,.45,i%2?"#ffd23a":"#ff7a1a",1.6,4,0])}
  if(G.pr7)for(i=0;i<V.length;i++)if(V[i][8]===0&&i%4===1){V[i][6]=["#7fe8ff","#c89bff","#9effd8"][i%3];V[i][7]=Math.max(V[i][7],.7)}
  if(G.sg7)for(i=0;i<8*G.sg7;i++){var q=i/(8*G.sg7)*Math.PI*2;V.push([Math.sin(q)*(6+G.sg7*2),9+(i%2)*.6,Math.cos(q)*(6+G.sg7*2),.35,.35,.35,"#3fe0d0",1.1,5,q])}
  if(G.vt7)for(i=0;i<V.length;i++)if(V[i][8]===0){if(i%3===0)V[i][6]="#4a4f56";else if(i%7===0){V[i][6]="#3fe0d0";V[i][7]=.8}}
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
/* ---------- 7d. living body: breathing + keeper bond growth ---------- */
var BS=1,BT=1,BOND=null;
var A0=anim;anim=function(v,tt,aw){var o=A0(v,tt,aw);if(!aw||!G)return o;o=o.slice();
  if(o[8]===0){var br=1+Math.sin(tt*1.7+o[2]*.15)*.03;o[3]*=br;o[5]*=br}
  if(o[8]===4&&Math.sin(tt*.9)>.995)o[4]*=.6;
  if(BS!==1)for(var q=0;q<6;q++)o[q]*=BS;return o};
function bond(){if(!G||MASTER||!AGE)return setTimeout(bond,3000);
  j("/r/inscription/"+SELF).then(function(r){var sp=String(r.satpoint||""),gt=SELF.split("i")[0],hh=Number(r.height);
    if(sp&&sp.indexOf(gt)!==0){BOND={n:"NEW KEEPER",a:0};BT=1;return}
    var a=hh>=0?Math.max(0,AGE.tip-hh):0;
    BOND=a>=10000?{n:"ANCIENT SOVEREIGN",a:a}:a>=1000?{n:"BONDED",a:a}:a>=144?{n:"SETTLED",a:a}:{n:"HATCHLING",a:a};
    BT=a>=10000?1.3:a>=1000?1.15:a>=144?1.05:1;
    if(a>=10000&&VOX)for(var i=0;i<10;i++)VOX.push([0,6+(i%3)*2,0,.5,.5,.5,"#ffd23a",1.5,5,i/10*6.283])
  }).catch(function(){BOND=null})}
setTimeout(bond,2500);
/* ---------- 7e. sky: real utc day/night, stars, aurora ---------- */
var STARS=[];(function(){var r=rng(h32("stars:"+SELF));for(var i=0;i<500;i++)STARS.push([r(),r()*.7,r()*1.4+.3,r()*6.28])})();
function lerpC(a,b,k){return "rgb("+[0,1,2].map(function(i){return Math.round(a[i]+(b[i]-a[i])*k)}).join(",")+")"}
backdrop=function(w,h){var now=performance.now()/1000,d=new Date(),hr=d.getUTCHours()+d.getUTCMinutes()/60,
    el=Math.sin((hr-6)/12*Math.PI),day=Math.max(0,el),night=Math.max(0,-el),dusk=Math.max(0,1-Math.abs(el)*3);
  BS+=(BT-BS)*.02;if(RC)yaw+=.021;
  var top=lerpC([3,5,12],[28,52,82],day),bot=lerpC([10,8,14],[120,70,30],Math.max(dusk,day*.5));
  var grd=g.createLinearGradient(0,0,0,h);grd.addColorStop(0,top);grd.addColorStop(1,bot);g.fillStyle=grd;g.fillRect(0,0,w,h);
  var sx=w*(.1+((hr+18)%24)/24*.8),sy=h*(.6-Math.abs(el)*.45);
  g.fillStyle=day>0?"#ffd890":"#dfe8f0";g.shadowColor=g.fillStyle;g.shadowBlur=30;g.beginPath();g.arc(sx,sy,day>0?18:12,0,6.283);g.fill();g.shadowBlur=0;
  if(night>.05){for(var i=0;i<STARS.length;i++){var s=STARS[i];g.globalAlpha=night*(.4+.6*Math.abs(Math.sin(now*1.3+s[3])));g.fillStyle="#fff";g.fillRect(s[0]*w,s[1]*h,s[2],s[2])}g.globalAlpha=1;
    if(G&&G.au)for(var k=0;k<3;k++){var ag=g.createLinearGradient(0,h*.08,0,h*.42);ag.addColorStop(0,"rgba(63,224,208,0)");ag.addColorStop(.5,k===1?"rgba(170,110,255,.5)":"rgba(63,224,208,.55)");ag.addColorStop(1,"rgba(63,224,208,0)");
      g.fillStyle=ag;g.globalAlpha=night*.45;for(var x=0;x<w;x+=5){var y=h*(.12+k*.05)+Math.sin(x*.006+now*.35+k*2)*h*.05+Math.sin(x*.017-now*.6)*h*.015;g.fillRect(x,y,5,h*.16+Math.sin(x*.01+now+k)*h*.04)}g.globalAlpha=1}}
};
/* ---------- 7f. 5s cinematic 360 video recorder ---------- */
var RC=null;
function rec(){if(RC||!c.captureStream||!window.MediaRecorder)return;var st=c.captureStream(60),mt=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"].filter(function(m){return MediaRecorder.isTypeSupported(m)})[0];
  if(!mt)return;var ch=[],mr=new MediaRecorder(st,{mimeType:mt,videoBitsPerSecond:8e6});RC=mr;
  mr.ondataavailable=function(e){if(e.data.size)ch.push(e.data)};
  mr.onstop=function(){RC=null;var b=new Blob(ch,{type:mt}),a=document.createElement("a");a.href=URL.createObjectURL(b);
    a.download=(G?G.h:"guardian")+"-guardian."+(mt.indexOf("mp4")>=0?"mp4":"webm");document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},800)};
  mr.start();act("roar");setTimeout(function(){mr.stop();st.getTracks().forEach(function(k){k.stop()})},5000)}
window.addEventListener("keydown",function(e){if(e.key.toLowerCase()==="v")rec()});
(function(){var b=document.createElement("button");b.textContent="V \u25CF REC 5S";
  b.style.cssText="position:fixed;right:2.5%;bottom:14%;font:10px ui-monospace,monospace;letter-spacing:.08em;color:#ff4a4a;background:rgba(4,6,10,.7);border:1px solid #ff4a4a77;padding:4px 7px;cursor:pointer;z-index:2";
  b.onclick=function(ev){ev.stopPropagation();rec()};document.body.appendChild(b)})();
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
  // Baked collection root: the master itself and any child without a second parent read the original collection.
  s = swap(s, "MASTER=true;collection(SELF);", `MASTER=true;collection(${JSON.stringify(COLLECTION_ROOT_ID)});`);
  s = swap(s, "if(root)collection(root);", `collection(root||${JSON.stringify(COLLECTION_ROOT_ID)});`);
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
