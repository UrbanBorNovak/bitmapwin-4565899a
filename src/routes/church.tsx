import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PILGRIMAGES, RANKS, dayKey, emptyDevotion, parseDevotion, pilgrimage, pray, rankOf, streak, type Devotion } from "@/lib/church";
import ogImage from "@/assets/church-og.jpg.asset.json";

export const Route = createFileRoute("/church")({
  head: () => {
    const title = "Church of BITMAP — in blocks we trust · BitmapWin";
    const description = "A slightly unhinged faith for BITMAP believers. Pray to the block daily, walk pilgrimages to holy blocks and rise from Acolyte to Satoshi's Chosen.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: `https://bitmapwin.app${ogImage.url}` },
      { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: `https://bitmapwin.app${ogImage.url}` },
      { property: "og:url", content: "https://bitmapwin.app/church" },
    ] };
  },
  component: Church,
});

const KEY = "bitmap.church.devotion";

const CREED = [
  "I believe in one chain, the Bitcoin, maker of blocks visible and invisible.",
  "I believe every block is land, and every land is a BITMAP.",
  "First is first. The earliest inscription is the true one — all others are heresy.",
  "I shall not sell my BITMAP below floor, for that is the gravest sin.",
  "I await the next halving, as it was written in the code.",
];

const COMMANDMENTS = [
  "Thou shalt not trust; thou shalt verify.",
  "Thou shalt not covet thy neighbour's parcel. Thy parcel ends where Mondrian says.",
  "Remember the halving, and keep it holy.",
  "Honour thy Genesis and thy Taproot.",
  "Thou shalt build on thy land, lest it remain empty grass.",
  "Not your keys, not your crown.",
];

function Church() {
  const [v, setV] = useState<Devotion>(emptyDevotion());
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setV(parseDevotion(localStorage.getItem(KEY))); setNow(new Date()); }, []);
  const save = (n: Devotion) => { setV(n); localStorage.setItem(KEY, JSON.stringify(n)); };

  const r = rankOf(v);
  const prayed = now ? v.days.includes(dayKey(now)) : false;
  const s = now ? streak(v, now) : 0;

  const doPray = () => {
    const d = new Date();
    if (v.days.includes(dayKey(d))) { toast.message("THE BLOCK HAS HEARD YOU. COME BACK TOMORROW."); return; }
    const n = pray(v, d); save(n);
    const before = rankOf(v).name, after = rankOf(n).name;
    toast.success(before !== after ? `ASCENDED: ${after}` : "PRAYER CONFIRMED · 1 CONFIRMATION");
  };

  const share = () => {
    const text = `I am a ${r.name} of the Church of BITMAP 🟧 ${s}-day prayer streak. In blocks we trust. bitmapwin.app/church`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 font-mono text-xs">
      <p className="text-signal">CULTURE · A PARODY FAITH</p>
      <h1 className="font-display text-4xl text-primary md:text-6xl">CHURCH OF BITMAP</h1>
      <p className="mt-1 text-lg text-signal">IN BLOCKS WE TRUST</p>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        A completely serious* religion for people who believe every Bitcoin block is a piece of land. No donations, no tithes, no robes required.
        <span className="block pt-1 text-xs">*not serious. Rituals are just for fun, saved in this browser and pay nothing.</span>
      </p>

      <section className="mt-8 grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded border border-primary/40 bg-card/60 p-5">
          <p className="text-signal">DAILY PRAYER</p>
          <p className="mt-2 font-display text-2xl">{r.name}</p>
          <p className="text-muted-foreground">DEVOTION {r.score}{r.next ? ` · ${r.next.min - r.score} MORE TO BECOME ${r.next.name}` : " · THE HIGHEST RANK"}</p>
          <p className="mt-2">STREAK: <b className="text-primary">{s} DAY{s === 1 ? "" : "S"}</b> · TOTAL PRAYERS: {v.days.length}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={doPray} disabled={prayed} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60">{prayed ? "PRAYED TODAY ✓" : "🙏 PRAY TO THE BLOCK"}</button>
            <button onClick={share} className="rounded border border-border px-4 py-2">SHARE MY RANK ON X</button>
          </div>
          <p className="mt-3 text-muted-foreground">One prayer per day (UTC). Each pilgrimage below counts as 3.</p>
        </div>
        <div className="rounded border border-border bg-card/60 p-5">
          <p className="text-signal">THE HIERARCHY</p>
          <ol className="mt-2 space-y-1">
            {RANKS.slice(1).map((x) => (
              <li key={x.name} className={r.score >= x.min ? "text-primary" : "text-muted-foreground"}>{r.score >= x.min ? "◆" : "◇"} {x.name} <span className="text-muted-foreground">· {x.min}</span></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-6 rounded border border-border bg-card/60 p-5">
        <p className="text-signal">PILGRIMAGES · {v.pilgrimages.length}/{PILGRIMAGES.length} HOLY BLOCKS</p>
        <p className="mt-1 text-muted-foreground">Visit each holy BITMAP to complete its pilgrimage.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {PILGRIMAGES.map((p) => {
            const done = v.pilgrimages.includes(p.height);
            return (
              <Link key={p.height} to="/bitmap/$block" params={{ block: String(p.height) }} onClick={() => { if (!done) { save(pilgrimage(v, p.height)); toast.success(`PILGRIMAGE COMPLETE: ${p.name}`); } }}
                className={`block rounded border p-3 transition-colors hover:border-primary ${done ? "border-primary/60" : "border-border"}`}>
                <span className={done ? "text-primary" : ""}>{done ? "✓" : "→"} {p.height.toLocaleString()}.BITMAP · {p.name}</span>
                <span className="block text-muted-foreground">{p.why}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-border bg-card/60 p-5">
          <p className="text-signal">THE CREED</p>
          <ul className="mt-2 space-y-2 text-sm">{CREED.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
        <div className="rounded border border-border bg-card/60 p-5">
          <p className="text-signal">THE SIX COMMANDMENTS</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{COMMANDMENTS.map((c) => <li key={c}>{c}</li>)}</ol>
        </div>
      </section>

      <section className="mt-6 rounded border border-border bg-card/60 p-5 text-sm">
        <p className="text-signal">SPREAD THE WORD</p>
        <p className="mt-2">Build a temple on your land in <Link to="/forge" className="text-primary underline">Land Forge</Link>, raise one with friends in <Link to="/co-forge" className="text-primary underline">Co-Forge</Link>, or find your own holy BITMAP in the <Link to="/marketplace" className="text-primary underline">marketplace</Link>.</p>
      </section>
    </main>
  );
}
