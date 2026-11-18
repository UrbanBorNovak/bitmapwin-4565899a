import { useEffect, useRef, useState } from "react";
import { L2Session, STEPS, type ErrorKind, type L2Char, type L2Selected, type L2Server, type SessionEvent, type Step } from "@/lib/l2/l2-session";
import { className, raceName } from "@/lib/l2/l2-classes";

type StepState = "wait" | "active" | "done" | "fail";
const KIND_LABEL: Record<ErrorKind, string> = { connection: "CONNECTION PROBLEM", protocol: "PROTOCOL PROBLEM", login: "LOGIN REFUSED" };

export default function L2LoginPanel() {
  const [loginUrl, setLoginUrl] = useState("ws://localhost:2107");
  const [gameUrl, setGameUrl] = useState("ws://localhost:7778");
  const [protocol, setProtocol] = useState(746);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState<Step | null>(null);
  const [failed, setFailed] = useState(false);
  const [servers, setServers] = useState<{ list: L2Server[]; last: number } | null>(null);
  const [chars, setChars] = useState<L2Char[] | null>(null);
  const [selected, setSelected] = useState<L2Selected | null>(null);
  const [error, setError] = useState<Extract<SessionEvent, { type: "error" }> | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const session = useRef<L2Session | null>(null);
  useEffect(() => () => session.current?.close(), []);

  function reset() {
    session.current?.close(); session.current = null;
    setCurrent(null); setFailed(false); setServers(null); setChars(null); setSelected(null); setError(null); setLog([]);
  }
  function connect() {
    reset();
    const s = new L2Session({
      loginUrl, gameUrl, protocol, user: user.trim(), password,
      emit: (e) => {
        if (e.type === "step") setCurrent(e.step);
        else if (e.type === "servers") setServers({ list: e.servers, last: e.lastServer });
        else if (e.type === "chars") setChars(e.chars);
        else if (e.type === "selected") setSelected(e.char);
        else if (e.type === "error") { setError(e); setFailed(true); }
        else setLog((l) => [...l.slice(-39), `${e.conn.toUpperCase()} ${e.dir === "in" ? "←" : "→"} 0x${e.opcode.toString(16).padStart(2, "0")} · ${e.size} bytes`]);
      },
    });
    session.current = s;
    setPassword("");
    s.start();
  }

  const idx = current ? STEPS.findIndex((s) => s.id === current) : -1;
  const stateOf = (i: number): StepState => (selected ? "done" : i < idx ? "done" : i === idx ? (failed ? "fail" : "active") : "wait");
  const busy = current != null && !failed && !selected;
  const field = "rounded border border-border bg-background px-2 py-1 font-mono text-xs";

  return (
    <section className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs">YOUR LOCAL GAMESERVER · LOGIN & CHARACTER SELECT</h2>
        <span className="font-mono text-[11px] text-muted-foreground">Interlude-style login (C5 onward) · bridges on this computer only</span>
      </div>
      <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e) => { e.preventDefault(); if (!busy) connect(); }}>
        <label className="space-y-1 lg:col-span-2"><span className="block font-mono text-[11px] text-muted-foreground">LOGIN BRIDGE</span>
          <input value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} className={`${field} w-full`} disabled={busy} /></label>
        <label className="space-y-1 lg:col-span-2"><span className="block font-mono text-[11px] text-muted-foreground">GAME BRIDGE</span>
          <input value={gameUrl} onChange={(e) => setGameUrl(e.target.value)} className={`${field} w-full`} disabled={busy} /></label>
        <label className="space-y-1"><span className="block font-mono text-[11px] text-muted-foreground">PROTOCOL</span>
          <input type="number" value={protocol} onChange={(e) => setProtocol(Math.floor(Number(e.target.value) || 0))} className={`${field} w-full`} disabled={busy} /></label>
        <div />
        <label className="space-y-1 lg:col-span-2"><span className="block font-mono text-[11px] text-muted-foreground">ACCOUNT</span>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" maxLength={14} className={`${field} w-full`} disabled={busy} /></label>
        <label className="space-y-1 lg:col-span-2"><span className="block font-mono text-[11px] text-muted-foreground">PASSWORD · kept in this page only</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={16} className={`${field} w-full`} disabled={busy} /></label>
        <div className="flex items-end gap-2 lg:col-span-2">
          {busy || selected
            ? <button type="button" onClick={reset} className="rounded border border-border px-3 py-1 font-mono text-xs hover:bg-muted">DISCONNECT</button>
            : <button type="submit" disabled={!user || !password} className="rounded border border-primary px-3 py-1 font-mono text-xs text-primary hover:bg-primary/10 disabled:opacity-50">LOG IN</button>}
        </div>
      </form>

      <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-5 font-mono text-[11px]">
        {STEPS.map((s, i) => {
          const st = current ? stateOf(i) : "wait";
          const tone = st === "done" ? "border-accent/50 text-accent" : st === "active" ? "border-primary text-primary" : st === "fail" ? "border-destructive text-destructive" : "border-border text-muted-foreground";
          return <li key={s.id} className={`rounded border px-2 py-1 ${tone}`}>{st === "done" ? "✓" : st === "fail" ? "✕" : st === "active" ? "…" : "·"} {i + 1}. {s.label}</li>;
        })}
      </ol>

      {error ? (
        <div role="alert" className="rounded border border-destructive/60 bg-destructive/10 p-3 text-sm space-y-1">
          <div className="font-mono text-xs text-destructive">{KIND_LABEL[error.kind]} · at “{STEPS.find((s) => s.id === error.step)?.label}”</div>
          <p>{error.message}</p>
          {error.hint ? <p className="font-mono text-xs text-muted-foreground">{error.hint}</p> : null}
        </div>
      ) : null}

      {servers && current === "servers" && !failed ? (
        <div className="space-y-1">
          <div className="font-mono text-xs text-muted-foreground">PICK A GAME SERVER · it connects through the game bridge above, not the address it lists</div>
          {servers.list.length === 0 ? <p className="text-sm text-muted-foreground">The login server lists no game servers. Is your game server registered and running?</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {servers.list.map((s) => (
              <button key={s.id} disabled={!s.online} onClick={() => session.current?.chooseServer(s.id)}
                className={`rounded border p-2 text-left font-mono text-xs ${s.id === servers.last ? "border-primary" : "border-border"} hover:bg-muted disabled:opacity-50`}>
                <div>SERVER #{s.id} · {s.online ? "ONLINE" : "OFFLINE"}{s.pvp ? " · PVP" : ""}</div>
                <div className="text-muted-foreground">{s.ip}:{s.port} · {s.players.toLocaleString("en-US")}/{s.maxPlayers.toLocaleString("en-US")} players{s.ageLimit ? ` · ${s.ageLimit}+` : ""}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {chars && current === "characters" && !failed ? (
        <div className="space-y-1">
          <div className="font-mono text-xs text-muted-foreground">PICK A CHARACTER</div>
          {chars.length === 0 ? <p className="text-sm text-muted-foreground">This account has no characters yet. Create one in the regular game client first; creating characters here isn't built yet.</p> : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {chars.map((c) => (
              <button key={c.slot} onClick={() => session.current?.chooseChar(c.slot)} className="rounded border border-border p-2 text-left font-mono text-xs hover:bg-muted">
                <div className="text-sm text-foreground">{c.name}</div>
                <div className="text-muted-foreground">Lv {c.level} · {className(c.classId)} · {raceName(c.race)}{c.deleteTimer ? " · being deleted" : ""}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="rounded border border-accent/50 p-3 font-mono text-xs text-accent space-y-1">
          <div>IN · {selected.name}{selected.title ? ` “${selected.title}”` : ""} · Lv {selected.level} · {className(selected.classId)}</div>
          <div className="text-muted-foreground">Position {selected.x.toLocaleString("en-US")}, {selected.y.toLocaleString("en-US")}, {selected.z.toLocaleString("en-US")} · HP {Math.round(selected.hp).toLocaleString("en-US")} · MP {Math.round(selected.mp).toLocaleString("en-US")}</div>
          <div className="text-muted-foreground">The server accepted this character. Entering the world and drawing it is the next step and isn't built yet.</div>
        </div>
      ) : null}

      <details className="text-xs">
        <summary className="cursor-pointer font-mono text-muted-foreground">How to set up the bridges · packet log ({log.length})</summary>
        <div className="mt-2 space-y-2 text-muted-foreground">
          <p>Browsers can't open your server's ports directly, so run two small bridges on the same computer as the game:</p>
          <pre className="rounded bg-background p-2 font-mono">websockify 2107 127.0.0.1:2106{"\n"}websockify 7778 127.0.0.1:7777</pre>
          <p>Your password is encrypted the way the game does it and sent only to your own server. This site never sees, stores or relays it.</p>
          <pre className="max-h-40 overflow-auto rounded bg-background p-2 font-mono">{log.join("\n") || "No packets yet."}</pre>
        </div>
      </details>
    </section>
  );
}
