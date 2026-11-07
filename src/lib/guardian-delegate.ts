/**
 * The Block-DNA Guardian master generator, and the tiny delegate mints that use it.
 *
 * One single inscription carries the whole renderer. Every Guardian after that is
 * inscribed with an empty body plus two header tags:
 *
 *   tag 11 (delegate) -> this master generator
 *   tag  3 (parent)   -> the holder's `<height>.bitmap` (and the collection root)
 *
 * The child therefore costs almost nothing to inscribe, yet every explorer and
 * wallet renders it by serving the master's code. The master works out what to
 * draw entirely from recursive `ord` endpoints, with no server anywhere:
 *
 *   1. its own inscription id from `window.location.pathname`
 *   2. the reveal txid by slicing that id (no network call at all)
 *   3. its parents from `/r/parents/<id>`, the bitmap height from the parent's
 *      own content, cross-checked against `/r/blockheight`
 *   4. the 1,000-sat tribute from `/r/tx/<reveal txid>`, which must pay the
 *      BITMAPWIN treasury in output 1
 *
 * A Guardian with a valid bitmap parent and a paid tribute awakens in full
 * colour. Anything else renders as a cracked stone relic with the reason on it.
 */

/** Where a summon tribute must land for the creature to awaken. */
export const TRIBUTE_ADDRESS = "bc1qqmu6el7rxdc2va4kzqexhll6ulmrdkwmcdqkxd";
/** Minimum tribute, in sats, checked on chain by the master generator. */
export const TRIBUTE_SATS = 1000;
/** Output script of TRIBUTE_ADDRESS (P2WPKH), matched byte-for-byte in the raw reveal. */
export const TRIBUTE_SCRIPT = "001406f9acffc33370a676b610326bfffae7f636d9db";

/** Treasury the active V7 master checks the tribute against (new mints pay here). */
export const MINT_TRIBUTE_ADDRESS = "bc1qgunjcn7a7njky4xzj4ahj79cg6muzj4qg5pfpv";
/** Every tribute address any live master accepts (V7 first, then V6). */
export const ACCEPTED_TRIBUTE_ADDRESSES: readonly string[] = [MINT_TRIBUTE_ADDRESS, TRIBUTE_ADDRESS];

/** V6 master: still the Tag 3 collection root every Guardian is a child of. */
export const GUARDIAN_V6_MASTER_ID =
  "9d1da99caec6afbf69b89bdafdc0a7ab679c6dd67920f7b38d3a3fd116d0e21fi0";

/** Active master generator (Tag 11 delegate): V8 Three.js, inscription #127,831,725, block 974,766. */
export const GUARDIAN_MASTER_DELEGATE_ID =
  "a3a5a15e80460a794e452dc65ddce9bb289fc7dd1bd69ac47a7bd7b1fceca9b4i0";

/** V7 master (#127,517,786): earlier delegate, still accepted for existing Guardians. */
export const GUARDIAN_V7_MASTER_ID =
  "4bf943b16b00addd1d667dea9df048a05ad9146687893002cb21b2d0c075075di0";

/** Every generator Guardians may delegate to: the current one first, then older versions still on chain. */
export const GUARDIAN_MASTER_DELEGATE_IDS: readonly string[] = [
  GUARDIAN_MASTER_DELEGATE_ID,
  GUARDIAN_V7_MASTER_ID,
  GUARDIAN_V6_MASTER_ID,
  "cafa642afc2fd984beeae8648c46fbfdf45e8b4082ca6c057d29465f871573f5i0",
  "a44f4d01312f944260d59a770e08d63ac3d7c6c9c99177183b50c784837a8de1i0",
];

export const DELEGATE_CONTENT_TYPE = "text/html;charset=utf-8";

/**
 * The master generator source, inscribed once as a single self-contained page.
 * It takes no parameters: the same bytes render every Guardian, each one driven
 * by its own parents and its own reveal transaction.
 */
