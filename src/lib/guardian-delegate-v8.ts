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
  /* face mask bits: 1 top, 2 +z, 4 +x, 8 -z, 16 -x; voxels with no open face are skipped */
  var S=[],mx=0;for(i=0;i<B.length;i++){b=B[i];var X=b[0],Y=b[1],Z=b[2];if(X>mx)mx=X;if(Z>mx)mx=Z;
    var f=(occ[key(X,Y+1,Z)]?0:1)|(occ[key(X,Y,Z+1)]?0:2)|(occ[key(X+1,Y,Z)]?0:4)|(occ[key(X,Y,Z-1)]?0:8)|(occ[key(X-1,Y,Z)]?0:16);if(!f)continue;
    var ao=0;for(var dx=-1;dx<2;dx++)for(var dz=-1;dz<2;dz++)if((dx||dz)&&occ[key(X+dx,Y+1,Z+dz)])ao++;
    S.push([X,Y,Z,b[3],Math.max(.62,1-ao*.06),f])}
  return{s:S.slice(0,12000),span:SPN||(mx>63?128:64)}}
var CBM=null,SPN=0,IDR=/^[0-9a-f]{64}i\d+$/;
/* minimal CBOR (maps/strings/ints/bytes) for Tag 5 metadata, same as the Land Forge master */
function cbor(b){var i=0;function L(a){if(a<24)return a;if(a==24)return b[i++];if(a==25){i+=2;return b[i-2]<<8|b[i-1]}if(a==26){i+=4;return(b[i-4]<<24>>>0)+(b[i-3]<<16)+(b[i-2]<<8)+b[i-1]}return 0}
  function I(){var x=b[i++],t=x>>5,a=x&31,n,s,k,o;if(t==0)return L(a);if(t==1)return-1-L(a);
    if(t==2||t==3){if(a==31){s=t==3?"":[];while(b[i]!=255){var c=I();if(t==3)s+=c;else s=s.concat(c)}i++;return s}n=L(a);s=b.slice(i,i+n);i+=n;return t==3?new TextDecoder().decode(s):Array.from(s)}
    if(t==4){n=L(a);o=[];for(k=0;k<n;k++)o.push(I());return o}if(t==5){n=L(a);o={};for(k=0;k<n;k++){var key=I();o[key]=I()}return o}return null}return I()}
function metaOf(id){return t("/r/metadata/"+id).then(function(r){var h=String(JSON.parse(r)).replace(/[^0-9a-f]/gi,""),b=new Uint8Array(h.length/2);for(var k=0;k<b.length;k++)b[k]=parseInt(h.substr(k*2,2),16);return cbor(b)}).catch(function(){return null})}
function b64B(s){return unpackBWVX(atob(String(s).replace(/\s/g,"")))}
/* voxels of one inscribed piece: master-delegate metadata first, then self-rendering HTML */
function pieceOf(id){return metaOf(id).then(function(m){if(m&&/^BWVX/.test(m.f||"")&&(m.d||m.b))return b64B(m.d||m.b);
  return t("/content/"+id).then(function(h){var x=h.match(/<script id="bwvx"[^>]*>([A-Za-z0-9+\/=\s]*)<\/script>/);return x?b64B(x[1]):null})}).catch(function(){return null})}
function placeP(V,x,y,z,r,sp){if(!V||!V.length)return[];var mx=1e9,my=1e9,mz=1e9,k,o=[];for(k=0;k<V.length;k++){mx=Math.min(mx,V[k][0]);my=Math.min(my,V[k][1]);mz=Math.min(mz,V[k][2])}
  V=V.map(function(v){return[v[0]-mx,v[1]-my,v[2]-mz,v[3]]});for(var q=0;q<((r%4)+4)%4;q++){var X=0;for(k=0;k<V.length;k++)X=Math.max(X,V[k][0]);V=V.map(function(v){return[v[2],v[1],X-v[0],v[3]]})}
  for(k=0;k<V.length;k++){var p=[V[k][0]+x,V[k][1]+y,V[k][2]+z,V[k][3]];if(p[0]<sp&&p[1]<sp&&p[2]<sp)o.push(p)}return o}
