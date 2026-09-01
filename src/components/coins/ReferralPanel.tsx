import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { COIN, formatBit } from "@/lib/coins";
import {
  REFERRAL,
  clearPendingReferralCode,
  myReferralQuery,
  normaliseCode,
  pendingReferralCode,
  referralLink,
} from "@/lib/referrals";
import { claimReferralFn } from "@/lib/referrals.functions";
import { shortenAddress } from "@/lib/registry";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * Invite panel: share your code, see who joined through it and how much BIT
 * their activity has paid you. All numbers come from the real BIT ledger.
 */
export function ReferralPanel() {
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress ?? null;
  const queryClient = useQueryClient();
  const summary = useQuery(myReferralQuery(address));
  const [code, setCode] = useState("");

  useEffect(() => {
    const pending = pendingReferralCode();
    if (pending) setCode(pending);
  }, []);

  const claim = useMutation({
    mutationFn: async (input: { address: string; code: string }) =>
      claimReferralFn({ data: input }),
    onSuccess: () => {
      clearPendingReferralCode();
      setCode("");
      void queryClient.invalidateQueries({ queryKey: ["referrals"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
      void queryClient.invalidateQueries({ queryKey: ["coin-ledger"] });
      toast("REFERRAL APPLIED", {
        description: `${formatBit(REFERRAL.joinerBonus)} CREDITED TO YOU`,
      });
    },
    onError: (e) => toast("REFERRAL FAILED", { description: (e as Error).message.toUpperCase() }),
  });

  const data = summary.data ?? null;

  return (
    <section className="border border-border p-6" id="referrals">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="display text-2xl">INVITE &amp; EARN</h2>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {formatBit(REFERRAL.inviterBonus)} PER FRIEND WHO JOINS · THEY GET{" "}
            {formatBit(REFERRAL.joinerBonus)} · YOU KEEP {REFERRAL.sharePercent}% OF EVERY {COIN}{" "}
            THEY EARN, FOREVER
          </p>
        </div>
      </div>

      {!address ? (
        <p className="mt-6 font-mono text-xs text-muted-foreground">
          &gt; CONNECT AND VERIFY A WALLET TO GET YOUR INVITE CODE_
        </p>
      ) : summary.isLoading ? (
        <p className="mt-6 font-mono text-xs text-muted-foreground">&gt; LOADING INVITE DATA_</p>
      ) : summary.isError ? (
        <p className="mt-6 font-mono text-xs text-muted-foreground">
          &gt; {(summary.error as Error).message.toUpperCase()}
        </p>
      ) : data ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-px sm:grid-cols-3">
            <Metric k="YOUR CODE" v={data.code} />
            <Metric k="FRIENDS JOINED" v={String(data.referredCount)} />
            <Metric k="EARNED FROM FRIENDS" v={formatBit(data.overrideTotal + data.bonusTotal)} />
          </div>

          <div>
            <div className="label">YOUR INVITE LINK</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap border border-border px-3 py-2 font-mono text-xs">
                {referralLink(data.code)}
              </code>
              <button
                type="button"
                className="btn-term-ghost"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(referralLink(data.code))
                    .then(() => toast("LINK COPIED"))
                    .catch(() => toast("COPY FAILED"));
                }}
              >
                [ COPY ]
              </button>
            </div>
          </div>

          {data.invitedBy ? (
            <p className="font-mono text-xs text-muted-foreground">
              &gt; INVITED BY {shortenAddress(data.invitedBy)}
            </p>
          ) : (
            <div>
              <div className="label">GOT A CODE?</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(normaliseCode(e.target.value))}
                  placeholder="ABC123"
                  className="w-40 border border-border bg-transparent px-3 py-2 font-mono text-xs uppercase"
                  aria-label="Referral code"
                />
                <button
                  type="button"
                  className="btn-term"
                  disabled={code.length < 4 || claim.isPending}
                  onClick={() => claim.mutate({ address, code })}
                >
                  {claim.isPending ? "[ APPLYING… ]" : "[ APPLY CODE ]"}
                </button>
              </div>
            </div>
          )}

          {data.referrals.length > 0 && (
            <div>
              <div className="label">FRIENDS YOU BROUGHT IN</div>
              <ul className="mt-2 divide-y divide-border border border-border">
                {data.referrals.map((row) => (
                  <li
                    key={row.refereeAddress}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 font-mono text-xs"
                  >
                    <span>{shortenAddress(row.refereeAddress)}</span>
                    <span className="text-muted-foreground">
                      {formatBit(row.overrideEarned)} SHARE ·{" "}
                      {new Date(row.createdAt).toLocaleDateString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-border px-4 py-4">
      <div className="label">{k}</div>
      <div className="display mt-2 text-xl">{v}</div>
    </div>
  );
}
