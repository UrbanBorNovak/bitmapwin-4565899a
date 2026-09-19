/**
 * Shared chrome for the hall of fame: board tabs, weekly/all-time scope, the
 * search box and the small name/clan cells every table reuses.
 */

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { statusClass, type RankPlayer, type RankStatus } from "@/lib/ranks";
import { useWalletSession } from "@/lib/wallet-session";

export const EMPTY_LINE = "NO BLOOD HAS BEEN SPILLED IN THE OASIS — YET";

const TABS = [
  { to: "/ranks", label: "PROGRESSION" },
  { to: "/ranks/pvp", label: "PVP / PK" },
  { to: "/ranks/clans", label: "CLANS" },
] as const;

export type Scope = "weekly" | "all";

export function RankShell({
  scope,
  onScope,
  term,
  onTerm,
  lore,
  children,
}: {
  scope: Scope;
  onScope: (scope: Scope) => void;
  term: string;
  onTerm: (term: string) => void;
  lore: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8 md:py-12">
      <div className="label text-bitcoin">THE OASIS · HALL OF FAME</div>
      <h1 className="display mt-3 text-3xl md:text-5xl">RANKS</h1>
      <p className="mt-3 max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground md:text-xs">
        {lore}
      </p>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Rank boards">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: true }}
            className="label border border-border px-4 py-3 text-[0.6rem] hover:border-bitcoin hover:text-bitcoin md:py-2"
            activeProps={{ className: "border-bitcoin text-bitcoin" }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["weekly", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onScope(value)}
            className={`label border px-4 py-3 text-[0.6rem] md:py-2 ${
              scope === value ? "border-signal text-signal" : "border-border text-muted-foreground"
            }`}
          >
            {value === "weekly" ? "WEEKLY" : "ALL TIME"}
          </button>
        ))}
        <input
          value={term}
          onChange={(event) => onTerm(event.target.value)}
          placeholder="SEARCH NAME OR [TAG]"
          className="min-w-48 flex-1 border border-border bg-background px-3 py-3 font-mono text-[11px] uppercase outline-none placeholder:text-muted-foreground focus:border-bitcoin md:py-2"
        />
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}

/** Horizontally scrollable table frame — phones swipe the columns. */
export function RankTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[46rem] border-collapse font-mono text-[11px]">
        <thead className="bg-surface">
          <tr className="text-left text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th className={`whitespace-nowrap border-b border-border px-2 py-2 font-normal ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

export function Td({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <td className={`whitespace-nowrap border-b border-border/60 px-2 py-2 ${right ? "text-right tabular-nums" : ""}`}>
      {children}
    </td>
  );
}

export function StatusPill({ status }: { status: RankStatus }) {
  return (
    <span className={`text-[10px] uppercase ${statusClass(status)}`}>
      {status === "chaotic" ? "☠ CHAOTIC" : status.toUpperCase()}
    </span>
  );
}

export function PlayerCell({ player }: { player: RankPlayer }) {
  return (
    <span className="flex items-center gap-1.5">
      {player.clanTag ? (
        <Link
          to="/clan/$tag"
          params={{ tag: player.clanTag }}
          className="shrink-0 text-[10px] text-muted-foreground hover:text-bitcoin"
        >
          [{player.clanTag}]
        </Link>
      ) : null}
      <Link
        to="/ranks/player/$id"
        params={{ id: player.id }}
        className={`font-bold hover:underline ${statusClass(player.status)}`}
      >
        {player.name}
      </Link>
    </span>
  );
}

export function EmptyState({ note = EMPTY_LINE }: { note?: string }) {
  return <p className="border border-border px-4 py-10 text-center font-mono text-[11px] text-muted-foreground">{note}</p>;
}

/** The row we pin at the bottom — matched by the connected wallet address. */
export function useMyPlayer(players: RankPlayer[] | undefined): RankPlayer | null {
  const wallet = useWalletSession();
  if (!wallet || !players) return null;
  const mine = [wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean).map(String);
  return players.find((player) => player.wallet && mine.includes(player.wallet)) ?? null;
}
