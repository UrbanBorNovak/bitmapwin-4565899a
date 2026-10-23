import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listLaunchSeatsFn } from "@/lib/launch-seats.functions";
import { supabase } from "@/integrations/supabase/client";
import { playSfx } from "@/lib/world-audio";
import { streamLiveStatusFn } from "@/lib/bitmap-stream.functions";
import { GENESIS_BROADCASTER } from "@/lib/genesis-broadcaster";

/** The four stops of the Bitmapper loop, in order. */
export const TRANSIT_STOPS = [
  { to: "/launch", no: "01", hub: "ARENA", place: "GRANDSTAND" },
  { to: "/biternam/cafe", no: "02", hub: "HANGOUT", place: "CAFÉ" },
  { to: "/oasis", no: "03", hub: "FRONTIER", place: "OASIS" },
  { to: "/forge", no: "04", hub: "WORKSHOP", place: "FORGE" },
] as const;

export const isTransitPath = (path: string) =>
  TRANSIT_STOPS.some((s) => path === s.to || path.startsWith(s.to + "/"));

const compact = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)}K` : String(n));

/** 90s switchboard strip linking the four loop hubs, with live readouts. */
export function BitTransitBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const seats = useQuery({ queryKey: ["launch-seats"], queryFn: () => listLaunchSeatsFn(), staleTime: 15_000, refetchInterval: 60_000 });
  const tip = useQuery({
    queryKey: ["transit-tip"], staleTime: 120_000, refetchInterval: 120_000,
    queryFn: async () => Number(await (await fetch("https://mempool.space/api/blocks/tip/height")).text()) || null,
  });
  const modules = useQuery({
    queryKey: ["transit-modules"], staleTime: 300_000,
    queryFn: async () => (await supabase.from("forge_modules").select("id", { count: "exact", head: true })).count ?? null,
  });
  const stream = useQuery({
    queryKey: ["transit-stream", GENESIS_BROADCASTER.channelHeight], staleTime: 30_000, refetchInterval: 60_000, retry: 0,
    queryFn: async () => (await streamLiveStatusFn({ data: { height: GENESIS_BROADCASTER.channelHeight } })).status,
  });
  if (!isTransitPath(path)) return null;

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const seated = hydrated ? seats.data?.seats.length : undefined;
  const live: Record<string, string> = {
    "/launch": seated != null ? `${seated} SEATED` : "…",
    "/biternam/cafe": stream.data === "live" ? "STREAM ON-AIR" : stream.data === "offline" ? "STREAM OFFLINE" : "STREAM ?",
    "/oasis": tip.data ? `BLOCK #${compact(tip.data)}` : "LIVE MAP",
    "/forge": modules.data != null ? `MODULES ${modules.data}` : "STUDIO READY",
  };
  const oasis = path.startsWith("/oasis");

  return (
    <nav aria-label="Bit-Transit"
      className={`fixed left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-stretch rounded border border-border bg-background/80 p-1 font-mono shadow-lg backdrop-blur-md ${oasis ? "top-16" : "bottom-4"}`}>
      {TRANSIT_STOPS.map((s, i) => {
        const active = path === s.to || path.startsWith(s.to + "/");
        return (
          <div key={s.to} className="flex items-stretch">
            {i > 0 && <span className="mx-0.5 w-px self-stretch bg-border" />}
            <Link to={s.to} onClick={() => { try { playSfx("pick"); } catch { /* audio locked */ } }}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col rounded px-2 py-1 leading-tight transition-colors md:px-3 ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="flex items-center gap-1 whitespace-nowrap text-[10px] tracking-widest">
                <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-primary" : "bg-accent"}`} />
                {s.no} <span className="hidden sm:inline">{s.hub} ·</span> {s.place}
              </span>
              <span className="text-[9px] whitespace-nowrap text-accent" data-no-translate>{live[s.to]}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
