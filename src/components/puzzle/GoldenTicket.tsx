import { useEffect, useRef, useState } from "react";
import { sha256 } from "@noble/hashes/sha2.js";
import { PUZZLE_71, hash160Of } from "@/lib/puzzle-sweep";
import { FOUND_KEY, chime, nearTier } from "@/lib/bitmap-lottery";

/**
 * Bitcoin Golden Ticket: one free scratchcard per device per day. The ticket's
 * start key is SHA-256(latest block hash + device salt) inside the #71 range;
 * scratching reveals it, then 250k keys are scanned on this device and the
 * best Hash160 prefix match decides the tier. Pays nothing; a real key is saved locally.
 */
const TICKET_KEYS = 250_000;
const DAY_KEY = "bitmap.ticket.day";
const SALT_KEY = "bitmap.ticket.salt";
const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

type Ticket = { block: number; hash: string; startHex: string };
type Saved = { day: string; ticket: Ticket; best: number; done: boolean };

export function GoldenTicket() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [scratched, setScratched] = useState(false);
  const [progress, setProgress] = useState(0);
  const [best, setBest] = useState(0);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(DAY_KEY) ?? "null") as Saved | null;
      if (s?.day === today) { setSaved(s); setTicket(s.ticket); setScratched(true); setBest(s.best); return; }
    } catch { /* fresh */ }
    (async () => {
      try {
        const [h, hash] = await Promise.all([
          fetch("https://mempool.space/api/blocks/tip/height").then((r) => r.text()),
          fetch("https://mempool.space/api/blocks/tip/hash").then((r) => r.text()),
        ]);
        let salt = localStorage.getItem(SALT_KEY);
        if (!salt) { salt = hexOf(crypto.getRandomValues(new Uint8Array(16))); localStorage.setItem(SALT_KEY, salt); }
        const seed = sha256(new TextEncoder().encode(`${hash}:${salt}:${today}`));
        const lo = BigInt("0x" + PUZZLE_71.startHex), hi = BigInt("0x" + PUZZLE_71.endHex);
        const start = lo + (BigInt("0x" + hexOf(seed)) % (hi - lo - BigInt(TICKET_KEYS)));
        setTicket({ block: Number(h), hash, startHex: start.toString(16) });
      } catch { setErr("COULD NOT READ THE LATEST BLOCK — TRY AGAIN SOON"); }
    })();
  }, [today]);

  // Paint the gold foil.
  useEffect(() => {
    const c = canvas.current;
    if (!c || scratched) return;
    const ctx = c.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = `oklch(${css.getPropertyValue("--bitcoin-l") || "0.72 0.17 60"})`;
    ctx.fillStyle = "hsl(38 90% 55%)";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("₿ SCRATCH TO REVEAL ₿", c.width / 2, c.height / 2 + 6);
  }, [ticket, scratched]);

  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons !== 1 && e.pointerType === "mouse") return;
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.width, y = ((e.clientY - r.top) / r.height) * c.height;
    const ctx = c.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    for (let i = 3; i < px.length; i += 64) if (px[i] === 0) clear++;
    if (clear / (px.length / 64) > 0.55) setScratched(true);
  }

  function run() {
    if (!ticket || running) return;
    setRunning(true); setProgress(0); setBest(0);
    const w = new Worker(new URL("../../lib/puzzle-worker.ts", import.meta.url), { type: "module" });
    let n = 0, b = 0;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "batch") { n += m.count; setProgress(Math.min(1, n / TICKET_KEYS)); }
      else if (m.type === "near" && m.nibbles > b) { b = m.nibbles; setBest(b); if (b >= 4) chime(b); }
      else if (m.type === "found") { localStorage.setItem(FOUND_KEY, m.keyHex); finish(b); w.terminate(); }
      else if (m.type === "slice-done") { finish(b); w.terminate(); }
    };
    w.postMessage({ type: "start", startHex: PUZZLE_71.startHex, endHex: PUZZLE_71.endHex,
      target: Array.from(hash160Of(PUZZLE_71.address)), duty: 1, nearMin: 2,
      slice: { startHex: ticket.startHex, size: TICKET_KEYS, canaries: [] } });
  }
  function finish(b: number) {
    setRunning(false); setProgress(1);
    const s: Saved = { day: today, ticket: ticket!, best: b, done: true };
    localStorage.setItem(DAY_KEY, JSON.stringify(s)); setSaved(s);
  }

  const tier = nearTier(best);
  const done = saved?.done;
  return (
    <section className="mt-6 rounded border border-bitcoin/60 bg-card/60 p-4 text-xs">
      <div className="flex items-center justify-between">
        <p className="label text-bitcoin">BITCOIN GOLDEN TICKET · DAILY</p>
        <p className="text-muted-foreground">1 FREE TICKET / DAY</p>
      </div>
      <p className="mt-2 text-muted-foreground">Your ticket is cut from today's newest Bitcoin block. Scratch it, then run its {TICKET_KEYS.toLocaleString()} keys. The more of the prize address your best key matches, the higher your tier.</p>
      {err && <p className="mt-3 text-destructive">{err}</p>}
      {ticket && (
        <div className="relative mt-4 overflow-hidden rounded border border-bitcoin/50 bg-background p-4" style={{ minHeight: 120 }}>
          <p className="text-muted-foreground">BLOCK <span className="text-foreground" data-no-translate>#{ticket.block.toLocaleString()}</span></p>
          <p className="mt-1 break-all text-[10px] text-muted-foreground" data-no-translate>{ticket.hash}</p>
          <p className="display mt-2 break-all text-lg text-bitcoin" data-no-translate>0x{ticket.startHex}</p>
          {!scratched && (
            <canvas ref={canvas} width={600} height={160} onPointerMove={scratch} onPointerDown={scratch}
              className="absolute inset-0 h-full w-full cursor-grab touch-none" aria-label="Scratch to reveal your ticket" />
          )}
        </div>
      )}
      {scratched && (
        <div className="mt-3">
          {!done && !running && <button onClick={run} className="rounded bg-primary px-4 py-2 text-primary-foreground">[ RUN MY TICKET ]</button>}
          {(running || done) && (
            <>
              <div className="h-2 w-full overflow-hidden rounded bg-muted"><div className="h-full bg-bitcoin transition-all" style={{ width: `${progress * 100}%` }} /></div>
              <p className="mt-2 text-muted-foreground">{running ? `SCANNING ${Math.round(progress * 100)}%` : "TICKET USED · NEXT ONE TOMORROW"}</p>
            </>
          )}
          {best > 0 && (
            <p className="display mt-2 text-lg">
              <span className={best >= 5 ? "text-bitcoin" : "text-accent"}>{tier.id}</span>
              <span className="ml-2 text-xs text-muted-foreground">{best} CHARACTERS MATCHED · 1 IN {tier.odds.toLocaleString()}</span>
            </p>
          )}
        </div>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">Tiers are for fun and pay nothing. Only the full key wins the 7.10 BTC.</p>
    </section>
  );
}

export function NearMissFeed({ nears, bestNear }: { nears: { nibbles: number; hash: string; at: number }[]; bestNear: number }) {
  const target = hexOf(hash160Of(PUZZLE_71.address));
  return (
    <section className="mt-4 rounded border border-border bg-card/60 p-4 text-xs">
      <div className="flex items-center justify-between">
        <p className="label text-accent">NEAR MISSES · LIVE</p>
        <p className="text-muted-foreground">BEST EVER: <span className="text-bitcoin">{bestNear ? `${nearTier(bestNear).id} (${bestNear})` : "—"}</span></p>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" data-no-translate>TARGET {target}</p>
      {nears.length === 0 ? <p className="mt-2 text-muted-foreground">Turn the lottery on — keys that share 4+ starting characters with the prize show up here.</p> : (
        <ul className="mt-2 space-y-1" data-no-translate>
          {nears.map((n) => (
            <li key={n.at + n.hash} className="flex gap-2 animate-in fade-in">
              <span className={`w-16 ${n.nibbles >= 5 ? "text-bitcoin" : "text-accent"}`}>{nearTier(n.nibbles).id}</span>
              <span><span className="text-bitcoin">{n.hash.slice(0, n.nibbles)}</span><span className="text-muted-foreground">{n.hash.slice(n.nibbles, 40)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
