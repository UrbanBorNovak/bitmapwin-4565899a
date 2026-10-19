"""Toon Studio on-chain rig: local GLB + pixel fixtures, model/skin failure recovery, Watch, export.
Run: python3 tests/browser/toon_onchain_rig.py  (no inscriptions, broadcasts or funds)."""
import asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright
S=Path("/tmp/browser/rig/shots"); S.mkdir(parents=True,exist_ok=True)
F=Path(__file__).parent/"fixtures"
A="5a8c5b891eed1f9975c74a1d4e40c4c3f37900236e3aba2068d9bde09e0bb324i0"
B="f1deececfbeead36c7a38d57cf09f1762f1d567ea5e71b02e7cf2d8e51df8622i0"
EP={"title":"Rig fixture","aspect":"16:9","music":"chill","scenes":[{"block":208,"duration":3,"shot":"orbit","lines":[],"cast":[
 {"height":208,"name":"Pizza","x":-4,"z":0,"pose":"idle","avatar":{"model":"runner","skin":"px:"+A}},
 {"height":208,"name":"Part","x":4,"z":0,"pose":"combat","avatar":{"model":"bruiser","skin":"px:"+B}}]}]}
h={"glb":0,"A":0,"B":0}
async def glb(route):
  h["glb"]+=1
  if h["glb"]<=1: return await route.fulfill(status=503,body="busy")
  await route.fulfill(path=str(F/"explorer_rig.glb"),content_type="model/gltf-binary")
async def img(route):
  u=route.request.url
  if A in u: h["A"]+=1; return await route.fulfill(path=str(F/"pixel_a.png"),content_type="image/png")
  if B in u:
    h["B"]+=1
    if h["B"]<=1: return await route.fulfill(status=503,body="busy")
    return await route.fulfill(path=str(F/"pixel_b.png"),content_type="image/png")
  await route.fulfill(status=404,body="no fixture")
async def probe(pg):
  return await pg.evaluate("""()=>{const c=document.querySelector('canvas');const g=c.getContext('webgl2')||c.getContext('webgl');return !!g}""")
async def main():
  ok=[]
  async with async_playwright() as p:
    b=await p.chromium.launch(headless=True,args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
    c=await b.new_context(viewport={"width":1280,"height":1800},accept_downloads=True)
    pg=await c.new_page(); errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)))
    await pg.route(re.compile(r".*ordinals\.com/content/5e2d04efb.*"),glb)
    await pg.route(re.compile(r".*/api/public/inscription/.*"),img)
    await pg.goto("http://localhost:8080/toon",wait_until="networkidle")
    await pg.add_style_tag(content="[role=dialog]{display:none!important}")
    await pg.get_by_label("Episode script").fill(json.dumps(EP))
    await pg.get_by_role("button",name="[ APPLY SCRIPT ]").click()
    st=pg.locator("canvas").first
    await pg.get_by_label("Timeline",exact=True).fill("0.3"); await pg.wait_for_timeout(700)
    await st.screenshot(path=str(S/"1_fallback.png")); print("during failure",dict(h))
    await pg.wait_for_timeout(5000)
    await st.screenshot(path=str(S/"2_recovered.png")); print("after recovery",dict(h))
    ok.append(("model retried",h["glb"]>=2)); ok.append(("skin retried",h["B"]>=2))
    for t in ("1","2.2"):
      await pg.get_by_label("Timeline",exact=True).fill(t); await pg.wait_for_timeout(900)
      await st.screenshot(path=str(S/f"3_scrub_{t}.png"))
    try:
      async with pg.expect_download(timeout=150000) as d:
        await pg.get_by_role("button",name=re.compile("EXPORT FOR X")).click()
      dl=await d.value; out="/tmp/browser/rig/export"+Path(dl.suggested_filename).suffix
      await dl.save_as(out); ok.append(("export",Path(out).stat().st_size>20000)); print("export",out)
    except Exception as e: ok.append(("export",False)); print(e)
    async def fake(route):
      await route.fulfill(status=200,content_type="application/json",headers={"content-range":"0-0/1"},
        body=json.dumps({"id":"fixture-rig","title":"Rig fixture","creator_name":"test","episode":EP,"status":"approved"}))
    await pg.route(re.compile(r".*/rest/v1/toon_submissions.*"),fake)
    await pg.goto("http://localhost:8080/watch?ep=fixture-rig",wait_until="networkidle")
    await pg.add_style_tag(content="[role=dialog]{display:none!important}")
    await pg.get_by_label("Seek").fill("0.8"); await pg.wait_for_timeout(4000)
    await pg.locator("canvas").first.screenshot(path=str(S/"4_watch.png"))
    ok.append(("no page errors",not errs)); print("errors",errs[:5])
    await b.close()
  for n,v in ok: print("PASS" if v else "FAIL",n)
asyncio.run(main())
