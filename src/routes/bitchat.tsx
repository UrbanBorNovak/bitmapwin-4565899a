import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { liveBitmapFn } from "@/lib/bw-matter.functions";
import { BitchatChannel } from "@/components/game/BitchatChannel";
import { bitmapRoomPubkey, bitmapRoomRelayStatus, postBitmapRoom, subscribeBitmapRoom, type BitchatLine } from "@/lib/nostr/bitchat-bridge";

import { checkFresh, loadPendingProof, loadRoomProof, parcelBadgeLabel, roomProofMessage, savePendingProof, saveRoomProof, type RoomProof } from "@/lib/nostr/bitchat-landowner";
import { roomRoleFn, verifyRoomOwnersFn, type RoomOwnerCheck } from "@/lib/nostr/bitchat-landowner.functions";
import { useWalletSession } from "@/lib/wallet-session";
import { signMessageWithWallet } from "@/lib/browser-wallet";

const FAMOUS = [0, 9, 715093, 717328, 840000];

export const Route = createFileRoute("/bitchat")({
  head: () => ({
    meta: [
      { title: "BITMAP Rooms on BitChat · BitmapWin" },
      { name: "description", content: "Chat in a room for every BITMAP block, checked live against the on-chain LiveOCI index and sent over BitChat's Nostr relays." },
      { property: "og:title", content: "BITMAP Rooms on BitChat" },
      { property: "og:description", content: "One chat room per BITMAP block, verified live from LiveOCI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BitchatRooms,
});

type Dossier = { inscriptionId: string | null; sat: number | null; source: string | null; error: string | null };

function BitchatRooms() {
  const lookup = useServerFn(liveBitmapFn);
  const [input, setInput] = useState("715093");
  const [height, setHeight] = useState<number | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [lines, setLines] = useState<BitchatLine[]>([]);
  const [nick, setNick] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [connected, setConnected] = useState(0);
  const [relayCount, setRelayCount] = useState(0);
  const [mode, setMode] = useState<"rooms" | "phone">("rooms");
  const listRef = useRef<HTMLDivElement>(null);
  const wallet = useWalletSession();
  const verify = useServerFn(verifyRoomOwnersFn);
  const roomRole = useServerFn(roomRoleFn);
  const [proof, setProof] = useState<RoomProof | null>(null);
  const [pending, setPending] = useState<RoomProof | null>(null);
  const [proofMsg, setProofMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [roleUnavailable, setRoleUnavailable] = useState(false);
  const [owners, setOwners] = useState<Record<string, RoomOwnerCheck>>({});
  const [now, setNow] = useState(() => Date.now());
  const ownersRef = useRef(owners); ownersRef.current = owners;
  const linesRef = useRef(lines); linesRef.current = lines;
  const inFlight = useRef(new Set<string>());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    setOwners({}); inFlight.current.clear(); setProofMsg(""); setRoleUnavailable(false);
    setProof(height == null ? null : loadRoomProof(height, bitmapRoomPubkey(height)));
    setPending(height == null ? null : loadPendingProof(height, bitmapRoomPubkey(height)));
  }, [height]);

  // Results are stamped with this device's clock on arrival, so freshness never depends on server time.
  const stamp = (r: Record<string, RoomOwnerCheck>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, checkedAt: Date.now() }]));

  // Check each proof (signature + live custody). Results live only in page memory and are
  // re-checked once older than RECHECK_MS; `force` re-runs failed (unavailable) checks now.
  const checkLines = useCallback((force?: Set<string>) => {
    if (height == null) return;
    const nowMs = Date.now();
    const due = new Map<string, { pubkey: string } & RoomProof>();
    for (const l of linesRef.current) {
      if (!l.proof || inFlight.current.has(l.pubkey)) continue;
      const c = ownersRef.current[l.pubkey];
      if (!c || force?.has(l.pubkey) || !checkFresh(c.checkedAt, nowMs)) due.set(l.pubkey, { pubkey: l.pubkey, ...l.proof });
    }
    const items = [...due.values()];
    for (let i = 0; i < items.length; i += 20) {
      const batch = items.slice(i, i + 20);
      batch.forEach((b) => inFlight.current.add(b.pubkey));
      verify({ data: { height, items: batch } })
        .then((r) => setOwners((p) => ({ ...p, ...stamp(r) })))
        .catch(() => setOwners((p) => ({ ...p, ...Object.fromEntries(batch.map((b) => [b.pubkey, { ok: false, status: "unavailable" as const, reason: "verification service unreachable", checkedAt: Date.now() }])) })))
        .finally(() => batch.forEach((b) => inFlight.current.delete(b.pubkey)));
    }
  }, [height, verify]);

  useEffect(() => { checkLines(); }, [lines, now, checkLines]);

  const retryUnavailable = () => {
    const ids = new Set(Object.entries(ownersRef.current).filter(([, c]) => c.status === "unavailable").map(([k]) => k));
    checkLines(ids);
  };

  /** Apply a verification result for this device's own signed proof (new or pending). */
  const settleOwn = (pubkey: string, p: RoomProof, r: RoomOwnerCheck | undefined) => {
    if (height == null) return;
    if (r?.ok) {
      savePendingProof(height, pubkey, null); setPending(null);
      saveRoomProof(height, pubkey, p); setProof(p);
      setOwners((o) => ({ ...o, [pubkey]: { ...r, checkedAt: Date.now() } }));
      setProofMsg(r.role === "parcel"
        ? `✓ VERIFIED · YOUR MESSAGES HERE CARRY THE PARCEL BADGE (${parcelBadgeLabel(r.parcels ?? [], height)}) FOR 24H`
        : "✓ VERIFIED · YOUR MESSAGES HERE CARRY THE LANDOWNER BADGE FOR 24H");
    } else if (!r || r.status === "unavailable") {
      savePendingProof(height, pubkey, p); setPending(p);
      setProofMsg(`⚠ SIGNED, BUT THE OWNERSHIP CHECK IS UNAVAILABLE (${(r?.reason ?? "verification service unreachable").toUpperCase()}). NO BADGE YET — RETRY WITHOUT SIGNING AGAIN.`);
    } else {
      savePendingProof(height, pubkey, null); setPending(null);
      setProofMsg(`✕ ${(r.reason ?? "not verified").toUpperCase()}`);
    }
  };

  const prove = async () => {
    if (height == null || !wallet) return;
    setBusy(true); setRoleUnavailable(false);
    try {
      const pubkey = bitmapRoomPubkey(height);
      const address = wallet.ordinalsAddress;
      setProofMsg("CHECKING ON-CHAIN HOLDINGS…");
      const role = await roomRole({ data: { height, address } }).catch(() => ({ role: null, parcels: [], unavailable: "ownership service unreachable" }));
      if (!role.role) {
        if (role.unavailable) { setRoleUnavailable(true); setProofMsg(`⚠ OWNERSHIP SOURCES UNAVAILABLE RIGHT NOW (${role.unavailable.toUpperCase()}). NOTHING WAS SIGNED.`); }
        else setProofMsg(`✕ THIS WALLET HOLDS NEITHER ${height}.BITMAP NOR ONE OF ITS VALID PARCELS RIGHT NOW`);
        return;
      }
      const kind = role.role === "parcel" ? "parcel" as const : undefined;
      setProofMsg("OPENING WALLET…");
      const issuedAt = Math.floor(Date.now() / 1000);
      const signature = await signMessageWithWallet(wallet.provider, address, roomProofMessage(kind, height, address, pubkey, issuedAt));
      const p: RoomProof = kind ? { address, signature, issuedAt, kind } : { address, signature, issuedAt };
      setProofMsg("CHECKING SIGNATURE AND ON-CHAIN HOLDINGS…");
      const r = await verify({ data: { height, items: [{ pubkey, ...p }] } }).then((x) => x[pubkey]).catch(() => undefined);
      settleOwn(pubkey, p, r);
    } catch (e) { setProofMsg(`✕ ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  /** Re-check the already-signed pending proof: no wallet prompt. */
  const retryPending = async () => {
    if (height == null || !pending) return;
    const pubkey = bitmapRoomPubkey(height);
    setBusy(true); setProofMsg("RE-CHECKING ON-CHAIN HOLDINGS…");
    try {
      const r = await verify({ data: { height, items: [{ pubkey, ...pending }] } }).then((x) => x[pubkey]).catch(() => undefined);
      settleOwn(pubkey, pending, r);
    } finally { setBusy(false); }
  };

  const dropProof = () => {
    if (height == null) return;
    const pk = bitmapRoomPubkey(height);
    saveRoomProof(height, pk, null); savePendingProof(height, pk, null);
    setProof(null); setPending(null); setProofMsg("");
  };
  const myPk = height == null ? null : bitmapRoomPubkey(height);
  const myCheck = myPk ? owners[myPk] : undefined;

  const open = (h: number) => { setHeight(h); setInput(String(h)); };

  useEffect(() => {
    if (height == null) return;
    setLines([]); setDossier(null); setStatus("");
    let alive = true;
    lookup({ data: { height } }).then((d) => alive && setDossier(d)).catch(() => alive && setDossier({ inscriptionId: null, sat: null, source: null, error: "LiveOCI lookup failed" }));
    const seen = new Set<string>();
    const stop = subscribeBitmapRoom(height, (l) => {
      if (seen.has(l.id)) return; seen.add(l.id);
      setLines((p) => p.some((x) => x.id === l.id) ? p : [...p, l].sort((a, b) => a.at - b.at).slice(-200));
    });
    const t = setInterval(() => { const s = bitmapRoomRelayStatus(); setRelayCount(s.length); setConnected(s.filter((x) => x.connected).length); }, 2000);
    return () => { alive = false; stop(); clearInterval(t); };
  }, [height, lookup]);

  useEffect(() => { listRef.current?.scrollTo({ top: 1e9 }); }, [lines.length]);

  const send = async () => {
    if (height == null || !text.trim()) return;
    setStatus("SENDING…");
    try {
      const r = await postBitmapRoom(height, nick, text, proof);
      if (r.outcome.accepted.length) { setLines((p) => p.some((x) => x.id === r.line.id) ? p : [...p, r.line]); setText(""); setStatus(`✓ ACCEPTED BY ${r.outcome.accepted.length}/${r.outcome.of} RELAYS`); }
      else setStatus(`✕ NOT SENT (${r.outcome.rejected[0]?.reason ?? "no relay answered"})`);
    } catch (e) { setStatus(`✕ NOT SENT (${(e as Error).message})`); }
  };

  const submitRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(input.trim().replace(/\.bitmap$/i, "").replace(/^#/, ""));
    if (Number.isInteger(h) && h >= 0 && h < 2_000_000) open(h);
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-3 px-3 pb-32 pt-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl text-foreground">⚡ BITMAP ROOMS</h1>
        <span className="font-mono text-[11px] text-muted-foreground">BW-ROOMS-1 · LIVEOCI</span>
      </header>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-md border border-border bg-card p-1 font-mono text-xs">
        {([["rooms", "BITMAP ROOMS"], ["phone", "PHONE CHANNELS"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
            className={`rounded px-3 py-2 ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</button>
        ))}
      </div>

      {mode === "phone" ? (
        <section className="space-y-2">
          <p className="font-mono text-[11px] text-muted-foreground">Location channels (#geohash) on the same relays the BitChat iPhone and Android apps use, so phone users in that area can read and reply. Messages are public and not stored by us.</p>
          <BitchatChannel />
        </section>
      ) : (<>
      <form onSubmit={submitRoom} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} inputMode="numeric" placeholder="Block number, e.g. 715093"
          className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 font-mono text-sm text-foreground" />
        <button className="rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground">ENTER</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {FAMOUS.map((h) => (
          <button key={h} onClick={() => open(h)} className={`rounded-full border px-3 py-1 font-mono text-xs ${height === h ? "border-signal text-signal" : "border-border text-muted-foreground"}`}>#{h}</button>
        ))}
      </div>

      {height == null ? (
        <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">Pick a block to open its room. Every BITMAP block has its own chat room.</p>
      ) : (
        <>
          <section className="rounded-md border border-border bg-card p-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-base text-foreground">{height}.bitmap</span>
              <span className={connected ? "text-signal" : "text-destructive"}>● {connected}/{relayCount} RELAYS</span>
            </div>
            {!dossier ? <p className="mt-1 text-muted-foreground">Checking LiveOCI…</p>
              : dossier.inscriptionId ? (
                <div className="mt-1 space-y-0.5 text-muted-foreground">
                  <p>CANONICAL: <a className="text-signal underline" href={`https://ordinals.com/inscription/${dossier.inscriptionId}`} target="_blank" rel="noreferrer">{dossier.inscriptionId.slice(0, 10)}…{dossier.inscriptionId.slice(-4)}</a></p>
                  {dossier.sat != null && <p>SAT: {dossier.sat.toLocaleString("en-US")}</p>}
                  <p>SOURCE: {dossier.source}</p>
                  <Link to="/slab" search={{ b: height }} className="text-primary underline">View land slab →</Link>
                </div>
              ) : <p className="mt-1 text-muted-foreground">{dossier.error ?? "No canonical BITMAP found for this block — chat still works."}</p>}
          </section>

          <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto rounded-md border border-border bg-card p-3 text-sm" style={{ minHeight: "16rem", maxHeight: "50dvh" }}>
            {lines.length === 0 ? <p className="text-muted-foreground">No messages in the last hour. Say hello.</p> : lines.map((l) => (
              <p key={l.id} className="break-words">{l.proof ? <HolderBadge check={owners[l.pubkey]} proof={l.proof} height={height} now={now} onRetry={retryUnavailable} /> : null}<span className={`font-mono text-xs ${l.mine ? "text-primary" : "text-signal"}`}>{l.nick}</span> <span className="text-foreground">{l.text}</span></p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="rounded-md border border-border bg-card p-2 font-mono text-[11px] text-muted-foreground">
              {proof ? (
                <>
                  <p>{proof.kind === "parcel" ? "▦" : "👑"} <span className="text-primary">{proof.kind === "parcel" ? "PARCEL HOLDER PROOF ON" : "LANDOWNER PROOF ON"}</span> · {proof.address.slice(0, 8)}…{proof.address.slice(-4)} · <button onClick={dropProof} className="underline">REMOVE</button></p>
                  {myCheck?.status === "unavailable" && <p className="mt-1 text-destructive">⚠ OWNERSHIP CHECK UNAVAILABLE ({(myCheck.reason ?? "").toUpperCase()}) · BADGE HIDDEN · <button onClick={retryUnavailable} className="underline">RETRY CHECK</button></p>}
                  {myCheck?.status === "rejected" && <p className="mt-1 text-destructive">✕ {(myCheck.reason ?? "not verified").toUpperCase()} · BADGE HIDDEN</p>}
                </>
              ) : pending ? (
                <p>{pending.kind === "parcel" ? "▦" : "👑"} <span className="text-foreground">SIGNED · WAITING FOR AN OWNERSHIP CHECK</span> · <button onClick={retryPending} disabled={busy} className="text-primary underline disabled:opacity-50">{busy ? "CHECKING…" : "RETRY CHECK"}</button> (no new signature) · <button onClick={dropProof} className="underline">DISCARD</button></p>
              ) : wallet ? (
                <p>Hold {height}.bitmap or one of its parcels? <button onClick={prove} disabled={busy} className="text-primary underline disabled:opacity-50">{roleUnavailable ? "TRY AGAIN" : "PROVE OWNERSHIP"}</button> — one wallet signature, no fee, valid 24h.</p>
              ) : (
                <p>Hold this BITMAP? <Link to="/wallet" className="text-primary underline">Connect your wallet</Link> to prove it in chat.</p>
              )}
              {proofMsg && <p className="mt-1">{proofMsg}</p>}
              <p className="mt-1 text-[10px]">A badge shows only when the signature checks out and the signing address holds this BITMAP, or a valid parcel of it (first claim per transaction index), on-chain right now. If an ownership source can't be reached, no badge is shown until a fresh check succeeds; badges are re-checked every 5 minutes. Signing never moves funds.</p>
            </div>
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Nickname (optional)" maxLength={24}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground" />
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`Message #${height}`} maxLength={500}
                className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground" />
              <button onClick={send} className="rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground">SEND</button>
            </div>
            {status && <p className="font-mono text-[11px] text-muted-foreground">{status}</p>}
            <p className="font-mono text-[10px] text-muted-foreground">✓ ACCEPTED means a relay took it, not that anyone read it. Rooms follow the open BW-ROOMS-1 format (BitChat-style messages on five shared relays). The BitChat phone app does not read block rooms yet; use PHONE CHANNELS to talk with phone users.</p>
          </div>
        </>
      )}
      </>)}
    </main>
  );
}

/** Badge for one chat line: shown only for a verified, fresh live check; never from a stale or failed one. */
function HolderBadge({ check, proof, height, now, onRetry }: { check: RoomOwnerCheck | undefined; proof: RoomProof; height: number; now: number; onRetry: () => void }) {
  const chip = "mr-1 rounded-sm border px-1 font-mono text-[10px]";
  if (!check || (check.ok && !checkFresh(check.checkedAt, now)))
    return <span className={`${chip} border-border text-muted-foreground`}>… CHECKING HOLDER</span>;
  if (check.status === "unavailable")
    return <button type="button" onClick={onRetry} title={`Ownership could not be checked: ${check.reason ?? "source unavailable"}. No badge is shown until a fresh check succeeds.`} className={`${chip} border-destructive text-destructive`}>⚠ HOLDER CHECK UNAVAILABLE · RETRY</button>;
  if (!check.ok) return null;
  if (check.role === "parcel") {
    const list = check.parcels ?? [];
    return <span title={`Signed by ${proof.address}, which holds parcel${list.length > 1 ? "s" : ""} ${list.map((i) => `${i}.${height}`).join(", ")} of ${height}.bitmap on-chain (checked ${new Date(check.checkedAt).toLocaleTimeString("en-US")})`} className={`${chip} border-dashed border-primary text-primary`}>▦ PARCEL · {parcelBadgeLabel(list, height)}</span>;
  }
  return <span title={`Signed by ${proof.address}, which holds ${height}.bitmap on-chain (checked ${new Date(check.checkedAt).toLocaleTimeString("en-US")})`} className={`${chip} border-primary text-primary`}>👑 LANDOWNER · {height}</span>;
}
