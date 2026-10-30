import { useEffect, useMemo, useState } from "react";
import { walletQuery } from "@/lib/wallet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { blockSliceStatusFn, scoutedBlocksFn } from "@/lib/puzzle-pool.functions";
import { runBlockSlice } from "@/lib/puzzle-test-run";
import { isWorkerAddress } from "@/lib/puzzle-pool";
import { isBlockHeight } from "@/lib/puzzle-cartographic";
import { safeError } from "@/lib/puzzle-secret";
import { lotteryFound } from "@/lib/bitmap-lottery";
import { useWalletSession } from "@/lib/wallet-session";
import { ScanProgress } from "./ScanProgress";

/** Cartographic Luck: scout the one #71 slice your BITMAP block owns. */
export function BlockHuntPanel() {
  const wallet = useWalletSession();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [prog, setProg] = useState<{ done: number; size: number; rate: number } | null>(null);
  useEffect(() => { if (!addr && wallet?.paymentAddress) setAddr(wallet.paymentAddress); }, [wallet?.paymentAddress, addr]);
  const h = Number(input.replace(/\.bitmap$/i, "").trim());
  const valid = input.trim() !== "" && isBlockHeight(h);
  const status = useQuery({ queryKey: ["block-slice", h], queryFn: () => blockSliceStatusFn({ data: { height: h } }), enabled: valid });
  const scouted = useQuery({ queryKey: ["scouted-blocks"], queryFn: () => scoutedBlocksFn(), refetchInterval: 30_000 });
  const s = status.data?.ok ? status.data : null;

  async function scout() {
    setBusy(true); setMsg(null); setProg(null);
    try {
      const r = await runBlockSlice(addr.trim(), h, setMsg, (k) => lotteryFound(k), setProg);
      setMsg(r.message);
      void qc.invalidateQueries({ queryKey: ["block-slice", h] });
      void qc.invalidateQueries({ queryKey: ["scouted-blocks"] });
    } catch (e) { setMsg(safeError(e)); }
    setBusy(false);
  }

  return (
    <section className="mt-6 rounded border border-primary/40 bg-card/60 p-4 text-xs">
      <p className="label text-primary">CARTOGRAPHIC LUCK · HUNT YOUR OWN BLOCK</p>
      <p className="mt-2 text-muted-foreground">
        Every BITMAP block owns one fixed slice of #71 ({"SHA-256(\"bitmapwin:puzzle71:cartographic:<height>\") mod slice count"}). Scan it once with all 3 trap keys found and the block earns a SCOUTED badge on the Grandstand Jumbotron. No BIT, no extra prize share.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="208.bitmap" className="w-36 rounded border border-border bg-background px-2 py-1 font-mono" />
        <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="your BTC address" className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono" data-no-translate />
        <button onClick={scout} disabled={busy || !valid || !isWorkerAddress(addr.trim()) || s?.status !== "open"} className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50">
          {busy ? "[ SCANNING… ]" : `[ SCOUT ${valid ? h : "BLOCK"} ]`}
        </button>
      </div>
      <HeldBitmapPicker ordinals={wallet?.ordinalsAddress ?? ""} current={valid ? h : null} scouted={new Set((scouted.data ?? []).map((b) => b.height))} onPick={(v) => setInput(`${v}.bitmap`)} />
      {s && (
        <div className="mt-3 font-mono text-[11px]" data-no-translate>
          <p>SLICE #{s.index} · {s.status === "scouted" ? "✓ SCOUTED" : s.status === "scanning" ? "BEING SCANNED" : "OPEN"}</p>
          <p className="break-all text-muted-foreground">{s.startHex} → {s.endHex}</p>
          {s.worker && <p className="text-accent">by {s.worker.slice(0, 8)}…{s.worker.slice(-6)}</p>}
        </div>
      )}
      {busy && <p className="mt-2 text-muted-foreground">16.7M keys — usually 10–20 minutes. Keep this tab open.</p>}
      {busy && prog && <ScanProgress done={prog.done} size={prog.size} rate={prog.rate} />}
      {!busy && s?.status === "scanning" && <p className="mt-2 text-muted-foreground">Someone is scanning this block right now. If it was you and you left the page, it frees up within 20 minutes.</p>}
      {msg && <p className="mt-2 font-mono text-accent">{msg}</p>}
      {!!scouted.data?.length && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground" data-no-translate>
          SCOUTED: {scouted.data.map((b) => `${b.height}.bitmap`).join(" · ")}
        </p>
      )}
    </section>
  );
}

/** Lists every BITMAP held by the connected wallet (live ord index) as one-click hunt targets. */
function HeldBitmapPicker({ ordinals, current, scouted, onPick }: { ordinals: string; current: number | null; scouted: Set<number>; onPick: (h: number) => void }) {
  const snap = useQuery({ ...walletQuery(ordinals), enabled: ordinals !== "" });
  const held = useMemo(() => [...new Set((snap.data?.utxos ?? []).flatMap((u) => u.inscriptions.map((i) => i.bitmapHeight).filter((x): x is number => x !== null)))].sort((a, b) => a - b), [snap.data]);
  if (!ordinals) return <p className="mt-3 text-muted-foreground">Connect your wallet to list your own BITMAPs here.</p>;
  return (
    <div className="mt-3">
      <p className="label text-muted-foreground">YOUR BITMAPS {snap.isLoading ? "· SCANNING WALLET…" : `· ${held.length}`}</p>
      {!snap.isLoading && held.length === 0 && <p className="mt-1 text-muted-foreground">No BITMAPs found in this wallet.</p>}
      {held.length > 0 && (
        <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" data-no-translate>
          {held.map((v) => (
            <button key={v} onClick={() => onPick(v)} className={`rounded border px-2 py-0.5 font-mono text-[11px] ${current === v ? "border-primary bg-primary/20 text-primary" : "border-border hover:border-primary/60"}`}>
              {v}.bitmap{scouted.has(v) ? " ✓" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
