// Tiny Store template: builds a single self-contained HTML storefront that reads
// the public BitmapWin Market API live. Zero custody: buying hands off to the
// BITMAP page where the visitor signs with their own wallet. Never signs anything.

export type StoreConfig = {
  name: string;
  tagline: string;
  accent: string; // hex
  seller?: string | undefined; // only this seller's listings
  minHeight?: number | undefined;
  maxHeight?: number | undefined;
  maxSats?: number | undefined;
  sort: "price_asc" | "price_desc" | "recent";
  apiBase: string;
};

export const DEFAULT_STORE: StoreConfig = {
  name: "MY BITMAP SHOP",
  tagline: "Hand-picked BITMAPs, live from Bitcoin.",
  accent: "#f7931a",
  sort: "price_asc",
  apiBase: "https://bitmapwin.app",
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const ADDR = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/;

export type StoreForm = { config: StoreConfig; minH: string; maxH: string; maxBtc: string };

/** A shop with every setting back at its starting value. */
export const DEFAULT_FORM: StoreForm = { config: { ...DEFAULT_STORE }, minH: "", maxH: "", maxBtc: "" };

/**
 * True when the shop is exactly as it started, so resetting has nothing to lose.
 * apiBase is ignored: the preview points at localhost, the downloaded shop at the live site.
 */
export function isFormDefault(f: StoreForm): boolean {
  const c = f.config;
  return (
    c.name === DEFAULT_STORE.name &&
    c.tagline === DEFAULT_STORE.tagline &&
    c.accent === DEFAULT_STORE.accent &&
    c.sort === DEFAULT_STORE.sort &&
    !c.seller &&
    f.minH === "" &&
    f.maxH === "" &&
    f.maxBtc === ""
  );
}

/** Reads a shared shop link; anything missing or malformed keeps its default. */
export function storeFormFromSearch(search: string): StoreForm {
  const q = new URLSearchParams(search);
  const sort = q.get("sort");
  const digits = (v: string | null) => (v ?? "").replace(/\D/g, "");
  const accent = q.get("accent") ?? "";
  return {
    config: {
      ...DEFAULT_STORE,
      name: q.get("name")?.slice(0, 80) || DEFAULT_STORE.name,
      tagline: q.get("tagline")?.slice(0, 200) || DEFAULT_STORE.tagline,
      accent: HEX.test(accent) ? accent : DEFAULT_STORE.accent,
      seller: q.get("seller")?.trim() || undefined,
      sort: sort === "price_desc" || sort === "recent" || sort === "price_asc" ? sort : DEFAULT_STORE.sort,
    },
    minH: digits(q.get("from")),
    maxH: digits(q.get("to")),
    maxBtc: (q.get("max") ?? "").replace(/[^\d.]/g, ""),
  };
}



/** Builds the listings query; filters the API can't do (height range) run in the page. */
export function storeQuery(c: StoreConfig): string {
  const p = new URLSearchParams({ sort: c.sort, limit: "200" });
  if (c.seller && ADDR.test(c.seller)) p.set("seller", c.seller);
  if (c.maxSats && c.maxSats > 0) p.set("max_sats", String(Math.floor(c.maxSats)));
  return `${c.apiBase.replace(/\/+$/, "")}/api/public/market/listings?${p}`;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function buildStoreHtml(c: StoreConfig): string {
  const accent = HEX.test(c.accent) ? c.accent : DEFAULT_STORE.accent;
  const base = c.apiBase.replace(/\/+$/, "");
  const cfg = JSON.stringify({
    url: storeQuery(c),
    base,
    min: Number.isFinite(c.minHeight) ? c.minHeight : null,
    max: Number.isFinite(c.maxHeight) ? c.maxHeight : null,
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.name)}</title><meta name="description" content="${esc(c.tagline)}">
<style>
:root{--a:${accent};--bg:#0b0d10;--fg:#e8e6e1;--mut:#8a8f98;--ln:#ffffff1a}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at top,color-mix(in srgb,var(--a) 10%,transparent),transparent 60%),var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
header{padding:44px 24px 20px;max-width:1100px;margin:auto}h1{margin:0;font:700 34px/1.1 ui-monospace,monospace;letter-spacing:.04em;color:var(--a)}
p.t{color:var(--mut);margin:8px 0 0}
#s{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;font:11px ui-monospace,monospace;letter-spacing:.08em}
.k{border:1px solid var(--ln);border-radius:999px;padding:5px 12px;background:#ffffff08;color:var(--mut)}.k b{color:var(--fg);font-weight:700}.k.f b{color:var(--a)}
main{max-width:1100px;margin:auto;padding:8px 24px 48px;display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.c{border:1px solid var(--ln);border-radius:12px;overflow:hidden;background:linear-gradient(#ffffff0a,#ffffff03);backdrop-filter:blur(6px);transition:transform .2s,border-color .2s,box-shadow .2s}
.c:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--a) 60%,transparent);box-shadow:0 10px 30px -12px var(--a)}
.v{aspect-ratio:1;display:grid;place-items:center;border-bottom:1px solid var(--ln);background:repeating-linear-gradient(0deg,#ffffff06 0 1px,transparent 1px 16px),repeating-linear-gradient(90deg,#ffffff06 0 1px,transparent 1px 16px),#050607;font:700 26px ui-monospace,monospace;color:var(--a);text-shadow:0 0 18px color-mix(in srgb,var(--a) 50%,transparent)}.v small{display:block;text-align:center;color:var(--mut);font-size:10px;letter-spacing:.2em;text-shadow:none}
.b{padding:12px}.h{font:700 15px ui-monospace,monospace}.p{color:var(--a);font:700 16px ui-monospace,monospace;margin-top:6px}.q{color:var(--mut);font:11px ui-monospace,monospace}
.c a{display:block;margin:0 12px 12px;padding:9px;text-align:center;border-radius:8px;background:var(--a);color:#000;font:700 12px ui-monospace,monospace;text-decoration:none;letter-spacing:.1em;transition:filter .15s}.c a:hover{filter:brightness(1.15)}
.hold{opacity:.5}.hold a{background:transparent;color:var(--mut);border:1px solid var(--ln)}
.e{grid-column:1/-1;border:1px dashed var(--ln);border-radius:12px;padding:40px 20px;text-align:center;color:var(--mut);font:12px/1.7 ui-monospace,monospace;letter-spacing:.06em}.e b{display:block;color:var(--fg);font-size:14px;margin-bottom:6px}.e a{color:var(--a)}
footer{text-align:center;color:var(--mut);font:11px ui-monospace,monospace;padding:24px}footer a{color:var(--a)}
</style></head><body>
<header><h1>${esc(c.name)}</h1><p class="t">${esc(c.tagline)}</p><div id="s"><span class="k">LOADING LIVE LISTINGS…</span></div></header>
<main id="g"></main>
<footer>Zero custody · you sign in your own wallet · data from <a href="${esc(base)}/api" target="_blank" rel="noreferrer">BitmapWin public API</a></footer>
<script>
const C=${cfg};
const g=document.getElementById('g'),s=document.getElementById('s');
const btc=v=>(v/1e8).toFixed(8).replace(/0+$/,'').replace(/\\.$/,'')+' BTC',sat=v=>Number(v).toLocaleString('en-US')+' sats';
fetch(C.url).then(r=>r.json()).then(d=>{
 const L=(d.listings||[]).filter(o=>(C.min==null||o.bitmap_height>=C.min)&&(C.max==null||o.bitmap_height<=C.max));
 const open=L.filter(o=>!o.on_hold),fl=open.length?Math.min(...open.map(o=>o.price_sats)):null;
 s.innerHTML='<span class="k"><b>'+L.length+'</b> FOR SALE</span>'+(fl!=null?'<span class="k f">FLOOR <b>'+sat(fl)+'</b> · '+btc(fl)+'</span>':'')+'<span class="k">● LIVE</span>';
 if(!L.length){g.innerHTML='<div class="e"><b>NO ACTIVE LISTINGS RIGHT NOW</b>Nothing matches this shop yet — check back soon, or browse the <a target="_blank" rel="noreferrer" href="'+C.base+'/marketplace">full marketplace</a>.</div>';return;}
 for(const o of L){const el=document.createElement('div');el.className='c'+(o.on_hold?' hold':'');
  const h=Number(o.bitmap_height),id=String(o.inscription_id).replace(/[^a-z0-9i]/gi,'');
  el.innerHTML='<a class="v" style="all:unset;cursor:pointer" target="_blank" rel="noreferrer" href="https://ordinals.com/inscription/'+id+'"></a><div class="b"><div class="h">'+h+'.bitmap</div><div class="p">'+sat(o.price_sats)+'</div><div class="q">'+btc(o.price_sats)+'</div></div><a target="_blank" rel="noreferrer" href="'+C.base+'/bitmap/'+h+'">'+(o.on_hold?'IN CHECKOUT':'BUY')+'</a>';
  g.appendChild(el);}
}).catch(()=>{s.innerHTML='<span class="k">COULD NOT LOAD LISTINGS — TRY AGAIN SOON</span>';});
</script></body></html>`;
}
