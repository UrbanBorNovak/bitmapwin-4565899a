import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import {
  createBot, fetchBalance, loadBots, saveBots, statusFor, validateCommission,
  MIN_DEPOSIT_SATS, PROMPT_MAX, type BotCitizen,
} from "@/lib/bot-citizen";

function BotCard({ bot, onRemove }: { bot: BotCitizen; onRemove: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [bal, setBal] = useState<{ confirmed: number; pending: number } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { void QRCode.toDataURL(`bitcoin:${bot.address}?amount=${MIN_DEPOSIT_SATS / 1e8}`, { margin: 1, width: 200 }).then(setQr); }, [bot.address]);
  useEffect(() => {
    let live = true;
    const tick = () => fetchBalance(bot.address).then((b) => { if (live) { setBal(b); setErr(false); } }).catch(() => live && setErr(true));
    tick(); const id = setInterval(tick, 30_000);
    return () => { live = false; clearInterval(id); };
  }, [bot.address]);
  const status = bal ? statusFor(bal.confirmed, bal.pending) : null;
  const backup = () => {
    const blob = new Blob([JSON.stringify(bot, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `bot-${bot.name}.json`; a.click();
  };
  return (
    <div className="space-y-3 rounded border border-border bg-card/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-display text-foreground">{bot.name}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{bot.height}{bot.parcelIndex !== null ? ` · parcel ${bot.parcelIndex}` : ""}.BITMAP</div>
      </div>
      <p className="text-xs text-muted-foreground">“{bot.prompt}”</p>
      <div className="flex gap-3">
        {qr ? <img src={qr} alt="Deposit address QR code" className="h-28 w-28 rounded bg-foreground p-1" /> : <div className="h-28 w-28 rounded bg-muted" />}
        <div className="min-w-0 space-y-2">
          <div className="font-mono text-[10px] tracking-widest text-signal">DEPOSIT ADDRESS</div>
          <button className="break-all text-left font-mono text-[11px] text-foreground hover:text-primary"
            onClick={() => { void navigator.clipboard.writeText(bot.address); toast.success("Address copied"); }}>{bot.address}</button>
          <div className="font-mono text-[11px]">
            {err ? <span className="text-muted-foreground">BALANCE UNAVAILABLE</span>
              : !bal ? <span className="text-muted-foreground">CHECKING…</span>
              : <span className={status === "FUNDED" ? "text-primary" : "text-signal"}>
                  {status?.replace("_", " ")} · {bal.confirmed.toLocaleString()} sats{bal.pending ? ` (+${bal.pending.toLocaleString()} pending)` : ""}
                </span>}
          </div>
        </div>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground">Send at least {MIN_DEPOSIT_SATS.toLocaleString()} sats · max fee per build {bot.maxFeeSats.toLocaleString()} sats</div>
      <div className="flex gap-2">
        <button className="btn-term-ghost text-xs" onClick={backup}>[ BACK UP KEY ]</button>
        <button className="btn-term-ghost text-xs" onClick={() => { if (confirm("Remove this bot from this device? Without a backup, any sats on its address are lost.")) onRemove(); }}>[ REMOVE ]</button>
      </div>
    </div>
  );
}

export function CommissionCitizen() {
  const [bots, setBots] = useState<BotCitizen[]>([]);
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [parcel, setParcel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [maxFee, setMaxFee] = useState(5000);
  useEffect(() => setBots(loadBots()), []);
  const update = (next: BotCitizen[]) => { setBots(next); saveBots(next); };

  const submit = () => {
    const input = { name, height: Number(height), parcelIndex: parcel === "" ? null : Number(parcel), prompt, maxFeeSats: maxFee };
    const why = validateCommission(input);
    if (why) return toast.error(why);
    update([createBot(input), ...bots]);
    setName(""); setPrompt(""); setParcel("");
    toast.success("Bot commissioned — fund its address to start");
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="btn-term">[ COMMISSION AUTONOMOUS CITIZEN ]</button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Commission Autonomous Citizen</SheetTitle>
          <SheetDescription>
            Give a bot its own Bitcoin address and a build idea for your BITMAP. Its key is made and kept on this device only — we never hold it. Back it up.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground">BOT NAME</span>
            <input className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="Unit-07" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">BITMAP #</span>
              <input inputMode="numeric" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} placeholder="819245" />
            </label>
            <label className="block space-y-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">PARCEL (OPTIONAL)</span>
              <input inputMode="numeric" className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" value={parcel} onChange={(e) => setParcel(e.target.value.replace(/\D/g, ""))} placeholder="whole BITMAP" />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground">BUILD IDEA · {prompt.length}/{PROMPT_MAX}</span>
            <textarea rows={3} maxLength={PROMPT_MAX} className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Cyberpunk radio tower, basalt core with cyan relay needles" />
          </label>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground">MAX FEE PER BUILD · {maxFee.toLocaleString()} SATS</span>
            <input type="range" min={1000} max={10000} step={500} value={maxFee} onChange={(e) => setMaxFee(Number(e.target.value))} className="w-full" />
          </label>
          <button className="btn-term w-full" onClick={submit}>[ GENERATE DEPOSIT ADDRESS ]</button>
        </div>
        <div className="mt-6 space-y-3">
          <div className="font-mono text-[10px] tracking-widest text-signal">YOUR BOTS ON THIS DEVICE · {bots.length}</div>
          {bots.length === 0 && <p className="text-xs text-muted-foreground">No bots yet.</p>}
          {bots.map((b) => <BotCard key={b.id} bot={b} onRemove={() => update(bots.filter((x) => x.id !== b.id))} />)}
          <p className="text-[11px] text-muted-foreground">Building on its own is not switched on yet — funded bots wait here until the auto-build step ships. You can always move the sats out with the backed-up key.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
