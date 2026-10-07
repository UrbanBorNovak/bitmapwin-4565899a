import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Swords, Users } from "lucide-react";
import { pvpScore, rankPlayersQuery } from "@/lib/ranks";

/** Live players online (self + fresh peers) and the real top 3 PvP souls. */
export function OasisOnlinePanel({ online, compact = false }: { online: number; compact?: boolean }) {
  const players = useQuery({ ...rankPlayersQuery(), refetchInterval: 15_000 });
  const top = (players.data ?? [])
    .filter((p) => p.pvpKills + p.pkKills > 0)
    .sort((a, b) => pvpScore(b) - pvpScore(a))
    .slice(0, 3);

  if (compact) {
    return (
      <div
        data-no-translate
        className="pointer-events-auto mt-1 flex w-fit max-w-[15rem] items-center gap-1.5 border-l border-bitcoin bg-background/60 px-1.5 py-0.5 font-mono text-[8px] leading-tight backdrop-blur-md"
      >
        <span className="relative flex size-1">
          <span className="relative inline-flex size-1 rounded-full bg-signal" />
        </span>
        <span className="tabular-nums text-foreground">{online}</span>
        <Swords className="size-2.5 text-bitcoin" aria-hidden />
        {top.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          top.map((p, i) => (
            <span key={p.id} className="flex items-center gap-0.5">
              <span className="text-bitcoin">{i + 1}</span>
              <span className="max-w-[3.5rem] truncate text-foreground">{p.name}</span>
              <span className="text-muted-foreground">{p.pvpKills}</span>
            </span>
          ))
        )}
      </div>
    );
  }

  return (
    <div
      data-no-translate
      className="pointer-events-auto mt-1.5 w-fit min-w-[11rem] border-l-2 border-bitcoin bg-background/65 px-3 py-1.5 font-mono text-[10px] backdrop-blur-md"
    >
      <div className="flex items-center gap-1.5 text-signal">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-signal" />
        </span>
        <Users className="size-3" aria-hidden />
        <span className="tabular-nums text-foreground">{online}</span> ONLINE
      </div>
      <div className="mt-1 flex items-center gap-1 tracking-[0.18em] text-muted-foreground">
        <Swords className="size-3 text-bitcoin" aria-hidden /> TOP 3 PVP
      </div>
      {top.length === 0 ? (
        <div className="text-muted-foreground">{players.isLoading ? "…" : "NO KILLS YET"}</div>
      ) : (
        <ol className="mt-0.5 space-y-0.5">
          {top.map((p, i) => (
            <li key={p.id}>
              <Link
                to="/ranks/player/$id"
                params={{ id: p.id }}
                className="flex items-center gap-1.5 hover:text-bitcoin"
              >
                <span className="text-bitcoin">#{i + 1}</span>
                <span className="max-w-[7rem] truncate text-foreground">{p.name}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{p.pvpKills} K</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
