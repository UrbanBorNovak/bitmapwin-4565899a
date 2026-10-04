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
  /* thermodynamics: proof-of-work difficulty sets the armour */
  var df=Number(blk.difficulty||0);G.df=df;G.wt=wt;
  if(df>0&&df<=1){G.th="CLAY";G.mx.push(["Thermodynamics","GENESIS CLAY \u00B7 CPU ERA"])}
  else if(df>1e12){G.th="TERA";G.mx.push(["Thermodynamics","TERAHASH SINGULARITY"])}
  /* mass: block weight decides wraith or titan */
  if(wt>0&&wt<50000){G.ms="WRAITH";G.mx.push(["Mass","EMPTY BLOCK WRAITH"])}
  else if(wt>3950000){G.ms="TITAN";G.mx.push(["Mass","MONOLITHIC TITAN"])}
  /* consensus crests: version bits or activation era */
  var ver=Number(blk.version||0);
  if(G.h>=709632||(G.h>=687221&&(ver&4))){G.tp=1;G.mx.push(["Consensus","TAPROOT SCHNORR CREST"])}
  else if(G.h>=481824||(ver&2&&G.h>=470000)){G.sw=1;G.mx.push(["Consensus","SEGWIT WITNESS FINS"])}
  /* super-zero: hash beat its own target by 2+ extra hex zeroes */
  var hs=String(blk.hash||""),lz=0;while(lz<hs.length&&hs.charAt(lz)==="0")lz++;
  if(df>0&&hs.length===64){var need=8+Math.floor(Math.log(df)/Math.log(16));if(lz>=need+2){G.lz=lz;G.mx.push(["Entropy","SUPER-ZERO SUPERNOVA \u00B7 "+lz+" ZEROES"])}}
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
  /* thermodynamic armour */
  var n0=V.length,bx=0,by=0,bz=0,bn=0,hzx=-1e9;
  for(i=0;i<n0;i++){if(V[i][8]===0){bx=Math.max(bx,Math.abs(V[i][0])+V[i][3]/2);by=Math.max(by,V[i][1]+V[i][4]/2);bz+=V[i][2];bn++}if(V[i][8]===4)hzx=Math.max(hzx,V[i][2]+V[i][5]/2)}
  bz=bn?bz/bn:0;
  if(G.th==="CLAY")for(i=0;i<n0;i++)if(V[i][8]===0){V[i][6]=i%2?"#c26d38":"#7a4220";V[i][7]=0}
  if(G.th==="TERA")for(i=0;i<n0;i++)if(V[i][8]===0&&i%2===0){V[i][6]=i%4?"#e8edf2":"#9aa3ab";V[i][7]=Math.max(V[i][7],.35)}
  /* mass */
  if(G.ms==="TITAN"){for(i=0;i<n0;i++)if(V[i][8]===0){V[i][0]*=1.25;V[i][3]*=1.25;V[i][5]*=1.1}
    for(i=-1;i<2;i+=2)V.push([i*(bx*1.25+.6),by*.85,bz,2.2,1.6,2.2,"#4a4f56",0,0,0])}
  if(G.ms==="WRAITH"){for(i=0;i<n0;i++){V[i][1]+=2;if(V[i][8]===0&&i%3===0){V[i][6]="#bff6ff";V[i][7]=.9}}
    for(i=0;i<10;i++){var m=i/10*Math.PI*2;V.push([Math.sin(m)*3,.6+(i%3)*.4,bz+Math.cos(m)*3,.4,.4,.4,"#3fe0d0",1.2,5,m])}}
  var lift=G.ms==="WRAITH"?2:0;
  /* consensus crests */
  if(G.tp&&hy>-1e9)for(i=0;i<5;i++)V.push([0,hy+lift+2.4+i*.55,hz,1.6-i*.3,.5,.4,i%2?"#ffd23a":"#ff7a1a",1.5,4,0]);
  if(G.sw)for(i=-1;i<2;i+=2)for(var k=0;k<3;k++)V.push([i*(bx+.4+k*.7),by+lift+.4-k*.3,bz-1-k*.9,.35,1.8-k*.4,1.1,"#3fe0d0",1.1,0,0]);
  /* super-zero laser eyes */
  if(G.lz&&hy>-1e9&&hzx>-1e9)for(i=-1;i<2;i+=2){V.push([i*.7,hy+lift-.6,hzx+4,.25,.25,8,"#3fe0d0",2,4,0]);V.push([i*.7,hy+lift-.6,hzx+.2,.55,.55,.55,"#ffd23a",2,4,0])}
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
  /* on-chain sky events: Blood Moon near a difficulty adjustment, lightning on new tip blocks, meteors at night */
  var bh=G?G.h:0,em=bh%2016,blood=bh>0&&(em>=1944||em<=72);
  if(blood){var bx=w*.78,by=h*.18,bg=g.createRadialGradient(bx,by,4,bx,by,90);bg.addColorStop(0,"rgba(200,30,30,.55)");bg.addColorStop(1,"rgba(120,10,10,0)");g.fillStyle=bg;g.fillRect(0,0,w,h*.6);
    g.fillStyle="#c81e1e";g.shadowColor="#ff3a2a";g.shadowBlur=40;g.beginPath();g.arc(bx,by,20,0,6.283);g.fill();g.shadowBlur=0;
    g.fillStyle="rgba(120,0,0,.08)";g.fillRect(0,0,w,h)}
  if(night>.05||blood){if(!MET||MET.t>1){if(Math.random()<(blood?.02:.006))MET={x:Math.random()*w,y:Math.random()*h*.3,t:0}}
    if(MET&&MET.t<=1){MET.t+=.03;var mx=MET.x-MET.t*w*.25,my=MET.y+MET.t*h*.15;g.strokeStyle="rgba(255,240,210,"+(1-MET.t)+")";g.lineWidth=2;g.beginPath();g.moveTo(mx,my);g.lineTo(mx+40,my-24);g.stroke()}}
  if(LT>0){var lx=LX*w,ly=0;g.strokeStyle="rgba(232,246,255,"+LT+")";g.lineWidth=2.5;g.shadowColor="#9fd8ff";g.shadowBlur=20;g.beginPath();g.moveTo(lx,ly);
    for(var j=1;j<9;j++){lx+=Math.sin(j*7.3+LX*50)*22;ly=j*h*.065;g.lineTo(lx,ly)}g.stroke();g.shadowBlur=0;g.fillStyle="rgba(220,235,255,"+LT*.25+")";g.fillRect(0,0,w,h);LT-=.06}
};
var LT=0,LX=.5,MET=null,TIP=0;
function strike(){LT=1;LX=.15+Math.random()*.7}
setInterval(function(){fetch("/r/blockheight").then(function(r){return r.text()}).then(function(t){var n=+t;if(n>0){if(TIP&&n!==TIP)strike();TIP=n}}).catch(function(){})},30000);
setInterval(function(){var bh=G?G.h:0,em=bh%2016;if(bh>0&&(em>=1944||em<=72)&&Math.random()<.5)strike()},9000);
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
/* ---------- 7g. extruded parcels: LiveOCI parent -> /r/children -> first-is-first {i}.{h}.bitmap ---------- */
var PARC=[],PSEL=null,BOWN=null,BID=null,BABY=null,PSCAN=0;
function hueOf(a){var h=h32("owner:"+a)%360;return "hsl("+h+",85%,58%)"}
function hexOf(a){var h=(h32("owner:"+a)%360)/360,s=.85,l=.58,q=l+s-l*s,p=2*l-q;function f(t){t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p}
  return "#"+[f(h+1/3),f(h),f(h-1/3)].map(function(v){return("0"+Math.round(v*255).toString(16)).slice(-2)}).join("")}
