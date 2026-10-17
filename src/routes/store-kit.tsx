import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { buildStoreHtml, DEFAULT_STORE, type StoreConfig } from "@/lib/store-template";

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

function StoreKit() {
  const [c, setC] = useState<StoreConfig>(DEFAULT_STORE);
  const [minH, setMinH] = useState("");
  const [maxH, setMaxH] = useState("");
  const [maxBtc, setMaxBtc] = useState("");
  const cfg: StoreConfig = {
    ...c,
    apiBase: typeof window !== "undefined" ? window.location.origin : DEFAULT_STORE.apiBase,
    minHeight: num(minH),
    maxHeight: num(maxH),
    maxSats: maxBtc ? Math.round(Number(maxBtc) * 1e8) : undefined,
  };
  const html = useMemo(() => buildStoreHtml(cfg), [JSON.stringify(cfg)]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([buildStoreHtml({ ...cfg, apiBase: DEFAULT_STORE.apiBase })], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(url);
  };
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