/* one candidate reinscription → voxels, or null when it is not a Land Forge build */
function buildOf(id){return metaOf(id).then(function(m){if(m&&/^BWVX/.test(m.f||"")&&(m.d||m.b)&&!m.p)return b64B(m.d||m.b);
  return t("/content/"+id).then(function(h){if(h.length>120000)return null;var x=h.match(/<script id="bwvx"[^>]*>([A-Za-z0-9+\/=\s]*)<\/script>/);if(x)return b64B(x[1]);
    var a=h.match(/<script id="bwvx-asm"([^>]*)>([A-Za-z0-9+\/=\s]*)<\/script>/);if(!a)return null;
    var pm=a[1].match(/data-parts="([^"]*)"/),sm=a[1].match(/data-span="(\d+)"/),sp=sm&&+sm[1]==128?128:64;SPN=sp;
    var B=a[2].trim()?b64B(a[2]):[],segs=(pm?pm[1]:"").split(";").filter(Boolean).slice(0,32);
    return Promise.all(segs.map(function(sg){var s=sg.split("@"),n=(s[1]||"").split(",").map(Number);if(!IDR.test(s[0])||n.length<4)return[];
      return pieceOf(s[0]).then(function(V){return placeP(V,n[0],n[1],n[2],n[3],sp)})})).then(function(all){all.forEach(function(v){B=B.concat(v)});return B})})})}
function citadelLoad(tries){
  /* the BITMAP: the verified Tag 3 parent, else the canonical OCI id for this Guardian's block (Guardians inscribed under the root only) */
  var bm=BMP||BID||CBM;
  if(!bm){if(typeof G!=="undefined"&&G&&G.h!=null&&tries>=6){bitmapId(G.h).then(function(id){if(id&&IDR.test(id)){CBM=id;citadelLoad(tries+1)}}).catch(function(){});return}
    if(tries<120)setTimeout(function(){citadelLoad(tries+1)},500);return}
  /* same order the site verifies: sat's newest reinscription first, then older ones (max 8) */
  j("/r/inscription/"+bm).then(function(ins){if(!ins||ins.sat==null)throw 0;return j("/r/sat/"+ins.sat)})
  .then(function(r){var ids=((r&&r.ids)||[]).slice().reverse().filter(function(x){return x!==bm&&IDR.test(x)}).slice(0,8),k=0;
    (function next(){if(k>=ids.length)return;SPN=0;buildOf(ids[k++]).then(function(B){if(B&&B.length)CIT=citadelPrep(B);else next()})})()}).catch(function(){})}
function shade(h,f){var n=parseInt(h.slice(1),16);return"rgb("+[(n>>16)&255,(n>>8)&255,n&255].map(function(v){return Math.round(v*f)}).join(",")+")"}
var _dl8=drawLand;
/* full cubes for every exposed voxel (same look as the build's own on-chain viewer): faces facing the camera, painter-sorted each frame */
var CFACE=[[[0,1,0],[1,1,0],[1,1,1],[0,1,1],0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1],1,.8],[[1,0,0],[1,0,1],[1,1,1],[1,1,0],1,.62],[[0,0,0],[1,0,0],[1,1,0],[0,1,0],1,.7],[[0,0,0],[0,0,1],[0,1,1],[0,1,0],1,.55]];
drawLand=function(pulse){_dl8(pulse);if(!CIT||!LAND)return;var L=LAND,u=2*L.half/CIT.span,o=-L.half,i,k,S=CIT.s,Q=[];
  for(i=0;i<S.length;i++){var v=S[i],x=o+v[0]*u,z=o+v[2]*u,y=v[1]*u;Q.push([P3(x+u/2,y+u/2,z+u/2)[2],x,y,z,v])}
  Q.sort(function(p,q){return p[0]-q[0]});
  for(i=0;i<Q.length;i++){var w=Q[i],vv=w[4],c=CITP[vv[3]]||CITP[0];
    for(k=0;k<5;k++){if(!(vv[5]&(1<<k)))continue;var F=CFACE[k],cx=0,cy=0,cz=0,n;for(n=0;n<4;n++){cx+=F[n][0]/4;cy+=F[n][1]/4;cz+=F[n][2]/4}
      /* back faces: the face centre lies farther (smaller depth) than the cube centre */
      if(P3(w[1]+cx*u,w[2]+cy*u,w[3]+cz*u)[2]<w[0]-1e-9)continue;
      var pp=[F[0],F[1],F[2],F[3]].map(function(p){return P3(w[1]+p[0]*u,w[2]+p[1]*u,w[3]+p[2]*u)});
      poly(pp,shade(F[4]?c[1]:c[0],F[5]*(k?1:vv[4])))}}};
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
/* Silent Beacon (BW-BEACON-1): the holder publishes a BIP-352 silent payment
   address by inscribing a text child of this Guardian ("BW-BEACON-1 sp1…").
   Only the current holder can make a child, so the beacon is chain-proved.
   The sender's wallet derives a fresh one-time Taproot output; this page never
   derives keys or touches funds. Newest beacon child wins. */