function kids(id,max){var out=[];function pg(n){return j("/r/children/"+id+"/"+n).then(function(r){out=out.concat(r.ids||[]);if(r.more&&out.length<max)return pg(n+1)})}
  return pg(0).then(function(){return out.slice(0,max)},function(){return out})}
function txt0(id){return fetch("/content/"+id).then(function(r){return r.ok?r.text():""}).catch(function(){return ""})}
function ownerOf(id){return j("/r/inscription/"+id).then(function(r){return r.address||String(r.satpoint||"").split(":")[0]||null}).catch(function(){return null})}
/* dynamic OCI: newest "OCI:<id>" child of the collection root wins; else LiveOCI alpha; else 942k OCI.
   Only the root's holder can add children, so the pointer cannot be hijacked. */
var OCI_ROOT="9d1da99caec6afbf69b89bdafdc0a7ab679c6dd67920f7b38d3a3fd116d0e21fi0",OCI_LIVE="0c18b83ca6aa6f5653bb57dafb491ac786b7fa738b6c5190f4542d1d7f15c43ai0",OCI_BASE="942b5886158d57fc70cb8fb7d9bd4d37aa95b8b145be1a351326336b087262dbi0";
function ociPtr(){var to=new Promise(function(r){setTimeout(function(){r(null)},1500)});
  var look=kids(OCI_ROOT,400).then(function(ids){ids=ids.slice(-40).reverse();var i=0;function nx(){if(i>=ids.length)return null;return txt0(ids[i++]).then(function(t){var m=/^\s*OCI:([0-9a-f]{64}i\d+)\s*$/.exec(t||"");return m?m[1]:nx()})}return nx()}).catch(function(){return null});
  return Promise.race([look,to])}
