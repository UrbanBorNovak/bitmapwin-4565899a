"""Store Kit LiveOCI scan: deterministic far-claim fixtures for both shops.

Run: python3 tests/browser/store_liveoci_scan.py   (dev server on :8080)

bop's block parser module is replaced by a fixture module, so block contents are fixed:
  970500.bitmap -> decoys at 970510 (trailing space), 970520 (delegate), 970530 (encoded),
                   first valid claim at 970540 (FX_A) - 40 blocks past the old 12-block window.
  970700.bitmap -> beyond the fixture tip (970600) -> no claim yet.
localStorage 'fx-fail' = block height that throws a network error (interrupted scan).
"""
import asyncio, json, subprocess, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path("/tmp/browser/store-fx"); OUT.mkdir(parents=True, exist_ok=True)
PARSER = "bbbb2172ebca174579884df1ad7487196c39e860b3aacdf4e052a33bf5ec31fai0"
FX_A = "a" * 64 + "i0"; FX_B = "b" * 64 + "i0"

FIXTURE = r"""
const hex=u=>Array.from(u,b=>b.toString(16).padStart(2,'0')).join('');
export const toHex=hex;
const T=970600, enc=s=>hex(new TextEncoder().encode(s));
const B={970510:[{bodyHex:enc('970500.bitmap '),complete:true,id:'d1'}],
 970520:[{bodyHex:enc('970500.bitmap'),complete:true,delegate:'x',id:'d2'}],
 970530:[{bodyHex:enc('970500.bitmap'),complete:true,contentEncoding:'br',id:'d3'}],
 970540:[{bodyHex:enc('970500.bitmap'),complete:false,id:'d4'},{bodyHex:enc('970500.bitmap'),complete:true,id:'%A%'}]};
export async function fetchBlock(n){(window.__fx=window.__fx||[]).push(n);
 if(String(n)===localStorage.getItem('fx-fail'))throw new Error('network down');
 if(n>T)throw new Error('/r/block/'+n+' returned HTTP 404');return{n}}
export function listInscriptions(b){return B[b.n]||[]}
""".replace("%A%", FX_A)

LISTINGS = [
    {"bitmap_height": 970500, "inscription_id": FX_A, "price_sats": 1000},
    {"bitmap_height": 970500, "inscription_id": FX_B, "price_sats": 2000},
    {"bitmap_height": 970700, "inscription_id": FX_B, "price_sats": 3000},
]

fails = []
def check(name, cond, got):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  got={got}"))
    if not cond: fails.append(name)

def build():
    gen = ROOT / ".fx-gen.ts"
    gen.write_text(
        'import { buildStoreHtml, DEFAULT_STORE } from "@/lib/store-template";\n'
        'import { buildSovereignStoreHtml } from "@/lib/sovereign-store";\n'
        'const c = { ...DEFAULT_STORE, apiBase: "http://localhost:8080" };\n'
        f'await Bun.write("{OUT}/std.html", buildStoreHtml(c));\n'
        f'await Bun.write("{OUT}/sov.html", buildSovereignStoreHtml(c));\n')
    try: subprocess.run(["bun", str(gen)], cwd=ROOT, check=True)
    finally: gen.unlink(missing_ok=True)

async def page(p):
    b = await p.chromium.launch(headless=True)
    ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
    await ctx.route(f"https://ordinals.com/content/{PARSER}*", lambda r: r.fulfill(body=FIXTURE, content_type="text/javascript", headers={"access-control-allow-origin": "*"}))
    await ctx.route("**/__std", lambda r: r.fulfill(body=(OUT / "std.html").read_text(), content_type="text/html"))
    await ctx.route("**/__sov", lambda r: r.fulfill(body=(OUT / "sov.html").read_text(), content_type="text/html"))
    await ctx.route("**/api/public/market/listings*", lambda r: r.fulfill(body=json.dumps({"listings": LISTINGS}), content_type="application/json"))
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    return b, pg, errs