var BEACON=null,BEACONST="SEARCHING";
function beaconLoad(){kids(SELF,200).then(function(ids){ids=ids.slice().reverse();var i=0;
  (function nx(){if(i>=ids.length||i>=40){BEACONST="NONE";return}var id=ids[i++];
    t("/content/"+id).then(function(s){var m=String(s).slice(0,400).match(/^\s*BW-BEACON-1\s+(sp1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{100,120}|bc1p[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58}|bc1q[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38})\s*$/);
      if(m){BEACON=m[1];BEACONST="LIVE"}else nx()}).catch(nx)})()}).catch(function(){BEACONST="UNREADABLE"})}
setTimeout(beaconLoad,1600);
tributeHud=function(w,h){var cbn=document.getElementById("bwcb");if(cbn)cbn.style.display=TRIBUTEON&&BEACON?"":"none";if(!TRIBUTEON)return;var fs=Math.max(11,Math.min(13,w*.016)),hs=fs+1.5,lh=fs*1.6,pad=Math.max(14,w*.035),
    pw=Math.min(w-pad*2,360),x=w-pw-pad,y=pad+fs*(w<520?7.4:5.2)+(PROOFON&&G?lh*7.6:0),L=[];
  if(BEACON){for(var k=0;k<BEACON.length;k+=Math.max(16,Math.floor(pw/(fs*.62))))L.push(BEACON.slice(k,k+Math.max(16,Math.floor(pw/(fs*.62)))))}
  var qs=BEACON?Math.min(150,pw*.5,h*.22):0;
  hudBox(x-10,y-hs*1.3,pw+20,hs*1.5+lh*(5+L.length)+(qs?qs+lh*.6:0),"#f7931a");
  txt("SILENT BEACON \u00B7 "+BEACONST,x,y,hs,"#f7931a");
  if(!BEACON){txt(BEACONST==="SEARCHING"?"READING THIS GUARDIAN'S CHILDREN\u2026":"THE HOLDER HAS NOT LIT A BEACON.",x,y+lh*1.2,fs,"#c5d0d9");
    txt("HOLDER: INSCRIBE A TEXT CHILD",x,y+lh*2.4,fs,"#ffffff");txt("\"BW-BEACON-1 sp1\u2026\"",x,y+lh*3.4,fs,"#3fe0d0");return}
  for(var i=0;i<L.length;i++)txt(L[i],x,y+lh*(i+1.2),fs,"#3fe0d0");
  var qy=y+lh*(L.length+.6);qrDraw(x,qy,qs);
  var yy=qy+qs+lh*1.1,sp=BEACON.slice(0,3)==="sp1";
  txt(sp?"SEND WITH A SILENT-PAYMENTS WALLET.":"PUBLIC BITCOIN ADDRESS.",x,yy,fs,"#ffffff");
  if(sp){txt("EACH TIP LANDS ON A NEW ONE-TIME ADDRESS,",x,yy+lh,fs,"#c5d0d9");txt("NOT LINKED TO THE HOLDER'S WALLET.",x,yy+lh*2,fs,"#c5d0d9")}
  else{txt("ANY WALLET CAN SEND. TIPS TO THIS ADDRESS",x,yy+lh,fs,"#c5d0d9");txt("ARE VISIBLE TO EVERYONE ON CHAIN.",x,yy+lh*2,fs,"#c5d0d9")}};