function viaOci(id,H){return import("/content/"+id).then(function(m){return m.getBitmapInscriptionId(H)}).then(function(b){if(!b)throw 0;return b})}
function bitmapId(H){return ociPtr().then(function(p){return p?viaOci(p,H):Promise.reject(0)})
  .catch(function(){return viaOci(OCI_LIVE,H)}).catch(function(){return viaOci(OCI_BASE,H)}).catch(function(){return null})}
function parcels(){if(!G||!LAND)return setTimeout(parcels,2000);if(PSCAN)return;PSCAN=1;var H=G.h,N=LAND.n;
  bitmapId(H).then(function(bid){
    if(!bid)return;BID=bid;ownerOf(bid).then(function(a){BOWN=a});
    return kids(bid,300).then(function(ids){var seen={},q=[];
      return Promise.all(ids.map(function(cid){return txt0(cid).then(function(t){var m=/^\s*(\d+)\.(\d+)\.bitmap\s*$/.exec(t||"");
        if(m&&+m[2]===H&&+m[1]<N)q.push([cid,+m[1]])})})).then(function(){
        /* children are served in inscription order: first-is-first wins each index */
        q.sort(function(a,b){return ids.indexOf(a[0])-ids.indexOf(b[0])});
        q.forEach(function(e){if(seen[e[1]])return;seen[e[1]]=1;var P={id:e[0],i:e[1],own:null,sp:0};PARC.push(P);
          ownerOf(e[0]).then(function(a){P.own=a});kids(e[0],60).then(function(k){P.sp=k.length})})})})}).catch(function(){})}
setTimeout(parcels,3000);
/* baby mode: a guardian whose Tag 3 parents include a valid parcel is its offspring */
setTimeout(function babyScan(){if(!G||MASTER)return G?0:setTimeout(babyScan,2500);
  j("/r/parents/"+SELF).then(function(r){var ps=r.ids||r.parents||[];return Promise.all(ps.map(function(pid){return txt0(pid).then(function(t){var m=/^\s*(\d+)\.(\d+)\.bitmap\s*$/.exec(t||"");if(m&&+m[2]===G.h)return{id:pid,i:+m[1]}})}))})
  .then(function(rs){var b=(rs||[]).filter(Boolean)[0];if(!b)return;BABY=b;ownerOf(b.id).then(function(a){BABY.own=a;
    var col=a?hexOf(a):G.accent;G.accent=col;
    if(VOX)for(var i=0;i<VOX.length;i++){var v=VOX[i];v[0]*=.58;v[1]*=.58;v[2]*=.58;v[3]*=.58;v[4]*=.58;v[5]*=.58;if(i%4===0)v[6]=mx(v[6],col,.5)}
    G.tr=(G.tr||[]).concat([["Generation","II \u00B7 OFFSPRING"],["Lineage","PARCEL #"+b.i+" SANCTUARY"],["Founder",a?a.slice(0,6)+"\u2026"+a.slice(-4):"UNKNOWN"]])})}).catch(function(){})},3500);
