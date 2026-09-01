import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InscriptionAvatar } from "@/components/InscriptionAvatar";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/bitmap";
import { profilesQuery, recentBitmapVisitsQuery } from "@/lib/profiles";
import { shortenAddress } from "@/lib/registry";

export function LiveBitmapPresence({ height, placeName }: { height: number; placeName: string }) {
  const queryClient = useQueryClient();
  const visits = useQuery(recentBitmapVisitsQuery(height));
  const addresses = useMemo(
    () => Array.from(new Set((visits.data ?? []).flatMap((visit) => visit.viewerAddress ? [visit.viewerAddress] : []))),
    [visits.data],
  );
  const profiles = useQuery(profilesQuery(addresses));

  useEffect(() => {
    const channel = supabase
      .channel(`bitmap-presence-${height}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bitmap_views", filter: `bitmap_height=eq.${height}` },
        () => queryClient.invalidateQueries({ queryKey: ["bitmap-visits", height] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [height, queryClient]);

  const latest = visits.data?.[0];
  const profile = latest?.viewerAddress ? profiles.data?.get(latest.viewerAddress) : null;
  const visitorName = profile?.displayName ?? (latest?.viewerAddress ? shortenAddress(latest.viewerAddress) : "A WANDERER");

  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm md:px-6" aria-live="polite">
      <span className="relative flex size-8 shrink-0 items-center justify-center border border-bitcoin bg-surface">
        <InscriptionAvatar
          inscriptionId={profile?.avatarInscriptionId}
          label={visitorName}
          alt=""
          className="size-full"
          fallbackClassName="text-bitcoin"
        />
        <span className="absolute -right-1 -top-1 size-2 bg-bitcoin" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 font-mono text-[11px] uppercase text-foreground">
        {latest ? (
          <p className="truncate">
            <span className="text-bitcoin">● LIVE</span>{" "}
            <span className="font-bold">{visitorName}</span> JUST ENTERED {placeName.toUpperCase()}
          </p>
        ) : (
          <p><span className="text-bitcoin">● LIVE</span> WAITING FOR THE NEXT VISITOR<span className="blink">_</span></p>
        )}
      </div>
      {latest && <span className="label hidden shrink-0 sm:block">{timeAgo(latest.createdAt)}</span>}
    </div>
  );
}