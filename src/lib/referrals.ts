import { queryOptions } from "@tanstack/react-query";
import { myReferralFn } from "@/lib/referrals.functions";

/**
 * Referral program for the BIT economy. An invite pays both sides a one-off
 * joining bonus, and the inviter keeps a share of every BIT their friend earns
 * from the daily payout — forever, on top of the friend's own reward.
 */

export const REFERRAL = {
  /** Paid to the inviter when a friend claims their code. */
  inviterBonus: 1000,
  /** Paid to the friend who joined with a code. */
  joinerBonus: 500,
  /** Share of a referred friend's daily BIT earnings paid to the inviter. */
  sharePercent: 10,
} as const;

export type ReferralRow = {
  refereeAddress: string;
  overrideEarned: number;
  createdAt: string;
};

export type ReferralSummary = {
  code: string;
  address: string;
  referrals: ReferralRow[];
  referredCount: number;
  overrideTotal: number;
  bonusTotal: number;
  /** The address that invited me, when I joined through a code. */
  invitedBy: string | null;
};

const PENDING_KEY = "bitmap.referral.code";

/** Remembers a `?ref=` code so it can be claimed after sign-in. */
export function rememberReferralCode(code: string) {
  if (typeof window === "undefined") return;
  const clean = normaliseCode(code);
  if (clean) window.localStorage.setItem(PENDING_KEY, clean);
}

export function pendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PENDING_KEY);
}

export function clearPendingReferralCode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_KEY);
}

export function normaliseCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

export function referralLink(code: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/?ref=${code}`;
}

/** Message used when sharing an invite on social platforms. */
export function referralShareText(code: string): string {
  return `Claim, build and trade Bitcoin BITMAP land on BITMAP UNHINGED. Join with my code ${code} and we both earn ${REFERRAL.joinerBonus} BIT.`;
}

/** Tweet intent URL pre-filled with the invite link. */
export function shareOnX(code: string): string {
  const params = new URLSearchParams({
    text: referralShareText(code),
    url: referralLink(code),
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/** Telegram share URL pre-filled with the invite link. */
export function shareOnTelegram(code: string): string {
  const params = new URLSearchParams({
    url: referralLink(code),
    text: referralShareText(code),
  });
  return `https://t.me/share/url?${params.toString()}`;
}

export const myReferralQuery = (address: string | null) =>
  queryOptions({
    queryKey: ["referrals", "mine", address],
    queryFn: async (): Promise<ReferralSummary | null> =>
      address ? await myReferralFn({ data: { address } }) : null,
    enabled: Boolean(address),
    staleTime: 30_000,
  });