/* Micro QR (byte mode, ECC L, versions 1-9, mask 0) built in this page: no library, no network. */
function qrMake(s){var D=[],i,j;for(i=0;i<s.length;i++)D.push(s.charCodeAt(i)&255);
  var CAP=[0,19,34,55,80,108,136,156,194,232],ECN=[0,7,10,15,20,26,18,20,24,30],v=1;
  while(v<10&&4+8+D.length*8>CAP[v]*8)v++;if(v>9)return null;
  var bits=[],put=function(x,n){for(var k=n-1;k>=0;k--)bits.push((x>>k)&1)};put(4,4);put(D.length,8);for(i=0;i<D.length;i++)put(D[i],8);
  var cap=CAP[v]*8;put(0,Math.min(4,cap-bits.length));while(bits.length%8)bits.push(0);
  var dat=[];for(i=0;i<bits.length;i+=8){var b=0;for(j=0;j<8;j++)b=b<<1|bits[i+j];dat.push(b)}for(i=0;dat.length<CAP[v];i++)dat.push(i%2?17:236);
  var mul=function(x,y){var z=0;for(var k=7;k>=0;k--){z=(z<<1)^((z>>>7)*285);z^=((y>>>k)&1)*x}return z&255},n=ECN[v],dv=[],root=1;
  for(i=0;i<n;i++)dv.push(0);dv[n-1]=1;for(i=0;i<n;i++){for(j=0;j<n;j++){dv[j]=mul(dv[j],root);if(j+1<n)dv[j]^=dv[j+1]}root=mul(root,2)}
  var nb=v<6?1:2,bl=CAP[v]/nb,blocks=[],ecs=[];
  for(i=0;i<nb;i++){var blk=dat.slice(i*bl,(i+1)*bl),r=[];for(j=0;j<n;j++)r.push(0);
    blk.forEach(function(c){var f=c^r.shift();r.push(0);for(var k=0;k<n;k++)r[k]^=mul(dv[k],f)});blocks.push(blk);ecs.push(r)}
  var all=[];for(j=0;j<bl;j++)for(i=0;i<nb;i++)all.push(blocks[i][j]);for(j=0;j<n;j++)for(i=0;i<nb;i++)all.push(ecs[i][j]);
  var N=17+4*v,M=[],F=[];for(i=0;i<N;i++){M.push([]);F.push([]);for(j=0;j<N;j++){M[i].push(0);F[i].push(0)}}
  var set=function(x,y,d){if(x<0||y<0||x>=N||y>=N)return;M[y][x]=d?1:0;F[y][x]=1};
  for(i=0;i<N;i++){set(6,i,i%2==0);set(i,6,i%2==0)}
  [[3,3],[N-4,3],[3,N-4]].forEach(function(c){for(var dy=-4;dy<=4;dy++)for(var dx=-4;dx<=4;dx++){var dd=Math.max(Math.abs(dx),Math.abs(dy));set(c[0]+dx,c[1]+dy,dd!=2&&dd!=4)}});
  var AP=v<2?[]:v<7?[6,4*v+10]:[[6,22,38],[6,24,42],[6,26,46]][v-7],la=AP.length-1;
  for(i=0;i<=la;i++)for(j=0;j<=la;j++){if((!i&&!j)||(!i&&j==la)||(i==la&&!j))continue;for(var ay=-2;ay<=2;ay++)for(var ax=-2;ax<=2;ax++)set(AP[i]+ax,AP[j]+ay,Math.max(Math.abs(ax),Math.abs(ay))!=1)}
  var fmt=function(){var d=8,rem=d;for(var k=0;k<10;k++)rem=(rem<<1)^((rem>>>9)*0x537);var B=((d<<10)|rem)^0x5412,g2=function(q){return(B>>>q)&1};
    for(k=0;k<6;k++)set(8,k,g2(k));set(8,7,g2(6));set(8,8,g2(7));set(7,8,g2(8));for(k=9;k<15;k++)set(14-k,8,g2(k));
    for(k=0;k<8;k++)set(N-1-k,8,g2(k));for(k=8;k<15;k++)set(8,N-15+k,g2(k));set(8,N-8,1)};fmt();
  if(v>=7){var rv=v;for(i=0;i<12;i++)rv=(rv<<1)^((rv>>>11)*0x1F25);var VB=v<<12|rv;for(i=0;i<18;i++){var bt=(VB>>>i)&1,a=N-11+i%3,c=Math.floor(i/3);set(a,c,bt);set(c,a,bt)}}
  var bi=0;for(var right=N-1;right>=1;right-=2){if(right==6)right=5;for(var vt=0;vt<N;vt++)for(j=0;j<2;j++){var x=right-j,up=((right+1)&2)==0,y=up?N-1-vt:vt;
    if(!F[y][x]&&bi<all.length*8){M[y][x]=(all[bi>>>3]>>>(7-(bi&7)))&1;bi++}}}
  for(i=0;i<N;i++)for(j=0;j<N;j++)if(!F[i][j]&&(i+j)%2==0)M[i][j]^=1;return M}
var QRM=null,QRFOR="";
function qrDraw(x,y,sz){if(QRFOR!==BEACON){QRFOR=BEACON;QRM=BEACON?qrMake(BEACON):null}if(!QRM)return;var N=QRM.length,m=sz/(N+8);
  g.fillStyle="#ffffff";g.fillRect(x,y,sz,sz);g.fillStyle="#000000";
  for(var r=0;r<N;r++)for(var c=0;c<N;c++)if(QRM[r][c])g.fillRect(x+(c+4)*m,y+(r+4)*m,Math.ceil(m),Math.ceil(m))}
