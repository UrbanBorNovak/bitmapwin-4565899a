import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { FolderEntry } from "@/lib/l2/game-folder";
import { WorldLibrary, type WorldTile } from "@/lib/l2/l2-world-loader";
import { tileFile, tileOf } from "@/lib/l2/l2-world";
const L2WorldScene = lazy(() => import("@/components/l2/L2WorldScene"));
import { channelName, L2Session, STEPS, type L2World, type ErrorKind, type L2Char, type L2Selected, type L2Server, type SessionEvent, type Step } from "@/lib/l2/l2-session";
import { className, raceName } from "@/lib/l2/l2-classes";

type StepState = "wait" | "active" | "done" | "fail";
const KIND_LABEL: Record<ErrorKind, string> = { connection: "CONNECTION PROBLEM", protocol: "PROTOCOL PROBLEM", login: "LOGIN REFUSED" };

export default function L2LoginPanel({ folder = null }: { folder?: Map<string, FolderEntry> | null }) {
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
  const [world, setWorld] = useState<L2World | null>(null);
  const [say, setSay] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const session = useRef<L2Session | null>(null);
  useEffect(() => () => session.current?.close(), []);

  function reset() {
    session.current?.close(); session.current = null;
    setCurrent(null); setFailed(false); setServers(null); setChars(null); setSelected(null); setWorld(null); setError(null); setLog([]);
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
        else if (e.type === "world") setWorld(e.world);
        else if (e.type === "error") { setError(e); setFailed(true); }
        else setLog((l) => [...l.slice(-39), `${e.conn.toUpperCase()} ${e.dir === "in" ? "←" : "→"} 0x${e.opcode.toString(16).padStart(2, "0")} · ${e.size} bytes`]);
      },
    });
    session.current = s;
    setPassword("");
    s.start();
  }

  const idx = current ? STEPS.findIndex((s) => s.id === current) : -1;
  const stateOf = (i: number): StepState => (world ? "done" : i < idx ? "done" : i === idx ? (failed ? "fail" : "active") : "wait");
  const busy = current != null && !failed;
  const field = "rounded border border-border bg-background px-2 py-1 font-mono text-xs";

  return (
    <section className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs">YOUR LOCAL GAMESERVER · LOGIN, CHARACTER & WORLD</h2>
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
          {busy
            ? <button type="button" onClick={reset} className="rounded border border-border px-3 py-1 font-mono text-xs hover:bg-muted">DISCONNECT</button>
            : <button type="submit" disabled={!user || !password} className="rounded border border-primary px-3 py-1 font-mono text-xs text-primary hover:bg-primary/10 disabled:opacity-50">LOG IN</button>}
        </div>
      </form>

      <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-6 font-mono text-[11px]">
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
          <div className="text-muted-foreground">{world ? "You are in the world." : failed ? "Entering the world stopped — see the error above." : "Entering the world…"}</div>
        </div>
      ) : null}

      {world ? <WorldView world={world} folder={folder} onMove={(x, y, z) => session.current?.moveTo(x, y, z ?? world.self.z)}
        say={say} setSay={setSay} onSay={() => { session.current?.say(say); setSay(""); }} onLogout={() => session.current?.logout()} /> : null}

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

const RANGE = 3000; // game units shown from the centre of the map
function useTile(library: WorldLibrary | null, x: number, y: number) {
  const { tx, ty } = tileOf(x, y);
  const [state, setState] = useState<{ key: string; tile?: WorldTile; error?: string } | null>(null);
  const key = `${tx}_${ty}`;
  useEffect(() => {
    if (!library) return;
    let live = true;
    setState({ key });
    void library.loadTile(tx, ty).then((r) => { if (live) setState({ key, ...r }); });
    return () => { live = false; };
  }, [library, key, tx, ty]);
  return { file: tileFile(tx, ty), state: state?.key === key ? state : null };
}

