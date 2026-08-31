import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addDelegate, delegatesQuery, removeDelegate } from "@/lib/builds";
import { shortenAddress } from "@/lib/registry";
import { useWalletSession, walletControls } from "@/lib/wallet-session";
import { useAuthSession } from "@/lib/auth";
import { isLinked, myWalletLinksQuery } from "@/lib/wallet-links";

/**
 * Delegated building: the holder of a bitmap can grant another address the
 * right to edit that bitmap's page. Enforced server-side by RLS through
 * `can_build_bitmap`.
 */
export function BuildDelegates({
  height,
  ownerAddress,
}: {
  height: number;
  ownerAddress: string | null;
}) {
  const wallet = useWalletSession();
  const { session } = useAuthSession();
  const links = useQuery(myWalletLinksQuery(Boolean(session)));
  const delegates = useQuery(delegatesQuery(height));
  const queryClient = useQueryClient();
  const isHolder = walletControls(wallet, ownerAddress) && isLinked(links.data, ownerAddress);

  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["build-delegates", height] });

  const grant = useMutation({
    mutationFn: () =>
      addDelegate({
        height,
        ownerAddress: ownerAddress as string,
        delegateAddress: address.trim(),
        note: note.trim() || null,
      }),
    onSuccess: () => {
      setAddress("");
      setNote("");
      toast.success("DELEGATE ADDED");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "COULD NOT ADD DELEGATE"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => removeDelegate(id),
    onSuccess: () => {
      toast.success("DELEGATE REVOKED");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "COULD NOT REVOKE"),
  });

  const rows = delegates.data ?? [];
  if (rows.length === 0 && !isHolder) return null;

  return (
    <div className="mt-6 border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="display text-sm">BUILD DELEGATES</h3>
        <span className="label">ADDRESSES ALLOWED TO BUILD ON THIS BITMAP</span>
      </div>

      {rows.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px]">
                {shortenAddress(d.delegateAddress)}
                {d.note ? <span className="text-muted-foreground"> · {d.note}</span> : null}
              </span>
              {isHolder ? (
                <button className="btn-term-ghost" onClick={() => revoke.mutate(d.id)}>
                  [ REVOKE ]
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="label mt-3 text-muted-foreground">NO DELEGATES</p>
      )}

      {isHolder ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-[2fr_2fr_auto]">
          <input
            className="border border-border bg-background px-3 py-2 font-mono text-xs"
            placeholder="DELEGATE BITCOIN ADDRESS"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className="border border-border bg-background px-3 py-2 font-mono text-xs"
            placeholder="NOTE (OPTIONAL)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className="btn-term"
            disabled={!address.trim() || grant.isPending}
            onClick={() => grant.mutate()}
          >
            [ {grant.isPending ? "ADDING…" : "DELEGATE"} ]
          </button>
        </div>
      ) : null}
    </div>
  );
}