/* Sibling sentinels: every other child of the collection root stands on the far horizon as its own
   on-chain Guardian design — Tag 3 BITMAP parent (OCI first-is-first) -> block -> dnaOf/mutate/blueprint/extras,
   the same path every Guardian runs on itself (no BITMAP parent = the same RELIC body it shows itself).
   Lookups are bounded (2 at a time, 96 max), cached in memory and device-local storage (inscriptions and
   blocks never change); each design is baked once per 45° view into a small sprite. */
var SIBO={},SIBW={},SIBR={},SIBK={},SIBP=[],FOC=null,SIBD={},SIBQ=[],SIBA=0,SIBN=0,SIBB=0,OCIM=null;
function sibCache(id,v){var k="gv8sib1:"+id;try{if(v===undefined){var s=localStorage.getItem(k);return s?JSON.parse(s):null}localStorage.setItem(k,JSON.stringify(v))}catch(_){return null}}
function sibBlk(b){if(!b)return null;var o={},k,F=["hash","height","transaction_count","transactions","tx_count","n_tx","size","nonce","merkle_root","timestamp","time","weight","difficulty","version"];for(k=0;k<F.length;k++)if(b[F[k]]!=null)o[F[k]]=b[F[k]];return o}
function sibResolve(id){var c=sibCache(id);if(c)return Promise.resolve(c);
  return j("/r/parents/"+id).then(function(p){var ps=((p&&p.ids)||p||[]).filter(function(x){return x!=="9d1da99caec6afbf69b89bdafdc0a7ab679c6dd67920f7b38d3a3fd116d0e21fi0"}).slice(0,4),i=0;
    function nx(){if(i>=ps.length)return Promise.resolve({h:0,b:null});var pid=ps[i++];
      return t("/content/"+pid).then(function(body){var h=body.length<64?heightFrom(body):null;if(h===null)return nx();
        return (OCIM||(OCIM=import("/content/0c18b83ca6aa6f5653bb57dafb491ac786b7fa738b6c5190f4542d1d7f15c43ai0"))).then(function(o){return o.getBitmapInscriptionId(h)}).catch(function(){return pid})
          .then(function(cid){if(cid&&cid!==pid)return{h:0,b:null};return blockData(h).then(function(b){return{h:h,b:sibBlk(b)}})})},function(){return nx()})}
    return nx()}).then(function(r){sibCache(id,r);return r})}
function sibDesign(r){var blk=r.b,h=r.h,txs=(blk&&(blk.transaction_count||blk.transactions||blk.tx_count||blk.n_tx))||1,hash=(blk&&blk.hash)||String(h);
  var d=dnaOf(h,hash,txs,(blk&&blk.size)||900000);mutate(d,blk);var V=blueprint(d);extras(d,V);
  var ty=0,ex=0,i;for(i=0;i<V.length;i++){var v=V[i];ty=Math.max(ty,v[1]+v[4]/2);ex=Math.max(ex,Math.abs(v[0])+v[3]/2,Math.abs(v[2])+v[5]/2)}
  var k=Math.min(1.6,22/ty,14/ex);for(i=0;i<V.length;i++){var w=V[i];w[0]*=k;w[1]*=k;w[2]*=k;w[3]*=k;w[4]*=k;w[5]*=k}return{V:V,sp:{}}}
function sibPump(){while(SIBA<2&&SIBQ.length){var id=SIBQ.shift();SIBA++;(function(id){sibResolve(id).then(function(r){SIBR[id]=r;SIBD[id]=sibDesign(r)},function(){SIBD[id]=null})
  /* holder colour: live owner (never cached, Guardians trade) through the same bounded queue */
  .then(function(){return ownerOf(id).then(function(a){if(a){SIBO[id]=hexOf(a);SIBW[id]=a}})}).then(function(){SIBA--;sibPump()})})(id)}}
function sibWant(id){if(id in SIBD||SIBN>=96)return;SIBD[id]=0;SIBN++;SIBQ.push(id);sibPump()}
/* bake one design at one 45° yaw step into a 128px sprite, borrowing the main projection for the moment */
function sibBake(D,st){var cv=document.createElement("canvas");cv.width=cv.height=128;var sv=[g,OX,OY,SC,CY,SY,AR,XR],yw=st*Math.PI/4,i;
  g=cv.getContext("2d");AR=false;XR=false;CY=Math.cos(yw);SY=Math.sin(yw);SC=128/40;OX=64;OY=104;g.lineWidth=.5;
  var V=D.V.slice().sort(function(p,q){return P3(p[0],p[1],p[2])[2]-P3(q[0],q[1],q[2])[2]});
  try{for(i=0;i<V.length;i++)cube(V[i],V[i][6],V[i][7],0)}catch(_){}
  g.shadowBlur=0;g=sv[0];OX=sv[1];OY=sv[2];SC=sv[3];CY=sv[4];SY=sv[5];AR=sv[6];XR=sv[7];return cv}
