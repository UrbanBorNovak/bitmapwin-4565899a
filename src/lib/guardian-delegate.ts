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

/**
 * The inscription id of the master generator, once it has been inscribed.
 * Empty means delegate mints are not offered yet.
 */
export const GUARDIAN_MASTER_DELEGATE_ID = "";

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
<canvas id="c"></canvas><div id="o"></div><div id="v"></div>
<script>
var TRIBUTE_TO=${JSON.stringify(TRIBUTE_ADDRESS)},TRIBUTE_MIN=${TRIBUTE_SATS};

/* ---------- 1. who am i, with zero network calls ---------- */
var SELF=(window.location.pathname.split("/").filter(Boolean).pop()||"");
var REVEAL=SELF.indexOf("i")>0?SELF.slice(0,SELF.lastIndexOf("i")):"";

function j(u){return fetch(u).then(function(r){if(!r.ok)throw 0;return r.json()})}
function t(u){return fetch(u).then(function(r){if(!r.ok)throw 0;return r.text()})}

/* ---------- 2. the bitmap parent, verified against the chain ---------- */
function heightFrom(s){var m=/(\\d{1,7})\\.bitmap/i.exec(s||"");return m?parseInt(m[1],10):null}
function parentHeight(){
  return j("/r/parents/"+SELF).then(function(p){
    var ids=(p&&p.ids)||p||[];
    if(!ids.length)throw 0;
    return ids.reduce(function(chain,id){
      return chain.then(function(found){
        if(found!==null)return found;
        return t("/content/"+id).then(function(body){
          var h=heightFrom(body);
          if(h===null)return null;
          /* OCI sanity check: a bitmap can only claim a block that exists */
          return t("/r/blockheight").then(function(tip){
            return h<=parseInt(tip,10)?h:null;
          },function(){return h});
        },function(){return null});
      });
    },Promise.resolve(null));
  });
}

/* ---------- 3. the tribute, read straight off the reveal transaction ---------- */
function tribute(){
  if(!REVEAL)return Promise.resolve(false);
  return j("/r/tx/"+REVEAL).then(function(tx){
    var outs=(tx&&(tx.vout||tx.outputs))||[];
    for(var i=0;i<outs.length;i++){
      var o=outs[i],a=o.scriptpubkey_address||o.address||"",v=o.value||0;
      if(a===TRIBUTE_TO&&v>=TRIBUTE_MIN)return true;
    }
    return false;
  },function(){return null}); /* null = could not read, not a failure */
}

/* ---------- 4. block dna -> creature, the same maths as bitmapwin ---------- */
function h32(s){var h=2166136261,i;for(i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){var s=seed>>>0;return function(){s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296}}
var SHAPES=["golem","bird","wisp","wyrm","beast"];
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
    bulk:Math.max(.8,Math.min(1.45,.8+size/2600000)),
    dna:h32(hash).toString(16)};
}

