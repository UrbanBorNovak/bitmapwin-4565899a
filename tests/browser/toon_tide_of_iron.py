"""Tide of Iron: load from Toon Studio, screenshot every scene, play in Watch, export the full film and sample frames.
Local GLB + pixel fixtures only. Run: python3 tests/browser/toon_tide_of_iron.py [--export]"""
import asyncio, re, subprocess, sys, json
from pathlib import Path
from playwright.async_api import async_playwright
S = Path("/tmp/browser/tide"); S.mkdir(parents=True, exist_ok=True)
F = Path(__file__).parent / "fixtures"
FIND = """()=>{let best=null,a=0;for(const c of document.querySelectorAll('canvas')){const r=c.getBoundingClientRect();if(r.width*r.height>a&&(c.getContext('webgl2')||c.getContext('webgl'))){a=r.width*r.height;best=c}}document.querySelectorAll('canvas').forEach(c=>c.removeAttribute('data-stage'));best&&best.setAttribute('data-stage','1')}"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"])
    c = await b.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True)
    pg = await c.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await pg.route(re.compile(r".*ordinals\.com/content/5e2d04efb.*"), lambda r: r.fulfill(path=str(F / "explorer_rig.glb"), content_type="model/gltf-binary"))
    await pg.goto("http://localhost:8080/toon", wait_until="networkidle")
    await pg.add_style_tag(content="[role=dialog]{display:none!important}")
    await pg.get_by_role("button", name=re.compile("TIDE OF IRON")).click()
    await pg.wait_for_timeout(2000); await pg.evaluate(FIND)
    st = pg.locator("canvas[data-stage]"); tl = pg.get_by_label("Timeline", exact=True)
    print("timeline max", await tl.get_attribute("max"))
    await tl.fill("1"); await pg.wait_for_timeout(5000)
    for i in range(12):
      for k, off in (("a", 1), ("b", 10)):
        await tl.fill(str(i * 15 + off)); await pg.wait_for_timeout(1200); await st.screenshot(path=str(S / f"s{i:02d}{k}.png"))
    await pg.get_by_role("button", name=re.compile(r"PLAY")).first.click(); await pg.wait_for_timeout(4000)
    print("time after play", await tl.input_value())
    if "--export" in sys.argv:
      async with pg.expect_download(timeout=560000) as d:
        await pg.get_by_role("button", name=re.compile("EXPORT VIDEO")).click()
      dl = await d.value; out = str(S / ("film" + Path(dl.suggested_filename).suffix)); await dl.save_as(out)
      print("export", dl.suggested_filename, Path(out).stat().st_size)
    await pg.goto("http://localhost:8080/watch", wait_until="networkidle")
    await pg.wait_for_timeout(3000); await pg.screenshot(path=str(S / "watch.png"))
    print("errors", errs[:5])
    await b.close()
asyncio.run(main())