var _dl8s=drawLand;drawLand=function(pulse){if(LAND&&COLL&&COLL.ids&&COLL.ids.length>1){var L=LAND,ids=COLL.ids,n=Math.min(96,ids.length),R=L.half*2.3,c0=P3(0,0,0)[2],far=[],i,
    tt=performance.now()/1000,hs=L.half*.07,st=((Math.round(Math.atan2(SY,CY)/(Math.PI/4))%8)+8)%8;SIBB=0;SIBP=[];
  for(i=0;i<n;i++){var id=ids[Math.floor(i*ids.length/n)];if(id===SELF)continue;var a=i/n*Math.PI*2,x=Math.cos(a)*R,z=Math.sin(a)*R;
    var dp=P3(x,0,z)[2];if(dp<c0){far.push([dp,x,z,id,i]);sibWant(id)}}
  far.sort(function(p,q){return p[0]-q[0]});g.lineWidth=.5;
  for(i=0;i<far.length;i++){var f=far[i],sid=String(f[3]),X=f[1],Z=f[2],D=SIBD[sid],bob=Math.sin(tt*1.2+f[4])*hs*.12;
    /* orange BITMAP ground; rim in the holder wallet's colour (grey until the owner is read) */
    cube([X,.15*hs,Z,2.6*hs,.3*hs,2.6*hs,"#f7931a",0,0,0],"#f7931a",0,pulse);
    var rc=SIBO[sid]||"#8a949c",rh=1.3*hs,ry=.3*hs+.01,foc=FOC===sid,kin=FOC&&!foc&&SIBO[sid]&&SIBO[sid]===SIBO[FOC];
    g.shadowColor=rc;g.shadowBlur=foc||kin?18+6*Math.sin(tt*4):SIBO[sid]?8:0;g.lineWidth=foc?3:kin?2.2:1.5;
    poly([P3(X-rh,ry,Z-rh),P3(X+rh,ry,Z-rh),P3(X+rh,ry,Z+rh),P3(X-rh,ry,Z+rh)],"rgba(0,0,0,0)",rc);g.shadowBlur=0;g.lineWidth=.5;
    var p0=P3(X,.3*hs+bob,Z),sw=40*(hs*4.5/22)*SC;SIBP.push([p0[0],p0[1]-sw*.35,Math.max(18,sw*.5),sid]);
    /* focus: a beam of the holder's colour rises from the chosen Guardian's ground */
    if(foc){var bt=P3(X,hs*14,Z),bw=Math.max(4,sw*.18),gr=g.createLinearGradient(0,p0[1],0,bt[1]);gr.addColorStop(0,rc);gr.addColorStop(1,"rgba(0,0,0,0)");
      g.globalAlpha=.45+.2*Math.sin(tt*3);g.fillStyle=gr;g.fillRect(p0[0]-bw/2,bt[1],bw,p0[1]-bt[1]);g.globalAlpha=1}
    if(!D)continue;
    if(!D.sp[st]&&SIBB<2){SIBB++;D.sp[st]=sibBake(D,st)}var sp=D.sp[st];if(!sp)continue;
    /* sprite: 40 design units across; designs stand ~4.5 sentinel units tall like the old figures; the focused one stands taller */
    var fz=foc?1.35:1;g.drawImage(sp,p0[0]-sw*fz/2,p0[1]-sw*fz*104/128,sw*fz,sw*fz)}
  g.shadowBlur=0}
  _dl8s(pulse)};