/* ---------- 5. voxel blueprint ---------- */
function mix(a,b,k){
  function rgb(x){var d=document.createElement("canvas").getContext("2d");d.fillStyle=x;x=d.fillStyle;
    if(x[0]==="#")return[parseInt(x.substr(1,2),16),parseInt(x.substr(3,2),16),parseInt(x.substr(5,2),16)];
    var m=x.match(/\\d+/g);return[+m[0],+m[1],+m[2]]}
  var A=rgb(a),B=rgb(b),o=[],i;for(i=0;i<3;i++)o.push(Math.round(A[i]+(B[i]-A[i])*k));
  return "rgb("+o.join(",")+")";
}
function blueprint(G){
  var BODY=G.body,ACC=G.accent,DARK=mix(BODY,"#000000",.55),LIGHT=mix(BODY,"#ffffff",.26),MID=mix(BODY,ACC,.2);
  var V=[],s=G.sh,b=G.bulk,i,k,f;
  function box(x,y,z,w,h,d,c,g){V.push([x,y,z,w*b,h,d*b,c,g||0])}
  function sym(x,y,z,w,h,d,c,g){box(x,y,z,w,h,d,c,g);box(-x,y,z,w,h,d,c,g)}
  if(s==="golem"){
    box(0,10,0,9,8,6,BODY);box(0,11,-3.4,6,5,1.2,DARK);box(0,11,3.2,6,4,.6,mix(ACC,"#000000",.3),.5);
    box(0,16.6,.2,5.6,4.4,4.8,BODY);box(0,18.8,0,4.4,1.2,3.8,LIGHT);sym(1.4,17.2,2.8,1,.6,.4,ACC,1);
    sym(6.7,14.2,0,4.2,3.6,5.4,BODY);sym(7.2,15.8,0,4.8,1.3,5.8,ACC,.4);
    sym(6.6,10.3,0,2.2,4.6,2.6,DARK);sym(2.6,5.5,0,3.1,5,3.4,BODY);sym(2.6,.7,1.3,4.2,1.4,5.5,BODY);
  }else if(s==="bird"){
    box(0,8.2,-.8,5.2,5.4,10.5,BODY);box(0,12.8,4.8,4.2,4.2,4.2,BODY);box(0,12.2,7.8,2.8,2,2.8,LIGHT);
    box(0,11.8,9.6,1.6,1.2,1.8,ACC,.8);sym(1.2,13.6,7,.9,.7,.4,ACC,1);
    for(i=0;i<5;i++)sym(7.2+i*1.9,9.7-i*.6,-1-i,4.4-i*.35,.5,1.6,i%2?LIGHT:BODY);
    sym(1.7,3.5,3.5,1.2,5.5,1.2,LIGHT);sym(1.7,.8,4.9,2,1,3,BODY);
    for(i=-1;i<2;i++)box(i*1.3,7.3,-8.3,1.2,.7,7.2,i?LIGHT:ACC,i?0:.3);
  }else if(s==="wisp"){
    box(0,12,0,4.6,4.6,4.6,BODY,.7);box(0,14.8,-.8,6.5,1.8,5.2,DARK);sym(2.7,12.9,.5,2,4.8,4.8,DARK);
    box(0,10.6,3.5,3.8,3.4,.8,DARK);sym(1.05,12,4.1,.8,.5,.3,ACC,1);sym(7,9.6,.8,2.5,2,2.8,MID);
    for(i=0;i<6;i++){var a=i*1.047;box(Math.sin(a)*7.2,11+Math.sin(a*2)*2.2,Math.cos(a)*7.2,1.4,1.4,1.4,ACC,.9)}
  }else if(s==="wyrm"){
    for(i=0;i<G.seg;i++){k=(i-(G.seg-1)/2)*3.6;f=Math.abs(i-(G.seg-1)/2);
      box(0,6.2+((G.seg-1)/2-f)*.45,k,5.4-f*.45,4.2,4.2,i%2?MID:BODY);
      box(0,8.6,k,4.2-f*.35,.9,3,i%2?LIGHT:ACC,i%2?0:.4)}
    box(0,8.8,G.seg*2,4.8,4.2,5.6,BODY);box(0,8,G.seg*2+3.4,3.4,2.5,4.2,LIGHT);
    sym(1.4,9.8,G.seg*2+2.5,.9,.7,.4,ACC,1);sym(1.6,12,G.seg*2-.5,1.1,3.4,1.1,ACC,.5);
  }else{
    box(0,7.2,-.8,5.4,5.8,11.4,BODY);box(0,9.1,2,6.2,2.5,5.5,MID);sym(3.4,9.2,2.8,2.4,2.4,4.2,ACC,.3);
    box(0,11.8,5.8,4.8,4.8,5,BODY);box(0,10.8,9.3,3.4,2.5,4.2,LIGHT);box(0,10.8,11.7,2.4,1.6,1.2,DARK);
    sym(1.4,13,8.4,.9,.7,.4,ACC,1);sym(2,15.7,4.8,1.5,5.6,1.9,BODY);
    for(i=0;i<2;i++){sym(2.5,4.7,i?3.8:-3.4,1.9,4.3,2.2,BODY);sym(2.7,1.3,i?4.4:-2.8,2.8,1,3.4,BODY)}
    for(i=0;i<4;i++)box(Math.sin(i*.55)*1.8,7.6+i*.9,-7.8-i*2.7,2-i*.25,2-i*.25,3.4,i%2?ACC:BODY,i%2?.3:0);
  }
  var pts=G.ra==="MYTHIC"?8:G.ra==="EPIC"?6:G.ra==="RARE"?4:0;
  for(i=0;i<pts;i++){var an=i/pts*Math.PI*2,r=G.ra==="MYTHIC"?7.6:6.6;
    box(Math.sin(an)*r,(s==="golem"?21.5:s==="wyrm"?13.5:17.5),Math.cos(an)*r,.7,G.ra==="MYTHIC"?2.6:1.7,.7,ACC,1)}
  return V;
}

/* ---------- 6. painter ---------- */
var c=document.getElementById("c"),g=c.getContext("2d"),W=0,H=0,DPR=Math.min(2,window.devicePixelRatio||1);
function fit(){W=c.clientWidth;H=c.clientHeight;c.width=W*DPR;c.height=H*DPR;g.setTransform(DPR,0,0,DPR,0,0)}
window.addEventListener("resize",fit);
var yaw=.7,yawV=0,drag=null,t0=performance.now(),VOX=null,G=null,EXT=null,STATE="LOADING",WHY="";
function project(x,y,z,cy,sy,sc,ox,oy){var rx=x*cy-z*sy,rz=x*sy+z*cy;
  return[ox+(rx-rz)*.866*sc,oy-(y*.92+(rx+rz)*.5)*sc,rx+rz]}
