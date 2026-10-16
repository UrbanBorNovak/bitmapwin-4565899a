import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/novelty")({
  head: () => ({
    meta: [
      { title: "Novelty on Bitcoin — BitmapWin" },
      { name: "description", content: "Why Bitcoin blockspace became land: BITMAP worlds that live as long as Bitcoin does, with no company server holding them up." },
      { property: "og:title", content: "Novelty on Bitcoin — the internet, but with land" },
      { property: "og:description", content: "Every Bitcoin block is a place. Enter it, build on it, own it — proven by Bitcoin itself." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://bitmapwin.app/novelty" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bitmapwin.app/novelty" }],
  }),
  component: NoveltyPage,
});

const CONTRAST = [
  ["WHERE IT LIVES", "Company servers and side chains", "Bitcoin itself — every node keeps a copy"],
  ["WHO PROVES OWNERSHIP", "A platform database", "Your wallet and the Bitcoin ledger"],
  ["IF THE COMPANY STOPS", "The world goes dark", "The land and inscribed builds remain"],
  ["SUPPLY", "Minted at will", "One BITMAP per block, never more"],
] as const;

const PILLARS = [
  ["WORLD", "The Oasis — walk the living map of every block.", "/oasis"],
  ["LAND", "BITMAPs — the places, traded on chain.", "/marketplace"],
  ["EXPERIENCES", "Extenders — things that happen on those places.", "/extenders"],
  ["IDENTITY", "Passport — a history you prove, not claim.", "/wallet"],
  ["CREATION", "Land Forge — inscribe builds onto your own BITMAP.", "/forge"],
] as const;

const SHARE = "Every Bitcoin block is a place. Enter it, build on it, own it — proven by Bitcoin itself. The internet, but with land →";
const URL = "https://bitmapwin.app/novelty";

function NoveltyPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  const embed = `<iframe src="https://bitmapwin.app/embed/oasis" width="800" height="450" style="border:0" allowfullscreen></iframe>`;

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-10 md:px-8 md:py-14">
      <header className="border-b border-border pb-8">
        <p className="label text-signal">BITCOIN-NATIVE WORLDS · DISPATCH</p>
        <h1 className="display mt-3 text-4xl md:text-6xl">NOVELTY ON <span className="text-bitcoin">BITCOIN</span></h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Bitcoin was money first. Then people learned to write onto it. BITMAP takes the next step: every block becomes a place, its shape drawn from the block's own transactions. Nothing here depends on a company staying online — the land is the chain.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/oasis" className="btn-term">ENTER THE OASIS</Link>
          <Link to="/marketplace" className="btn-term-ghost">SEE THE LAND MARKET</Link>
          <Link to="/archaeology" className="btn-term-ghost">READ THE HISTORY</Link>
        </div>
      </header>

      <section className="mt-8" aria-labelledby="contrast">
        <h2 id="contrast" className="display text-2xl">WHY IT'S NEW</h2>
        <div className="mt-4 overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="label text-muted-foreground">
              <tr className="border-b border-border"><th className="p-3 text-left"></th><th className="p-3 text-left">OTHER VIRTUAL WORLDS</th><th className="p-3 text-left text-bitcoin">BITMAP ON BITCOIN</th></tr>
            </thead>
            <tbody>
              {CONTRAST.map(([k, a, b]) => (
                <tr key={k} className="border-b border-border last:border-0">
                  <td className="label p-3">{k}</td>
                  <td className="p-3 text-muted-foreground">{a}</td>
                  <td className="p-3">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="pillars">
        <h2 id="pillars" className="display text-2xl">FIVE WAYS IN</h2>
        <div className="mt-4 grid gap-px border border-border bg-border md:grid-cols-5">
          {PILLARS.map(([t, b, to]) => (
            <a key={t} href={to} className="bg-card p-5 hover:bg-muted">
              <p className="label text-bitcoin">{t}</p>
              <p className="mt-2 text-sm text-muted-foreground">{b}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-8 border border-signal/50 p-5" aria-labelledby="spread">
        <p className="label text-signal">SPREAD THE WORD</p>
        <h2 id="spread" className="display mt-2 text-xl">BRING SOMEONE NEW</h2>
        <p className="mt-3 rounded-sm border border-border bg-background p-3 font-mono text-xs">{SHARE} {URL}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn-term" target="_blank" rel="noreferrer" href={`https://x.com/intent/post?text=${encodeURIComponent(SHARE)}&url=${encodeURIComponent(URL)}`}>SHARE ON X</a>
          <a className="btn-term-ghost" target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(URL)}&text=${encodeURIComponent(SHARE)}`}>TELEGRAM</a>
          <button className="btn-term-ghost" onClick={() => copy("msg", `${SHARE} ${URL}`)}>{copied === "msg" ? "COPIED" : "COPY MESSAGE"}</button>
        </div>
        <p className="label mt-6">EMBED THE LIVE WORLD ON YOUR SITE</p>
        <p className="mt-2 rounded-sm border border-border bg-background p-3 font-mono text-xs break-all">{embed}</p>
        <button className="btn-term-ghost mt-3" onClick={() => copy("embed", embed)}>{copied === "embed" ? "COPIED" : "COPY EMBED CODE"}</button>
      </section>
    </main>
  );
}
