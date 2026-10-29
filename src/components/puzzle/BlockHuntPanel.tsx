import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { blockSliceStatusFn, scoutedBlocksFn } from "@/lib/puzzle-pool.functions";
import { runBlockSlice } from "@/lib/puzzle-test-run";
import { isWorkerAddress } from "@/lib/puzzle-pool";
import { isBlockHeight } from "@/lib/puzzle-cartographic";
import { FOUND_KEY } from "@/lib/bitmap-lottery";
import { useWalletSession } from "@/lib/wallet-session";

/** Cartographic Luck: scout the one #71 slice your BITMAP block owns. */
export function BlockHuntPanel() {
  const wallet = useWalletSession();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!addr && wallet?.paymentAddress) setAddr(wallet.paymentAddress); }, [wallet?.paymentAddress, addr]);
  const h = Number(input.replace(/\.bitmap$/i, "").trim());
  const valid = input.trim() !== "" && isBlockHeight(h);
  const status = useQuery({ queryKey: ["block-slice", h], queryFn: () => blockSliceStatusFn({ data: { height: h } }), enabled: valid });
  const scouted = useQuery({ queryKey: ["scouted-blocks"], queryFn: () => scoutedBlocksFn(), refetchInterval: 30_000 });
  const s = status.data?.ok ? status.data : null;

  async function scout() {
    setBusy(true); setMsg(null);
    try {
      const r = await runBlockSlice(addr.trim(), h, setMsg, (k) => {
        localStorage.setItem(FOUND_KEY, k);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([`PUZZLE #71 KEY\n${k}\n`], { type: "text/plain" }));
        a.download = "puzzle71-key.txt"; a.click();
      });
      setMsg(r.message);
      void qc.invalidateQueries({ queryKey: ["block-slice", h] });
      void qc.invalidateQueries({ queryKey: ["scouted-blocks"] });
    } catch (e) { setMsg(e instanceof Error ? e.message : "Scan failed"); }
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
      {s && (
        <div className="mt-3 font-mono text-[11px]" data-no-translate>
          <p>SLICE #{s.index} · {s.status === "scouted" ? "✓ SCOUTED" : s.status === "scanning" ? "BEING SCANNED" : "OPEN"}</p>
          <p className="break-all text-muted-foreground">{s.startHex} → {s.endHex}</p>
          {s.worker && <p className="text-accent">by {s.worker.slice(0, 8)}…{s.worker.slice(-6)}</p>}
        </div>
      )}
      {busy && <p className="mt-2 text-muted-foreground">16.7M keys — usually 5–15 minutes. Keep this tab open.</p>}
      {msg && <p className="mt-2 font-mono text-accent">{msg}</p>}
      {!!scouted.data?.length && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground" data-no-translate>
          SCOUTED: {scouted.data.map((b) => `${b.height}.bitmap`).join(" · ")}
        </p>
      )}
    </section>
  );
}
