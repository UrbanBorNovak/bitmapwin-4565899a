import { Link } from "@tanstack/react-router";
import type { PassportEstate } from "@/lib/passport-estate";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--passport-line)] p-3">
      <strong className="block font-mono text-lg text-[var(--passport-paper)]" data-no-translate>{value}</strong>
      <span className="passport-kicker text-[7px]">{label}</span>
    </div>
  );
}

export function PassportProof({ estate }: { estate: PassportEstate }) {
  const g = estate.game;
  const volume = estate.chain.reduce((sum, t) => sum + t.priceSats, 0);
  const winRate = g.matches ? `${Math.round((g.wins / g.matches) * 100)}%` : "—";
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="passport-panel">
        <header className="border-b border-[var(--passport-line)] p-4">
          <p className="passport-kicker">CHAIN PROOF / CONFIRMED BITCOIN TRANSACTIONS</p>
          <h2 className="mt-2 font-mono text-xl font-bold text-[var(--passport-paper)]">ON-CHAIN LEDGER</h2>
        </header>
        <div className="grid grid-cols-3 gap-2 p-4">
          <Stat label="TRANSACTIONS" value={estate.chain.length} />
          <Stat label="BUYS / SELLS" value={`${estate.chain.filter((t) => t.side === "BUY").length}/${estate.chain.filter((t) => t.side === "SELL").length}`} />
          <Stat label="VOLUME BTC" value={(volume / 1e8).toFixed(4)} />
        </div>
        {estate.chain.length ? (
          <ul className="max-h-80 overflow-y-auto border-t border-[var(--passport-line)]">
            {estate.chain.map((t) => (
              <li key={`${t.txid}-${t.height}`} className="flex items-center justify-between gap-3 border-b border-[var(--passport-line)] px-4 py-2 font-mono text-[10px]">
                <span className={t.side === "BUY" ? "text-bitcoin" : "text-[var(--passport-gold)]"}>{t.side}</span>
                <Link to="/bitmap/$block" params={{ block: String(t.height) }} className="text-[var(--passport-paper)] hover:underline" data-no-translate>{t.height}.BITMAP</Link>
                <span className="text-[var(--passport-muted)]" data-no-translate>{t.priceSats ? `${(t.priceSats / 1e8).toFixed(4)} BTC` : "TRANSFER"}</span>
                <a href={`https://mempool.space/tx/${t.txid}`} target="_blank" rel="noreferrer" className="text-bitcoin hover:underline" data-no-translate>{t.txid.slice(0, 8)}…{t.blockHeight ? ` #${t.blockHeight}` : ""}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="passport-empty p-4">&gt; NO CONFIRMED TRADES INDEXED FOR THIS WALLET YET_</p>
        )}
      </section>
      <section className="passport-panel">
        <header className="border-b border-[var(--passport-line)] p-4">
          <p className="passport-kicker">WORLD PROOF / RECORDED IN-GAME STATS</p>
          <h2 className="mt-2 font-mono text-xl font-bold text-[var(--passport-paper)]">OASIS &amp; PLAY RECORD</h2>
        </header>
        <div className="grid grid-cols-3 gap-2 p-4">
          <Stat label="RANK LEVEL" value={g.level ?? "—"} />
          <Stat label="FAME" value={g.fame ?? "—"} />
          <Stat label="DUEL K / D" value={`${g.pvpKills}/${g.deaths}`} />
          <Stat label="DISTRICTS VISITED" value={g.districtsVisited} />
          <Stat label="BUILDS KEPT" value={g.buildsMaintained} />
          <Stat label="BIT BALANCE" value={g.bitBalance.toLocaleString("en-US")} />
          <Stat label="CARD MATCHES" value={g.matches} />
          <Stat label="WIN RATE" value={winRate} />
          <Stat label="BEST STREAK" value={g.bestStreak} />
        </div>
        <p className="passport-copy px-4 pb-4">BIT earned all-time: <span data-no-translate>{g.bitEarned.toLocaleString("en-US")}</span>. Stats come from recorded Oasis, rank and PLAY history only.</p>
      </section>
    </div>
  );
}
