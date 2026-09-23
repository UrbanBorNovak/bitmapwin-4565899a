/**
 * Shared chrome for the hall of fame: board tabs, weekly/all-time scope, the
 * search box and the small name/clan cells every table reuses.
 */

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { statusClass, type RankPlayer, type RankStatus } from "@/lib/ranks";
import { useWalletSession } from "@/lib/wallet-session";

export const EMPTY_LINE = "NO BLOOD HAS BEEN SPILLED IN THE OASIS — YET";

const TABS = [
  { to: "/ranks", label: "PROGRESSION" },
  { to: "/ranks/pvp", label: "PVP / PK" },
  { to: "/ranks/clans", label: "CLANS" },
  { to: "/ranks/shares", label: "SHARE MARKET" },
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
    <div className="rank-terminal mx-auto max-w-[1600px] px-3 py-5 md:px-5 md:py-8">
      <header className="rank-panel grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <div className="label text-bitcoin">THE OASIS · HALL OF FAME</div>
          <h1 className="display mt-2 text-3xl md:text-4xl">RANKS</h1>
        </div>
        <p className="max-w-2xl font-mono text-[10px] leading-relaxed text-muted-foreground md:text-right md:text-[11px]">{lore}</p>
      </header>

      <nav className="mt-px flex flex-wrap gap-px bg-border p-px" aria-label="Rank boards">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: true }}
            className="label flex-1 border border-transparent bg-background px-4 py-3 text-center text-[0.6rem] hover:border-bitcoin hover:text-bitcoin md:flex-none md:py-2"
            activeProps={{ className: "border-bitcoin bg-bitcoin text-primary-foreground" }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="rank-panel mt-px flex flex-wrap items-center gap-px p-2">
        {(["weekly", "all"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            onClick={() => onScope(value)}
            variant={scope === value ? "terminal" : "terminalGhost"}
            size="sm"
            className="text-[0.6rem]"
          >
            {value === "weekly" ? "WEEKLY" : "ALL TIME"}
          </Button>
        ))}
        <input
          value={term}
          onChange={(event) => onTerm(event.target.value)}
          placeholder="SEARCH NAME OR [TAG]"
          className="h-9 min-w-48 flex-1 border border-border bg-background px-3 font-mono text-[11px] uppercase outline-none placeholder:text-muted-foreground focus:border-bitcoin"
        />
      </div>

      <div className="mt-px">{children}</div>
    </div>
  );
}

/** Horizontally scrollable table frame — phones swipe the columns. */
export function RankTable({
  head,
  children,
  compact = false,
}: {
  head: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rank-panel overflow-x-auto [scrollbar-width:thin]">
      <table
        className={`w-full border-collapse font-mono text-[10px] sm:text-[11px] ${
          compact ? "min-w-[25rem] sm:min-w-[42rem]" : "min-w-[30rem] sm:min-w-[46rem]"
        }`}
      >
        <thead className="bg-secondary">
          <tr className="text-left text-[9px] uppercase tracking-normal text-muted-foreground">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, right, mobileHide }: { children: ReactNode; right?: boolean; mobileHide?: boolean }) {
  return (
    <th className={`whitespace-nowrap border-b border-border px-2 py-2 font-normal sm:px-3 ${right ? "text-right" : ""} ${mobileHide ? "hidden sm:table-cell" : ""}`}>
      {children}
    </th>
  );
}

export function Td({ children, right, mobileHide }: { children: ReactNode; right?: boolean; mobileHide?: boolean }) {
  return (
    <td className={`whitespace-nowrap border-b border-border/60 px-2 py-2 sm:px-3 ${right ? "text-right tabular-nums" : ""} ${mobileHide ? "hidden sm:table-cell" : ""}`}>
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
    <span className="flex items-center gap-2">
      {player.clanTag ? (
        <Link
          to="/clan/$tag"
          params={{ tag: player.clanTag }}
          className="shrink-0 border border-bitcoin/50 px-1.5 py-0.5 text-[11px] font-bold text-bitcoin hover:border-bitcoin hover:bg-bitcoin/10 sm:text-xs"
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