var _dl=drawLand;
drawLand=function(pulse){_dl(pulse);if(!LAND)return;var t=performance.now()/1000,L=LAND,list=[],own={};
  for(var i=0;i<PARC.length;i++)own[PARC[i].i]=1;
  /* uninscribed transactions: clear glass over the slab */
  g.shadowBlur=0;for(i=0;i<L.p.length;i++){if(own[i])continue;var q=L.p[i],x0=q[0],z0=q[1],w=q[2],gp=Math.min(.18,w*.08);
    poly([P3(x0+gp,.04,z0+gp),P3(x0+w-gp,.04,z0+gp),P3(x0+w-gp,.04,z0+w-gp),P3(x0+gp,.04,z0+w-gp)],"rgba(207,232,240,0.22)","rgba(233,248,255,0.45)")}
  for(i=0;i<PARC.length;i++){var P=PARC[i],q=L.p[P.i];if(!q)continue;var w=q[2],hgt=P.sp>=5?6:P.sp>0?1.2+Math.min(4,P.sp)*.58:1.2;
    if(P.sp>0)hgt*=1+Math.sin(t*1.4+i)*.04;var cx=q[0]+w/2,cz=q[1]+w/2;P.c=[cx,hgt,cz];
    list.push([P3(cx,hgt/2,cz)[2],[cx,hgt/2,cz,Math.max(.25,w*.82),hgt,Math.max(.25,w*.82)],P])}
  list.sort(function(a,b){return a[0]-b[0]});
  for(i=0;i<list.length;i++){var P=list[i][2],col=P.own?hexOf(P.own):"#f7931a",sel=PSEL===P,b=list[i][1];
    /* body is always Bitcoin orange; the holder colour is the glow + crown rim */
    var gl=sel?1.6:P.sp>=5?1.2:P.sp>0?.8:.5;cube(b,"#f7931a",0,0);
    var hx=b[3]/2,tp=b[1]+b[4]/2+.01;g.shadowColor=col;g.shadowBlur=14*gl*(1+pulse*.5);g.lineWidth=2;g.globalAlpha=.75+pulse*.25;
    poly([P3(b[0]-hx,tp,b[2]-hx),P3(b[0]+hx,tp,b[2]-hx),P3(b[0]+hx,tp,b[2]+hx),P3(b[0]-hx,tp,b[2]+hx)],"rgba(0,0,0,0)",col);g.globalAlpha=1;g.lineWidth=1;g.shadowBlur=0;
    if(P.sp>=5){var c=P.c;g.globalAlpha=.35+pulse*.3;g.strokeStyle=col;g.lineWidth=2;var a=P3(c[0],c[1],c[2]),b=P3(c[0],c[1]+40,c[2]);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
      var rg=[];for(var k=0;k<16;k++){var an=k/16*6.283+t;rg.push(P3(c[0]+Math.cos(an)*1.4,c[1]*.6,c[2]+Math.sin(an)*1.4))}poly(rg,"rgba(0,0,0,0)",col);g.globalAlpha=1;g.lineWidth=1}}
};
/* parcel HUD: tap a monolith */
var PH=document.createElement("div");PH.style.cssText="position:fixed;left:2.5%;bottom:14%;max-width:320px;font:10px ui-monospace,monospace;letter-spacing:.06em;color:#e9eef0;background:rgba(4,6,10,.82);border:1px solid #3fe0d055;padding:7px 9px;display:none;z-index:3;line-height:1.6";document.body.appendChild(PH);
function sh(a){return a?a.slice(0,6)+"\u2026"+a.slice(-4):"\u2026"}
function showP(P){PSEL=P;if(!P){PH.style.display="none";return}var col=P.own?hexOf(P.own):"#8a949c",lv=P.sp>=5?"MASTER SANCTUARY":P.sp>0?"SANCTUARY LV "+P.sp:"DORMANT";
  PH.innerHTML='<b style="color:'+col+'">PARCEL #'+P.i+"."+G.h+".BITMAP</b><br>HOLDER "+sh(P.own)+"<br>"+lv+" \u00B7 "+P.sp+" OFFSPRING<br>"+
  '<span style="color:#f7931a">SPAWN: INSCRIBE A CHILD OF THIS PARCEL + PAY 546 SATS TO BITMAP OWNER '+sh(BOWN)+"</span><br>"+
  '<button style="margin-top:4px;font:inherit;color:#f7931a;background:none;border:1px solid #f7931a77;padding:2px 6px;cursor:pointer">COPY PARCEL ID</button>';
  PH.style.display="block";PH.querySelector("button").onclick=function(e){e.stopPropagation();try{navigator.clipboard.writeText(P.id)}catch(_){}this.textContent="COPIED"}}
