/** dev9's Bat-computer: live mirror of the Launch Grandstand once the MARAUDER LOG is unlocked. */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listLaunchSeatsFn } from "@/lib/launch-seats.functions";
import { grandstandFeed } from "@/lib/batcave-feed";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function BatcaveGrandstandFeed() {
  const q = useQuery({ queryKey: ["launch-seats"], queryFn: () => listLaunchSeatsFn(), refetchInterval: 30_000, staleTime: 20_000 });
  const f = grandstandFeed(q.data?.seats ?? []);
  return (
    <div data-testid="batcave-grandstand-feed" className="pointer-events-auto absolute right-3 top-3 w-64 rounded border border-signal/60 bg-background/85 p-3 font-mono text-[11px] backdrop-blur-sm">
      <div className="tracking-[0.25em] text-signal">BAT-COMPUTER · GRANDSTAND FEED</div>
      {q.isLoading ? <p className="mt-2 text-muted-foreground">TUNING IN…</p> : q.data?.error ? <p className="mt-2 text-muted-foreground">FEED DOWN. TRY LATER.</p> : (
        <>
          <div className="mt-2 text-foreground"><span className="text-bitcoin" data-no-translate>{f.count}</span> / {f.capacity} SEATED</div>
          <div className="text-muted-foreground">{f.tier ? `${f.tier.left} TO ${f.tier.name}` : "IGNITION REACHED"}</div>
          <ul className="mt-2 space-y-0.5" data-no-translate>
            {f.latest.map((s) => <li key={s.seat} className="text-muted-foreground"><span className="text-signal">#{s.seat}</span> {short(s.address)}</li>)}
          </ul>
        </>
      )}
      <Link to="/launch" className="mt-2 inline-block rounded border border-border px-2 py-0.5 hover:border-signal">[ OPEN GRANDSTAND ]</Link>
    </div>
  );
}