function World3D({ world, folder, onMove }: { world: L2World; folder: Map<string, FolderEntry> | null; onMove: (x: number, y: number, z: number) => void }) {
  const library = useMemo(() => (folder ? new WorldLibrary(folder) : null), [folder]);
  const { file, state } = useTile(library, world.self.x, world.self.y);
  const [status, setStatus] = useState("");
  const box = "flex h-[460px] items-center justify-center rounded border border-border bg-background p-4 text-center text-sm text-muted-foreground";
  let body;
  if (!folder) body = <div className={box}>Open your game folder at the top of this page (OPEN GAME FOLDER) to draw the world around you from your own map files.</div>;
  else if (!state || (!state.tile && !state.error)) body = <div className={box}>Reading {file} from your game folder…</div>;
  else if (state.error) body = <div role="alert" className={box}>{state.error}</div>;
  else body = (
    <div data-l2-world className="h-[460px] overflow-hidden rounded border border-border">
      <Suspense fallback={<div className={box}>Loading the 3D view…</div>}>
        <L2WorldScene world={world} tile={state.tile!} library={library!} onMove={(p) => onMove(Math.round(p.x), Math.round(p.y), Math.round(p.z))} onStatus={setStatus} />
      </Suspense>
    </div>
  );
  const t = state?.tile;
  return (
    <div className="space-y-1 min-w-0">
      <div className="font-mono text-[11px] text-muted-foreground">3D · {file} · drag to look around, click the ground to walk there</div>
      {body}
      {t ? (
        <ul className="font-mono text-[11px] text-muted-foreground space-y-0.5">
          <li>{t.terrain ? `Ground: ${t.terrain.source}` : "Ground: not drawn"} · {t.actors.length.toLocaleString("en-US")} placed props in this tile</li>
          {status ? <li>{status}</li> : null}
          {t.notes.map((n) => <li key={n} className="text-destructive">{n}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function WorldView({ world, folder, onMove, say, setSay, onSay, onLogout }: { world: L2World; folder: Map<string, FolderEntry> | null; onMove: (x: number, y: number, z?: number) => void; say: string; setSay: (v: string) => void; onSay: () => void; onLogout: () => void }) {
  const me = world.self;
  const near = world.objects.map((o) => ({ ...o, d: Math.hypot(o.x - me.x, o.y - me.y) })).sort((a, b) => a.d - b.d);
  const tone = { npc: "fill-accent", player: "fill-primary", item: "fill-muted-foreground" } as const;
  return (
    <div className="space-y-3">
    <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
      <World3D world={world} folder={folder} onMove={(x, y, z) => onMove(x, y, z)} />
      <div className="space-y-1 lg:order-first">
        <div className="font-mono text-[11px] text-muted-foreground">MAP · north up · click to walk there</div>
        <svg viewBox={`${-RANGE} ${-RANGE} ${RANGE * 2} ${RANGE * 2}`} className="aspect-square w-full rounded border border-border bg-background"
          onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); onMove(Math.round(me.x + ((e.clientX - b.left) / b.width - 0.5) * RANGE * 2), Math.round(me.y + ((e.clientY - b.top) / b.height - 0.5) * RANGE * 2)); }}>
          <circle r={RANGE / 2} className="fill-none stroke-border" strokeWidth={12} />
          {near.filter((o) => o.d < RANGE * 1.4).map((o) => <circle key={o.objectId} cx={o.x - me.x} cy={o.y - me.y} r={60} className={tone[o.kind]}><title>{o.name}</title></circle>)}
          <circle r={90} className="fill-primary stroke-foreground" strokeWidth={20} />
        </svg>
        <div className="font-mono text-[11px] text-muted-foreground">{me.name} · {me.x.toLocaleString("en-US")}, {me.y.toLocaleString("en-US")}, {me.z.toLocaleString("en-US")} · HP {me.hp.toLocaleString("en-US")}/{me.maxHp.toLocaleString("en-US")} · MP {me.mp.toLocaleString("en-US")}/{me.maxMp.toLocaleString("en-US")}</div>
      </div>
    </div>
      <div className="space-y-2 min-w-0">
        <div className="font-mono text-[11px] text-muted-foreground">NEARBY ({near.length.toLocaleString("en-US")}) · {world.packets.toLocaleString("en-US")} world packets</div>
        <ul className="max-h-40 overflow-auto font-mono text-xs space-y-0.5">
          {near.slice(0, 40).map((o) => <li key={o.objectId}>{o.kind.toUpperCase()} · {o.name} · {Math.round(o.d).toLocaleString("en-US")} away</li>)}
          {near.length === 0 ? <li className="text-muted-foreground">Nothing reported nearby yet.</li> : null}
        </ul>
        <div className="font-mono text-[11px] text-muted-foreground">CHAT</div>
        <ul className="max-h-32 overflow-auto font-mono text-xs space-y-0.5">
          {world.chat.map((c, i) => <li key={i}><span className="text-muted-foreground">[{channelName(c.channel)}]</span> {c.from}: {c.text}</li>)}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onSay(); }}>
          <input value={say} onChange={(e) => setSay(e.target.value)} maxLength={100} placeholder="Say something" className="flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs" />
          <button type="submit" className="rounded border border-primary px-3 py-1 font-mono text-xs text-primary hover:bg-primary/10">SAY</button>
          <button type="button" onClick={onLogout} className="rounded border border-border px-3 py-1 font-mono text-xs hover:bg-muted">LOG OUT</button>
        </form>
      </div>
    </div>
  );
}