export function guardianMasterGeneratorHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>BLOCK-DNA GUARDIAN</title>
<style>
html,body{margin:0;height:100%;background:#04060a;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-user-select:none;user-select:none;touch-action:none}
#c{display:block;width:100%;height:100%}
#o{position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.34) 0 1px,rgba(0,0,0,0) 1px 3px);mix-blend-mode:multiply;opacity:.55}
#v{position:fixed;inset:0;pointer-events:none;box-shadow:inset 0 0 180px 60px #000}
</style></head><body>
<script type="application/json" id="traits">{}</script><canvas id="c"></canvas><div id="o"></div><div id="v"></div>
<script>
var TRIBUTE_TO=${JSON.stringify(TRIBUTE_ADDRESS)},TRIBUTE_SCRIPT=${JSON.stringify(TRIBUTE_SCRIPT)},TRIBUTE_MIN=${TRIBUTE_SATS};

/* ---------- 1. who am i, with zero network calls ---------- */
var SELF=(window.location.pathname.split("/").filter(Boolean).pop()||"");
var REVEAL=SELF.indexOf("i")>0?SELF.slice(0,SELF.lastIndexOf("i")):"";

/* in-browser previews (about:srcdoc) have no ord server: skip network instead of hitting the host page */
var OFFLINE=window.location.protocol==="about:"||!/^[0-9a-f]{64}i\\d+$/.test(SELF);
if(OFFLINE){var _f=window.fetch;window.fetch=function(u){return /^\\/(r|content)\\//.test(String(u))?Promise.reject(new Error("offline preview")):_f.apply(this,arguments)}}
function j(u){return fetch(u).then(function(r){if(!r.ok)throw 0;return r.json()})}
function t(u){return fetch(u).then(function(r){if(!r.ok)throw 0;return r.text()})}

/* ---------- 2. the bitmap parent, verified against the chain ---------- */
function heightFrom(s){var m=/(\\d{1,7})\\.bitmap/i.exec(s||"");return m?parseInt(m[1],10):null}
var PIDS=[],BMP=null,COLL=null,CANON=null,DUPE=false;
function parentHeight(){
  return j("/r/parents/"+SELF).then(function(p){
    var ids=(p&&p.ids)||p||[];
    PIDS=ids;
    /* no parents at all: this is the collection root (the master itself) */
    if(!ids.length)return -1;
    return ids.reduce(function(chain,id){
      return chain.then(function(found){
        if(found!==null)return found;
        return t("/content/"+id).then(function(body){
          var h=heightFrom(body);
          if(h===null)return null;
          BMP=id;
          /* a bitmap can only claim a block that exists */
          return t("/r/blockheight").then(function(tip){
            return h<=parseInt(tip,10)?h:null;
          },function(){return h}).then(function(hh){
            if(hh===null)return null;
            /* first-is-first: compare against the on-chain bitmap index (OCI) module */
            return import("/content/942b5886158d57fc70cb8fb7d9bd4d37aa95b8b145be1a351326336b087262dbi0").then(function(oci){
              if(hh>=942000)return hh;
              return oci.getBitmapInscriptionId(hh).then(function(cid){
                if(cid){CANON=(cid===id);if(!CANON)DUPE=true}
                return CANON===false?null:hh;
              });
            }).catch(function(){return hh});
          });
        },function(){return null});
      });
    },Promise.resolve(null));
  });
}

/* ---------- 2b. live collection analytics from /r/children (paged) ---------- */
function kids(id){
  var all=[];
  function page(n){
    return j("/r/children/"+id+"/"+n).then(function(r){
      all=all.concat((r&&r.ids)||[]);
      return r&&r.more&&n<200?page(n+1):all;
    },function(){return all});
  }
  return page(0);
}
function collection(root){
  return kids(root).then(function(ids){
    COLL={n:ids.length,rank:ids.indexOf(SELF)+1,last:ids.length?ids[ids.length-1]:""};
  },function(){});
}

/* ---------- 3. the tribute, read straight off the reveal transaction ---------- */
function tribute(){
  if(!REVEAL)return Promise.resolve(false);
  /* /r/tx/ serves the raw transaction as a hex string: walk its outputs */
  return t("/r/tx/"+REVEAL).then(function(raw){
    var x=String(raw).replace(/[^0-9a-f]/gi,"").toLowerCase(),p=8;
    if(x.length<20)return null;
    function b(n){var s=x.substr(p,n*2);p+=n*2;return s}
    function le(h){var v=0,i;for(i=h.length-2;i>=0;i-=2)v=v*256+parseInt(h.substr(i,2),16);return v}
    function vi(){var f=parseInt(b(1),16);return f<253?f:le(b(f===253?2:f===254?4:8))}
    if(x.substr(8,4)==="0001")p+=4;
    var n=vi(),i;for(i=0;i<n;i++){b(36);b(vi());b(4)}
    n=vi();for(i=0;i<n;i++){var v=le(b(8)),spk=b(vi());if(spk===TRIBUTE_SCRIPT&&v>=TRIBUTE_MIN)return true}
    return false;
  },function(){return null}); /* null = could not read, not a failure */
}

/* ---------- 4. block dna -> creature, the same maths as bitmapwin ---------- */
function h32(s){var h=2166136261,i;for(i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){var s=seed>>>0;return function(){s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296}}
var SHAPES=["quadruped","hexapod","serpent","biped","avian","floater","arachnid","centaur"];
var NAME_A=["VOID","SOLAR","OBSIDIAN","GLASS","CYBER","ORPHAN","EMBER","FROST","IRON","HOLLOW"];
var NAME_B=["WYRM","GRYPHON","BEHEMOTH","PHANTOM","RAM","LEVIATHAN","SENTINEL","STALKER","WARDEN","SERAPH"];
function dnaOf(height,hash,txs,size){
  var r=rng(h32(hash+":"+height));
  var pick=function(a){return a[Math.floor(r()*a.length)]};
  var score=r();
  var rarity=score>.97?"MYTHIC":score>.88?"EPIC":score>.65?"RARE":"COMMON";
  var hue=Math.floor(r()*360),hue2=(hue+90+Math.floor(r()*120))%360;
  return {h:height,sh:pick(SHAPES),ra:rarity,ep:Math.floor(height/210000),
    nm:pick(NAME_A)+" "+pick(NAME_B),
    hp:40+Math.floor(r()*60)+Math.min(40,Math.floor(txs/120)),
    bi:12+Math.floor(r()*40),sd:10+Math.floor(r()*40),ar:8+Math.floor(r()*40),
    lv:1+Math.floor(Math.min(20,Math.log2(1+txs)*2)),
    body:"hsl("+hue+",62%,46%)",accent:"hsl("+hue2+",88%,58%)",
    seg:Math.max(3,Math.min(7,3+Math.floor(txs/900))),
    bulk:Math.max(.85,Math.min(1.35,.85+size/3000000)),
    horn:Math.floor(r()*4),wing:r()>.7,spine:r()>.5,pat:r()>.4,gait:.7+r()*.6,
    dna:h32(hash).toString(16)};
}

/* ---------- 4b. punk-style traits: every optional mutation the body really renders ---------- */
var HORNS=["SHORT HORNS","CURVED TUSKS","ANTLERS","CROWN CREST"];
function traitsOf(G){
  var t=[["Horns",HORNS[G.horn]]];
  if(G.wing||G.sh==="avian"||G.sh==="floater")t.push(["Wings","AETHER WINGS"]);
  if(G.spine)t.push(["Spines","SPINED RIDGE"]);
  if(G.pat)t.push(["Markings","GLOWING RUNES"]);
  if(G.ra!=="COMMON")t.push(["Aura","ORBITING MOTES"]);
  if(G.ra==="MYTHIC")t.push(["Halo","SATOSHI CROWN"]);
  if(G.seg>=6)t.push(["Plating","HEAVY CARAPACE"]);
  return t;
}
function publish(G,n){
  var tr=G.tr,a=[{trait_type:"Trait Count",value:(tr.length-1)+" Traits"},
    {trait_type:"Body",value:G.sh.toUpperCase()},{trait_type:"Rarity",value:G.ra},
    {trait_type:"Epoch",value:G.ep},{trait_type:"Level",value:G.lv},{trait_type:"Parcels",value:n}],i;
  for(i=0;i<tr.length;i++)a.push({trait_type:tr[i][0],value:tr[i][1]});
  var el=document.getElementById("traits");
  if(el)el.textContent=JSON.stringify({name:G.nm+" \\u00B7 "+G.h+".bitmap",attributes:a});
  document.title=G.nm+" \\u00B7 "+(tr.length-1)+"-TRAIT \\u00B7 "+G.h+".BITMAP";
}

/* ---------- 5. voxel blueprint ---------- */
function mix(a,b,k){
  function rgb(x){var d=document.createElement("canvas").getContext("2d");d.fillStyle=x;x=d.fillStyle;
    if(x[0]==="#")return[parseInt(x.substr(1,2),16),parseInt(x.substr(3,2),16),parseInt(x.substr(5,2),16)];
    var m=x.match(/\\d+/g);return[+m[0],+m[1],+m[2]]}
  var A=rgb(a),B=rgb(b),o=[],i;for(i=0;i<3;i++)o.push(Math.round(A[i]+(B[i]-A[i])*k));
  return "rgb("+o.join(",")+")";
}
/* every voxel: [x,y,z,w,h,d,colour,glow,part,phase]
   part 0 body · 1 leg · 2 wing · 3 tail · 4 head · 5 mote */
function blueprint(G){
  var BODY=G.body,ACC=G.accent,DARK=mix(BODY,"#000000",.55),LIGHT=mix(BODY,"#ffffff",.26),MID=mix(BODY,ACC,.25),BONE=mix(LIGHT,"#ffffff",.35);
  var V=[],p=G.sh,b=G.bulk,r=rng(h32(G.dna+":anat")),i,k;
  function box(x,y,z,w,h,d,c,g,pt,ph){V.push([x,y,z,w*b,h,d*b,c,g||0,pt||0,ph||0])}
  function sym(x,y,z,w,h,d,c,g,pt,ph){box(x,y,z,w,h,d,c,g,pt,ph);box(-x,y,z,w,h,d,c,g,pt,(ph||0)+Math.PI)}
  var up=p==="biped"||p==="avian",low=p==="arachnid",serp=p==="serpent",fl=p==="floater";
  var LEG=serp||fl?0:low?3.2:up?6.5:4.8,seg=serp?G.seg+4:up?2:p==="hexapod"?4:G.seg>4?4:3;
  var BY=fl?9:serp?2.2:LEG+2.4,SW=up?4.6:low?6.4:5.6,SH=up?5.4:low?3.4:4.6,SL=serp?3:up?3.2:3.6;
  var front=0;
  /* torso: tapered armoured segments with dorsal plates and flank bands */
  for(i=0;i<seg;i++){var tp=serp?1-i/(seg*1.6):1-Math.abs(i-(seg-1)/2)/(seg*1.4),z=serp?-i*SL*.9:(i-(seg-1)/2)*SL;
    var y=up?BY+i*SH*.82:BY+(serp?Math.sin(i*.9)*.6:0),zz=up?0:z;
    box(0,y,zz,SW*tp,SH*tp,up?SW*.8:SL,i%2?MID:BODY,0,serp?3:0,i*.7);
    box(0,y+SH*tp*.5,zz,SW*tp*.7,.7,up?SW*.5:SL*.8,i%2?LIGHT:ACC,i%2?0:.35,serp?3:0,i*.7);
    sym(SW*tp*.52,y,zz,.5,SH*tp*.6,up?SW*.5:SL*.6,DARK,0,serp?3:0,i*.7);
    if(G.pat&&i%2===0)sym(SW*tp*.53,y+.4,zz,.2,.6,SL*.5,ACC,.8,serp?3:0,i*.7);
    if(!up&&!serp&&(G.spine||i===0))box(0,y+SH*tp*.5+1,zz,.8,1.6,.8,ACC,.5);
    if(up)front=SW*.4;else front=Math.max(front,zz+SL/2)}
  if(serp)front=SL/2;
  var topY=up?BY+(seg-1)*SH*.82+SH*.5:BY;
  /* head: skull, brow, jaw, snout, glowing eyes, horns */
  var HY=up?topY+2.6:BY+SH*.35,HZ=up?.6:front+2.2,HS=up?4:3.8;
  box(0,HY,HZ,HS,HS*.85,HS,BODY,0,4);
  box(0,HY+HS*.42,HZ+.2,HS*1.05,.7,HS*.8,DARK,0,4);
  box(0,HY-HS*.38,HZ+.6,HS*.8,1,HS*.9,DARK,0,4);
  box(0,HY-.4,HZ+HS*.62,HS*.6,HS*.45,1.4,LIGHT,0,4);
  sym(HS*.26,HY+.35,HZ+HS*.5,.8,.5,.3,ACC,1.2,4);
  sym(HS*.2,HY-HS*.55,HZ+HS*.7,.35,.8,.35,BONE,0,4);
  var horn=G.horn;
  for(k=0;k<(horn===3?5:2);k++){
    if(horn===0)sym(HS*.35,HY+HS*.7+k*.9,HZ-.3-k*.5,.7,1.2,.7,BONE,0,4);
    else if(horn===1)sym(HS*.55+k*.7,HY+HS*.5+k*.8,HZ-k*.9,.8,.8,1.3,BONE,0,4);
    else if(horn===2){sym(HS*.4+k*.6,HY+HS*.6+k*1.3,HZ-.4,.5,1.5,.5,BONE,0,4);sym(HS*.4+k*1.3,HY+HS*.6+k*1.3+.6,HZ-.4,1.2,.4,.4,BONE,0,4)}
    else box((k-2)*.9,HY+HS*.62+(k%2?.4:.9),HZ,.6,1.2+(k===2?1:0),.6,ACC,.7,4)}
  /* legs: thigh, shin, joint, clawed foot */
  var nl=p==="hexapod"?6:low?8:p==="quadruped"||p==="centaur"?4:up?2:0;
  for(i=0;i<nl/2;i++){var lz=up?0:nl===2?0:-((seg-1)/2*SL)+i*((seg-1)*SL)/Math.max(1,nl/2-1),lx=low?SW*.5+2.2:SW*.36,ph=i*1.6;
    sym(lx,LEG*.72,lz,1.8,LEG*.5,1.9,BODY,0,1,ph);
    sym(lx+(low?1:0),LEG*.42,lz,.9,.9,.9,mix(ACC,"#000000",.2),.3,1,ph);
    sym(lx+(low?1.6:0),LEG*.22,lz+.2,1.3,LEG*.42,1.3,MID,0,1,ph);
    sym(lx+(low?1.6:0),.35,lz+.6,2.1,.7,2.6,DARK,0,1,ph);
    for(k=-1;k<2;k++)sym(lx+(low?1.6:0)+k*.6,.25,lz+2,.35,.4,.7,BONE,0,1,ph)}
  if(up){/* arms */
    sym(SW*.7,topY-1.4,0,1.5,3.4,1.5,BODY,0,1,.5);sym(SW*.7,topY-3.8,.4,1.2,2.6,1.2,MID,0,1,.5);sym(SW*.7,topY-5.3,.7,1.6,.9,1.6,BONE,0,1,.5)}
  if(p==="centaur"){/* upright rider torso over the front */
    box(0,BY+SH*.5+3,front-1.5,4.2,5,3.4,BODY);box(0,BY+SH*.5+5.4,front-1.5,4.4,.8,3.6,ACC,.3);HY+=0}
  /* wings: shoulder, arm bone, layered feathers */
  if(G.wing||p==="avian"||fl){var wy=up?topY-.6:BY+SH*.6,wz=up?-1.2:0;
    for(i=0;i<5;i++)sym(SW*.5+1.2+i*1.9,wy+1-i*.3,wz-i*.6,2.2,.45,3.4-i*.35,i%2?LIGHT:BODY,i===4?.4:0,2,i*.2);
    sym(SW*.5+5,wy+1.4,wz+.6,8,.6,.6,BONE,0,2,.1)}
  /* tail: tapering segments */
  if(!serp&&!fl){var tz=up?-SW*.5:-((seg-1)/2*SL)-SL/2;
    for(i=0;i<5;i++)box(0,(up?BY:BY+.4)+i*.25,tz-1-i*1.7,1.8-i*.25,1.6-i*.2,1.9,i===4?ACC:i%2?MID:BODY,i===4?.6:0,3,i*.8)}
  if(fl){for(i=0;i<4;i++)box(0,BY-3-i*1.4,0,2.2-i*.4,1.2,2.2-i*.4,i%2?ACC:MID,.4+i*.1,3,i)}
  /* rarity aura motes */
  var pts=G.ra==="MYTHIC"?10:G.ra==="EPIC"?7:G.ra==="RARE"?4:0,mt=(up?topY+5:BY+SH+5);
  for(i=0;i<pts;i++){var an=i/pts*Math.PI*2;box(Math.sin(an)*9,mt+Math.sin(i)*1.5,Math.cos(an)*9,.7,.7,.7,ACC,1.2,5,an)}
  if(G.ra==="MYTHIC")for(i=0;i<12;i++){var a2=i/12*Math.PI*2;box(Math.sin(a2)*2.6,HY+HS+1.6,HZ+Math.cos(a2)*2.6,.5,.3,.5,"#f7931a",1.4,4)}
  return V;
}
/* animated position of a voxel at time t */
function anim(v,t,awake){
  if(!awake)return v;
  var x=v[0],y=v[1],z=v[2],pt=v[8],ph=v[9],s=G.gait*(STANCE===1?2.4:1),ak=ACT?Math.max(0,1-(t-ACT.t)/0.9):0;
  if(pt===1){y+=Math.max(0,Math.sin(t*s*4+ph))*.5;z+=Math.sin(t*s*4+ph)*.6}
  else if(pt===2){var f=Math.sin(t*s*5+ph)*.42;y+=Math.abs(x)*f*.5}
  else if(pt===3){x+=Math.sin(t*s*2.2-ph)*(.25+ph*.18)}
  else if(pt===4){y+=Math.sin(t*1.6)*.18;x+=Math.sin(t*.7)*.15}
  else if(pt===5){var a=ph+t*.6,rr=9+Math.sin(t+ph)*.8;x=Math.sin(a)*rr;z=Math.cos(a)*rr;y+=Math.sin(t*2+ph)*.6}
  if(ak>0&&ACT.k==="strike"&&(pt===4||pt===1))z+=Math.sin(ak*Math.PI)*4;
  if(ak>0&&ACT.k==="roar"&&pt===4){y+=Math.sin(ak*Math.PI)*1.6;x+=Math.sin(t*60)*.25*ak}
  if(pt!==5)y+=Math.sin(t*2)*.12*(y/10)+(G.sh==="floater"?Math.sin(t*1.3)*.8:0);
  return[x,y,z,v[3],v[4],v[5],v[6],v[7]];
}

/* ---------- 6. painter: free orbit (yaw + pitch), culled, outlined voxels ---------- */
var c=document.getElementById("c"),g=c.getContext("2d"),W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1);
function fit(){W=c.clientWidth;H=c.clientHeight;c.width=W*DPR;c.height=H*DPR;g.setTransform(DPR,0,0,DPR,0,0)}
window.addEventListener("resize",fit);
var yaw=.7,yawV=0,pitch=.62,pitchV=0,zoom=1,drag=null,t0=performance.now(),VOX=null,LAND=null,G=null,STATE="LOADING",WHY="",MASTER=false,STANCE=0,ACT=null,XR=false,AGE=null,AC=null,DRONE=null;
/* real-world mode: back camera behind a transparent canvas, the creature roams the floor */
var AR=false,VID=null,WX=0,WZ=0,HEAD=0,TGT=null,REST=0,GYRO=false,LT=0;
function arToggle(){if(AR){AR=false;if(VID){var s=VID.srcObject;if(s)s.getTracks().forEach(function(k){k.stop()});VID.remove();VID=null}WX=WZ=HEAD=0;TGT=null;return}
  var md=navigator.mediaDevices;if(!md||!md.getUserMedia){WHY="NO CAMERA ON THIS DEVICE";return}
  md.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false}).then(function(s){
    VID=document.createElement("video");VID.setAttribute("playsinline","");VID.muted=true;VID.autoplay=true;VID.srcObject=s;
    VID.style.cssText="position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:0";
    document.body.insertBefore(VID,document.body.firstChild);c.style.position="relative";c.style.zIndex="1";VID.play();AR=true;zoom=Math.max(zoom,1.3);
    var D=window.DeviceOrientationEvent;if(D&&typeof D.requestPermission==="function")D.requestPermission().then(gyro,function(){});else gyro("granted");
  },function(){WHY="CAMERA PERMISSION DENIED"})}
function gyro(p){if(p!=="granted"||GYRO)return;GYRO=true;window.addEventListener("deviceorientation",function(e){if(!AR||e.beta===null)return;
  pitch=Math.max(.1,Math.min(1.45,(90-Math.abs(e.beta))/90*1.4+.15));yaw=(e.alpha||0)*Math.PI/180;yawV=pitchV=0})}
function roam(t){var dt=Math.min(.1,t-LT);LT=t;if(!AR||STATE!=="AWAKE")return;
  if(!TGT){if(t<REST)return;var a=Math.random()*6.283,r=6+Math.random()*16;TGT=[Math.cos(a)*r,Math.sin(a)*r]}
  var dx=TGT[0]-WX,dz=TGT[1]-WZ,d=Math.sqrt(dx*dx+dz*dz);
  if(d<.6){TGT=null;REST=t+1+Math.random()*3;STANCE=0;return}
  STANCE=1;var want=Math.atan2(dx,dz),dh=want-HEAD;while(dh>3.1416)dh-=6.2832;while(dh<-3.1416)dh+=6.2832;HEAD+=dh*Math.min(1,dt*3);
  var sp=(2+(G?G.sd:30)/12)*dt;WX+=Math.sin(HEAD)*sp;WZ+=Math.cos(HEAD)*sp}
var STN=["IDLE","PROWL","STRIKE","ROAR"];
/* ---------- 6a. living block clock: the guardian ages with every block bitcoin mines ---------- */
function ageOf(){t("/r/blockheight").then(function(x){var tip=parseInt(String(x).replace(/[^0-9]/g,""),10);
  if(!G||!(tip>=0))return;var a=Math.max(0,tip-G.h),hv=0,k;for(k=210000;k<=tip;k+=210000)if(k>G.h)hv++;
  AGE={tip:tip,age:a,ep:Math.floor(a/2016),hv:hv}}).catch(function(){})}
/* ---------- 6b. hash-synthesized voice: no audio files, pure oscillators seeded by block dna ---------- */
function ax(){if(!AC){var C=window.AudioContext||window.webkitAudioContext;if(!C)return null;AC=new C()}
  if(AC.state==="suspended")AC.resume();return AC}
function cry(kind){var A=ax();if(!A||!G)return;var r=rng(h32(G.dna+":cry:"+kind)),n=A.currentTime,
  base=(G.sh==="avian"||G.sh==="floater"?520:G.sh==="serpent"?140:90)+r()*120,len=kind==="strike"?.35:1.3;
  var o=A.createOscillator(),m=A.createOscillator(),mg=A.createGain(),v=A.createGain(),f=A.createBiquadFilter();
  o.type=r()<.5?"sawtooth":"square";m.frequency.value=base*(1.5+r()*2.5);mg.gain.value=base*(1+r()*3);
  m.connect(mg);mg.connect(o.frequency);o.frequency.setValueAtTime(base*1.6,n);o.frequency.exponentialRampToValueAtTime(base*.45,n+len);
  f.type="lowpass";f.frequency.value=900+r()*2400;v.gain.setValueAtTime(0,n);v.gain.linearRampToValueAtTime(.32,n+.04);
  v.gain.exponentialRampToValueAtTime(.001,n+len);o.connect(f);f.connect(v);v.connect(A.destination);
  o.start(n);m.start(n);o.stop(n+len+.05);m.stop(n+len+.05);
  var b=A.createBuffer(1,A.sampleRate*.25|0,A.sampleRate),d=b.getChannelData(0),i;for(i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  var ns=A.createBufferSource(),ng=A.createGain();ns.buffer=b;ng.gain.value=.12;ns.connect(ng);ng.connect(A.destination);ns.start(n)}
function drone(){var A=ax();if(!A||!G)return;if(DRONE){DRONE.gain.gain.setTargetAtTime(0,A.currentTime,.3);var o=DRONE;setTimeout(function(){o.a.stop();o.b.stop()},1500);DRONE=null;return}
  var f=40+(h32(G.dna+":hum")%30),a=A.createOscillator(),b=A.createOscillator(),gn=A.createGain();
  a.frequency.value=f;b.frequency.value=f*1.5+.7;gn.gain.value=0;a.connect(gn);b.connect(gn);gn.connect(A.destination);
  a.start();b.start();gn.gain.setTargetAtTime(.06,A.currentTime,.8);DRONE={a:a,b:b,gain:gn}}
function act(k){if(STATE!=="AWAKE")return;ACT={k:k,t:(performance.now()-t0)/1000};cry(k)}
function stance(n){STANCE=n;if(n===2)act("strike");else if(n===3)act("roar")}
/* ---------- 6c. export: the exact voxel body as a wavefront .obj with vertex colors ---------- */
function exportObj(){if(!VOX||!G)return;var L=["# "+G.nm+" \u00B7 "+G.h+".bitmap \u00B7 dna "+G.dna,"# block-dna guardian voxel export","o guardian"],vi=1,i,k;
  var F=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
  for(i=0;i<VOX.length;i++){var v=VOX[i];if(v[8]===5)continue;var hw=v[3]/2,hh=v[4]/2,hd=v[5]/2,c=v[6].replace("#",""),
    R=(parseInt(c.slice(0,2),16)/255).toFixed(3),Gc=(parseInt(c.slice(2,4),16)/255).toFixed(3),B=(parseInt(c.slice(4,6),16)/255).toFixed(3);
    var P=[[-hw,-hh,-hd],[hw,-hh,-hd],[hw,-hh,hd],[-hw,-hh,hd],[-hw,hh,-hd],[hw,hh,-hd],[hw,hh,hd],[-hw,hh,hd]];
    for(k=0;k<8;k++)L.push("v "+(v[0]+P[k][0]).toFixed(3)+" "+(v[1]+P[k][1]).toFixed(3)+" "+(v[2]+P[k][2]).toFixed(3)+" "+R+" "+Gc+" "+B);
    for(k=0;k<6;k++)L.push("f "+(vi+F[k][0])+" "+(vi+F[k][1])+" "+(vi+F[k][2])+" "+(vi+F[k][3]));vi+=8}
  var bl=new Blob([L.join("\\n")],{type:"text/plain"}),a=document.createElement("a");
  a.href=URL.createObjectURL(bl);a.download=G.h+"_"+G.nm.toLowerCase().replace(/[^a-z0-9]+/g,"_")+"_guardian.obj";
  document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
/* ---------- 6d. controls bar ---------- */
function bar(){var d=document.createElement("div");d.style.cssText="position:fixed;right:2.5%;bottom:9%;display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;max-width:60%;z-index:2";
  [["1 IDLE",function(){stance(0)}],["2 PROWL",function(){stance(1)}],["3 STRIKE",function(){stance(2)}],["4 ROAR",function(){stance(3)}],
   ["X X-RAY",function(){XR=!XR}],["H HUM",drone],["E .OBJ",exportObj],["R REAL WORLD",arToggle]].forEach(function(b){var e=document.createElement("button");
    e.textContent=b[0];e.style.cssText="font:10px ui-monospace,monospace;letter-spacing:.08em;color:#f7931a;background:rgba(4,6,10,.7);border:1px solid #f7931a55;padding:4px 7px;cursor:pointer";
    e.onclick=function(ev){ev.stopPropagation();b[1]()};d.appendChild(e)});document.body.appendChild(d)}
window.addEventListener("keydown",function(e){var k=e.key.toLowerCase();if(k>="1"&&k<="4")stance(+k-1);else if(k==="x")XR=!XR;else if(k==="h")drone();else if(k==="e")exportObj();else if(k==="r")arToggle()});
var MC={};function mx(a,b,k){var key=a+b+k;return MC[key]||(MC[key]=mix(a,b,k))}
var CY,SY,CP,SP,SC,OX,OY;
function cam(){CY=Math.cos(yaw);SY=Math.sin(yaw);CP=Math.cos(pitch);SP=Math.sin(pitch)}
function P3(x,y,z){if(AR){var ch=Math.cos(HEAD),sh=Math.sin(HEAD),x2=x*ch+z*sh;z=-x*sh+z*ch+WZ;x=x2+WX}
  var rx=x*CY-z*SY,rz=x*SY+z*CY;return[OX+rx*SC,OY-(y*CP-rz*SP)*SC,rz*CP+y*SP]}
function poly(p,col,line){g.fillStyle=col;g.beginPath();g.moveTo(p[0][0],p[0][1]);
  for(var i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fill();
  if(line){g.strokeStyle=line;g.stroke()}}
function cube(v,col,gl,pulse){
  var hw=v[3]/2,hh=v[4]/2,hd=v[5]/2,x=v[0],y=v[1],z=v[2],ln=mx(col,"#000000",.6);
  var A=function(dx,dy,dz){return P3(x+dx,y+dy,z+dz)};
  if(XR){g.shadowBlur=0;var xc=G?G.accent:"#3fe0d0",F="rgba(0,0,0,.04)";
    poly([A(-hw,hh,-hd),A(hw,hh,-hd),A(hw,hh,hd),A(-hw,hh,hd)],F,xc);
    poly([A(-hw,-hh,-hd),A(hw,-hh,-hd),A(hw,-hh,hd),A(-hw,-hh,hd)],F,xc);
    poly([A(-hw,hh,hd),A(hw,hh,hd),A(hw,-hh,hd),A(-hw,-hh,hd)],F,xc);
    poly([A(-hw,hh,-hd),A(hw,hh,-hd),A(hw,-hh,-hd),A(-hw,-hh,-hd)],F,xc);return}
  if(gl>0){g.shadowColor=col;g.shadowBlur=14*gl*(1+pulse*.5)}else g.shadowBlur=0;
  var sx=SY>0?hw:-hw,sz=CY>0?hd:-hd;
  poly([A(sx,hh,-hd),A(sx,hh,hd),A(sx,-hh,hd),A(sx,-hh,-hd)],mx(col,"#000000",.36),ln);
  poly([A(-hw,hh,sz),A(hw,hh,sz),A(hw,-hh,sz),A(-hw,-hh,sz)],mx(col,"#000000",.16),ln);
  poly([A(-hw,hh,-hd),A(hw,hh,-hd),A(hw,hh,hd),A(-hw,hh,hd)],mx(col,"#ffffff",gl>0?.3:.2),ln);
}
function drawLand(pulse){
  if(!LAND)return;var L=LAND,i,s=L.half,d=L.depth;
  g.lineWidth=1;g.shadowBlur=0;
  /* the slab: the bitmap's solid orange body */
  cube([0,-d/2,0,s*2,d,s*2],"#c86d08",0,0);
  /* one square per transaction, packed exactly like the bitmap renderer */
  for(i=0;i<L.p.length;i++){var q=L.p[i],x0=q[0],z0=q[1],w=q[2],gp=Math.min(.18,w*.08);
    poly([P3(x0+gp,.02,z0+gp),P3(x0+w-gp,.02,z0+gp),P3(x0+w-gp,.02,z0+w-gp),P3(x0+gp,.02,z0+w-gp)],q[3],null)}
  g.globalAlpha=.35+pulse*.25;g.strokeStyle="#ffb03a";
  poly([P3(-s,.03,-s),P3(s,.03,-s),P3(s,.03,s),P3(-s,.03,s)],"rgba(0,0,0,0)","#ffb03a");g.globalAlpha=1;
}
function shadow(){
  var x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,i,pts=[];
  for(i=0;i<VOX.length;i++){var v=VOX[i];if(v[8]===5||v[8]===2)continue;x0=Math.min(x0,v[0]-v[3]/2);x1=Math.max(x1,v[0]+v[3]/2);z0=Math.min(z0,v[2]-v[5]/2);z1=Math.max(z1,v[2]+v[5]/2)}
  var cx=(x0+x1)/2,cz=(z0+z1)/2,rx=(x1-x0)*.42,rz=(z1-z0)*.42;
  for(i=0;i<20;i++){var a=i/20*Math.PI*2;pts.push(P3(cx+Math.cos(a)*rx,.05,cz+Math.sin(a)*rz))}
  g.globalAlpha=.45;poly(pts,"#1a0b00",null);g.globalAlpha=1;
}
function drawVox(pulse,stone,t){
  var list=[],i;shadow();
  for(i=0;i<VOX.length;i++){var v=anim(VOX[i],t,!stone);list.push([P3(v[0],v[1],v[2])[2],v])}
  list.sort(function(a,b){return a[0]-b[0]});g.lineWidth=.6;
  for(i=0;i<list.length;i++){var v=list[i][1];
    cube(v,stone?mx("#6b6f74","#2a2d31",(i%5)/6):v[6],stone?0:v[7],pulse)}
  if(AGE&&!stone){var ne=Math.min(16,AGE.ep);for(i=0;i<ne;i++){var ea=i/ne*Math.PI*2+t*.25;
    cube([Math.sin(ea)*16,3+Math.sin(t*1.5+i)*1.2+(i%3)*2,Math.cos(ea)*16,.55,.55,.55,"#f7931a",1.4,0,0],"#f7931a",1.4,pulse)}}
  g.shadowBlur=0
}
function txt(s,x,y,size,col,a){g.globalAlpha=a===undefined?1:a;g.fillStyle=col;
  g.font=size+"px ui-monospace,monospace";g.fillText(s,x,y);g.globalAlpha=1}
function hud(w,h,pulse){
  var pad=Math.max(14,w*.035),small=Math.max(8,Math.min(13,w*.016)),big=Math.max(18,Math.min(44,w*.055));
  var ACC=G?G.accent:"#3fe0d0",stone=STATE!=="AWAKE";
  g.strokeStyle=stone?"#6b6f74":ACC;g.globalAlpha=.5;g.lineWidth=1;
  g.strokeRect(pad*.55,pad*.55,w-pad*1.1,h-pad*1.1);g.globalAlpha=1;
  txt((MASTER?"GUARDIAN MASTER GENERATOR":"BLOCK-DNA GUARDIAN")+(G&&!MASTER?" \\u00B7 "+G.h+".BITMAP":""),pad,pad+small*1.4,small,"#f7931a");
  if(LAND)txt(LAND.n+" PARCELS \\u00B7 ONE PER TRANSACTION",pad,pad+small*3,small*.8,"#f7931a",.75);
  if(!G){txt(STATE==="LOADING"?"READING THE CHAIN\\u2026":"STONE RELIC",pad,h/2,big,"#8a949c");
    if(WHY)txt(WHY,pad,h/2+small*2.4,small,"#d2493c");return}
  txt(G.nm,pad,h-pad-small*7.4,big,stone?"#8a949c":"#e9eef0");
  if(G.tr&&!MASTER){var tn=G.tr.length-1,tl=[];for(var q=1;q<G.tr.length;q++)tl.push(G.tr[q][1].split(" ").pop());
    txt(tn+"-TRAIT GUARDIAN"+(tl.length?" \\u00B7 "+tl.join(" \\u00B7 "):" \\u00B7 PURE"),pad,h-pad-small*7.4-big*1.1,small*.85,"#f7931a")}
  if(MASTER)txt("TRAIT ENGINE \\u00B7 0 TO 6 TRAIT GUARDIANS",pad,h-pad-small*7.4-big*1.1,small*.85,"#f7931a");
  txt(G.ra+" \\u00B7 LV "+G.lv+" \\u00B7 ERA "+G.ep+" \\u00B7 "+G.sh.toUpperCase(),pad,h-pad-small*5.9,small,stone?"#6b6f74":ACC);
  var stats=[["HP",G.hp],["BITE",G.bi],["SPEED",G.sd],["ARMOR",G.ar]],i,cw=(w-pad*2)/4;
  for(i=0;i<4;i++){txt(stats[i][0],pad+i*cw,h-pad-small*4,small*.85,"#87939b");
    txt(String(stats[i][1]),pad+i*cw,h-pad-small*2.5,small*1.5,stone?"#8a949c":"#e9eef0")}
  if(MASTER)txt("COLLECTION PARENT \\u00B7 GENESIS PROGENITOR",pad,h-pad-small*1.1,small,"#f7931a",.7+pulse*.3);
  else if(stone)txt(WHY,pad,h-pad-small*1.1,small,"#d2493c");
  else txt(CANON===true?"TRIBUTE VERIFIED \\u00B7 FIRST-IS-FIRST BITMAP (OCI)":"TRIBUTE VERIFIED ON CHAIN \\u00B7 FIRST-IS-FIRST CHECK IN APP",pad,h-pad-small*1.1,small,ACC,.7+pulse*.3);
  if(COLL){var cl=MASTER?COLL.n+" GUARDIANS INSCRIBED AS CHILDREN":(COLL.rank>0?"COLLECTION #"+COLL.rank+" OF "+COLL.n:COLL.n+" IN COLLECTION");
    txt(cl,pad,pad+small*4.6,small*.85,"#3fe0d0");
    if(MASTER&&COLL.last)txt("LATEST "+COLL.last.slice(0,12)+"\\u2026",pad,pad+small*6,small*.75,"#3fe0d0",.7)}
  txt("DNA "+G.dna+"  "+SELF.slice(0,16)+"\\u2026",pad,h-pad*.95,small*.7,"#5d676e");
  if(AGE)txt("AGE "+AGE.age.toLocaleString()+" BLOCKS \\u00B7 "+AGE.ep+" EPOCHS SURVIVED \\u00B7 "+AGE.hv+" HALVINGS WITNESSED",pad,pad+small*7.4,small*.75,"#f7931a",.85);
  txt("STANCE "+STN[STANCE]+(XR?" \\u00B7 X-RAY":""),w-pad-small*11.5,pad+small*2.9,small*.8,"#3fe0d0",.8);
  txt("DRAG \\u00B7 SCROLL TO ZOOM",w-pad-small*11.5,pad+small*1.4,small*.8,"#5d676e",.7);
}
function backdrop(w,h){
  var grd=g.createRadialGradient(w/2,h*.55,10,w/2,h*.55,Math.max(w,h)*.75);
  grd.addColorStop(0,"#1a0f04");grd.addColorStop(1,"#04060a");g.fillStyle=grd;g.fillRect(0,0,w,h);
}
function frame(now){
  var t=(now-t0)/1000,pulse=(Math.sin(t*2.2)+1)/2;
  if(!drag){yaw+=(STATE==="AWAKE"?.003:.001)+yawV;yawV*=.94;pitch+=pitchV;pitchV*=.9}
  pitch=Math.max(.1,Math.min(1.45,pitch));
  roam(t);
  if(AR){g.clearRect(0,0,W,H);document.body.style.background="transparent"}else{backdrop(W,H);document.body.style.background=""}
  if(VOX&&LAND){cam();
    var span=LAND.half*3.4;SC=Math.min(W,H)/span*zoom;OX=W/2;OY=H*.56+Math.sin(pitch)*LAND.half*.1*SC;
    if(!AR)drawLand(pulse);drawVox(pulse,STATE!=="AWAKE",t);
  }
  hud(W,H,pulse);requestAnimationFrame(frame)
}
function pt(e){return[e.clientX,e.clientY]}
c.style.touchAction="none";
c.addEventListener("pointerdown",function(e){drag=pt(e);yawV=pitchV=0});
window.addEventListener("pointermove",function(e){if(!drag)return;var p=pt(e),dx=p[0]-drag[0],dy=p[1]-drag[1];
  yaw+=dx*.008;pitch+=dy*.006;yawV=dx*.0006;pitchV=dy*.0004;drag=p});
var DN=null;c.addEventListener("pointerdown",function(e){DN=pt(e)});
window.addEventListener("pointerup",function(e){drag=null;if(DN){var p=pt(e);if(Math.abs(p[0]-DN[0])+Math.abs(p[1]-DN[1])<6){
  if(AR&&SC&&SP>.05){var me=P3(0,4,0),near=Math.abs(p[0]-me[0])+Math.abs(p[1]-me[1])<Math.min(W,H)*.12;
    if(near)act("roar");else{var rx=(p[0]-OX)/SC,rz=(p[1]-OY)/(SP*SC);TGT=[rx*CY+rz*SY,-rx*SY+rz*CY]}}
  else act("roar")}}DN=null});
c.addEventListener("wheel",function(e){e.preventDefault();zoom=Math.max(.5,Math.min(3,zoom*(e.deltaY>0?.9:1.1)))},{passive:false});

/* ---------- 7. resolve, then render ---------- */
/* ---------- 7a. the bitmap: mondrian layout, one parcel per transaction (bitfeed order) ---------- */
function mondrian(sizes){
  var wt=0,i;for(i=0;i<sizes.length;i++)wt+=sizes[i]*sizes[i];
  var width=Math.max(1,Math.ceil(Math.sqrt(wt))),rows=[],out=[];
  function row(y){return rows[y]}
  function addRow(){var r={y:rows.length,s:[],m:{}};rows.push(r);return r}
  function add(sl){if(sl.r<=0)return;var r=row(sl.y);if(!r)return;var e=r.m[sl.x];if(e){if(sl.r>e.r)e.r=sl.r;return}
    var at=-1;for(var k=0;k<r.s.length;k++)if(r.s[k].x>sl.x){at=k;break}
    if(at<0)r.s.push(sl);else r.s.splice(at,0,sl);r.m[sl.x]=sl}
  function rm(sl){var r=row(sl.y);if(!r)return;delete r.m[sl.x];var k=r.s.indexOf(sl);if(k>=0)r.s.splice(k,1)}
  function fill(sl,sw){var sq={x:sl.x,y:sl.y,r:sw},ri,k;rm(sl);
    for(ri=sl.y;ri<sl.y+sw;ri++){var r=row(ri);
      if(r){var col=[],ex=0,ss=r.s.slice();
        for(k=0;k<ss.length;k++){var ts=ss[k];if(!(ts.x+ts.r<=sq.x||ts.x>=sq.x+sw)){col.push(ts);ex=Math.max(ex,Math.max(0,ts.x+ts.r-(sl.x+sl.r)))}}
        if(sq.x+sw<width&&!r.m[sq.x+sw])add({x:sq.x+sw,y:ri,r:sl.r-sw+ex});
        for(k=0;k<col.length;k++){col[k].r=sl.x-col[k].x;if(col[k].r<=0)rm(col[k])}
      }else{addRow();if(sl.x>0)add({x:0,y:ri,r:sl.x});if(sq.x+sw<width)add({x:sq.x+sw,y:ri,r:width-(sq.x+sw)})}}
    for(ri=Math.max(0,sl.y-sw);ri<sl.y;ri++){var r2=row(ri);if(!r2)continue;var s2=r2.s.slice();
      for(k=0;k<s2.length;k++){var t2=s2[k];
        if(t2.x<sq.x+sw&&t2.x+t2.r>sq.x&&t2.y+t2.r>=sl.y){var ow=t2.r;t2.r=sl.y-t2.y;if(t2.r<=0){rm(t2);continue}
          var re={x:t2.x+t2.r,y:t2.y,w:ow-t2.r,h:t2.r};
          while(re.w>0&&re.h>0){if(re.w<=re.h){add({x:re.x,y:re.y,r:re.w});re.y+=re.w;re.h-=re.w}
            else{add({x:re.x,y:re.y,r:re.h});re.x+=re.h;re.w-=re.h}}}}}
    return sq}
  for(i=0;i<sizes.length;i++){var size=Math.max(1,sizes[i]),sq=null;
    outer:for(var a=0;a<rows.length;a++){var rs=rows[a].s.slice();for(var b=0;b<rs.length;b++)if(rs[b].r>=size){sq=fill(rs[b],size);break outer}}
    if(!sq){var nr=addRow(),s0={x:0,y:nr.y,r:width};nr.s.push(s0);nr.m[0]=s0;sq=fill(s0,size)}
    out.push(sq)}
  var hgt=0;for(i=0;i<out.length;i++)hgt=Math.max(hgt,out[i].y+out[i].r);
  return{w:width,h:hgt,sq:out}
}
function land(txs,hash){
  /* parcel size scales with sqrt(tx weight) like the bitmap renderer; the block's
     per-transaction sizes are not served by recursive endpoints, so the size mix is
     seeded from the block hash. the parcel COUNT is exact: one per transaction. */
  var r=rng(h32(hash+":land")),sizes=[],i,n=Math.max(1,Math.min(txs,12000));
  for(i=0;i<n;i++){var u=r();sizes.push(i===0?Math.max(2,Math.ceil(Math.sqrt(n)/12)):u<.72?1:u<.9?2:u<.97?3:u<.995?4:5+Math.floor(r()*4))}
  var M=mondrian(sizes),side=Math.max(M.w,M.h),S=28/side,half=14,p=[];
  var OR=["#f7931a","#f9a23c","#e8850e","#ffb03a","#d97a0a"];
  for(i=0;i<M.sq.length;i++){var q=M.sq[i];
    p.push([q.x*S-half+(side-M.w)*S/2,q.y*S-half+(side-M.h)*S/2,q.r*S,OR[(h32(hash+i)>>>3)%OR.length]])}
  return{p:p,half:half,depth:2.6,n:n}
}
function build(height,blk){
  var txs=(blk&&(blk.transaction_count||blk.transactions||blk.tx_count||blk.n_tx))||1,hash=(blk&&blk.hash)||String(height);
  G=dnaOf(height,hash,txs,(blk&&blk.size)||900000);
  LAND=land(txs,hash);VOX=blueprint(G);G.tr=traitsOf(G);if(!MASTER)publish(G,LAND.n);
  /* fit the creature to its land: never taller than 22, never wider than 28 */
  var ty=0,ex=0,i;for(i=0;i<VOX.length;i++){var v=VOX[i];ty=Math.max(ty,v[1]+v[4]/2);ex=Math.max(ex,Math.abs(v[0])+v[3]/2,Math.abs(v[2])+v[5]/2)}
  var k=Math.min(1.6,22/ty,14/ex);
  for(i=0;i<VOX.length;i++){var w=VOX[i];w[0]*=k;w[1]*=k;w[2]*=k;w[3]*=k;w[4]*=k;w[5]*=k}
}
function blockData(height){
  return j("/r/blockinfo/"+height).catch(function(){
    return t("/r/blockhash/"+height).then(function(h){return{hash:h.replace(/"/g,"").trim()}});
  }).catch(function(){return null});
}
Promise.all([parentHeight().catch(function(){return null}),tribute()]).then(function(r){
  var height=r[0],paid=r[1];
  if(height===-1){MASTER=true;collection(SELF);
    return blockData(0).then(function(blk){build(0,blk);STATE="AWAKE";WHY=""})}
  if(height===null){STATE="RELIC";WHY=DUPE?"DUPLICATE BITMAP \\u00B7 NOT FIRST-IS-FIRST (OCI)":"INVALID BITMAP PARENT";build(0,null);STATE="RELIC";return}
  var root=null,i;for(i=0;i<PIDS.length;i++)if(PIDS[i]!==BMP){root=PIDS[i];break}
  if(root)collection(root);
  return blockData(height).then(function(blk){
    build(height,blk);
    if(paid===true)STATE="AWAKE";
    else if(paid===false){STATE="RELIC";WHY="UNVERIFIED TRIBUTE \\u00B7 NO "+TRIBUTE_MIN+"-SAT SUMMON"}
    else{STATE="AWAKE";WHY=""}
  });
}).catch(function(){STATE="RELIC";WHY="COULD NOT READ THE CHAIN";build(0,null)});
bar();fit();requestAnimationFrame(frame);setTimeout(ageOf,800);setInterval(ageOf,600000);
</script></body></html>`;
}

/** Bytes the master generator occupies on chain. */
export const guardianMasterBytes = () => new TextEncoder().encode(guardianMasterGeneratorHtml()).length;
