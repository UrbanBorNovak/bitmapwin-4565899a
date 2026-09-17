/**
 * MEMBERS — a monthly 10,000 sat donation to the project address earns a
 * MEMBERS badge on the address's profile.
 *
 * Nothing here trusts the browser. The browser asks the backend for an invoice
 * (10,000 sats plus a few unique sats so the payment can be told apart from
 * everybody else's), the visitor pays it from their own wallet, and the backend
 * confirms the payment against the chain before the badge appears.
 */

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkMembershipFn, startMembershipFn } from "@/lib/membership.functions";

/** Where the monthly donation goes. */
export const MEMBERSHIP_ADDRESS = "bc1qqmu6el7rxdc2va4kzqexhll6ulmrdkwmcdqkxd";
/** The monthly donation, before the unique few sats that identify the payer. */
export const MEMBERSHIP_SATS = 10_000;
/** How long one donation counts for. */
export const MEMBERSHIP_DAYS = 30;

export type Membership = {
  address: string;
  status: "pending" | "active";
  expiresAt: string | null;
};

function toMembership(row: {
  address: string;
  status: string;
  expires_at: string | null;
}): Membership {
  return {
    address: row.address,
    status: row.status === "active" ? "active" : "pending",
    expiresAt: row.expires_at,
  };
}

export function isActive(membership: Membership | null | undefined): boolean {
  if (!membership || membership.status !== "active") return false;
  if (!membership.expiresAt) return false;
  return new Date(membership.expiresAt).getTime() > Date.now();
}

export async function fetchMembership(address: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("address, status, expires_at")
    .eq("address", address)
    .maybeSingle();
  if (error) throw error;
  return data ? toMembership(data) : null;
}

export const membershipQuery = (address: string) =>
  queryOptions({
    queryKey: ["membership", address],
    queryFn: () => fetchMembership(address),
    enabled: address !== "",
    staleTime: 60_000,
  });

/**
 * The public badge: only whether an address currently counts as a MEMBER, plus
 * when it lapses. Payment detail stays private to the member.
 */
export async function fetchMembershipBadge(address: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("membership_badges")
    .select("active, expires_at")
    .eq("address", address)
    .maybeSingle();
  if (error) throw error;
  if (!data?.active || !data.expires_at) return false;
  return new Date(data.expires_at).getTime() > Date.now();
}

export const membershipBadgeQuery = (address: string) =>
  queryOptions({
    queryKey: ["membership-badge", address],
    queryFn: () => fetchMembershipBadge(address),
    enabled: address !== "",
    staleTime: 60_000,
  });

export async function startMembership(address: string) {
  return startMembershipFn({ data: { address } });
}

export async function checkMembership(address: string) {
  return checkMembershipFn({ data: { address } });
}
