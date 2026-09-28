import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { transferShadowPassFn, verifyShadowPassFn } from "@/lib/shadow-assets.functions";
import {
  clearPendingReceive,
  createPendingReceive,
  forgetPass,
  getPendingReceive,
  parseReceiveCode,
  receiveCodeFor,
  savePass,
  type ShadowPass,
} from "@/lib/shadow-vault";

const btn = "border px-3 py-2 font-mono text-[11px] disabled:opacity-40";

/** Holder side: paste a recipient's receive code and hand the pass over. */
export function ShadowSend({ pass, onSent }: { pass: ShadowPass; onSent: () => void }) {
  const transfer = useServerFn(transferShadowPassFn);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSend() {
    const parsed = parseReceiveCode(code);
    if (!parsed || parsed.slug !== pass.slug) {
      toast.error("THAT RECEIVE CODE IS NOT FOR THIS GATE");
      return;
    }
    if (!window.confirm("SEND THIS PASS? IT WILL LEAVE THIS DEVICE FOR GOOD.")) return;
    setBusy(true);
    try {
      const res = await transfer({ data: { slug: pass.slug, salt: pass.salt, newCommitment: parsed.commitment } });
      if (!res.ok) {
        toast.error(res.reason);
        return;
      }
      forgetPass(pass.slug);
      toast.success("PASS SENT · SHIELDED");
      onSent();
    } catch {
      toast.error("GATE UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btn} border-border text-muted-foreground`}>
        ⇄ SEND THIS PASS PRIVATELY
      </button>
    );
  return (
    <div className="border border-signal/40 p-2">
      <p className="label text-signal">SEND PRIVATELY</p>
      <p className="label mt-1 text-muted-foreground">
        ASK THE RECIPIENT FOR THEIR RECEIVE CODE. NO ADDRESS OR ACCOUNT IS INVOLVED.
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="SHADOW-RECV-v1…"
        className="mt-2 w-full border border-border bg-background px-2 py-1 font-mono text-[11px]"
      />
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy || !code} onClick={onSend} className={`${btn} border-signal text-signal`}>
          {busy ? "SENDING…" : "SEND"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`${btn} border-border text-muted-foreground`}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

/** Recipient side: make fresh secrets on-device, share only the receive code. */
export function ShadowReceive({ slug, onReceived }: { slug: string; onReceived: (p: ShadowPass) => void }) {
  const verify = useServerFn(verifyShadowPassFn);
  const [pending, setPending] = useState<ReturnType<typeof getPendingReceive>>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPending(getPendingReceive(slug)), [slug]);

  async function onCheck() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await verify({ data: { slug, commitment: pending.commitment } });
      if (!res.valid) {
        toast.message("NOT ARRIVED YET — SEND THE CODE TO THE HOLDER");
        return;
      }
      const pass: ShadowPass = { ...pending, passIndex: 0, claimedAt: new Date().toISOString() };
      savePass(pass);
      clearPendingReceive(slug);
      toast.success("PASS RECEIVED");
      onReceived(pass);
    } catch {
      toast.error("GATE UNREACHABLE");
    } finally {
      setBusy(false);
    }
  }

  if (!pending)
    return (
      <button
        type="button"
        onClick={() => setPending(createPendingReceive(slug))}
        className={`${btn} border-border text-muted-foreground`}
      >
        ⇄ RECEIVE A PASS FROM SOMEONE
      </button>
    );
  const code = receiveCodeFor(slug, pending.commitment);
  return (
    <div className="border border-signal/40 p-2">
      <p className="label text-signal">YOUR RECEIVE CODE</p>
      <p className="label mt-1 text-muted-foreground">
        SHARE IT WITH THE HOLDER. IT CANNOT OPEN THE GATE — ONLY THIS DEVICE CAN.
      </p>
      <code className="mt-1 block break-all font-mono text-[10px]">{code}</code>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            toast.success("RECEIVE CODE COPIED");
          }}
          className={`${btn} border-border`}
        >
          COPY
        </button>
        <button type="button" disabled={busy} onClick={onCheck} className={`${btn} border-signal text-signal`}>
          {busy ? "CHECKING…" : "CHECK ARRIVAL"}
        </button>
      </div>
    </div>
  );
}
