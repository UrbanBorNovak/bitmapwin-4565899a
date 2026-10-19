"""Tide of Iron effects: stills at cue times, scrub/loop determinism, draw calls, JSON import validation, optional export.
Local GLB fixture only. Run: python3 tests/browser/toon_vfx.py [--export]"""
import asyncio, re, sys, hashlib
from pathlib import Path
from playwright.async_api import async_playwright
S = Path("/tmp/browser/vfx"); S.mkdir(parents=True, exist_ok=True)
F = Path(__file__).parent / "fixtures"
FIND = """()=>{let best=null,a=0;for(const c of document.querySelectorAll('canvas')){const r=c.getBoundingClientRect();if(r.width*r.height>a&&(c.getContext('webgl2')||c.getContext('webgl'))){a=r.width*r.height;best=c}}document.querySelectorAll('canvas').forEach(c=>c.removeAttribute('data-stage'));best&&best.setAttribute('data-stage','1')}"""
# Count draw calls per animation frame on every WebGL context.
COUNT = """(()=>{window.__dc=[];let n=0;for(const P of [WebGL2RenderingContext.prototype,WebGLRenderingContext.prototype]){for(const f of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const o=P[f];if(!o)continue;P[f]=function(...a){n++;return o.apply(this,a)}}}
const tick=()=>{window.__dc.push(n);if(window.__dc.length>120)window.__dc.shift();n=0;requestAnimationFrame(tick)};requestAnimationFrame(tick)})()"""
CUES = [("rain_s0", 1), ("blast_s0", 4.6), ("blast_s1", 21.7), ("blast_s2", 33.5), ("sparks_s2", 38.3), ("smoke_s3", 48), ("muzzle_s3", 50.05), ("blast_s4", 69.6), ("embers_s5", 80), ("dust_s8", 122.4), ("muzzle_s9", 139.05), ("rain_s11", 170)]
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"])
    c = await b.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True)
    await c.add_init_script(COUNT)
    pg = await c.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await pg.route(re.compile(r".*ordinals\.com/content/5e2d04efb.*"), lambda r: r.fulfill(path=str(F / "explorer_rig.glb"), content_type="model/gltf-binary"))
    await pg.goto("http://localhost:8080/toon", wait_until="networkidle")
    await pg.add_style_tag(content="[role=dialog]{display:none!important}")
    await pg.get_by_role("button", name=re.compile("TIDE OF IRON")).click()
    await pg.wait_for_timeout(2500); await pg.evaluate(FIND)
    st = pg.locator("canvas[data-stage]"); tl = pg.get_by_label("Timeline", exact=True)
    async def shot(t, name):
      await tl.fill(str(t)); await pg.wait_for_timeout(1500); await st.screenshot(path=str(S / f"{name}.png"))
      return hashlib.md5((S / f"{name}.png").read_bytes()).hexdigest()
    await tl.fill("1"); await pg.wait_for_timeout(5000)
    for name, t in CUES: await shot(t, name)
    # draw calls: no-fx moment vs heavy-fx moment (scene 5 has embers only; scene 0 rain+blast)
    async def dc(t):
      await tl.fill(str(t)); await pg.wait_for_timeout(1500); v = await pg.evaluate("window.__dc.slice(-20)"); return max(v), min(v)
    print("drawcalls blast+rain", await dc(4.6), "embers", await dc(80), "dust", await dc(122.4))
    # determinism: same moment after scrubbing around
    h1 = await shot(4.6, "det_a")
    for t in (100, 2, 170, 4.2, 60): await tl.fill(str(t)); await pg.wait_for_timeout(400)
    h2 = await shot(4.6, "det_b"); print("scrub deterministic", h1 == h2)
    # JSON import validation
    box = pg.get_by_label("Effect JSON"); imp = pg.get_by_role("button", name=re.compile("IMPORT EFFECT"))
    for label, js in [("garbage", "{not json"), ("format", '{"format":"x","id":"me/a-v1","keys":[]}'),
                      ("color", '{"format":"bitmapwin.vfx/1","id":"me/a-v1","keys":[{"t":0,"scale":1,"color":"red","opacity":1}]}'),
                      ("reserved", '{"format":"bitmapwin.vfx/1","id":"bitmapwin/x-v1","keys":[{"t":0,"scale":1,"color":"#ffffff","opacity":1}]}'),
                      ("ok", '{"format":"bitmapwin.vfx/1","id":"me/flare-v1","name":"Flare","count":99999,"keys":[{"t":0,"scale":1,"color":"#ff00ff","opacity":1}]}')]:
      await box.fill(js); await imp.click(); await pg.wait_for_timeout(200)
      msg = await pg.locator("section:has-text('IMPORT AN EFFECT') p.text-signal").inner_text()
      print("import", label, "->", msg)
    print("stored", await pg.evaluate("localStorage.getItem('bitmapwin.toon.vfx')"))
    if "--export" in sys.argv:
      async with pg.expect_download(timeout=590000) as d:
        await pg.get_by_role("button", name=re.compile("EXPORT VIDEO")).click()
      dl = await d.value; out = str(S / ("film" + Path(dl.suggested_filename).suffix)); await dl.save_as(out)
      print("export", dl.suggested_filename, Path(out).stat().st_size)
    await pg.goto("http://localhost:8080/watch", wait_until="networkidle"); await pg.wait_for_timeout(2500)
    await pg.screenshot(path=str(S / "watch.png"))
    print("errors", errs[:5])
    await b.close()
asyncio.run(main())
