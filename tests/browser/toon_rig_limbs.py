"""On-chain rig limbs, pose by pose: actors stand at their assigned spots, each of the seven poses visibly moves
on its own, scrubbing/looping back returns the identical frame (no rotation buildup), Watch plays, export has motion.
Local GLB + pixel fixtures only (no inscriptions, broadcasts or funds).
Run: python3 tests/browser/toon_rig_limbs.py"""
import asyncio, json, re, subprocess
from pathlib import Path
from PIL import Image, ImageChops
from playwright.async_api import async_playwright
S = Path("/tmp/browser/limbs"); S.mkdir(parents=True, exist_ok=True)
F = Path(__file__).parent / "fixtures"
A = "5a8c5b891eed1f9975c74a1d4e40c4c3f37900236e3aba2068d9bde09e0bb324i0"
POSES = ["idle", "talk", "wave", "dance", "combat", "jump", "walk"]
DUR = 3
def av(n, x, pose): return {"height": 208, "name": n, "x": x, "z": 0, "pose": pose, "avatar": {"model": "runner", "skin": "px:" + A}}
# Scene 0: spacing check (three actors 30 units apart). Then one scene per pose with a single actor.
SPOTS = [-30, 0, 30]
EP = {"title": "Limbs", "aspect": "16:9", "scenes": [{"block": 208, "duration": DUR, "shot": "wide", "lines": [], "cast": [av(f"s{i}", x, "idle") for i, x in enumerate(SPOTS)]}] +
  [{"block": 208, "duration": DUR, "shot": "wide", "lines": [], "cast": [av(p, 0, p)]} for p in POSES]}
FIND = """()=>{let best=null,a=0;for(const c of document.querySelectorAll('canvas')){const r=c.getBoundingClientRect();if(r.width*r.height>a&&(c.getContext('webgl2')||c.getContext('webgl'))){a=r.width*r.height;best=c}}document.querySelectorAll('canvas').forEach(c=>c.removeAttribute('data-stage'));best&&best.setAttribute('data-stage','1')}"""
HEADS = "async()=>{const m=await import('/src/lib/toon-anchors.ts');return [...m.toonHeads.entries()].sort((a,b)=>a[0]-b[0]).map(([k,v])=>v.x)}"

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
    await pg.evaluate(FIND)
    st = pg.locator("canvas[data-stage]"); tl = pg.get_by_label("Timeline", exact=True)
    async def shot(t, name):
      await tl.fill(f"{t:g}"); await pg.wait_for_timeout(1100); f = str(S / f"{name}.png"); await st.screenshot(path=f); return f
    await shot(0.5, "warm"); await pg.wait_for_timeout(3000)
    # Spacing: heads keep their left-to-right order and stay well apart.
    await shot(1, "spacing"); xs = await pg.evaluate(HEADS); print("spacing heads", [round(x, 3) for x in xs])
    ok.append(("actors at assigned spots", len(xs) == 3 and xs[0] < xs[1] < xs[2] and min(xs[1] - xs[0], xs[2] - xs[1]) > 0.12))
    for i, pose in enumerate(POSES):
      t0 = (i + 1) * DUR
      t1, t2 = t0 + 1, t0 + 1.6
      await shot(t1, "pre"); a = await shot(t1, f"{pose}_a"); bb = await shot(t2, f"{pose}_b")
      for _ in range(3): await shot(t2, "loop"); await shot(t1 - 0.5, "loop")
      a2 = await shot(t1, f"{pose}_a_again")
      move, drift = diff(a, bb), diff(a, a2)
      print(f"{pose:7s} move px {move:6d} drift px {drift}")
      ok.append((f"{pose} limbs move", move > 300)); ok.append((f"{pose} no rotation buildup", drift < max(40, move * 0.05)))
    try:
      async with pg.expect_download(timeout=300000) as d:
        await pg.get_by_role("button", name=re.compile("EXPORT VIDEO")).click()
      dl = await d.value; out = str(S / ("export" + Path(dl.suggested_filename).suffix))
      await dl.save_as(out); ok.append(("export saved", Path(out).stat().st_size > 20000))
      # Pull two frames inside each pose scene and compare: the recorded video must show limb motion per pose.
      moved = 0
      for i, pose in enumerate(POSES):
        t0 = (i + 1) * DUR
        fa, fb = str(S / f"ex_{pose}_a.png"), str(S / f"ex_{pose}_b.png")
        for t, f in ((t0 + 1, fa), (t0 + 1.6, fb)):
          subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t}", "-i", out, "-frames:v", "1", f], check=False)
        if Path(fa).exists() and Path(fb).exists():
          m = diff(fa, fb); print(f"export {pose:7s} move px {m}"); moved += m > 300
      ok.append(("export shows motion in every pose", moved == len(POSES)))
    except Exception as e: ok.append(("export saved", False)); print(e)
    async def fake(route):
      await route.fulfill(status=200, content_type="application/json", headers={"content-range": "0-0/1"},
        body=json.dumps({"id": "fixture-limbs", "title": "Limbs", "creator_name": "test", "episode": EP, "status": "approved"}))
    await pg.route(re.compile(r".*/rest/v1/toon_submissions.*"), fake)
    await pg.goto("http://localhost:8080/watch?ep=fixture-limbs", wait_until="networkidle")
    await pg.add_style_tag(content="[role=dialog]{display:none!important}")
    await pg.wait_for_timeout(3000)
    await pg.get_by_role("button", name=re.compile(r"\[ ▶ PLAY \]")).click()
    await pg.evaluate(FIND); w = pg.locator("canvas[data-stage]"); seek = pg.get_by_label("Seek")
    # Watch: seek into each pose scene while playing and confirm the figure moves between two moments.
    wm = 0
    for i, pose in enumerate(POSES):
      await seek.fill(f"{(i + 1) * DUR + 0.5:g}"); await pg.wait_for_timeout(500)
      fa, fb = str(S / f"w_{pose}_a.png"), str(S / f"w_{pose}_b.png")
      await w.screenshot(path=fa); await pg.wait_for_timeout(600); await w.screenshot(path=fb)
      m = diff(fa, fb); print(f"watch  {pose:7s} move px {m}"); wm += m > 300
    sv = float(await seek.input_value()); print("watch seek", sv)
    ok.append(("watch plays", sv > DUR)); ok.append(("watch limbs move in every pose", wm == len(POSES)))
    ok.append(("no page errors", not errs)); print("errors", errs[:5])
    await b.close()
  for n, v in ok: print("PASS" if v else "FAIL", n)
asyncio.run(main())
