import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BIT_PER_SAT,
  DONATION_ADDRESS,
  btcDonationsQuery,
  donationPayout,
} from "@/lib/donations";
import { claimBtcDonationsFn } from "@/lib/donations.functions";
import { coinBalanceQuery, formatBit } from "@/lib/coins";
import { useWalletSession } from "@/lib/wallet-session";

export const Route = createFileRoute("/donate")({
  component: DonatePage,
  head: () => ({
    meta: [
      { title: "Share & Fuel the Oasis — Send BTC, Collect BIT" },
      {
        name: "description",
        content:
          "Share bitcoin with the Oasis commons and collect BIT to build, craft and play. Every payment is checked on-chain.",
      },
      { property: "og:title", content: "Share & Fuel the Oasis — Send BTC, Collect BIT" },
      {
        property: "og:description",
        content:
          "Share BTC with the Oasis commons and collect BIT for every sat, verified on-chain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function DonatePage() {
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress ?? null;
  const client = useQueryClient();

  const balances = useQuery({
    ...coinBalanceQuery(address ? [address] : []),
    enabled: Boolean(address),
  });
  const balance = balances.data?.[0]?.balance ?? 0;

  const btc = useQuery({ ...btcDonationsQuery(address), enabled: Boolean(address) });
  const btcSats = (btc.data ?? []).reduce((sum, row) => sum + row.sats, 0);
  const btcBits = (btc.data ?? []).reduce((sum, row) => sum + row.bitsAwarded, 0);

  const scanBtc = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect and verify your wallet first");
      return claimBtcDonationsFn({ data: { address } });
    },
    onSuccess: (result) => {
      if (result.credited.length === 0) {
        toast.info("NO NEW BITCOIN FOUND FROM YOUR WALLET YET");
      } else {
        toast.success(`+${formatBit(result.bits)} FOR ${result.sats} SHARED SATS`);
      }
      void client.invalidateQueries({ queryKey: ["btc-donations"] });
      void client.invalidateQueries({ queryKey: ["coin-balance"] });
    },
    onError: (error: Error) => toast.error(error.message.toUpperCase()),
  });


  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
      <header>
        <h1 className="display text-3xl md:text-4xl">SHARE & FUEL THE OASIS</h1>
        <p className="label mt-3">
          SHARE BTC WITH THE COMMONS — USE THE BIT YOU GET TO BUILD, CRAFT AND PLAY
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 border border-border md:grid-cols-4">
        <Stat k="RATE" v={`${BIT_PER_SAT} BIT / SAT`} />
        <Stat k="YOUR SHARES" v={String((btc.data ?? []).length)} />
        <Stat k="SATS SHARED" v={String(btcSats)} />
        <Stat k="BIT EARNED" v={formatBit(btcBits)} />
      </section>

      <section className="mt-6 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">FUEL THE COMMONS</h2>
          <p className="label mt-2">
            SEND BTC FROM YOUR VERIFIED WALLET AND COLLECT {BIT_PER_SAT} BIT PER SAT
          </p>
        </header>
        <div className="space-y-3 p-5">
          <div className="break-all border border-border p-2 font-mono text-[11px]" data-no-translate>
            {DONATION_ADDRESS}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            SCAN CHECKS THE CHAIN FOR EVERY PAYMENT SENT FROM YOUR WALLET TO THIS ADDRESS AND
            CREDITS ANYTHING NOT PAID OUT YET — 10,000 SATS PAYS {formatBit(donationPayout(10_000))}
          </p>
          <button
            type="button"
            disabled={!address || scanBtc.isPending}
            onClick={() => scanBtc.mutate()}
            className="label border border-bitcoin px-4 py-3 text-bitcoin hover:bg-bitcoin/10 disabled:opacity-40"
          >
            {scanBtc.isPending ? "SCANNING THE CHAIN…" : "SCAN & COLLECT BIT"}
          </button>
          {(btc.data ?? []).length > 0 && (
            <ul className="divide-y divide-border border border-border">
              {(btc.data ?? []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="break-all font-mono text-[11px]" data-no-translate>
                    {row.txid.slice(0, 10)}…{row.txid.slice(-4)}
                  </span>
                  <span className="label">{row.confirmed ? "CONFIRMED" : "IN MEMPOOL"}</span>
                  <span className="label ml-auto">{row.sats} SATS</span>
                  <span className="label text-bitcoin">+{formatBit(row.bitsAwarded)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-border p-4 [&:not(:last-child)]:border-r">
      <div className="label">{k}</div>
      <div className="display mt-1 text-lg">{v}</div>
    </div>
  );
}
