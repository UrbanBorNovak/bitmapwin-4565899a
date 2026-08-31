import { useEffect, useId, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { openBidsQuery, type Bid } from "@/lib/bids";
import { walletQuery } from "@/lib/wallet";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { useWalletSession } from "@/lib/wallet-session";
import { formatSats } from "@/lib/trades";

const SEEN_KEY = "bitmap.bids.seen";

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-400)));
}

/**
 * Bid inbox for the connected wallet: the live bids standing on parcels this
 * wallet holds on chain, kept fresh through realtime `bids` changes. New bids
 * raise a toast the first time they are seen so the holder knows someone is
 * bidding on their land.
 */
export function useBidInbox(options: { notify?: boolean } = {}) {
  const { notify = false } = options;
  const wallet = useWalletSession();
  const queryClient = useQueryClient();
  const holderAddress = wallet?.ordinalsAddress ?? "";
  const addresses = useMemo(
    () => (wallet ? [wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean) : []),
    [wallet],
  );

  const held = useQuery(walletQuery(holderAddress));
  const indexed = useQuery(heldHeightsQuery(addresses));
  const bids = useQuery(openBidsQuery(500));

  const heldHeights = useMemo(() => {
    const set = new Set<number>();
    for (const utxo of held.data?.utxos ?? []) {
      for (const insc of utxo.inscriptions) {
        if (insc.bitmapHeight !== null) set.add(insc.bitmapHeight);
      }
    }
    for (const height of indexed.data ?? []) set.add(height);
    return set;
  }, [held.data, indexed.data]);

  const received = useMemo<Bid[]>(
    () =>
      (bids.data ?? [])
        .filter((bid) => heldHeights.has(bid.bitmapHeight))
        .sort((a, b) => b.priceSats - a.priceSats),
    [bids.data, heldHeights],
  );

  // Realtime: any bid change refreshes the inbox. The channel name is unique
  // per hook instance so multiple mounted consumers never collide on one
  // channel (which would throw "cannot add callbacks after subscribe()").
  const channelId = useId();
  useEffect(() => {
    if (!holderAddress) return;
    const channel = supabase
      .channel(`bid-inbox:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["bids"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [holderAddress, queryClient, channelId]);


  const notified = useRef(false);
  useEffect(() => {
    if (!notify || received.length === 0) return;
    const seen = readSeen();
    const fresh = received.filter((bid) => !seen.has(bid.id));
    if (fresh.length === 0) {
      notified.current = true;
      return;
    }
    fresh.forEach((bid) => seen.add(bid.id));
    writeSeen(seen);
    const top = fresh[0]!;
    toast(
      fresh.length === 1
        ? `NEW BID — ${top.bitmapHeight}.BITMAP`
        : `${fresh.length} NEW BIDS ON YOUR BITMAPS`,
      {
        description: `${formatSats(top.priceSats)} OFFERED · OPEN /WALLET TO ACCEPT`,
        duration: 10_000,
      },
    );
    notified.current = true;
  }, [notify, received]);

  return { received, heldHeights, isLoading: held.isLoading || bids.isLoading };
}