var pdn=null;c.addEventListener("pointerdown",function(e){pdn=[e.clientX,e.clientY]});
c.addEventListener("pointerup",function(e){if(!pdn||Math.abs(e.clientX-pdn[0])+Math.abs(e.clientY-pdn[1])>6)return;var r=c.getBoundingClientRect(),dpr=1,mxp=(e.clientX-r.left)*dpr,myp=(e.clientY-r.top)*dpr,best=null,bd=28*dpr;
  for(var i=0;i<PARC.length;i++){var P=PARC[i];if(!P.c)continue;var p=P3(P.c[0],P.c[1],P.c[2]),d=Math.hypot(p[0]-mxp,p[1]-myp);if(d<bd){bd=d;best=P}}showP(best)});
/* ---------- 7h. collection ticker: supply + last on-chain trade ----------
   Supply = children of the collection root. A trade = an item whose current
   satpoint txid differs from its reveal txid and whose spend pays output 0
   (the seller payout in a signed-PSBT sale) more than dust. Newest-minted
   traded item is scanned first; nothing is shown that the chain cannot prove. */
/* TRD: null = scanning, false = no proven sale, {sats,id} = last proven sale */
var TRD=null,TRDS=0;
function out0(raw){var x=String(raw).replace(/[^0-9a-f]/gi,"").toLowerCase(),p=8;if(x.length<20)return null;
  function b(n){var s=x.substr(p,n*2);p+=n*2;return s}
  function le(h){var v=0;for(var i=h.length-2;i>=0;i-=2)v=v*256+parseInt(h.substr(i,2),16);return v}
  function vi(){var f=parseInt(b(1),16);return f<253?f:le(b(f===253?2:f===254?4:8))}
  if(x.substr(8,4)==="0001")p+=4;var n=vi(),i;for(i=0;i<n;i++){b(36);b(vi());b(4)}
  n=vi();if(!(n>=2))return null;var v=le(b(8));return isFinite(v)?v:null}
/* SALES: every proven sale found, oldest-minted first; drives the running-total chart */
var SALES=[];
function tradeScan(){if(!COLL||!COLL.ids){if(TRDS===3)collection("9d1da99caec6afbf69b89bdafdc0a7ab679c6dd67920f7b38d3a3fd116d0e21fi0");if(TRDS++<20)setTimeout(tradeScan,1500);else TRD=false;return}
  var L=COLL.ids.slice(-80).reverse(),i=0;
  function nx(){if(i>=L.length){if(!TRD)TRD=false;return}var id=L[i++];
    return j("/r/inscription/"+id).then(function(r){var sp=String((r&&r.satpoint)||"").split(":")[0];
      if(!sp||sp===id.split("i")[0])return nx();
      return t("/r/tx/"+sp).then(function(raw){var v=out0(raw);if(typeof v==="number"&&v>1000){if(!TRD)TRD={sats:v,id:id};SALES.unshift(v)}return nx()})})
    .catch(function(){return nx()})}
  nx()}
