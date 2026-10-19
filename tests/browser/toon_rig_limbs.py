"""On-chain rig limbs: every pose visibly moves, scrubbing back returns the identical frame (no accumulation),
Watch plays, export has motion. Local GLB + pixel fixtures only (no inscriptions, broadcasts or funds).
Run: python3 tests/browser/toon_rig_limbs.py"""
import asyncio, json, re
from pathlib import Path
from PIL import Image, ImageChops
from playwright.async_api import async_playwright
S = Path("/tmp/browser/limbs"); S.mkdir(parents=True, exist_ok=True)
F = Path(__file__).parent / "fixtures"
A = "5a8c5b891eed1f9975c74a1d4e40c4c3f37900236e3aba2068d9bde09e0bb324i0"
def av(n, x, pose, **k): return {"height": 208, "name": n, "x": x, "z": 0, "pose": pose, "avatar": {"model": "runner", "skin": "px:" + A}, **k}
EP = {"title": "Limbs", "aspect": "16:9", "scenes": [
  {"block": 208, "duration": 4, "shot": "wide", "lines": [], "cast": [av("I", -6, "idle"), av("T", -2, "talk"), av("W", 2, "wave"), av("D", 6, "dance")]},
  {"block": 208, "duration": 4, "shot": "wide", "lines": [], "cast": [av("C", -5, "combat"), av("J", 0, "jump"), av("K", 5, "walk", to={"x": -5, "z": 0}, moveStart=0, moveEnd=4)]}]}

def diff(a, b):
  d = ImageChops.difference(Image.open(a).convert("L"), Image.open(b).convert("L"))
  return sum(1 for p in d.get_flattened_data() if p > 24)

async def main():
  ok = []
  async with async_playwright() as p:
    b = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    c = await b.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True)
    pg = await c.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.route(re.compile(r".*ordinals\.com/content/5e2d04efb.*"), lambda r: r.fulfill(path=str(F / "explorer_rig.glb"), content_type="model/gltf-binary"))
    await pg.route(re.compile(r".*/api/public/inscription/.*"), lambda r: r.fulfill(path=str(F / "pixel_a.png"), content_type="image/png"))
    await pg.goto("http://localhost:8080/toon", wait_until="networkidle")
    await pg.add_style_tag(content="[role=dialog]{display:none!important}")
    await pg.get_by_label("Episode script").fill(json.dumps(EP))
    await pg.get_by_role("button", name="[ APPLY SCRIPT ]").click()
    await pg.evaluate("""()=>{let best=null,a=0;for(const c of document.querySelectorAll('canvas')){const r=c.getBoundingClientRect();if(r.width*r.height>a&&(c.getContext('webgl2')||c.getContext('webgl'))){a=r.width*r.height;best=c}}document.querySelectorAll('canvas').forEach(c=>c.removeAttribute('data-stage'));best&&best.setAttribute('data-stage','1')}""")
    st = pg.locator("canvas[data-stage]"); tl = pg.get_by_label("Timeline", exact=True)
    async def shot(t, name):
      await tl.fill(f"{t:g}"); await pg.wait_for_timeout(1200); f = str(S / f"{name}.png"); await st.screenshot(path=f); return f
    await shot(0.5, "warm")
    for scene, (t1, t2) in (("s1", (1, 1.7)), ("s2", (5, 5.7))):
      await shot(t1, "pre"); a = await shot(t1, f"{scene}_a"); a0 = await shot(t1, f"{scene}_a_same"); bb = await shot(t2, f"{scene}_b")
      print(scene, "same-time jitter px", diff(a, a0))
      # loop back and forth, then return: same time must give the same frame
      for _ in range(4): await shot(t2, "loop"); await shot(t1, "loop")
      a2 = await shot(t1, f"{scene}_a_again")
      move, drift = diff(a, bb), diff(a, a2)
      print(scene, "move px", move, "drift px", drift)
      ok.append((f"{scene} limbs move", move > 400)); ok.append((f"{scene} no accumulation", drift < move * 0.1))
    try:
      async with pg.expect_download(timeout=240000) as d:
        await pg.get_by_role("button", name=re.compile("EXPORT VIDEO")).click()
      dl = await d.value; out = "/tmp/browser/limbs/export" + Path(dl.suggested_filename).suffix
      await dl.save_as(out); ok.append(("export saved", Path(out).stat().st_size > 20000)); print("export", out)
    except Exception as e: ok.append(("export saved", False)); print(e)
    async def fake(route):
      await route.fulfill(status=200, content_type="application/json", headers={"content-range": "0-0/1"},
        body=json.dumps({"id": "fixture-limbs", "title": "Limbs", "creator_name": "test", "episode": EP, "status": "approved"}))
    await pg.route(re.compile(r".*/rest/v1/toon_submissions.*"), fake)
    await pg.goto("http://localhost:8080/watch?ep=fixture-limbs", wait_until="networkidle")
    await pg.add_style_tag(content="[role=dialog]{display:none!important}")
    await pg.wait_for_timeout(3000)
    await pg.get_by_role("button", name=re.compile(r"\[ ▶ PLAY \]")).click()
    await pg.evaluate("""()=>{let best=null,a=0;for(const c of document.querySelectorAll('canvas')){const r=c.getBoundingClientRect();if(r.width*r.height>a&&(c.getContext('webgl2')||c.getContext('webgl'))){a=r.width*r.height;best=c}}document.querySelectorAll('canvas').forEach(c=>c.removeAttribute('data-stage'));best&&best.setAttribute('data-stage','1')}""")
    w = pg.locator("canvas[data-stage]")
    await pg.wait_for_timeout(1500); await w.screenshot(path=str(S / "watch_a.png"))
    await pg.wait_for_timeout(700); await w.screenshot(path=str(S / "watch_b.png"))
    seek = await pg.get_by_label("Seek").input_value(); print("watch seek", seek)
    ok.append(("watch plays", float(seek) > 0.5)); ok.append(("watch limbs move", diff(str(S / "watch_a.png"), str(S / "watch_b.png")) > 400))
    ok.append(("no page errors", not errs)); print("errors", errs[:5])
    await b.close()
  for n, v in ok: print("PASS" if v else "FAIL", n)
asyncio.run(main())
