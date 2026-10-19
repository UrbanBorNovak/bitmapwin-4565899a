"""Browser regression: /sdk BWVX try-viewer + .GLB download recover after malformed builds.
Local fixtures only. Run: python3 tests/browser/sdk_bwvx_recovery.py (dev server on :8080)."""
import asyncio, base64, json, struct, sys
from playwright.async_api import async_playwright

URL = "http://localhost:8080/sdk"
b64 = lambda bs: base64.b64encode(bytes(bs)).decode()
V2 = [66, 87, 50, 0]
GOOD3 = b64(V2 + [0,0,0,3,2,1,3] + [6,0,0,6,2,0,3] + [10,0,10,10,0,10,3])  # 3 boxes, bounds 0..11 x 0..3 x 0..11
GOOD1 = b64(V2 + [0,0,0,1,1,1,3])
BAD = {"truncated": b64(V2 + [0,0,0,1]), "reversed": b64(V2 + [5,0,0,4,1,1,3]), "palette": b64([0,0,0,255]), "base64": "%%%"}
fails = []
def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok: fails.append(msg)

def glb_bounds(data: bytes):
    assert data[:4] == b"glTF", "not a glb"
    ln = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + ln])
    acc = j["accessors"][j["meshes"][0]["primitives"][0]["attributes"]["POSITION"]]
    return len(j["meshes"]), acc["min"], acc["max"]

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True)
        ctx = await br.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True)
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(URL, wait_until="networkidle")
        inp, load, glb = page.get_by_test_id("bwvx-try-input"), page.get_by_test_id("bwvx-try-load"), page.get_by_test_id("bwvx-try-glb")
        err, ok, canvas = page.get_by_test_id("bwvx-try-error"), page.get_by_test_id("bwvx-try-ok"), page.get_by_test_id("bwvx-try-canvas")
        await inp.scroll_into_view_if_needed()

        for label, bad in BAD.items():
            await inp.fill(GOOD1); await load.click(); await ok.wait_for()
            await inp.fill(bad); await load.click(); await err.wait_for()
            txt = await err.inner_text()
            check("BWVX" in txt, f"viewer shows error for {label}: {txt!r}")
            check(await ok.count() == 0 and await canvas.get_attribute("data-boxes") == "0", f"preview cleared after {label}")
            dl = []
            page.once("download", lambda d: dl.append(d))
            await glb.click(); await err.wait_for(); await page.wait_for_timeout(400)
            check(not dl, f"no file downloaded for {label}")

        await inp.fill(GOOD3); await load.click(); await ok.wait_for()
        check(await ok.get_attribute("data-boxes") == "3" and await err.count() == 0, "valid build loads after failures, no stale error")
        async with page.expect_download() as info:
            await glb.click()
        d = await info.value
        data = open(await d.path(), "rb").read()
        meshes, mn, mx = glb_bounds(data)
        check(d.suggested_filename == "bwvx-build.glb" and meshes == 1 and mn == [0,0,0] and mx == [11,3,11], f"downloaded glb ok: {meshes} mesh, {mn}..{mx}")
        await page.screenshot(path="/tmp/browser/sdk_ok.png")

        # Rapid successive loads: fire without waiting; final state must match the last payload only.
        for seq, final in [([GOOD3, BAD["reversed"], GOOD1, BAD["palette"]], "error"), ([BAD["truncated"], GOOD1, BAD["reversed"], GOOD3], "ok")]:
            for pl in seq:
                await inp.fill(pl); await load.click(no_wait_after=True)
            await page.wait_for_timeout(800)
            if final == "error":
                check(await err.count() == 1 and await ok.count() == 0 and await canvas.get_attribute("data-boxes") == "0", "rapid loads ending on a bad build: error only, preview cleared")
            else:
                check(await ok.get_attribute("data-boxes") == "3" and await err.count() == 0, "rapid loads ending on a good build: only latest build, no stale error")
        await page.screenshot(path="/tmp/browser/sdk_rapid.png")
        check(not errors, f"no page crashes {errors}")
        await br.close()
    sys.exit(1 if fails else 0)

asyncio.run(main())