setTimeout(tradeScan,2000);
/* on-chain typeface for every HUD label; plain monospace until it arrives */
try{var OCF=new FontFace("OCF","url(/content/f558af98ebf22b85a7de7ccd8943b2e27ad84de505d73b00a9041212b9643118i0)");OCF.load().then(function(f){document.fonts.add(f)}).catch(function(){})}catch(_){}
/* on-chain proof card: both Tag 3 parents, difficulty armour, block weight mass, consensus crests */
function fmtD(d){return d>=1e12?(d/1e12).toFixed(2)+"T":d>=1e9?(d/1e9).toFixed(2)+"G":d>=1e6?(d/1e6).toFixed(2)+"M":d>=1e3?(d/1e3).toFixed(1)+"K":String(Math.round(d))}
function chainHud(w,h){if(!G)return;
  var small=Math.max(8,Math.min(12,w*.015)),lh=small*1.45,pw=Math.min(w*.42,300),pad=Math.max(14,w*.035),x=w-pw-pad,y=pad+small*4.5;
  var arm=G.th==="CLAY"?"GENESIS CLAY":G.th==="TERA"?"TERAHASH ARMOUR":"FORGED STEEL";
  var ms=G.ms==="TITAN"?"TITAN":G.ms==="WRAITH"?"WRAITH":"STANDARD";
  var cr=[];if(G.tp)cr.push("TAPROOT");if(G.sw)cr.push("SEGWIT");if(G.lz)cr.push("SUPER-ZERO");
  var R=[["ON-CHAIN PROOF","","#f7931a"],
    ["PARENT 1",G.h+".BITMAP","#3fe0d0"],
    ["PARENT 2","ROOT 9d1da99c\u2026i0","#3fe0d0"],
    ["ARMOUR",arm+(G.df?" \u00B7 DIFF "+fmtD(G.df):""),"#e8eef2"],
    ["BLOCK WEIGHT",(G.wt?(G.wt/1e6).toFixed(2)+" MWU":"\u2026")+" \u00B7 "+ms,"#e8eef2"],
    ["CRESTS",cr.length?cr.join(" + "):"NONE (PRE-SEGWIT)",cr.length?"#f7931a":"#8a949c"]];
  g.globalAlpha=.55;g.fillStyle="#04060a";g.fillRect(x-8,y-small*1.2,pw+16,lh*R.length+small*.6);
  g.globalAlpha=.5;g.strokeStyle="#3fe0d0";g.lineWidth=1;g.strokeRect(x-8,y-small*1.2,pw+16,lh*R.length+small*.6);g.globalAlpha=1;
  for(var i=0;i<R.length;i++){var yy=y+i*lh;
    if(!R[i][1]){txt(R[i][0],x,yy,small*.85,R[i][2]);continue}
    txt(R[i][0],x,yy,small*.72,"#8a949c",.85);txt(R[i][1],x+pw*.36,yy,small*.8,R[i][2])}
}
function tickerHud(w,h){chainHud(w,h);
  var pad=Math.max(14,w*.035),small=Math.max(8,Math.min(13,w*.016)),y=pad+small*8.8;
  txt("LAST SALE \u00B7 "+(TRD&&typeof TRD.sats==="number"?TRD.sats.toLocaleString()+" SATS":TRD===false?"NO TRADES YET":"LOOKING\u2026"),pad,y,small*.8,"#f7931a",.9);
  var gw=Math.min(w*.32,220),gh=small*4,gx=pad,gy=y+small*1.2,k,tot=0,pts=[0];
  for(k=0;k<SALES.length;k++){tot+=SALES[k];pts.push(tot)}
  g.globalAlpha=.35;g.strokeStyle="#3fe0d0";g.lineWidth=1;g.beginPath();g.moveTo(gx,gy+gh);g.lineTo(gx+gw,gy+gh);g.stroke();g.globalAlpha=1;
  if(pts.length>1){var sx=gw/(pts.length-1),px,py;g.beginPath();g.moveTo(gx,gy+gh);
    for(k=0;k<pts.length;k++){px=gx+k*sx;py=gy+gh-pts[k]/tot*gh;if(k)g.lineTo(px,gy+gh-pts[k-1]/tot*gh);g.lineTo(px,py)}
    g.lineTo(gx+gw,gy+gh);g.closePath();var fg=g.createLinearGradient(0,gy,0,gy+gh);fg.addColorStop(0,"rgba(247,147,26,.45)");fg.addColorStop(1,"rgba(247,147,26,0)");g.fillStyle=fg;g.fill();
    g.beginPath();for(k=0;k<pts.length;k++){px=gx+k*sx;py=gy+gh-pts[k]/tot*gh;if(k)g.lineTo(px,gy+gh-pts[k-1]/tot*gh);else g.moveTo(px,py);g.lineTo(px,py)}
    g.strokeStyle="#f7931a";g.lineWidth=1.5;g.stroke()}
  txt("ALL SALES ADDED UP \u00B7 "+(tot?tot.toLocaleString()+" SATS":"WAITING FOR THE FIRST SALE"),pad,gy+gh+small*1.3,small*.75,"#3fe0d0",.85);
  if(typeof GMASTER!=="undefined"){var ch=G?G.h:"";
    if(GMASTER)txt("CURRENT GUARDIAN MASTER \u00B7 "+GMASTER.toUpperCase()+"."+ch+".BITMAP",pad,gy+gh+small*2.8,small*.85,"#f7931a",.95);
    else txt("GUARDIAN MASTER \u00B7 "+(SKFOR?"UNCLAIMED":"SCANNING\u2026"),pad,gy+gh+small*2.8,small*.75,"#8a949c",.7)}
}
/* ================= /V7 ================= */
`;

/* Master preview: featured multi-parcel blocks; RANDOM / B cycles them on the master only. */
const PREVIEW_BLOCK = `
var PVH=[715093,819245,347001,777777,208,969569],PVI=0;
function pvCycle(){PVI=(PVI+1)%PVH.length;var h=PVH[PVI];blockData(h).then(function(b){BID=null;build(h,b);PARC=[];PSEL=null;PSCAN=0;parcels()})}
var _stp=step;step=function(d){if(MASTER&&d===0)return pvCycle();_stp(d)};
window.addEventListener("keydown",function(e){if(MASTER&&e.key.toLowerCase()==="b")pvCycle()});
setTimeout(function(){if(!MASTER)return;var b=document.createElement("button");b.textContent="B \\u21BB NEXT BITMAP";
  b.style.cssText="position:fixed;right:2.5%;bottom:19%;font:10px ui-monospace,monospace;letter-spacing:.08em;color:#f7931a;background:rgba(4,6,10,.7);border:1px solid #f7931a77;padding:4px 7px;cursor:pointer;z-index:2";
  b.onclick=function(ev){ev.stopPropagation();pvCycle()};document.body.appendChild(b)},2500);
