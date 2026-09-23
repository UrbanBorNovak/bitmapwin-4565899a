import { ArrowRight, Fingerprint, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { shortenAddress } from "@/lib/registry";

type PassportArtifactProps = {
  wallet: string | null;
  stamps?: number;
  unlocks?: number;
  records?: number;
  holdings?: number;
};

function passportKey(wallet: string | null) {
  if (!wallet) return "IDENTITY_NOT_LINKED";
  const head = wallet.slice(0, 8).toUpperCase();
  const tail = wallet.slice(-8).toUpperCase();
  return `${head}::${tail}`;
}

export function PassportArtifact({ wallet, stamps = 0, unlocks = 0, records = 0, holdings = 0 }: PassportArtifactProps) {
  const evidenceLevel = Math.min(99, stamps * 8 + unlocks * 12 + Math.min(records, 25) + Math.min(holdings * 3, 20));
  return (
    <article className="passport-artifact" aria-label={wallet ? "Verified BitmapWin Passport" : "Unlinked BitmapWin Passport"}>
      <div className="passport-artifact__corner passport-artifact__corner--tl" />
      <div className="passport-artifact__corner passport-artifact__corner--br" />
      <div className="passport-artifact__scan" aria-hidden />

      <header className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="passport-kicker">EVIDENCE LEVEL {String(evidenceLevel).padStart(2, "0")}</p>
          <h1 className="passport-wordmark">BITMAPWIN <span>PASSPORT</span></h1>
        </div>
        <div className="passport-status-light" title={wallet ? "Identity linked" : "Identity unlinked"}>
          <span className={wallet ? "is-linked" : ""} />
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-9 text-center">
        <div className="passport-seal">
          <div className="passport-seal__orbit" aria-hidden />
          <div className="passport-seal__core">
            {wallet ? <ShieldCheck className="size-16" strokeWidth={1} /> : <Fingerprint className="size-16" strokeWidth={1} />}
          </div>
          <span className="passport-seal__index">{wallet ? "VERIFIED" : "UNLINKED"}</span>
        </div>
        <p className="mt-8 text-xs uppercase text-[var(--passport-paper)]">
          Status: <strong>{wallet ? "SOVEREIGN IDENTITY ACTIVE" : "AWAITING IDENTITY"}</strong>
        </p>
        <p className="mt-2 font-mono text-[9px] text-[var(--passport-gold)]" data-no-translate>{passportKey(wallet)}</p>
        {wallet ? <p className="mt-2 font-mono text-[10px] text-[var(--passport-muted)]" data-no-translate>{shortenAddress(wallet)}</p> : null}
      </div>

      {wallet ? (
        <div className="relative z-10 grid grid-cols-4 border border-[var(--passport-line)]">
          {[["BITMAPS", holdings], ["STAMPS", stamps], ["UNLOCKS", unlocks], ["RECORDS", records]].map(([label, value]) => (
            <div key={String(label)} className="border-r border-[var(--passport-line)] p-2 text-center last:border-r-0">
              <strong className="block font-mono text-lg text-[var(--passport-paper)]">{value}</strong>
              <span className="passport-kicker text-[7px]">{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative z-10">
          <Link to="/auth" className="passport-initialize">
            INITIALIZE PASSPORT <ArrowRight className="size-4" />
          </Link>
          <p className="mt-3 text-center font-mono text-[8px] uppercase text-[var(--passport-muted)]">SIGN IN · VERIFY WALLET · BEGIN HISTORY</p>
        </div>
      )}
    </article>
  );
}