import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import {
  createBot, fetchBalance, loadBots, saveBots, statusFor, validateCommission,
  MIN_DEPOSIT_SATS, PROMPT_MAX, type BotCitizen,
} from "@/lib/bot-citizen";
import { runSignetBuild, type BuildStep } from "@/lib/bot-build";
import { checkBotGroundFn } from "@/lib/bot-citizen.functions";
import { useServerFn } from "@tanstack/react-start";

const STEP_LABEL: Record<BuildStep, string> = {
  VALIDATING: "CHECKING YOU HOLD THIS GROUND…", GENERATING: "GENERATING VOXELS…", SIGNING_COMMIT: "SIGNING COMMIT ON THIS DEVICE…",
  WAITING_COMMIT: "COMMIT SENT…", SIGNING_REVEAL: "SIGNING REVEAL ON THIS DEVICE…", DONE: "BUILD INSCRIBED ON SIGNET",
};

function BotCard({ bot, onRemove, onUpdate }: { bot: BotCitizen; onRemove: () => void; onUpdate: (b: BotCitizen) => void }) {
  const checkGround = useServerFn(checkBotGroundFn);
  const [step, setStep] = useState<BuildStep | null>(null);
  const [stepInfo, setStepInfo] = useState<string>("");
  const running = step !== null && step !== "DONE";
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);
  const build = async () => {
    try {
      setStep("VALIDATING"); setStepInfo("");
      const g = await checkGround({ data: { height: bot.height, parcelIndex: bot.parcelIndex } });
      if (!g.ok) throw new Error(g.reason);
      const r = await runSignetBuild({ secretHex: bot.secretHex, height: bot.height, prompt: bot.prompt, maxFeeSats: bot.maxFeeSats,
        ground: { rect: g.rect, txCount: g.txCount }, onStep: (s, i) => { setStep(s); setStepInfo(i ?? ""); } });
      onUpdate({ ...bot, lastBuild: { revealTxid: r.revealTxid, blocks: r.blocks, fees: r.fees, at: Date.now() } });
      toast.success(`Built ${r.blocks} voxels on signet`);
    } catch (e) {
      setStep(null); toast.error((e as Error).message || "Build failed");
    }
  };
  const [qr, setQr] = useState<string | null>(null);
  const [bal, setBal] = useState<{ confirmed: number; pending: number } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { void QRCode.toDataURL(`bitcoin:${bot.address}`, { margin: 1, width: 200 }).then(setQr); }, [bot.address]);
  useEffect(() => {
    let live = true;
    const tick = () => fetchBalance(bot.address, bot.network).then((b) => { if (live) { setBal(b); setErr(false); } }).catch(() => live && setErr(true));
    tick(); const id = setInterval(tick, 30_000);
    return () => { live = false; clearInterval(id); };
  }, [bot.address, bot.network]);
  const status = bal ? statusFor(bal.confirmed, bal.pending) : null;
  const backup = () => {
    const blob = new Blob([JSON.stringify(bot, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `bot-${bot.name}.json`; a.click();
  };
  return (
    <div className="space-y-3 rounded border border-border bg-card/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-display text-foreground">{bot.name} <span className={`ml-1 font-mono text-[10px] ${bot.network === "signet" ? "text-signal" : "text-muted-foreground"}`}>{bot.network.toUpperCase()}</span></div>
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
      <div className="font-mono text-[10px] text-muted-foreground">Send at least {MIN_DEPOSIT_SATS.toLocaleString()} {bot.network === "signet" ? "signet (test) " : ""}sats · max fee per build {bot.maxFeeSats.toLocaleString()} sats</div>
      {running && (
        <div role="status" className="rounded border border-primary bg-primary/10 p-2 font-mono text-[11px] text-primary">
          KEEP THIS TAB OPEN — the bot signs on this device. Closing now can leave sats waiting on a half-finished build.
          <div className="mt-1 text-foreground">{STEP_LABEL[step!]} {stepInfo && <span className="text-muted-foreground">{stepInfo.slice(0, 24)}</span>}</div>
        </div>
      )}
      {bot.lastBuild && (
        <a className="block font-mono text-[11px] text-signal hover:text-primary" target="_blank" rel="noreferrer"
          href={`https://mempool.space/signet/tx/${bot.lastBuild.revealTxid}`}>
          LAST BUILD · {bot.lastBuild.blocks} voxels · {bot.lastBuild.fees.toLocaleString()} sats fees ↗
        </a>
      )}
      {bot.network === "signet" ? (
        <button className="btn-term w-full text-xs" disabled={running || status !== "FUNDED"} onClick={build}>
          {running ? "[ BUILDING… ]" : status === "FUNDED" ? "[ BUILD NOW ON SIGNET ]" : `[ FUND ${MIN_DEPOSIT_SATS.toLocaleString()} SIGNET SATS TO BUILD ]`}
        </button>
      ) : <p className="font-mono text-[10px] text-muted-foreground">MAINNET BOT · auto-build runs on signet only for now. Back up the key to move its sats.</p>}
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
    if (why) { toast.error(why); return; }
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
          {bots.map((b) => <BotCard key={b.id} bot={b} onRemove={() => update(bots.filter((x) => x.id !== b.id))} onUpdate={(nb) => update(bots.map((x) => (x.id === nb.id ? nb : x)))} />)}
          <p className="text-[11px] text-muted-foreground">New bots run on Bitcoin signet (test coins, no real value). Before each build we check that one of your linked wallets holds the BITMAP or parcel; voxels are clipped to that ground and the build stops if fees go over the limit. Signing happens in this browser, so the tab must stay open while a build runs.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