/* Swarm telemetry: how the collection is forming on chain (children of the root, in inscription order). */
swarmHud=function(w,h){if(!SWARMON)return;var fs=Math.max(11,Math.min(13,w*.016)),hs=fs+1.5,lh=fs*1.6,pad=Math.max(14,w*.035),
    pw=Math.min(w-pad*2,380),x=pad,y=pad+Math.max(8,Math.min(13,w*.016))*19+hs;
  if(!COLL||!COLL.ids){hudBox(x-10,y-hs*1.3,pw+20,hs*1.5+lh*1.6,"#3fe0d0");txt("COLLECTION FORMATION",x,y,hs,"#3fe0d0");txt("READING CHILDREN FROM THE CHAIN\u2026",x,y+lh*1.2,fs,"#c5d0d9");return}
  var ids=COLL.ids,n=ids.length,cols=25,cells=Math.min(n,500),rows=Math.max(1,Math.ceil(cells/cols)),cs=pw/cols,me=ids.indexOf(SELF),
    gh=rows*cs,ph=hs*1.5+lh*3.6+gh+lh*.6;if(y+ph>h-pad)y=Math.max(pad+hs,h-pad-ph);
  hudBox(x-10,y-hs*1.3,pw+20,ph,"#3fe0d0");
  txt("COLLECTION FORMATION \u00B7 ON CHAIN",x,y,hs,"#3fe0d0");
  txt(n+" GUARDIANS INSCRIBED"+(me>=0?" \u00B7 YOU #"+(me+1):""),x,y+lh*1.2,fs,"#ffffff");
  txt("LATEST "+String(ids[n-1]).slice(0,14)+"\u2026",x,y+lh*2.2,fs,"#c5d0d9");
  var gy=y+lh*2.9,tp=performance.now()/1000;
  for(var i=0;i<cells;i++){var k=n>500?Math.floor(i*n/500):i,cx=x+(i%cols)*cs,cy=gy+Math.floor(i/cols)*cs,mine=k===me,
      fresh=k>=n-5;g.globalAlpha=mine?.75+.25*Math.sin(tp*4):fresh?.95:.55;g.fillStyle=mine?"#f7931a":fresh?"#ffffff":sibHex(ids[k]);
    g.fillRect(cx+1,cy+1,cs-2,cs-2)}g.globalAlpha=1;
  txt(n>500?"ONE CELL \u2248 "+(n/500).toFixed(1)+" GUARDIANS \u00B7 WHITE = NEWEST 5":"ONE CELL = ONE GUARDIAN \u00B7 WHITE = NEWEST 5",x,gy+gh+lh*.9,fs*.9,"#c5d0d9")};
/* Explore the pack: tap a horizon Guardian to focus it. The card shows only what the chain says —
   its BITMAP parent (same first-is-first check as its own page), its live holder and how many
   children it has. Tap it again, press Esc or × to let it go. */
function focusSib(id){FOC=FOC===id?null:id;var fd=document.getElementById("bwfoc");if(fd){fd.style.display=FOC?"":"none";var a=fd.firstChild;if(FOC)a.href="/inscription/"+FOC}
  if(FOC&&!(FOC in SIBK)){SIBK[FOC]=-1;var cid=FOC;j("/r/children/"+cid).then(function(r){SIBK[cid]=((r&&r.ids)||[]).length+(r&&r.more?"+":"")},function(){SIBK[cid]=-2})}}
(function(){var fd=document.createElement("div"),oa=document.createElement("a"),xb=document.createElement("button");fd.id="bwfoc";fd.style.cssText="position:fixed;right:14px;bottom:64px;display:none;gap:6px;z-index:5";
  oa.textContent="OPEN ON CHAIN \u2197";oa.target="_blank";oa.rel="noopener";xb.textContent="\u00D7";
  [oa,xb].forEach(function(b){b.style.cssText="font:600 11px monospace;letter-spacing:.08em;padding:7px 10px;margin-left:6px;background:#04060a;color:#3fe0d0;border:1px solid #3fe0d0;text-decoration:none;cursor:pointer"});
  xb.onclick=function(e){e.stopPropagation();if(FOC)focusSib(FOC)};fd.appendChild(oa);fd.appendChild(xb);document.body.appendChild(fd);
  var dn=null;c.addEventListener("pointerdown",function(e){dn=[e.clientX,e.clientY];var h=sibHit(e);if(h){e.stopImmediatePropagation()}},true);
  c.addEventListener("pointerup",function(e){if(!dn||Math.abs(e.clientX-dn[0])+Math.abs(e.clientY-dn[1])>6){dn=null;return}dn=null;var h=sibHit(e);if(h){e.stopImmediatePropagation();e.stopPropagation();focusSib(h)}},true);
  addEventListener("keydown",function(e){if(e.key==="Escape"&&FOC)focusSib(FOC)})})();
function sibHit(e){var r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,best=null,bd=1e9;
  for(var i=0;i<SIBP.length;i++){var p=SIBP[i],d=Math.hypot(p[0]-x,p[1]-y);if(d<p[2]&&d<bd){bd=d;best=p[3]}}return best}
