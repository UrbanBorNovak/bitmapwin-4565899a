import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildStoreHtml, DEFAULT_FORM, DEFAULT_STORE, isFormDefault, storeFormFromSearch, type StoreConfig } from "@/lib/store-template";
import { buildSovereignStoreHtml } from "@/lib/sovereign-store";
import { NostrListPanel } from "@/components/NostrListPanel";

export const Route = createFileRoute("/store-kit")({
  head: () => {
    const title = "Tiny Store Kit — launch your own BITMAP shop · BitmapWin";
    const description =
      "Make a free, open BITMAP storefront in minutes: pick your name, colour and listings, preview it live, download one file and host it anywhere.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: StoreKit,
});

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

const GUIDE = [
  { title: "CUSTOMIZE", body: "Fill in your shop name, tagline and colour above. Add your seller address to show only your own listings, or set a block range or max price to curate. The preview updates as you type." },
  { title: "DOWNLOAD", body: "Press DOWNLOAD MY SHOP. You get one file called index.html — that is your whole shop." },
  { title: "CREATE A GITHUB REPOSITORY", body: "Sign in at github.com (free account), press New repository, give it a name like my-bitmap-shop, set it to Public and create it." },
  { title: "UPLOAD THE FILE", body: "In the new repository, choose Add file → Upload files, drag in index.html and press Commit changes." },
  { title: "TURN ON GITHUB PAGES", body: "Open Settings → Pages. Under Branch pick main and / (root), then Save. After a minute your shop is live at yourname.github.io/my-bitmap-shop. To change it later, make a new file here and upload it again." },
] as const;

/** Best-effort copy: clipboard API, then a hidden textarea, then give up and show the link. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // blocked permission or an insecure page: fall through to the textarea trick
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function StoreKit() {
  const [c, setC] = useState<StoreConfig>(DEFAULT_STORE);
  const [minH, setMinH] = useState("");
  const [maxH, setMaxH] = useState("");
  const [maxBtc, setMaxBtc] = useState("");
  const [copied, setCopied] = useState(false);
  const [apiBase, setApiBase] = useState(DEFAULT_STORE.apiBase);
  const [note, setNote] = useState("");
  const [manual, setManual] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [mode, setMode] = useState<"live" | "sovereign">("live");
  const noteTimer = useRef<number | undefined>(undefined);
  const copiedTimer = useRef<number | undefined>(undefined);
  const manualRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const f = storeFormFromSearch(window.location.search);
    setC(f.config);
    setMinH(f.minH);
    setMaxH(f.maxH);
    setMaxBtc(f.maxBtc);
    setApiBase(window.location.origin);
  }, []);
  useEffect(() => {
    if (manual) manualRef.current?.select();
  }, [manual]);
  useEffect(
    () => () => {
      window.clearTimeout(noteTimer.current);
      window.clearTimeout(copiedTimer.current);
    },
    [],
  );
  const flash = (msg: string) => {
    window.clearTimeout(noteTimer.current);
    setNote(msg);
    noteTimer.current = window.setTimeout(() => setNote(""), 3000);
  };
  const atDefaults = useMemo(() => isFormDefault({ config: c, minH, maxH, maxBtc }), [c, minH, maxH, maxBtc]);
  const doReset = () => {
    const wasCustom = !atDefaults;
    setConfirming(false);
    setC({ ...DEFAULT_FORM.config });
    setMinH(DEFAULT_FORM.minH);
    setMaxH(DEFAULT_FORM.maxH);
    setMaxBtc(DEFAULT_FORM.maxBtc);
    setCopied(false);
    setManual("");
    window.history.replaceState(null, "", "/store-kit");
    flash(wasCustom ? "BACK TO DEFAULTS — SHARED SETTINGS CLEARED" : "ALREADY AT DEFAULTS");
  };
  const reset = () => {
    if (atDefaults) {
      doReset();
      return;
    }
    setConfirming(true);
  };
  const share = async () => {
    const q = new URLSearchParams({ name: c.name, tagline: c.tagline, accent: c.accent, sort: c.sort });
    if (c.seller) q.set("seller", c.seller);
    if (minH) q.set("from", minH);
    if (maxH) q.set("to", maxH);
    if (maxBtc) q.set("max", maxBtc);
    const url = `${window.location.origin}/store-kit?${q}`;
    window.history.replaceState(null, "", `/store-kit?${q}`);
    if (await copyText(url)) {
      setManual("");
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
      flash("LINK COPIED — ANYONE WHO OPENS IT SEES THIS SHOP");
      return;
    }
    setManual(url);
    flash("COPY BLOCKED BY YOUR BROWSER — YOUR SHOP LINK IS SELECTED, PRESS CTRL+C");
  };
  const cfg: StoreConfig = {
    ...c,
    apiBase,
    minHeight: num(minH),
    maxHeight: num(maxH),
    maxSats: maxBtc ? Math.round(Number(maxBtc) * 1e8) : undefined,
  };
  const html = useMemo(() => (mode === "sovereign" ? buildSovereignStoreHtml(cfg) : buildStoreHtml(cfg)), [JSON.stringify(cfg), mode]);
  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const liveHtml = () => (mode === "sovereign" ? buildSovereignStoreHtml(cfg) : buildStoreHtml({ ...cfg, apiBase: DEFAULT_STORE.apiBase }));
  const download = () => save(new Blob([liveHtml()], { type: "text/html" }), "index.html");
  const input = "w-full rounded border border-border bg-background/60 px-3 py-2 text-sm";
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <div className="label text-bitcoin">CREATE · TINY STORE KIT</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">YOUR OWN BITMAP SHOP</h1>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        Name it, colour it, choose which BITMAPs to show. Download one file and put it on GitHub Pages, Netlify or any
        host. Listings stay live; buyers always sign in their own wallet.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded border border-border p-1 text-[11px] font-bold">
            {(["live", "sovereign"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded px-2 py-2 ${mode === m ? "bg-bitcoin text-background" : "text-muted-foreground"}`}>
                {m === "live" ? "FAST · BITMAPWIN" : "SOVEREIGN · NOSTR"}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {mode === "live"
              ? "Reads listings from bitmapwin.app; BUY opens the BitmapWin checkout."
              : "Needs no BitmapWin: listings come from open Nostr relays, every offer is re-checked on Bitcoin, and buyers pay the seller directly from their UniSat wallet inside the shop. No marketplace fee."}
          </p>
          <label className="block text-xs">SHOP NAME<input className={input} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></label>
          <label className="block text-xs">TAGLINE<input className={input} value={c.tagline} onChange={(e) => setC({ ...c, tagline: e.target.value })} /></label>
          <label className="block text-xs">COLOUR<input type="color" className="h-10 w-full" value={c.accent} onChange={(e) => setC({ ...c, accent: e.target.value })} /></label>
          <label className="block text-xs">ONLY MY LISTINGS (seller address, optional)<input className={input} value={c.seller ?? ""} placeholder="bc1p…" onChange={(e) => setC({ ...c, seller: e.target.value.trim() })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">FROM BLOCK<input className={input} inputMode="numeric" value={minH} onChange={(e) => setMinH(e.target.value.replace(/\D/g, ""))} /></label>
            <label className="block text-xs">TO BLOCK<input className={input} inputMode="numeric" value={maxH} onChange={(e) => setMaxH(e.target.value.replace(/\D/g, ""))} /></label>
          </div>
          <label className="block text-xs">MAX PRICE (BTC)<input className={input} inputMode="decimal" value={maxBtc} onChange={(e) => setMaxBtc(e.target.value.replace(/[^\d.]/g, ""))} /></label>
          <label className="block text-xs">ORDER
            <select className={input} value={c.sort} onChange={(e) => setC({ ...c, sort: e.target.value as StoreConfig["sort"] })}>
              <option value="price_asc">Cheapest first</option>
              <option value="price_desc">Priciest first</option>
              <option value="recent">Newest listings</option>
            </select>
          </label>
          <button onClick={download} className="w-full rounded bg-bitcoin px-4 py-3 text-sm font-bold text-background">DOWNLOAD MY SHOP</button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Download only — shops cannot be inscribed: ordinals.com blocks the outside connections a shop needs to load listings, so an inscribed copy would stay empty. Host the file on GitHub Pages or open it on your computer.</p>
          <button onClick={share} className="w-full rounded border border-signal px-4 py-3 text-sm font-bold text-signal">{copied ? "LINK COPIED" : "COPY SHARE LINK"}</button>
          {manual && (
            <label className="block text-xs text-signal">
              SHOP LINK — SELECTED, PRESS CTRL+C
              <input
                ref={manualRef}
                readOnly
                value={manual}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-1 w-full rounded border border-signal bg-background/60 px-2 py-2 font-mono text-[11px] text-signal"
              />
            </label>
          )}
          {confirming ? (
            <div className="rounded border border-bitcoin/60 bg-bitcoin/10 p-3">
              <p className="text-xs leading-relaxed">RESET EVERYTHING? Your shop name, colour, seller and filters go back to their starting values.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={doReset} className="flex-1 rounded bg-bitcoin px-3 py-2 text-xs font-bold text-background">YES, RESET</button>
                <button onClick={() => setConfirming(false)} className="flex-1 rounded border border-border px-3 py-2 text-xs font-bold text-muted-foreground">KEEP MY SETTINGS</button>
              </div>
            </div>
          ) : (
            <button onClick={reset} className="w-full rounded border border-border bg-secondary/40 px-4 py-2 text-xs font-bold text-muted-foreground">RESET TO DEFAULTS</button>
          )}
          {note && <p className="text-xs text-signal">{note}</p>}
          {mode === "sovereign" && <NostrListPanel />}
          <p className="text-xs text-muted-foreground">Free and open — change the file however you like.</p>
        </div>
        <iframe title="Shop preview" srcDoc={html} sandbox="allow-scripts allow-popups" className="h-[720px] w-full rounded border border-border bg-background" />
      </div>
      <section className="mt-12 border border-border">
        <header className="border-b border-border p-5">
          <div className="label text-signal">HOW TO LAUNCH YOUR SHOP</div>
          <p className="mt-2 text-sm text-muted-foreground">Five steps, no coding needed. Takes about 10 minutes.</p>
        </header>
        <ol className="divide-y divide-border">
          {GUIDE.map((s, i) => (
            <li key={s.title} className="flex gap-4 p-4">
              <span className="font-mono text-xs text-bitcoin">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="display text-sm md:text-base">{s.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="border-t border-border p-5">
          <div className="label text-signal">HOST IT — DON'T INSCRIBE IT</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your shop has to fetch live listings every time it opens. ordinals.com runs inscriptions inside a sandbox
            that blocks those outside connections, so an inscribed shop would open empty. Put the file on GitHub Pages
            (steps 3–5 above) or open it on your computer — there it works normally.
          </p>
        </div>
        <div className="border-t border-border p-5">
          <div className="label text-signal">WHAT STAYS LIVE</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {mode === "live"
              ? "The file is only the shop window. Every time someone opens it, it asks bitmapwin.app for the current listings, and BUY opens the BITMAP's page on the BitmapWin marketplace for checkout. If bitmapwin.app is unreachable, the shop shows \"COULD NOT LOAD LISTINGS\" and nobody can buy through it until it's back. Only listed BITMAPs appear."
              : "The sovereign file is also only a window. Every time it opens it reads signed listings from open Nostr relays and re-checks each one on Bitcoin (ordinals.com recursion + mempool.space) before showing it, so a stale or fake offer never appears. The buyer signs and sends the swap from their own wallet in the page. Because it needs those services reachable, it is hosted — not inscribed."}
          </p>
        </div>
        <footer className="border-t border-border bg-secondary/40 p-5">
          <div className="label text-bitcoin">WHERE BUYING HAPPENS</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {mode === "live"
              ? "Your shop is a window, not a checkout. When a visitor presses BUY, they go to that BITMAP's page on the main BitmapWin marketplace and sign there with their own wallet. Payment goes straight to the seller on Bitcoin — your shop never holds coins, keys or BITMAPs. A listing marked IN CHECKOUT is briefly reserved by another buyer."
              : "Your shop is a window, but the swap happens inside it. Pressing BUY builds the trade in the page and the buyer's own UniSat wallet signs and sends it — coins go straight to the seller, the BITMAP straight to the buyer. Your shop never holds coins, keys or BITMAPs, and nothing is signed until the buyer confirms."}
          </p>
        </footer>
      </section>
    </div>
  );
}