async def sovereign(p):
    b, pg, errs = await page(p)
    await pg.goto("http://localhost:8080/__sov"); await pg.wait_for_timeout(800)
    await pg.evaluate("localStorage.clear();localStorage.setItem('fx-fail','970525')")
    r = await pg.evaluate("async()=>{const r=await BM.check(970500);return [r,localStorage.getItem('bmoci:970500'),await BM.oci(970500)]}")
    check("sov interrupted scan is a failure, not a verdict", r[0]["state"] == "fail" and r[2] is None, r)
    check("sov progress saved at the broken block", json.loads(r[1] or "{}").get("next") == 970525, r[1])
    await pg.evaluate("localStorage.removeItem('fx-fail')"); await pg.reload(); await pg.wait_for_timeout(800)
    r = await pg.evaluate("async()=>{const r=await BM.check(970500);return [r,window.__fx[0],window.__fx.length]}")
    check("sov resume starts at the saved block", r[1] == 970525, r)
    check("sov finds the far claim, skipping invalid decoys", r[0].get("id") == FX_A and r[2] == 16, r)
    await pg.reload(); await pg.wait_for_timeout(800)
    r = await pg.evaluate("async()=>[await BM.check(970500),(window.__fx||[]).length]")
    check("sov cached result needs no block downloads", r[0].get("id") == FX_A and r[1] == 0, r)
    r = await pg.evaluate("async()=>[await BM.check(970700),await BM.oci(970700)]")
    check("sov past the tip is 'no claim yet', never an id", r[0]["state"] == "none" and r[1] is None, r)
    check("sov no page errors", not errs, errs); await b.close()

BADGES = "[...document.querySelectorAll('.c')].map(c=>c.querySelector('.o').className+'|'+c.querySelector('.o').textContent)"

async def standard(p):
    b, pg, errs = await page(p)
    await pg.goto("http://localhost:8080/robots.txt")
    await pg.evaluate("localStorage.clear();localStorage.setItem('fx-fail','970525')")
    await pg.goto("http://localhost:8080/__std"); await pg.wait_for_timeout(4000)
    s = await pg.evaluate(BADGES)
    check("std interrupted: both 970500 cards say RETRY, none marked duplicate", all("RETRY" in x and "bad" not in x for x in s[:2]), s)
    check("std beyond tip says NO CLAIM YET, not duplicate", "NO CLAIM YET" in s[2] and "bad" not in s[2], s)
    await pg.evaluate("localStorage.removeItem('fx-fail')")
    await pg.locator(".o").first.click(); await pg.wait_for_timeout(4000)
    s = await pg.evaluate(BADGES)
    check("std retry proves the real claim canonical", s[0].startswith("o ok|"), s)
    check("std retry marks the other id as duplicate only after the claim is found", "o bad|" in s[1] or "RETRY" in s[1], s)
    await pg.locator(".o").nth(1).click(); await pg.wait_for_timeout(1500)
    s = await pg.evaluate(BADGES)
    check("std duplicate card shows NOT FIRST-IS-FIRST", s[1].startswith("o bad|"), s)
    await pg.reload(); await pg.wait_for_timeout(2500)
    s = await pg.evaluate(BADGES); n = await pg.evaluate("(window.__fx||[]).filter(x=>x<=970600).length")
    check("std reload uses cached proof", s[0].startswith("o ok|") and s[1].startswith("o bad|") and n == 0, [s, n])
    check("std BUY links intact", await pg.locator("a[href*='/bitmap/970500']").count() == 2, "")
    await pg.screenshot(path=str(OUT / "std.png"))
    check("std no page errors", not errs, errs); await b.close()

async def main():
    build()
    async with async_playwright() as p:
        await sovereign(p); await standard(p)
    print("ALL PASS" if not fails else f"{len(fails)} FAILED"); sys.exit(1 if fails else 0)

asyncio.run(main())
