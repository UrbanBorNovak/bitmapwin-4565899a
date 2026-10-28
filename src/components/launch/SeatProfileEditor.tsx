import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { setSeatProfileFn } from "@/lib/launch-seats.functions";
import { STATUS_MAX, cleanHandle, profileMessage, type LaunchSeat } from "@/lib/launch-seats";

type Signer = { provider: Parameters<typeof signMessageWithWallet>[0]; ordinalsAddress: string };

/** Lets a seat's own wallet sign an X handle + short status that neighbors can see. */
export function SeatProfileEditor({ seat, signer }: { seat: LaunchSeat; signer: Signer | null }) {
  const save = useServerFn(setSeatProfileFn);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState(seat.xHandle ?? "");
  const [status, setStatus] = useState(seat.statusNote ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!signer) return null;
  if (!open) {
    return (
      <button type="button" className="mt-1 text-signal hover:underline" onClick={() => setOpen(true)}>
        {seat.xHandle || seat.statusNote ? "✎ Edit my handle & status" : "+ Add my X handle & status"}
      </button>
    );
  }
  const submit = async () => {
    const h = handle.trim().replace(/^@/, "");
    if (h && !cleanHandle(h)) { setMsg("X handle: letters, numbers and _ only (max 15)"); return; }
    const s = status.trim().slice(0, STATUS_MAX);
    setBusy(true); setMsg(null);
    try {
      const issuedAt = new Date().toISOString();
      const address = signer.ordinalsAddress;
      const signature = await signMessageWithWallet(signer.provider, address, profileMessage(address, issuedAt, h, s));
      const res = await save({ data: { address, issuedAt, signature, handle: h, status: s } });
      if (!res.ok) { setMsg(res.error); return; }
      await qc.invalidateQueries({ queryKey: ["launch-seats"] });
      setMsg("Saved — your neighbors can see it now"); setOpen(false);
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-2 space-y-1 rounded border border-signal/40 p-2">
      <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={16} placeholder="@handle on X"
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs" aria-label="X handle" />
      <input value={status} onChange={(e) => setStatus(e.target.value.slice(0, STATUS_MAX))} maxLength={STATUS_MAX} placeholder="Status, e.g. building block #208"
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs" aria-label="Status" />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{status.length}/{STATUS_MAX} · signed by your wallet, no fee</span>
        <div className="flex gap-2">
          <button type="button" className="hover:underline" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" disabled={busy} className="text-bitcoin hover:underline" onClick={submit}>{busy ? "Signing…" : "Sign & save"}</button>
        </div>
      </div>
      {msg && <div className="text-[10px] text-signal">{msg}</div>}
    </div>
  );
}

/** Public display of a seat's handle and status. */
export function SeatProfileLine({ seat }: { seat: LaunchSeat }) {
  if (!seat.xHandle && !seat.statusNote) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {seat.xHandle && (
        <a href={`https://x.com/${seat.xHandle}`} target="_blank" rel="noreferrer" className="block text-signal hover:underline" data-no-translate>𝕏 @{seat.xHandle}</a>
      )}
      {seat.statusNote && <div className="italic text-muted-foreground" data-no-translate>“{seat.statusNote}”</div>}
    </div>
  );
}
