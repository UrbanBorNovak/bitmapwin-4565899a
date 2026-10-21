"""Deterministic Oasis gate harness: mock keycards + mock Bitcoin, no real coins.
Run: python3 tests/browser/gate_recheck_harness.py  (dev server on :8080)"""
import asyncio, json, subprocess, sys
from playwright.async_api import async_playwright
FX = "/tmp/gate_fixtures.json"
subprocess.run(["bun", "tests/browser/gate_fixtures.ts"], check=True, capture_output=True)
F = json.load(open(FX))
A, B = "cypherpunk-assembly", "the-hyperbolic-time-chamber-156795-5ibi"
ok = True
def check(name, cond, extra=""):
    global ok; ok &= bool(cond); print(("PASS " if cond else "FAIL ") + name, extra)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 960, "height": 1100}); pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
        cur = {"r": dict(F["pending"]["routes"])}
        async def h(route):
            v = cur["r"].get(route.request.url.split("/api", 1)[1])
            hdr = {"access-control-allow-origin": "*", "content-type": "application/json"}
            if v is None or v == "DOWN": await route.fulfill(status=503, body="down", headers=hdr)
            else: await route.fulfill(status=200, body=str(v) if isinstance(v, int) else json.dumps(v), headers=hdr)
        await ctx.route("https://mempool.space/api/**", h)
        await pg.goto("http://localhost:8080/")
        await pg.evaluate("v=>{localStorage.clear();localStorage.setItem('bitmapwin:tour-done','1');localStorage.setItem('bitmapwin:sealed-notes',v)}", json.dumps(F["pending"]["held"]))
        await pg.goto("http://localhost:8080/oasis?height=819245", wait_until="domcontentloaded")
        await pg.wait_for_function("()=>(window.__bwGates||[]).length>=2", timeout=300000)
        if await pg.get_by_text("SKIP").count(): await pg.get_by_text("SKIP").first.dispatch_event("click")
        spot = lambda slug: pg.evaluate("s=>{const g=window.__bwGates.find(x=>x.slug===s);return {x:g.x,z:g.z}}", slug)
        place = lambda pos: pg.evaluate("p=>{window.__bwGateHarness=p}", pos)
        toasts = lambda: pg.evaluate("()=>[...document.querySelectorAll('[data-sonner-toast]')].filter(t=>t.textContent.includes('GATEWAY SEALED')).map(t=>t.textContent)")
        inRoom = lambda: pg.evaluate("()=>document.body.innerText.includes('◈ SHADOW VAULT')")
        await pg.get_by_role("button", name="[B] QUESTS").first.dispatch_event("click")
        recheck = lambda: pg.get_by_role("button", name="[ RECHECK ]").dispatch_event("click")

        a, bb = await spot(A), await spot(B)
        await place({"x": a["x"] + 99999, "z": a["z"]})
        # 1 · wrong gate: keycard for A never opens B
        await place(bb); await pg.wait_for_timeout(2500)
        t = await toasts(); check("wrong gate stays shut", not await inRoom() and any("WRONG GATE" in x for x in t), t[-1:] )
        await place({"x": bb["x"] + 99999, "z": bb["z"]}); await pg.wait_for_timeout(800)
        # 2 · pending at A, RECHECK while still pending (5/6) updates one message
        await place(a); await pg.wait_for_timeout(2500)
        t = await toasts(); check("pending 3/6 blocked", not await inRoom() and any("3/6" in x for x in t), t[-1:])
        cur["r"]["/blocks/tip/height"] = 202; await recheck(); await pg.wait_for_timeout(2500)
        t = [x for x in await toasts() if "KEYCARD PENDING" in x]
        check("RECHECK updates in place, no duplicates", len(t) == 1 and "5/6" in t[0], t)
        # 3 · leaving clears the retry: RECHECK while away does nothing
        await place({"x": a["x"] + 99999, "z": a["z"]}); await pg.wait_for_timeout(800)
        cur["r"]["/blocks/tip/height"] = 203; await recheck(); await pg.wait_for_timeout(2500)
        check("leaving clears the retry", not await inRoom())
        # 4 · back at A, still pending → blocked; then 6 confirmations + RECHECK opens without reload
        cur["r"]["/blocks/tip/height"] = 202; await recheck(); await pg.wait_for_timeout(1500)
        await place(a); await pg.wait_for_timeout(2500)
        check("still blocked at 5/6 on return", not await inRoom())
        nav0 = await pg.evaluate("()=>performance.getEntriesByType('navigation').length")
        cur["r"]["/blocks/tip/height"] = 203; await recheck(); await pg.wait_for_timeout(3000)
        check("6 confirmations + RECHECK opens the gate, no reload", await inRoom() and nav0 == await pg.evaluate("()=>performance.getEntriesByType('navigation').length"))
        await pg.keyboard.press("Escape"); await place(None)
        # 5 · invalid / unresolved cards stay blocked through RECHECK
        for name in ["conflict", "lost", "moved", "unavailable"]:
            await place({"x": a["x"] + 99999, "z": a["z"]}); await pg.wait_for_timeout(600)
            cur["r"] = dict(F[name]["routes"])
            await pg.evaluate("v=>localStorage.setItem('bitmapwin:sealed-notes',v)", json.dumps(F[name]["held"]))
            await recheck(); await pg.wait_for_timeout(2000)
            await place(a); await pg.wait_for_timeout(2000)
            await recheck(); await pg.wait_for_timeout(2000)
            t = await toasts(); check(f"{name} stays blocked", not await inRoom() and len(t) == 1, t)
        check("no page errors", not errs, errs[:2])
        await b.close()
    sys.exit(0 if ok else 1)
asyncio.run(main())