`;

/* Reinscription skin + Guardian Master: scans the BITMAP's sat; newest image skins the parcel
   tops, newest <name>.<height>.bitmap text names the current Guardian Master. */
const SKIN_BLOCK = `
var SKIN=null,SKFOR=null,GMASTER=null;
function skinScan(){setTimeout(skinScan,4000);if(!BID||BID===SKFOR)return;var bid=BID,bh=G?G.h:null;SKFOR=bid;SKIN=null;GMASTER=null;
  j("/r/inscription/"+bid).then(function(r){if(r.sat===undefined||r.sat===null)throw 0;return j("/r/sat/"+r.sat)})
  .then(function(body){var ids=((body&&body.ids)||[]).filter(function(x){return x!==bid}).slice(-8).reverse(),imgDone=false,nmDone=false;
    return ids.reduce(function(ch,id){return ch.then(function(){if(imgDone&&nmDone)return;
      return j("/r/inscription/"+id).then(function(m){var ct=String((m&&m.content_type)||"").toLowerCase();
        if(!imgDone&&ct.indexOf("image/")===0){imgDone=true;var im=new Image();im.onload=function(){if(SKFOR===bid)SKIN=im};im.src="/content/"+id;return}
        if(!nmDone&&ct.indexOf("text/plain")===0&&(m.content_length||0)<=256)return t("/content/"+id).then(function(tx){
          var mm=/^\\s*([a-z0-9][a-z0-9_-]{0,47})\\.(\\d+)\\.bitmap\\s*$/i.exec(tx||"");
          if(mm&&bh!==null&&+mm[2]===bh&&SKFOR===bid){nmDone=true;GMASTER=mm[1]}})}).catch(function(){})})},Promise.resolve())})
  .catch(function(){})}
setTimeout(skinScan,3500);
function skinTop(x0,z0,w,y){var L=LAND,s=L.half,iw=SKIN.naturalWidth,ih=SKIN.naturalHeight;
  var a=P3(x0,y,z0),b=P3(x0+w,y,z0),cc=P3(x0+w,y,z0+w),d=P3(x0,y,z0+w);
  var sx=(x0+s)/(2*s)*iw,sy=(z0+s)/(2*s)*ih,sw=w/(2*s)*iw,shh=w/(2*s)*ih;if(sw<=0||shh<=0)return;
  g.save();g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(cc[0],cc[1]);g.lineTo(d[0],d[1]);g.closePath();g.clip();
  var m11=(b[0]-a[0])/sw,m12=(b[1]-a[1])/sw,m21=(d[0]-a[0])/shh,m22=(d[1]-a[1])/shh;
  g.transform(m11,m12,m21,m22,a[0]-m11*sx-m21*sy,a[1]-m12*sx-m22*sy);
  g.drawImage(SKIN,sx,sy,sw,shh,sx,sy,sw,shh);g.restore()}