function face(p,col,a){g.fillStyle=col;g.globalAlpha=a;g.beginPath();g.moveTo(p[0][0],p[0][1]);
  for(var i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fill();g.globalAlpha=1}
function extents(){
  var ax=0,ymin=1e9,ymax=-1e9,k,i;
  for(k=0;k<12;k++){var a=k/12*Math.PI*2,cy=Math.cos(a),sy=Math.sin(a);
    for(i=0;i<VOX.length;i++){var v=VOX[i],dx,dy,dz;
      for(dx=-1;dx<2;dx+=2)for(dy=-1;dy<2;dy+=2)for(dz=-1;dz<2;dz+=2){
        var p=project(v[0]+dx*v[3]/2,v[1]+dy*v[4]/2,v[2]+dz*v[5]/2,cy,sy,1,0,0);
        if(Math.abs(p[0])>ax)ax=Math.abs(p[0]);
        if(p[1]<ymin)ymin=p[1];if(p[1]>ymax)ymax=p[1]}}}
  return{ax:ax,ymin:ymin,ymax:ymax}
}
function drawVox(sc,ox,oy,pulse,stone){
  var cy=Math.cos(yaw),sy=Math.sin(yaw),list=[],i;
  for(i=0;i<VOX.length;i++){var v=VOX[i],d=project(v[0],v[1],v[2],cy,sy,sc,ox,oy);list.push([d[2]+v[1]*.01,v])}
  list.sort(function(a,b){return a[0]-b[0]});
  for(i=0;i<list.length;i++){
    var v=list[i][1],hw=v[3]/2,hh=v[4]/2,hd=v[5]/2,x=v[0],y=v[1],z=v[2];
    var col=stone?mix("#6b6f74","#2a2d31",(i%5)/6):v[6],gl=stone?0:v[7];
    var P=function(dx,dy,dz){return project(x+dx,y+dy,z+dz,cy,sy,sc,ox,oy)};
    if(gl>0){g.shadowColor=col;g.shadowBlur=16*gl*(1+pulse*.5)}else{g.shadowBlur=0}
    face([P(-hw,hh,-hd),P(hw,hh,-hd),P(hw,hh,hd),P(-hw,hh,hd)],mix(col,"#ffffff",.22+gl*.25*pulse),1);
    face([P(-hw,hh,hd),P(-hw,-hh,hd),P(-hw,-hh,-hd),P(-hw,hh,-hd)],mix(col,"#000000",.34),1);
    face([P(-hw,hh,hd),P(hw,hh,hd),P(hw,-hh,hd),P(-hw,-hh,hd)],mix(col,"#000000",.14),1);
  }
  g.shadowBlur=0
}
function txt(s,x,y,size,col,a){g.globalAlpha=a===undefined?1:a;g.fillStyle=col;
  g.font=size+"px ui-monospace,monospace";g.fillText(s,x,y);g.globalAlpha=1}
function hud(w,h,pulse){
  var pad=Math.max(14,w*.035),small=Math.max(8,Math.min(13,w*.016)),big=Math.max(18,Math.min(44,w*.055));
  var ACC=G?G.accent:"#3fe0d0",stone=STATE!=="AWAKE";
  g.strokeStyle=stone?"#6b6f74":ACC;g.globalAlpha=.5;g.lineWidth=1;
  g.strokeRect(pad*.55,pad*.55,w-pad*1.1,h-pad*1.1);g.globalAlpha=1;
  txt("BLOCK-DNA GUARDIAN"+(G?" \\u00B7 "+G.h+".BITMAP":""),pad,pad+small*1.4,small,"#f7931a");
  if(!G){txt(STATE==="LOADING"?"READING THE CHAIN\\u2026":"STONE RELIC",pad,h/2,big,"#8a949c");
    if(WHY)txt(WHY,pad,h/2+small*2.4,small,"#d2493c");return}
  txt(G.nm,pad,h-pad-small*7.4,big,stone?"#8a949c":"#e9eef0");
  txt(G.ra+" \\u00B7 LV "+G.lv+" \\u00B7 ERA "+G.ep+" \\u00B7 "+G.sh.toUpperCase(),pad,h-pad-small*5.9,small,stone?"#6b6f74":ACC);
  var stats=[["HP",G.hp],["BITE",G.bi],["SPEED",G.sd],["ARMOR",G.ar]],i,cw=(w-pad*2)/4;
  for(i=0;i<4;i++){txt(stats[i][0],pad+i*cw,h-pad-small*4,small*.85,"#87939b");
    txt(String(stats[i][1]),pad+i*cw,h-pad-small*2.5,small*1.5,stone?"#8a949c":"#e9eef0")}
  if(stone)txt(WHY,pad,h-pad-small*1.1,small,"#d2493c");
  else txt("TRIBUTE VERIFIED ON CHAIN",pad,h-pad-small*1.1,small,ACC,.7+pulse*.3);
  txt("DNA "+G.dna+"  "+SELF.slice(0,16)+"\\u2026",pad,h-pad*.95,small*.7,"#5d676e");
  txt("DRAG TO ORBIT",w-pad-small*7.6,pad+small*1.4,small*.8,"#5d676e",.7);
}
function backdrop(w,h,t){
  var ACC=G?G.accent:"#17313a";
  var grd=g.createRadialGradient(w/2,h*.55,10,w/2,h*.55,Math.max(w,h)*.75);
  grd.addColorStop(0,mix("#04060a",STATE==="AWAKE"?ACC:"#3a3f45",.09));grd.addColorStop(1,"#04060a");
  g.fillStyle=grd;g.fillRect(0,0,w,h);
  var cols=26,i,j2,cw=w/cols;g.globalAlpha=.14;
  for(i=0;i<cols;i++)for(j2=0;j2<10;j2++){
    var n=Math.sin(i*.7+j2*1.9+t*.06);if(n<.42)continue;
    g.fillStyle=STATE==="AWAKE"?ACC:"#30353b";
    g.fillRect(i*cw,h-(j2+1)*(h*.045)-h*.02,cw*.72,h*.03*n)}
  g.globalAlpha=1
}
function frame(now){
  var t=(now-t0)/1000,pulse=(Math.sin(t*2.2)+1)/2;
  if(!drag)
    {yaw+=(STATE==="AWAKE"?.0045:.0012)+yawV;yawV*=.92}
  g.clearRect(0,0,W,H);backdrop(W,H,t);
  if(VOX){
    if(!EXT)EXT=extents();
    var sc=Math.min(W*.84/(EXT.ax*2||1),H*.58/((EXT.ymax-EXT.ymin)||1));
    var oy=H*.46-((EXT.ymin+EXT.ymax)/2)*sc+(STATE==="AWAKE"?Math.sin(t*1.5)*3:0);
    var baseY=oy+EXT.ymax*sc,rad=EXT.ax*sc*.95;
    g.save();g.translate(W/2,baseY+rad*.1);g.scale(1,.26);
    var gr=g.createRadialGradient(0,0,0,0,0,rad);
    gr.addColorStop(0,STATE==="AWAKE"?G.accent:"#4a4f55");
    gr.addColorStop(.45,"rgba(0,0,0,.6)");gr.addColorStop(1,"rgba(0,0,0,0)");
    g.globalAlpha=.3+pulse*.1;g.fillStyle=gr;g.beginPath();g.arc(0,0,rad,0,Math.PI*2);g.fill();g.restore();
    drawVox(sc,W/2,oy,pulse,STATE!=="AWAKE");
  }
  hud(W,H,pulse);requestAnimationFrame(frame)
}
function px(e){return(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX)}
c.addEventListener("pointerdown",function(e){drag=px(e)});
window.addEventListener("pointermove",function(e){if(drag===null)return;var x=px(e);
  yawV=(x-drag)*.00035;yaw+=(x-drag)*.006;drag=x});
window.addEventListener("pointerup",function(){drag=null});

/* ---------- 7. resolve, then render ---------- */
function build(height,blk){
  G=dnaOf(height,(blk&&blk.hash)||String(height),(blk&&(blk.transactions||blk.tx_count))||1200,(blk&&blk.size)||900000);
  VOX=blueprint(G);EXT=null;
}
Promise.all([parentHeight().catch(function(){return null}),tribute()]).then(function(r){
  var height=r[0],paid=r[1];
  if(height===null){STATE="RELIC";WHY="INVALID BITMAP PARENT";build(0,null);STATE="RELIC";return}
  return j("/r/blockinfo/"+height).catch(function(){return null}).then(function(blk){
    build(height,blk);
    if(paid===true)STATE="AWAKE";
    else if(paid===false){STATE="RELIC";WHY="UNVERIFIED TRIBUTE \\u00B7 NO "+TRIBUTE_MIN+"-SAT SUMMON"}
    else{STATE="AWAKE";WHY=""}
  });
}).catch(function(){STATE="RELIC";WHY="COULD NOT READ THE CHAIN";build(0,null)});
fit();requestAnimationFrame(frame);
</script></body></html>`;
}

/** Bytes the master generator occupies on chain. */
export const guardianMasterBytes = () => new TextEncoder().encode(guardianMasterGeneratorHtml()).length;
