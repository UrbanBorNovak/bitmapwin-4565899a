import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MEMBERSHIP_ADDRESS,
  MEMBERSHIP_DAYS,
  MEMBERSHIP_SATS,
  checkMembership,
  claimHolderMembership,
  isActive,
  membershipQuery,
  startMembership,
} from "@/lib/membership";

/**
 * Monthly membership: donate 10,000 sats to the project address and the address
 * carries a MEMBERS badge on its profile for the next 30 days.
 */
export function MembershipPanel({ address, canEdit }: { address: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const membership = useQuery(membershipQuery(address));
  const active = isActive(membership.data);

  const invoice = useMutation({
    mutationFn: () => startMembership(address),
    onError: (error: Error) => toast.error(error.message.toUpperCase()),
  });

  const confirm = useMutation({
    mutationFn: () => checkMembership(address),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["membership", address] });
      if (result.justActivated) toast.success("MEMBERSHIP ACTIVE — BADGE ADDED");
      else toast.message("NO MATCHING DONATION FOUND YET");
    },
    onError: (error: Error) => toast.error(error.message.toUpperCase()),
  });

  const holderClaim = useMutation({
    mutationFn: () => claimHolderMembership(address),
    onSuccess: (result) => {
      if (result.claimed) {
        void queryClient.invalidateQueries({ queryKey: ["membership", address] });
        void queryClient.invalidateQueries({ queryKey: ["membership-badge", address] });
        toast.success("JIGGLYPUFF HOLDER — MEMBERSHIP ACTIVE");
      } else {
        toast.message("NO JIGGLYPUFF INSCRIPTION FOUND ON THIS ADDRESS");
      }
    },
    onError: (error: Error) => toast.error(error.message.toUpperCase()),
  });

  const amount = invoice.data?.invoiceSats ?? null;

  return (
    <section className="mt-10 border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border p-5">
        <h2 className="display text-xl">MEMBERSHIP</h2>
        {active ? (
          <span className="label border border-bitcoin px-2 py-1 text-bitcoin">MEMBERS</span>
        ) : (
          <span className="label">{MEMBERSHIP_SATS.toLocaleString()} SATS / MONTH</span>
        )}
      </header>

      <div className="space-y-4 p-5 font-mono text-xs text-muted-foreground">
        {active ? (
          <p>
            &gt; MEMBERS BADGE ACTIVE UNTIL{" "}
            <span className="text-foreground">
              {new Date(membership.data!.expiresAt!).toISOString().slice(0, 10)}
            </span>
            . DONATE AGAIN ANY TIME TO EXTEND.
          </p>
        ) : (
          <p>
            &gt; DONATE {MEMBERSHIP_SATS.toLocaleString()} SATS AND CARRY A MEMBERS BADGE ON YOUR
            PROFILE FOR {MEMBERSHIP_DAYS} DAYS.
          </p>
        )}

        {!canEdit && (
          <p>&gt; VERIFY THIS ADDRESS ON THIS PAGE FIRST TO CLAIM A MEMBERSHIP.</p>
        )}

        {canEdit && (
          <>
            <div className="border border-border p-4">
              <p className="label">DONATION ADDRESS</p>
              <p className="mt-1 break-all text-foreground">{MEMBERSHIP_ADDRESS}</p>
              <p className="label mt-4">EXACT AMOUNT</p>
              <p className="mt-1 text-foreground">
                {amount
                  ? `${amount.toLocaleString()} SATS`
                  : "GET YOUR EXACT AMOUNT BELOW — IT IDENTIFIES YOUR DONATION"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => invoice.mutate()}
                disabled={invoice.isPending}
                className="label border border-border px-4 py-2 hover:border-bitcoin hover:text-bitcoin disabled:opacity-50"
              >
                {invoice.isPending ? "…" : amount ? "AMOUNT SHOWN ABOVE" : "GET MY EXACT AMOUNT"}
              </button>
              <button
                type="button"
                onClick={() => confirm.mutate()}
                disabled={confirm.isPending}
                className="label border border-bitcoin px-4 py-2 text-bitcoin hover:bg-bitcoin hover:text-background disabled:opacity-50"
              >
                {confirm.isPending ? "CHECKING…" : "I HAVE DONATED — CHECK"}
              </button>
            </div>
            <p>
              &gt; SEND THE EXACT AMOUNT FROM YOUR OWN WALLET, THEN PRESS CHECK. THE PAYMENT IS
              CONFIRMED AGAINST THE CHAIN.
            </p>

            <div className="border border-border p-4">
              <p className="label text-bitcoin">JIGGLYPUFF HOLDERS</p>
              <p className="mt-2">
                &gt; HOLD ANY JIGGLYPUFF INSCRIPTION ON THIS ADDRESS AND MEMBERSHIP IS FREE — NO
                DONATION NEEDED. HOLDINGS ARE CHECKED AGAINST THE CHAIN.
              </p>
              <button
                type="button"
                onClick={() => holderClaim.mutate()}
                disabled={holderClaim.isPending}
                className="label mt-3 border border-bitcoin px-4 py-2 text-bitcoin hover:bg-bitcoin hover:text-background disabled:opacity-50"
              >
                {holderClaim.isPending ? "CHECKING THE CHAIN…" : "CLAIM AS JIGGLYPUFF HOLDER"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
