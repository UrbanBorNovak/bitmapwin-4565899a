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
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
header{padding:40px 24px 16px;max-width:1100px;margin:auto}h1{margin:0;font:700 34px/1.1 ui-monospace,monospace;letter-spacing:.04em;color:var(--a)}
p.t{color:var(--mut);margin:8px 0 0}#s{color:var(--mut);font:12px ui-monospace,monospace;margin-top:16px}
main{max-width:1100px;margin:auto;padding:8px 24px 48px;display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}
.c{border:1px solid var(--ln);border-radius:10px;overflow:hidden;background:#ffffff08}
.c img{display:block;width:100%;aspect-ratio:1;object-fit:cover;background:#000;image-rendering:pixelated}
.b{padding:10px 12px}.h{font:700 15px ui-monospace,monospace}.p{color:var(--a);font:600 14px ui-monospace,monospace}
.c a{display:block;margin:0 12px 12px;padding:8px;text-align:center;border-radius:6px;background:var(--a);color:#000;font:700 12px ui-monospace,monospace;text-decoration:none;letter-spacing:.08em}
.hold{opacity:.5}footer{text-align:center;color:var(--mut);font:11px ui-monospace,monospace;padding:24px}footer a{color:var(--a)}
</style></head><body>
<header><h1>${esc(c.name)}</h1><p class="t">${esc(c.tagline)}</p><div id="s">LOADING LIVE LISTINGS…</div></header>
<main id="g"></main>
<footer>Zero custody · you sign in your own wallet · data from <a href="${esc(base)}/api" target="_blank" rel="noreferrer">BitmapWin public API</a></footer>
<script>
const C=${cfg};
const g=document.getElementById('g'),s=document.getElementById('s');
fetch(C.url).then(r=>r.json()).then(d=>{
 const L=(d.listings||[]).filter(o=>(C.min==null||o.bitmap_height>=C.min)&&(C.max==null||o.bitmap_height<=C.max));
 s.textContent=L.length+' BITMAP'+(L.length===1?'':'S')+' FOR SALE';
 for(const o of L){const el=document.createElement('div');el.className='c'+(o.on_hold?' hold':'');
  const h=Number(o.bitmap_height),id=String(o.inscription_id).replace(/[^a-z0-9i]/gi,'');
  el.innerHTML='<img loading="lazy" alt="'+h+'.bitmap" src="https://ordinals.com/content/'+id+'"><div class="b"><div class="h">'+h+'.bitmap</div><div class="p">'+(o.price_sats/1e8).toFixed(8).replace(/0+$/,'').replace(/\\.$/,'')+' BTC</div></div><a target="_blank" rel="noreferrer" href="'+C.base+'/bitmap/'+h+'">'+(o.on_hold?'IN CHECKOUT':'BUY')+'</a>';
  g.appendChild(el);}
}).catch(()=>{s.textContent='COULD NOT LOAD LISTINGS — TRY AGAIN SOON';});
</script></body></html>`;
}
