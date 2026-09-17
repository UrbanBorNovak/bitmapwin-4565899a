import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BIT_PER_SAT,
  DONATION_ADDRESS,
  donationPayout,
  donationsQuery,
} from "@/lib/donations";
import { donateInscriptionFn } from "@/lib/donations.functions";
import { coinBalanceQuery, formatBit } from "@/lib/coins";
import { useWalletSession } from "@/lib/wallet-session";

export const Route = createFileRoute("/donate")({
  component: DonatePage,
  head: () => ({
    meta: [
      { title: "Donate an Inscription — Turn Unwanted Ordinals into BIT" },
      {
        name: "description",
        content:
          "Send any inscription you no longer want to the platform address and get paid in BIT. The sats riding on the inscription are counted on-chain and credited to your balance.",
      },
      { property: "og:title", content: "Donate an Inscription — Turn Unwanted Ordinals into BIT" },
      {
        property: "og:description",
        content:
          "Retire unwanted ordinals to the platform address and collect BIT for every sat they carry.",
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
  const [inscriptionId, setInscriptionId] = useState("");

  const donations = useQuery({ ...donationsQuery(address), enabled: Boolean(address) });
  const balances = useQuery({
    ...coinBalanceQuery(address ? [address] : []),
    enabled: Boolean(address),
  });
  const balance = balances.data?.[0]?.balance ?? 0;

  const claim = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect and verify your wallet first");
      return donateInscriptionFn({ data: { inscriptionId: inscriptionId.trim(), address } });
    },
    onSuccess: (result) => {
      setInscriptionId("");
      if (result.alreadyClaimed) {
        toast.info(`ALREADY CREDITED — ${formatBit(result.bits)} FOR ${result.sats} SATS`);
      } else {
        toast.success(`+${formatBit(result.bits)} FOR ${result.sats} DONATED SATS`);
      }
      void client.invalidateQueries({ queryKey: ["inscription-donations"] });
      void client.invalidateQueries({ queryKey: ["coin-balance"] });
    },
    onError: (error: Error) => toast.error(error.message.toUpperCase()),
  });

  const totalSats = (donations.data ?? []).reduce((sum, d) => sum + d.sats, 0);
  const totalBits = (donations.data ?? []).reduce((sum, d) => sum + d.bitsAwarded, 0);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
      <header>
        <h1 className="display text-3xl md:text-4xl">DONATE AN INSCRIPTION</h1>
        <p className="label mt-3">
          RETIRE ANY INSCRIPTION YOU DO NOT WANT — WE COUNT ITS SATS AND PAY YOU IN BIT
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 border border-border md:grid-cols-4">
        <Stat k="RATE" v={`${BIT_PER_SAT} BIT / SAT`} />
        <Stat k="YOUR DONATIONS" v={String((donations.data ?? []).length)} />
        <Stat k="SATS DONATED" v={String(totalSats)} />
        <Stat k="BIT EARNED" v={formatBit(totalBits)} />
      </section>

      <section className="mt-10 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">HOW IT WORKS</h2>
        </header>
        <ol className="space-y-3 p-5 font-mono text-[11px] text-muted-foreground">
          <li>
            1. SEND THE INSCRIPTION FROM YOUR VERIFIED WALLET TO
            <div
              className="mt-2 break-all border border-border p-2 text-foreground"
              data-no-translate
            >
              {DONATION_ADDRESS}
            </div>
          </li>
          <li>2. WAIT FOR THE TRANSFER TO BE INDEXED (USUALLY ONE BLOCK)</li>
          <li>3. PASTE THE INSCRIPTION ID BELOW AND CLAIM — BIT LANDS IN YOUR BALANCE</li>
        </ol>
      </section>

      <section className="mt-6 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">CLAIM YOUR BIT</h2>
          <p className="label mt-2">
            BALANCE {formatBit(balance)} — PAYOUT IS SATS ON THE INSCRIPTION × {BIT_PER_SAT}
          </p>
        </header>
        <div className="space-y-3 p-5">
          <input
            value={inscriptionId}
            onChange={(event) => setInscriptionId(event.target.value)}
            placeholder="e.g. 9c1ff2…i0"
            spellCheck={false}
            data-no-translate
            className="w-full border border-border bg-transparent p-3 font-mono text-[11px] text-foreground outline-none focus:border-bitcoin"
          />
          <p className="font-mono text-[11px] text-muted-foreground">
            A STANDARD 546-SAT INSCRIPTION PAYS {formatBit(donationPayout(546))}
          </p>
          <button
            type="button"
            disabled={!address || inscriptionId.trim().length < 60 || claim.isPending}
            onClick={() => claim.mutate()}
            className="label border border-bitcoin px-4 py-3 text-bitcoin hover:bg-bitcoin/10 disabled:opacity-40"
          >
            {claim.isPending ? "VERIFYING ON-CHAIN…" : "CLAIM BIT"}
          </button>
          {!address && (
            <p className="font-mono text-[11px] text-muted-foreground">
              &gt; CONNECT AND VERIFY YOUR WALLET TO CLAIM<span className="blink">_</span>
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 border border-border">
        <header className="border-b border-border p-5">
          <h2 className="display text-xl">YOUR DONATION LOG</h2>
        </header>
        {(donations.data ?? []).length === 0 ? (
          <p className="p-5 font-mono text-[11px] text-muted-foreground">
            &gt; NO DONATIONS YET<span className="blink">_</span>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(donations.data ?? []).map((donation) => (
              <li key={donation.id} className="flex flex-wrap items-center gap-3 p-4">
                <span
                  className="break-all font-mono text-[11px] text-foreground"
                  data-no-translate
                >
                  {donation.inscriptionId.slice(0, 10)}…{donation.inscriptionId.slice(-4)}
                </span>
                <span className="label ml-auto">{donation.sats} SATS</span>
                <span className="label text-bitcoin">+{formatBit(donation.bitsAwarded)}</span>
              </li>
            ))}
          </ul>
        )}
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
