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
import { applyOp, emptyState, exportAssembly, liveBlocks, liveParts, newOid, type CoOp, type CoState } from "@/lib/co-forge";

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
  const [, setTick] = useState(0);
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
    if (!joined) return;
    let stop = () => {};
    let alive = true;
    (async () => {
      const net = await import("@/lib/nostr/co-forge-room");
      if (!alive) return;
      const pk = net.myPubkey();
      setMe(pk);
      state.current = emptyState();
      stop = net.joinRoom(joined, (b) => {
        b.ops.forEach((o) => applyOp(state.current, o, { t: b.t, by: b.by }));
        setPeers((p) => ({ ...p, [b.by]: Math.max(p[b.by] ?? 0, b.t) }));
        setTick((n) => n + 1);
      });
      send.current = (ops) => {
        const t = Date.now();
        ops.forEach((o) => applyOp(state.current, o, { t, by: pk }));
        setTick((n) => n + 1);
        net.sendOps(joined, ops, t).catch((e: Error) => toast.error(e.message));
      };
    })();
    return () => { alive = false; stop(); send.current = null; };
  }, [joined]);

  const parts = liveParts(state.current);
  useEffect(() => { parts.forEach((p) => void fetchPiece(p.id)); });

  // Flatten: pieces (oldest first) then loose blocks/erasures on top.
  const { world, owner } = useMemo(() => {
    const w = new Map<string, number>(), o = new Map<string, string>();
    for (const p of parts) {
      const b = cache[p.id];
      if (!b) continue;
      for (const v of placePart(b, p, SPAN)) { const k = `${v.dx},${v.dy},${v.dz}`; w.set(k, v.k); o.set(k, p.oid); }
    }
    for (const [k, b] of state.current.blocks) { if (b.k === null) w.delete(k); else w.set(k, b.k); o.delete(k); }
    return { world: w, owner: o };
  }, [parts, cache, state.current.blocks.size, peers]); // eslint-disable-line react-hooks/exhaustive-deps

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
      send.current([{ op: "p+", oid: newOid(), id: picked, x, y: 0, z, r: rot }]);
    } else if (tool === "block") {
      const y = col ? col.y + 1 : 0;
      if (y < SPAN) send.current([{ op: "b+", x, y, z, k: kind }]);
    } else if (col) {
      const key = `${x},${col.y},${z}`, oid = owner.get(key);
      send.current([oid ? { op: "p-", oid } : { op: "b-", x, y: col.y, z }]);
    }
  };

  const loadPaste = async () => {
    const id = pasteId.trim();
    if (!isInscriptionId(id)) { toast.error("PASTE A FULL INSCRIPTION ID (…i0)"); return; }
    await fetchPiece(id); setPicked(id); setTool("piece"); setPasteId("");
  };

  const exp = exportAssembly(state.current);
  const html = useMemo(() => forgeAssemblyHtml(height, exp.parts, exp.own as TplBlock[]), [height, exp.parts.length, exp.own.length, peers]); // eslint-disable-line react-hooks/exhaustive-deps
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
        <label className="flex flex-col gap-1">ROOM CODE<input className="rounded border border-border bg-background px-2 py-1" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. 819245-crew" /></label>
        <label className="flex flex-col gap-1">BITMAP<input type="number" className="w-28 rounded border border-border bg-background px-2 py-1" value={height} onChange={(e) => setHeight(Math.max(0, Number(e.target.value) | 0))} /></label>
        <button className="rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50" disabled={!room.trim()} onClick={() => setJoined(room.trim().toLowerCase())}>{joined ? "SWITCH ROOM" : "JOIN ROOM"}</button>
        {joined && <button className="rounded border border-border px-3 py-1.5" onClick={() => navigator.clipboard.writeText(share).then(() => toast.success("INVITE LINK COPIED"), () => toast.message(share))}>COPY INVITE LINK</button>}
        {joined && <span className="text-signal">● LIVE IN “{joined}” · {Object.keys(peers).filter((p) => p !== me).length} OTHER BUILDER(S) SEEN</span>}
      </section>

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
