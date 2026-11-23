import { useEffect, useState } from "react";

type Probe = "checking" | "online" | "offline";
const BRIDGES = [
  { label: "Login bridge", url: "ws://localhost:2107" },
  { label: "Game bridge", url: "ws://localhost:7778" },
];
const COMMANDS = [
  { cmd: ".class", where: "Game chat", note: "Opens the first class transfer choice (level 20+, base class)." },
  { cmd: "//spawn 12006", where: "Game chat · GM", note: "Spawns the Guardian companion NPC." },
  { cmd: "loadBitmap(367613)", where: "Browser console", note: "Streams an on-chain Land Forge build in front of your character." },
  { cmd: "listBitmapBuilds()", where: "Browser console", note: "Lists the known on-chain builds you can load." },
];
const STEPS = [
  { n: "01", title: "Start your servers", body: "Run LoginServer and GameServer, then the WebSocket bridges on this computer." },
  { n: "02", title: "Log in below", body: "Enter your account in the login panel. The password stays in this page only." },
  { n: "03", title: "Load a BITMAP", body: "Use the console shortcuts to bring on-chain builds into the world." },
];

function probe(url: string): Promise<Probe> {
  return new Promise((res) => {
    let done = false;
    const finish = (p: Probe) => { if (!done) { done = true; res(p); } };
    try {
      const ws = new WebSocket(url);
      const t = setTimeout(() => { ws.close(); finish("offline"); }, 2500);
      ws.onopen = () => { clearTimeout(t); ws.close(); finish("online"); };
      ws.onerror = () => { clearTimeout(t); finish("offline"); };
    } catch { finish("offline"); }
  });
}

export default function L2PlayHub() {
  const [status, setStatus] = useState<Probe[]>(BRIDGES.map(() => "checking"));
  const [copied, setCopied] = useState<string | null>(null);
  const check = () => { setStatus(BRIDGES.map(() => "checking")); void Promise.all(BRIDGES.map((b) => probe(b.url))).then(setStatus); };
  useEffect(check, []);
  const copy = (c: string) => { void navigator.clipboard?.writeText(c); setCopied(c); setTimeout(() => setCopied(null), 1500); };

  return (
    <section className="rounded-lg border border-primary/40 bg-card/60 backdrop-blur p-5 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-primary">PLAY NOW</p>
          <h2 className="font-display text-2xl">Chronicle 4 · Scions of Destiny</h2>
          <p className="text-sm text-muted-foreground">Your own local server, played in the browser, with BITMAP builds from Bitcoin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {BRIDGES.map((b, i) => {
            const s = status[i];
            const tone = s === "online" ? "border-accent text-accent" : s === "offline" ? "border-destructive/60 text-destructive" : "border-border text-muted-foreground";
            return <span key={b.url} className={`rounded border px-2 py-1 ${tone}`} title={b.url}>● {b.label} · {s?.toUpperCase()}</span>;
          })}
          <button onClick={check} className="rounded border border-border px-2 py-1 hover:bg-muted">RECHECK</button>
        </div>
      </div>

      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded border border-border bg-background/40 p-3">
            <div className="font-mono text-xs text-primary">{s.n}</div>
            <div className="font-display">{s.title}</div>
            <p className="text-xs text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-2">
          <div className="font-mono text-xs text-muted-foreground">COMMAND SHORTCUTS · click to copy</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {COMMANDS.map((c) => (
              <button key={c.cmd} onClick={() => copy(c.cmd)} className="rounded border border-border p-2 text-left hover:border-primary">
                <div className="flex justify-between font-mono text-xs"><span className="text-primary">{c.cmd}</span><span className="text-muted-foreground">{copied === c.cmd ? "COPIED" : c.where}</span></div>
                <p className="text-xs text-muted-foreground">{c.note}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="font-mono text-xs text-muted-foreground">RATES</div>
          <div className="rounded border border-border p-3 text-xs space-y-1">
            <p>EXP, SP, adena and drop rates come from your server's <span className="font-mono">config/Rates.ini</span>.</p>
            <p className="text-muted-foreground">Inside a BITMAP territory, 5% of picked-up adena goes to the territory's on-chain owner.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
