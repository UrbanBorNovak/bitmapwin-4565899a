import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright
D = Path("/tmp/browser/colony_export"); (D/"s").mkdir(exist_ok=True)
BLOCKS = [[x,y,10,"stone"] for x in range(4) for y in range(3)] + [[20,0,20,"grass"],[21,0,20,"gold"]]
ROW = {"id":"00000000-0000-0000-0000-00000000seed","bitmap_height":840000,"parcel_index":None,"role":"bitmap","block_count":len(BLOCKS),
       "note":"seeded test","model_inscription_id":None,"status":"pending","created_at":"2026-10-20T17:00:00Z","blocks":BLOCKS}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width":1280,"height":1800}, accept_downloads=True)
        await ctx.grant_permissions(["clipboard-read","clipboard-write"], origin="http://localhost:8080")
        page = await ctx.new_page()
        errs=[]; page.on("pageerror", lambda e: errs.append(str(e)))
        async def fake(route):
            if route.request.method == "GET": await route.fulfill(status=200, content_type="application/json", body=json.dumps([ROW]))
            else: await route.continue_()
        await page.route("**/rest/v1/build_proposals*", fake)
        await page.goto("http://localhost:8080")
        await page.evaluate("([k,v])=>localStorage.setItem(k,v)", [os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"], os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]])
        await page.goto("http://localhost:8080/colony", wait_until="networkidle")
        await page.get_by_role("button", name="EXPORT .BWVX").wait_for(timeout=20000)
        for name, fn in [("EXPORT .BWVX","p.bwvx"),("EXPORT .GLB","p.glb")]:
            async with page.expect_download() as dl:
                await page.get_by_role("button", name=name).click()
            d = await dl.value; await d.save_as(str(D/fn)); print(name, d.suggested_filename)
        await page.get_by_role("button", name="COPY THREE.JS LOADER").click()
        await page.wait_for_timeout(800)
        (D/"loader.js").write_text(await page.evaluate("navigator.clipboard.readText()"))
        await page.screenshot(path=str(D/"s/colony.png"))
        print("errors", errs)
        await b.close()
asyncio.run(main())
