import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * INSCRIPTION DONATIONS — send an inscription you no longer want to the
 * platform address and the sats sitting on it are counted and paid back as BIT.
 *
 * Nothing here is trusted from the browser: the claim is verified server-side
 * against the chain (the inscription must actually be held by the platform
 * address, and the wallet asking for BIT must be the one that sent it).
 */

/** The platform address inscriptions are donated to. */
export const DONATION_ADDRESS = "bc1qqmu6el7rxdc2va4kzqexhll6ulmrdkwmcdqkxd";

/** BIT paid for each sat carried by a donated inscription. */
export const BIT_PER_SAT = 10;

export type Donation = {
  id: string;
  inscriptionId: string;
  donorAddress: string;
  txid: string | null;
  sats: number;
  bitsAwarded: number;
  status: string;
  note: string | null;
  createdAt: string;
};

export function donationPayout(sats: number): number {
  return Math.max(0, Math.round(sats * BIT_PER_SAT));
}

export const donationsQuery = (address: string | null) =>
  queryOptions({
    queryKey: ["inscription-donations", address],
    queryFn: async (): Promise<Donation[]> => {
      if (!address) return [];
      const { data, error } = await supabase
        .from("inscription_donations")
        .select(
          "id, inscription_id, donor_address, txid, sats, bits_awarded, status, note, created_at",
        )
        .eq("donor_address", address)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        inscriptionId: row.inscription_id,
        donorAddress: row.donor_address,
        txid: row.txid,
        sats: Number(row.sats),
        bitsAwarded: Number(row.bits_awarded),
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
      }));
    },
    staleTime: 15_000,
  });

/**
 * BITCOIN DONATIONS — plain BTC sent to the platform address, paid back in BIT
 * at the same rate as inscription donations. The scan and the payout happen
 * server-side against the chain; the browser only asks for it.
 */
export type BtcDonation = {
  id: string;
  txid: string;
  donorAddress: string;
  sats: number;
  bitsAwarded: number;
  status: string;
  confirmed: boolean;
  createdAt: string;
};

export const btcDonationsQuery = (address: string | null) =>
  queryOptions({
    queryKey: ["btc-donations", address],
    queryFn: async (): Promise<BtcDonation[]> => {
      if (!address) return [];
      const { data, error } = await supabase
        .from("btc_donations")
        .select("id, txid, donor_address, sats, bits_awarded, status, confirmed, created_at")
        .eq("donor_address", address)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        txid: row.txid,
        donorAddress: row.donor_address,
        sats: Number(row.sats),
        bitsAwarded: Number(row.bits_awarded),
        status: row.status,
        confirmed: Boolean(row.confirmed),
        createdAt: row.created_at,
      }));
    },
    staleTime: 15_000,
  });
