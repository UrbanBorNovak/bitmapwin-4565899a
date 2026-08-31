import { queryOptions } from "@tanstack/react-query";
import { myWalletLinksFn } from "@/lib/wallet-link.functions";

export type WalletLink = {
  id: string;
  address: string;
  purpose: string;
  verifiedAt: string;
};

/** Verified addresses for the signed-in account (empty when signed out). */
export const myWalletLinksQuery = (signedIn: boolean) =>
  queryOptions({
    queryKey: ["wallet-links", signedIn],
    queryFn: async (): Promise<WalletLink[]> => (signedIn ? await myWalletLinksFn() : []),
    enabled: signedIn,
    staleTime: 30_000,
  });

export function isLinked(links: WalletLink[] | undefined, address: string | null): boolean {
  if (!links || !address) return false;
  const target = address.toLowerCase();
  return links.some((l) => l.address.toLowerCase() === target);
}