var _dl7=drawLand;
drawLand=function(pulse){_dl7(pulse);if(!SKIN||!LAND||!SKIN.naturalWidth)return;var L=LAND,own={},i,gp,s=L.half,raised=[];
  g.imageSmoothingEnabled=false;g.shadowBlur=0;
  for(i=0;i<PARC.length;i++)own[PARC[i].i]=PARC[i];
  /* one compound clip of every flat parcel top, then a single image draw across the whole block */
  g.save();g.beginPath();
  for(i=0;i<L.p.length;i++){var q=L.p[i],P=own[i];
    if(P&&P.c){raised.push([q,P]);continue}
    gp=Math.min(.18,q[2]*.08);var a=P3(q[0]+gp,.05,q[1]+gp),b=P3(q[0]+q[2]-gp,.05,q[1]+gp),c=P3(q[0]+q[2]-gp,.05,q[1]+q[2]-gp),d=P3(q[0]+gp,.05,q[1]+q[2]-gp);
    g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(c[0],c[1]);g.lineTo(d[0],d[1]);g.closePath()}
  g.clip();var iw=SKIN.naturalWidth,ih=SKIN.naturalHeight,A=P3(-s,.05,-s),B=P3(s,.05,-s),D=P3(-s,.05,s);
  g.transform((B[0]-A[0])/iw,(B[1]-A[1])/iw,(D[0]-A[0])/ih,(D[1]-A[1])/ih,A[0],A[1]);g.drawImage(SKIN,0,0);g.restore();
  for(i=0;i<raised.length;i++){var q2=raised[i][0],P2=raised[i][1],bw=Math.max(.25,q2[2]*.82),cx=q2[0]+q2[2]/2,cz=q2[1]+q2[2]/2;skinTop(cx-bw/2,cz-bw/2,bw,P2.c[1]+.02)}
  g.imageSmoothingEnabled=true};
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
  s = swap(s, "hud(W,H,pulse);requestAnimationFrame(frame)", "hud(W,H,pulse);tickerHud(W,H);requestAnimationFrame(frame)");
  // Friendly HUD words + on-chain typeface.
  s = swap(s, '" GUARDIANS INSCRIBED AS CHILDREN"', '" GUARDIANS BORN TO THE PACK"');
  s = swap(s, '"COLLECTION #"+COLL.rank+" OF "', '"PACK MEMBER #"+COLL.rank+" OF "');
  s = swap(s, '" IN COLLECTION"', '" IN THE PACK"');
  s = swap(s, 'txt("LATEST "+', 'txt("NEWEST GUARDIAN \\u00B7 "+');
  s = swap(s, 'g.font=size+"px ui-monospace,monospace"', 'g.font=size+"px OCF,ui-monospace,monospace"');
  // Architecture labels: V7 is the Tag 11 code delegate; the V6 root stays the Tag 3 collection parent.
  s = swap(s, '"COLLECTION PARENT \\u00B7 GENESIS PROGENITOR"', '"MASTER CODE DELEGATE V7 \\u00B7 ROOT 9d1da99c\\u2026"');
  s = swap(
    s,
    'txt("DNA "+G.dna+"  "+SELF.slice(0,16)+"\\u2026"',
    'txt("DNA "+G.dna+"  "+SELF.slice(0,16)+"\\u2026"+(MASTER?"":" \\u00B7 TAG 3 PARENTS: "+G.h+".BITMAP + ROOT 9d1da99c\\u2026 \\u00B7 TAG 11 DELEGATE V7")',
  );
  s = swap(s, 'LAND.n+" PARCELS \\u00B7', 'LAND.n+(LAND.n===1?" PARCEL":" PARCELS")+" \\u00B7');
  // Master preview stands on a featured multi-parcel BITMAP instead of the 1-tx genesis block.
  s = swap(s, "return blockData(0).then(function(blk){build(0,blk);", "return blockData(PVH[0]).then(function(blk){build(PVH[0],blk);");
  s = swap(s, "bar();fit();requestAnimationFrame(frame);", V7_BLOCK + PREVIEW_BLOCK + SKIN_BLOCK + "bar();fit();requestAnimationFrame(frame);");
  cached = s;
  return s;
}