function focusHud(w,h){if(!FOC)return;var fs=Math.max(11,Math.min(13,w*.016)),hs=fs+1.5,lh=fs*1.6,pad=Math.max(14,w*.035),pw=Math.min(w-pad*2,330),
    x=w-pw-pad,R=SIBR[FOC],a=SIBW[FOC],col=SIBO[FOC]||"#8a949c",k=SIBK[FOC],kin=0,i;
  for(i in SIBO)if(i!==FOC&&SIBO[i]===SIBO[FOC])kin++;
  var rows=[["INSCRIPTION",String(FOC).slice(0,10)+"\u2026"+String(FOC).slice(-4),"#ffffff"],
    ["BITMAP",!R?"READING\u2026":R.h?R.h+".BITMAP":"NONE \u00B7 RELIC",R&&R.h?"#f7931a":"#c5d0d9"],
    ["HOLDER",a?a.slice(0,8)+"\u2026"+a.slice(-6):"READING\u2026",col],
    ["SAME HOLDER",a?kin?kin+" MORE IN VIEW":"ONLY ONE IN VIEW":"\u2026",kin?col:"#c5d0d9"],
    ["CHILDREN",k===undefined||k===-1?"READING\u2026":k===-2?"CHAIN UNREADABLE":k===0?"NONE YET":String(k),k>0||typeof k==="string"?"#3fe0d0":"#c5d0d9"]];
  if(R&&R.b&&R.b.transaction_count!=null)rows.splice(2,0,["PARCELS",String(R.b.transaction_count||R.b.tx_count)+" TX","#ffffff"]);
  var ph=hs*1.5+lh*(rows.length+.5),y=h-pad-64-ph+hs*1.3;
  hudBox(x-10,y-hs*1.3,pw+20,ph,col);txt("PACK MEMBER \u00B7 ON CHAIN",x,y,hs,col);
  for(i=0;i<rows.length;i++){var yy=y+lh*(i+1.1);txt(rows[i][0],x,yy,fs,"#c5d0d9");txt(rows[i][1],x+pw*.38,yy,fs,rows[i][2])}}
var _ch8f=chainHud;chainHud=function(w,h){_ch8f(w,h);focusHud(w,h)};
var LASTP="t";
/* narrow screens show one of TRIBUTE / SWARM at a time: the one opened last */
var _ch8=chainHud;chainHud=function(w,h){_ch8(w,h);var one=TRIBUTEON&&SWARMON&&w<900;
  if(!one||LASTP==="t")tributeHud(w,h);else{var cbn=document.getElementById("bwcb");if(cbn)cbn.style.display="none"}
  if(!one||LASTP==="s")swarmHud(w,h)};
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
  s = swap(s, "GTLON=true,", "GTLON=false,PROOFON=false,TRIBUTEON=false,SWARMON=false,tributeHud=function(){},swarmHud=function(){},");
  s = swap(s, 'tb=document.createElement("button");', 'tb=document.createElement("button"),pb=document.createElement("button"),rb=document.createElement("button"),cb=document.createElement("button"),sb=document.createElement("button");');
  s = swap(s, '"TIMELINE +"}', '"TIMELINE +";sb.textContent=SWARMON?"SWARM \u00D7":"SWARM +";pb.textContent=PROOFON?"PROOF \u00D7":"PROOF +";rb.textContent=TRIBUTEON?"TRIBUTE \u00D7":"TRIBUTE +";cb.textContent="COPY BEACON";cb.id="bwcb";cb.style.display=TRIBUTEON&&typeof BEACON!=="undefined"&&BEACON?"":"none"}');
  s = swap(s, "[mb,tb].forEach", "[mb,tb,sb,pb,rb,cb].forEach");
  s = swap(s, "GTLON=!GTLON;label()};", "GTLON=!GTLON;if(GTLON)SWARMON=false;label()};sb.onclick=function(e){e.stopPropagation();SWARMON=!SWARMON;if(SWARMON){GTLON=false;LASTP=\"s\"}label()};pb.onclick=function(e){e.stopPropagation();PROOFON=!PROOFON;label()};rb.onclick=function(e){e.stopPropagation();TRIBUTEON=!TRIBUTEON;if(TRIBUTEON)LASTP=\"t\";label()};cb.onclick=function(e){e.stopPropagation();try{navigator.clipboard.writeText(BEACON)}catch(_){}this.textContent=\"COPIED\"};");
  s = swap(s, "bar();fit();requestAnimationFrame(frame);", v8Block() + "bar();fit();requestAnimationFrame(frame);");
  cached = s;
  return s;
}

/** Byte size of the V8 page, for inscription cost checks. */
export function guardianV8ByteSize(): number {
  return new TextEncoder().encode(guardianMasterGeneratorHtmlV8()).length;
}
