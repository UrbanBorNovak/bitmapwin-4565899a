import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildStoreHtml, DEFAULT_FORM, DEFAULT_STORE, isFormDefault, storeFormFromSearch, type StoreConfig } from "@/lib/store-template";
import { brotliPackFn } from "@/lib/brotli-pack.functions";

const INSCRIBE = [
  { title: "CHOOSE YOUR WAY", body: "Easiest: use the ord wallet with the normal index.html and the --compress flag — ord packs it for you. If you use an inscription service instead, only upload the .html.br file when it lets you set content type text/html and content encoding br; otherwise upload the normal index.html." },
  { title: "ORD COMMAND", body: "ord wallet inscribe --fee-rate <sats/vB> --file index.html --compress — ord checks the fee and shows the cost before anything is sent. You sign and send it yourself; BitmapWin never does." },
  { title: "OPEN YOUR SHOP", body: "After it confirms, your shop lives forever at ordinals.com/content/<your inscription id>. Browsers open it normally; very old tools that can't read packed files may show an error instead." },
] as const;

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
  const html = useMemo(() => buildStoreHtml(cfg), [JSON.stringify(cfg)]);
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
  const liveHtml = () => buildStoreHtml({ ...cfg, apiBase: DEFAULT_STORE.apiBase });
  const download = () => save(new Blob([liveHtml()], { type: "text/html" }), "index.html");
  const [packed, setPacked] = useState<{ bytes: Uint8Array; raw: number; size: number; key: string } | null>(null);
  const [packing, setPacking] = useState(false);
  const packKey = JSON.stringify(cfg);
  const prepareBr = async () => {
    setPacking(true);
    try {
      const r = await brotliPackFn({ data: { text: liveHtml() } });
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      setPacked({ bytes, raw: r.rawBytes, size: r.packedBytes, key: packKey });
    } catch {
      flash("COULD NOT PACK THE FILE — TRY AGAIN");
    } finally {
      setPacking(false);
    }
  };
  const ready = packed && packed.key === packKey ? packed : null;
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
          {ready ? (
            <button onClick={() => save(new Blob([ready.bytes as BlobPart], { type: "application/octet-stream" }), "index.html.br")} className="w-full rounded border border-bitcoin px-4 py-3 text-sm font-bold text-bitcoin">
              DOWNLOAD FOR INSCRIPTION (.HTML.BR) · {ready.size.toLocaleString("en-US")} BYTES
            </button>
          ) : (
            <button onClick={prepareBr} disabled={packing} className="w-full rounded border border-bitcoin px-4 py-3 text-sm font-bold text-bitcoin disabled:opacity-50">
              {packing ? "PACKING…" : "PREPARE FOR INSCRIPTION (.HTML.BR)"}
            </button>
          )}
          {ready && <p className="font-mono text-[11px] text-muted-foreground">PACKED {ready.raw.toLocaleString("en-US")} → {ready.size.toLocaleString("en-US")} BYTES · CHECKED: UNPACKS TO THE EXACT SAME SHOP</p>}
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
          <div className="label text-bitcoin">PUT YOUR SHOP ON BITCOIN (OPTIONAL)</div>
          <p className="mt-2 text-sm text-muted-foreground">Inscribe it once and it stays on Bitcoin forever — no hosting. Small fee, paid by you to miners.</p>
        </div>
        <ol className="divide-y divide-border border-t border-border">
          {INSCRIBE.map((s, i) => (
            <li key={s.title} className="flex gap-4 p-4">
              <span className="font-mono text-xs text-bitcoin">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="display text-sm md:text-base">{s.title}</div>
                <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="border-t border-border p-5">
          <div className="label text-signal">WHAT STAYS LIVE (EVEN ON BITCOIN)</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The inscribed file is only the shop window. Every time someone opens it, it asks bitmapwin.app for the current
            listings, and BUY opens the BITMAP's page on the BitmapWin marketplace for checkout. If bitmapwin.app is
            unreachable, the shop shows "COULD NOT LOAD LISTINGS" and nobody can buy through it until it's back. Only
            listed BITMAPs appear.
          </p>
        </div>
        <footer className="border-t border-border bg-secondary/40 p-5">
          <div className="label text-bitcoin">WHERE BUYING HAPPENS</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your shop is a window, not a checkout. When a visitor presses BUY, they go to that BITMAP's page on the main
            BitmapWin marketplace and sign there with their own wallet. Payment goes straight to the seller on Bitcoin —
            your shop never holds coins, keys or BITMAPs. A listing marked IN CHECKOUT is briefly reserved by another buyer.
          </p>
        </footer>
      </section>
    </div>
  );
}
