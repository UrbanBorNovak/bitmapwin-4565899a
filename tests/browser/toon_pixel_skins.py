import asyncio, json, re
from pathlib import Path
from playwright.async_api import async_playwright
S=Path("/tmp/browser/pixels/shots"); S.mkdir(parents=True,exist_ok=True)
A="5a8c5b891eed1f9975c74a1d4e40c4c3f37900236e3aba2068d9bde09e0bb324i0"
B="f1deececfbeead36c7a38d57cf09f1762f1d567ea5e71b02e7cf2d8e51df8622i0"
EP={"title":"Pixel fixture","aspect":"16:9","music":"chill","scenes":[{"block":208,"duration":3,"shot":"orbit","lines":[],"cast":[
 {"height":208,"name":"Pizza","x":-5,"z":0,"pose":"dance","avatar":{"model":"runner","skin":"px:"+A}},
 {"height":208,"name":"Participant","x":5,"z":0,"pose":"wave","avatar":{"model":"bruiser","skin":"px:"+B}}]}]}
hits={"A":0,"B":0,"Bfail":0}
async def img(route):
  u=route.request.url
  if A in u: hits["A"]+=1; return await route.fulfill(path="tests/browser/fixtures/pixel_a.png",content_type="image/png")
  if B in u:
    hits["B"]+=1
    if hits["Bfail"]<2: hits["Bfail"]+=1; return await route.fulfill(status=503,body="busy")
    return await route.fulfill(path="tests/browser/fixtures/pixel_b.png",content_type="image/png")
  await route.fulfill(status=404,body="no fixture")
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(headless=True,args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
    c=await b.new_context(viewport={"width":1280,"height":1800},accept_downloads=True)
    pg=await c.new_page(); errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)))
    await pg.route(re.compile(r".*/api/public/inscription/.*"),img)
    await pg.goto("http://localhost:8080/toon",wait_until="networkidle")
    await pg.add_style_tag(content="[role=dialog]{display:none!important}")
    await pg.get_by_role("button",name="+ ADD AVATAR").first.click()
    tex=pg.get_by_label("Avatar texture").last
    await pg.wait_for_function("()=>[...document.querySelectorAll('select[aria-label=\"Avatar texture\"] option')].length>50",timeout=30000)
    opts=await tex.locator("option").all_inner_texts()
    print("roster:",len(opts),opts[6:10])
    await tex.select_option("px:"+A)
    await pg.get_by_label("Episode script").fill(json.dumps(EP))
    await pg.get_by_role("button",name="[ APPLY SCRIPT ]").click()
    stage=pg.locator("canvas").first
    await pg.get_by_label("Timeline",exact=True).fill("0.4"); await pg.wait_for_timeout(1200)
    await stage.screenshot(path=str(S/"1_B_failing.png")); print("hits after fail window",dict(hits))
    await pg.wait_for_timeout(4000)
    await stage.screenshot(path=str(S/"2_recovered.png")); print("hits after recovery",dict(hits))
    await pg.get_by_label("Timeline",exact=True).fill("1.7"); await pg.wait_for_timeout(1500)
    await stage.screenshot(path=str(S/"3_scrub.png"))
    try:
      async with pg.expect_download(timeout=150000) as d:
        await pg.get_by_role("button",name=re.compile("EXPORT FOR X")).click()
      dl=await d.value; out="/tmp/browser/pixels/export"+Path(dl.suggested_filename).suffix
      await dl.save_as(out); print("export:",out,Path(out).stat().st_size)
    except Exception as e: print("export fail",e)
    async def fake(route):
      await route.fulfill(status=200,content_type="application/json",headers={"content-range":"0-0/1"},
        body=json.dumps({"id":"fixture-px","title":"Pixel fixture","creator_name":"test","episode":EP,"status":"approved"}))
    await pg.route(re.compile(r".*/rest/v1/toon_submissions.*"),fake)
    await pg.goto("http://localhost:8080/watch?ep=fixture-px",wait_until="networkidle")
    await pg.add_style_tag(content="[role=dialog]{display:none!important}")
    await pg.get_by_label("Seek").fill("0.8"); await pg.wait_for_timeout(4000)
    await pg.locator("canvas").first.screenshot(path=str(S/"4_watch.png"))
    print("errors:",errs[:6]); await b.close()
asyncio.run(main())
