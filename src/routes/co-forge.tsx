import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BLOCKS } from "@/lib/voxel-world";
import type { TplBlock } from "@/lib/voxel-templates";
import { forgePieceFn } from "@/lib/forge-parts.functions";
import { collectionPiecesQuery } from "@/lib/forge-collection.functions";
import { forgeAssemblyHtml, isInscriptionId, normPart, placePart, MAX_ASM_PARTS } from "@/lib/forge-assembly";
import { batchCounts, keepFor, sealFor, sealId, SEAL_MAX, buildState, canEdit, emptyState, exportAssembly, liveParts, makeRoom, newOid, nextConfig, openConfig, roomName, roomOwner, type Batch, type CoOp, type CoState, type RoomConfig } from "@/lib/co-forge";

export const Route = createFileRoute("/co-forge")({
  head: () => {
    const title = "Co-Forge — build a BITMAP together, live · BitmapWin";
    const description = "Open a room, invite your crew and snap inscribed pieces together in real time over Nostr. Export one tiny recursive assembly to inscribe.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  component: CoForge,
});

const SPAN = 64;
type Tool = "piece" | "block" | "erase";

function CoForge() {
  const pieceFn = useServerFn(forgePieceFn);
  const shelf = useQuery(collectionPiecesQuery());
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState<string | null>(null);
  const [height, setHeight] = useState(840000);
  const [tick, setTick] = useState(0);
  const state = useRef<CoState>(emptyState());
  const [me, setMe] = useState("");
  const [peers, setPeers] = useState<Record<string, number>>({});
  const [cache, setCache] = useState<Record<string, TplBlock[]>>({});
  const loading = useRef(new Set<string>());
  const [picked, setPicked] = useState<string | null>(null);
  const [pasteId, setPasteId] = useState("");
  const [tool, setTool] = useState<Tool>("piece");
  const [rot, setRot] = useState(0);
  const [kind, setKind] = useState(0);
  const send = useRef<((ops: CoOp[]) => void) | null>(null);
  const batches = useRef<Batch[]>([]);
  const deny = useRef(new Set<string>());
  const [cfg, setCfg] = useState<RoomConfig>(openConfig());
  const cfgRef = useRef(cfg);
  const [requests, setRequests] = useState<Record<string, number>>({});
  const owner = joined ? roomOwner(joined) : null;
  const isOwner = !!owner && owner === me;
  const mayEdit = !!owner && !!me && canEdit(cfg, owner, me);
  const ctrl = useRef<((c: { allow: string[]; locked: boolean; revoke?: string; wipe?: string }) => void) | null>(null);

  const join = async () => {
    const net = await import("@/lib/nostr/co-forge-room");
    const raw = room.trim();
    // A plain name opens your own room; a full invite code joins someone else's.
    const id = roomOwner(raw) ? `${roomName(raw)}@${roomOwner(raw)}` : makeRoom(raw, net.myPubkey());
    setRoom(id); setJoined(id);
  };

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("room");
    if (q) setRoom(q);
  }, []);

  // Fetch every referenced piece from Bitcoin once.
  const fetchPiece = async (id: string) => {
    if (cache[id] || loading.current.has(id)) return;
    loading.current.add(id);
    const r = await pieceFn({ data: { id } }).catch(() => null);
    loading.current.delete(id);
    if (r?.ok) setCache((c) => ({ ...c, [id]: normPart(r.blocks) }));
    else toast.error(`COULD NOT LOAD PIECE ${id.slice(0, 8)}…`);
  };

  useEffect(() => {
    if (!joined || !owner) return;
    let stop = () => {};
    let alive = true;
    (async () => {
      const net = await import("@/lib/nostr/co-forge-room");
      if (!alive) return;
      const pk = net.myPubkey();
      setMe(pk);
      batches.current = []; deny.current = new Set(); cfgRef.current = openConfig(); setCfg(cfgRef.current); setRequests({}); setPeers({});
      state.current = emptyState();
      const rebuild = () => { state.current = buildState(batches.current, cfgRef.current, owner); setTick((n) => n + 1); };
      stop = net.joinRoom(joined, (b) => {
        if (batches.current.some((x) => x.id === b.id)) return;
        batches.current.push(b);
        // The owner remembers builder moves that arrive while locked so they stay out after unlock.
        if (pk === owner && cfgRef.current.locked && b.by !== owner && !batchCounts(b, cfgRef.current, owner)) deny.current.add(sealId(b.id));
        rebuild();
        setPeers((p) => ({ ...p, [b.by]: Math.max(p[b.by] ?? 0, b.t) }));
      }, (c) => {
        if (c.hello && c.by !== owner) setRequests((r) => ({ ...r, [c.by]: Math.max(r[c.by] ?? 0, c.t) }));
        const next = nextConfig(cfgRef.current, owner, c.by, c.cfg, c.t);
        if (next !== cfgRef.current) next.deny.forEach((d) => deny.current.add(d));
        if (next !== cfgRef.current) { cfgRef.current = next; setCfg(next); rebuild(); }
      });
      if (pk !== owner) net.sendCtrl(joined, { hello: true }).catch(() => {});
      send.current = (ops) => {
        if (!canEdit(cfgRef.current, owner, pk)) { toast.error(cfgRef.current.locked ? "THE OWNER LOCKED EDITING" : "WAITING FOR THE OWNER TO APPROVE YOU"); return; }
        const t = Date.now();
        net.sendOps(joined, ops, t).then((id) => {
          if (!batches.current.some((b) => b.id === id)) batches.current.push({ ops, t, by: pk, id });
          rebuild();
        }, (e: Error) => toast.error(e.message));
      };
      ctrl.current = ({ revoke, wipe, ...c }) => {
        const cur0 = cfgRef.current;
        let keep = cur0.keep;
        // Revoking keeps what they built so far; wiping is a separate, explicit step.
        if (revoke) keep = [...new Set([...keep, ...keepFor(batches.current, cur0, owner, revoke)])].slice(-SEAL_MAX);
        if (wipe) batches.current.forEach((b) => { if (b.by === wipe) deny.current.add(sealId(b.id)); });
        // Unlocking: every builder move outside the seal was made during the lock — keep it out for good.
        if (cfgRef.current.locked && !c.locked) {
          const cur = cfgRef.current;
          batches.current.forEach((b) => { if (b.by !== owner && !cur.seal.includes(sealId(b.id))) deny.current.add(sealId(b.id)); });
        }
        const full = { ...c, seal: c.locked ? (cfgRef.current.locked ? cfgRef.current.seal : sealFor(batches.current, cfgRef.current, owner)) : [], deny: [...deny.current].slice(-SEAL_MAX), keep };
        net.sendCtrl(joined, { cfg: full }).then((t) => {
          const next = nextConfig(cfgRef.current, owner, pk, full, t);
          cfgRef.current = next; setCfg(next); rebuild();
        }, (e: Error) => toast.error(e.message));
      };
    })();
    return () => { alive = false; stop(); send.current = null; ctrl.current = null; };
  }, [joined, owner]);

  const parts = liveParts(state.current);
  useEffect(() => { parts.forEach((p) => void fetchPiece(p.id)); });

  // Flatten: pieces (oldest first) then loose blocks/erasures on top.
  const { world, owner: cellOwner } = useMemo(() => {
    const w = new Map<string, number>(), o = new Map<string, string>();
    for (const p of parts) {
      const b = cache[p.id];
      if (!b) continue;
      for (const v of placePart(b, p, SPAN)) { const k = `${v.dx},${v.dy},${v.dz}`; w.set(k, Math.max(0, BLOCKS.findIndex((x) => x.id === v.k))); o.set(k, p.oid); }
    }
    for (const [k, b] of state.current.blocks) { if (b.k === null) w.delete(k); else w.set(k, b.k); o.delete(k); }
    return { world: w, owner: o };
  }, [parts, cache, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = useMemo(() => {
    const t = new Map<string, { y: number; k: number }>();
    for (const [k, v] of world) { const [x, y, z] = k.split(",").map(Number); const c = `${x},${z}`; const cur = t.get(c); if (!cur || y! > cur.y) t.set(c, { y: y!, k: v }); }
    return t;
  }, [world]);

  const grid = useRef<HTMLCanvasElement>(null);
  const iso = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = grid.current?.getContext("2d"); if (!g) return;
    const s = grid.current!.width / SPAN;
    g.fillStyle = "#0b0d10"; g.fillRect(0, 0, SPAN * s, SPAN * s);
    for (const [c, v] of top) { const [x, z] = c.split(",").map(Number); g.fillStyle = BLOCKS[v.k]?.top ?? "#888"; g.globalAlpha = 0.45 + Math.min(1, v.y / 30) * 0.55; g.fillRect(x! * s, z! * s, s, s); }
    g.globalAlpha = 1; g.strokeStyle = "rgba(120,200,255,.08)";
    for (let i = 0; i <= SPAN; i += 8) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, SPAN * s); g.moveTo(0, i * s); g.lineTo(SPAN * s, i * s); g.stroke(); }
  }, [top]);
  useEffect(() => {
    const cv = iso.current; const g = cv?.getContext("2d"); if (!g || !cv) return;
    const W = cv.width, H = cv.height, s = Math.min(W, H) / (SPAN * 1.9 + 8);
    g.fillStyle = "#07090d"; g.fillRect(0, 0, W, H);
    const L = [...world].map(([k, v]) => { const [x, y, z] = k.split(",").map(Number); return [x!, y!, z!, v] as const; }).sort((a, b) => a[0] + a[2] + a[1] * 0.01 - (b[0] + b[2] + b[1] * 0.01));
    for (const [x, y, z, k] of L) {
      const px = W / 2 + (x - z) * s, py = H * 0.62 + (x + z - SPAN) * s * 0.5 - y * s, b = BLOCKS[k] ?? BLOCKS[0]!;
      g.fillStyle = b.top; g.beginPath(); g.moveTo(px, py - s); g.lineTo(px + s, py - s * 0.5); g.lineTo(px, py); g.lineTo(px - s, py - s * 0.5); g.fill();
      g.fillStyle = b.side; g.beginPath(); g.moveTo(px - s, py - s * 0.5); g.lineTo(px, py); g.lineTo(px, py + s); g.lineTo(px - s, py + s * 0.5); g.fill();
      g.globalAlpha = 0.75; g.beginPath(); g.moveTo(px + s, py - s * 0.5); g.lineTo(px, py); g.lineTo(px, py + s); g.lineTo(px + s, py + s * 0.5); g.fill(); g.globalAlpha = 1;
    }
  }, [world]);

  const onGrid = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!send.current) { toast.error("JOIN A ROOM FIRST"); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * SPAN), z = Math.floor(((e.clientY - r.top) / r.height) * SPAN);
    const col = top.get(`${x},${z}`);
    if (tool === "piece") {
      if (!picked) { toast.error("PICK A PIECE FROM THE SHELF"); return; }
      if (parts.length >= MAX_ASM_PARTS) toast.warning(`OVER ${MAX_ASM_PARTS} PIECES — EXTRAS WON'T BE INSCRIBED`);
      const b = cache[picked] ?? [];
      const ex = b.length ? Math.max(...b.map((v) => v.dx)) + 1 : 1, ez = b.length ? Math.max(...b.map((v) => v.dz)) + 1 : 1;
      const [w, d] = rot % 2 ? [ez, ex] : [ex, ez];
      const fit = (c: number, n: number) => Math.max(0, Math.min(SPAN - Math.min(n, SPAN), c - Math.floor(n / 2)));
      send.current([{ op: "p+", oid: newOid(), id: picked, x: fit(x, w), y: 0, z: fit(z, d), r: rot }]);
    } else if (tool === "block") {
      const y = col ? col.y + 1 : 0;
      if (y < SPAN) send.current([{ op: "b+", x, y, z, k: kind }]);
    } else if (col) {
      const key = `${x},${col.y},${z}`, oid = cellOwner.get(key);
      send.current([oid ? { op: "p-", oid } : { op: "b-", x, y: col.y, z }]);
    }
  };

  const loadPaste = async () => {
    const id = pasteId.trim();
    if (!isInscriptionId(id)) { toast.error("PASTE A FULL INSCRIPTION ID (…i0)"); return; }
    await fetchPiece(id); setPicked(id); setTool("piece"); setPasteId("");
  };

  const exp = exportAssembly(state.current);
  const former = owner ? Object.entries(batches.current.reduce<Record<string, number>>((m, b) => {
    if (b.by !== owner && !cfg.allow.includes(b.by) && batchCounts(b, cfg, owner)) m[b.by] = (m[b.by] ?? 0) + 1;
    return m;
  }, {})) : [];
  const html = useMemo(() => forgeAssemblyHtml(height, exp.parts, exp.own.map((b) => ({ ...b, k: BLOCKS[b.k]!.id })) as TplBlock[]), [height, exp.parts.length, exp.own.length, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const bytes = new TextEncoder().encode(html).length;
  const share = typeof window !== "undefined" && joined ? `${location.origin}/co-forge?room=${encodeURIComponent(joined)}` : "";
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = `${height}-co-forge.html`; a.click(); };

  const shelfItems = [...new Set([...(shelf.data ?? []).map((p) => p.id), ...Object.keys(cache)])].slice(0, 40);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 font-mono text-xs">
      <p className="text-signal">CREATION · MULTIPLAYER</p>
      <h1 className="font-display text-3xl text-primary">CO-FORGE</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Build one BITMAP together. Snap inscribed pieces in by reference — everyone sees each move live through public Nostr relays — then download one tiny recursive file to inscribe yourself. Nothing is signed or sent to Bitcoin from here.</p>

      <section className="mt-6 flex flex-wrap items-end gap-2 rounded border border-border bg-card/60 p-3">
        <label className="flex flex-col gap-1">ROOM CODE<input className="rounded border border-border bg-background px-2 py-1" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="name, or paste an invite code" /></label>
        <label className="flex flex-col gap-1">BITMAP<input type="number" className="w-28 rounded border border-border bg-background px-2 py-1" value={height} onChange={(e) => setHeight(Math.max(0, Number(e.target.value) | 0))} /></label>
        <button className="rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50" disabled={!room.trim()} onClick={() => void join()}>{joined ? "SWITCH ROOM" : "JOIN / OPEN ROOM"}</button>
        {joined && <button className="rounded border border-border px-3 py-1.5" onClick={() => navigator.clipboard.writeText(share).then(() => toast.success("INVITE LINK COPIED"), () => toast.message(share))}>COPY INVITE LINK</button>}
        {joined && <span className="text-signal">● LIVE IN “{roomName(joined)}” · {isOwner ? "YOU OWN THIS ROOM" : mayEdit ? "YOU CAN BUILD" : cfg.locked ? "VIEWING · EDITING LOCKED" : "VIEWING · WAITING FOR APPROVAL"}</span>}
      </section>

      {joined && isOwner && (
        <section className="mt-3 space-y-2 rounded border border-primary/40 bg-card/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-primary">OWNER CONTROLS</p>
            <button className={`rounded border px-3 py-1 ${cfg.locked ? "border-primary text-primary" : "border-border"}`} onClick={() => ctrl.current?.({ allow: cfg.allow, locked: !cfg.locked })}>{cfg.locked ? "🔒 EDITING LOCKED — UNLOCK" : "LOCK EDITING"}</button>
            <span className="text-muted-foreground">Visitors can always watch. Only you and approved builders can change the build{cfg.locked ? "; right now only you can" : ""}.</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-signal">WANTS TO BUILD</p>
              {Object.keys(requests).filter((p) => !cfg.allow.includes(p)).length === 0 && <p className="text-muted-foreground">No requests yet.</p>}
              {Object.keys(requests).filter((p) => !cfg.allow.includes(p)).map((p) => (
                <div key={p} className="flex items-center gap-2 py-0.5"><span className="truncate">◇ {p.slice(0, 8)}…{p.slice(-4)}</span><button className="rounded border border-primary px-2 text-primary" onClick={() => ctrl.current?.({ allow: [...cfg.allow, p], locked: cfg.locked })}>APPROVE</button></div>
              ))}
            </div>
            <div>
              <p className="text-signal">APPROVED BUILDERS</p>
              {cfg.allow.length === 0 && <p className="text-muted-foreground">Only you so far.</p>}
              {cfg.allow.map((p) => (
                <div key={p} className="flex items-center gap-2 py-0.5"><span className="truncate">◆ {p.slice(0, 8)}…{p.slice(-4)}</span><button className="rounded border border-destructive px-2 text-destructive" onClick={() => ctrl.current?.({ allow: cfg.allow.filter((x) => x !== p), locked: cfg.locked, revoke: p })}>REVOKE ACCESS</button></div>
              ))}
              {cfg.allow.length > 0 && <p className="mt-1 text-muted-foreground">Revoking stops new edits. What they already built stays.</p>}
            </div>
            <div className="md:col-span-2">
              <p className="text-signal">FORMER BUILDERS · WORK STILL IN THE BUILD</p>
              {former.length === 0 && <p className="text-muted-foreground">None.</p>}
              {former.map(([p, n]) => (
                <div key={p} className="flex flex-wrap items-center gap-2 py-0.5">
                  <span className="truncate">◇ {p.slice(0, 8)}…{p.slice(-4)} · {n} MOVE(S) KEPT</span>
                  <button className="rounded border border-primary px-2 text-primary" onClick={() => ctrl.current?.({ allow: [...cfg.allow, p], locked: cfg.locked })}>RE-APPROVE</button>
                  <button className="rounded border border-destructive px-2 text-destructive" onClick={() => { if (confirm(`Remove everything ${p.slice(0, 8)}… built? This takes it out of the build for everyone.`)) ctrl.current?.({ allow: cfg.allow, locked: cfg.locked, wipe: p }); }}>REMOVE THEIR WORK</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr_1fr]">
        <aside className="space-y-3 rounded border border-border bg-card/60 p-3">
          <p className="text-signal">TOOLS</p>
          <div className="flex gap-1">{(["piece", "block", "erase"] as Tool[]).map((t) => <button key={t} onClick={() => setTool(t)} className={`rounded border px-2 py-1 ${tool === t ? "border-primary text-primary" : "border-border"}`}>{t.toUpperCase()}</button>)}</div>
          <button className="rounded border border-border px-2 py-1" onClick={() => setRot((r) => (r + 1) % 4)}>ROTATE · {rot * 90}°</button>
          <div className="flex flex-wrap gap-1">{BLOCKS.slice(0, 16).map((b, i) => <button key={b.id} title={b.name} onClick={() => { setKind(i); setTool("block"); }} className={`h-5 w-5 rounded-sm border ${kind === i ? "border-primary" : "border-border"}`} style={{ background: b.top }} />)}</div>
          <p className="pt-2 text-signal">PIECE SHELF · FROM BITCOIN</p>
          <div className="flex gap-1"><input className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1" placeholder="inscription id …i0" value={pasteId} onChange={(e) => setPasteId(e.target.value)} /><button className="rounded border border-border px-2" onClick={loadPaste}>ADD</button></div>
          <div className="max-h-72 space-y-1 overflow-auto">
            {shelfItems.length === 0 && <p className="text-muted-foreground">Loading inscribed pieces…</p>}
            {shelfItems.map((id) => (
              <button key={id} onClick={() => { setPicked(id); setTool("piece"); void fetchPiece(id); }} className={`block w-full truncate rounded border px-2 py-1 text-left ${picked === id ? "border-primary text-primary" : "border-border"}`}>
                ◆ {id.slice(0, 10)}…{id.slice(-4)} {cache[id] ? `· ${cache[id]!.length} VOX` : ""}
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded border border-border bg-card/60 p-3">
          <p className="mb-2 text-signal">FLOOR PLAN · CLICK TO {tool === "piece" ? "SNAP PIECE" : tool === "block" ? "STACK BLOCK" : "REMOVE TOP"}</p>
          <canvas ref={grid} width={512} height={512} onClick={onGrid} className="aspect-square w-full cursor-crosshair rounded" />
        </section>

        <section className="rounded border border-border bg-card/60 p-3">
          <p className="mb-2 text-signal">LIVE 3D · {world.size.toLocaleString()} BLOCKS</p>
          <canvas ref={iso} width={640} height={640} className="aspect-square w-full rounded" />
        </section>
      </div>

      <section className="mt-4 flex flex-wrap items-center gap-4 rounded border border-border bg-card/60 p-3">
        <span>PIECES BY REFERENCE: <b className="text-primary">{exp.parts.length}</b>{exp.dropped ? <span className="text-destructive"> (+{exp.dropped} over limit)</span> : null}</span>
        <span>OWN BLOCKS: <b className="text-primary">{exp.own.length}</b></span>
        <span>TOTAL SHOWN: <b>{world.size.toLocaleString()}</b></span>
        <span>FILE: <b className="text-signal">{bytes.toLocaleString()} BYTES</b></span>
        <button className="ml-auto rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50" disabled={!exp.parts.length && !exp.own.length} onClick={download}>DOWNLOAD ASSEMBLY .HTML</button>
      </section>
      <p className="mt-2 text-muted-foreground">Inscribe the downloaded file with your own wallet, or bring it into Land Forge to reinscribe on your BITMAP. Room moves are public on Nostr; anyone with the code can join.</p>
    </main>
  );
}
