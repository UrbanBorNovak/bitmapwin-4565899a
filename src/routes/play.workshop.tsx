import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PlayNav } from "@/components/play/PlayNav";
import { LivingCard } from "@/components/play/LivingCard";
import { MatchStats } from "@/components/play/MatchStats";
import { heldHeightsQuery } from "@/lib/held-parcels";
import { useWalletSession } from "@/lib/wallet-session";
import { craftCard, syncWorld, upgradeCard, usePlayProfile } from "@/lib/game/worldState";
import { UPGRADE_LABEL, canUpgrade, upgradeCap, upgradeCost, upgradesOf, UPGRADE_MAX, type UpgradeKind } from "@/lib/game/workshop";

type Search = { card?: string };

export const Route = createFileRoute("/play/workshop")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => (typeof s["card"] === "string" && /^bitmap-\d{1,8}$/.test(s["card"]) ? { card: s["card"] } : {}),
  head: () => ({
    meta: [
      { title: "Workshop — BITMAPWIN // PLAY" },
      { name: "description", content: "Craft living cards from the BITMAPs you hold and forge permanent upgrades unlocked by your Oasis builds." },
      { property: "og:title", content: "The card workshop — BITMAPWIN // PLAY" },
      { property: "og:description", content: "Your land is your forge. Build in the Oasis, then upgrade the cards born from it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkshopPage,
});

const KINDS: UpgradeKind[] = ["power", "defense", "efficiency"];

function WorkshopPage() {
  const profile = usePlayProfile();
  const wallet = useWalletSession();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const addresses = wallet ? [wallet.ordinalsAddress, wallet.paymentAddress].filter(Boolean) : [];
  const held = useQuery({ ...heldHeightsQuery(addresses), enabled: addresses.length > 0 });
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { if (profile) void syncWorld(); }, [profile?.owner]); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = profile ? profile.order.map((id) => profile.cards[id]).filter((c): c is NonNullable<typeof c> => !!c) : [];
  const selected = (search.card && profile?.cards[search.card]) || cards[0] || null;
  const craftable = (held.data ?? []).filter((h) => !profile?.cards[`bitmap-${h}`]).slice(0, 60);

  return (
    <main className="play-district mx-auto max-w-[1200px] space-y-5 overflow-x-hidden px-3 py-4 md:px-8 md:py-6">
      <PlayNav />
      <header>
        <p className="label text-signal">FORGE</p>
        <h1 className="display mt-1 text-3xl md:text-4xl">WORKSHOP</h1>
        <p className="mt-2 max-w-2xl font-mono text-xs text-muted-foreground">Craft cards from the BITMAPs you hold. Spend a card's earned XP on permanent upgrades — each Oasis build on its BITMAP unlocks another level.</p>
      </header>

      <section className="border border-border bg-card p-4 md:p-5">
        <h2 className="label">CRAFT FROM YOUR BITMAPS</h2>
        {!wallet ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">Connect a wallet to craft cards from the BITMAPs you hold. <Link to="/wallet" className="text-bitcoin">CONNECT →</Link></p>
        ) : held.isPending ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">&gt; READING YOUR LAND…</p>
        ) : held.isError ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">BITMAP DATA UNAVAILABLE — try again shortly.</p>
        ) : craftable.length === 0 ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">{(held.data ?? []).length ? "Every BITMAP you hold already has a card." : "No BITMAPs found in this wallet."}</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {craftable.map((h) => (
              <li key={h}>
                <button type="button" className="btn-term-ghost min-h-10" onClick={() => { if (craftCard(h)) { setNote(`CRAFTED ${h}.BITMAP`); void navigate({ search: { card: `bitmap-${h}` } }); } }}>
                  CRAFT {h}.BITMAP
                </button>
              </li>
            ))}
          </ul>
        )}
        {note && <p className="mt-2 font-mono text-[10px] text-bitcoin" role="status">{note}</p>}
      </section>

      {!profile ? (
        <p className="font-mono text-xs text-muted-foreground">&gt; READING CARDS…</p>
      ) : selected ? (
        <section className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="grid justify-items-center gap-3">
            <LivingCard card={selected} size="lg" />
            <Link to="/play/card/$id" params={{ id: String(selected.bitmap) }} className="btn-term-ghost w-full justify-center">OPEN CARD PAGE</Link>
          </div>
          <div className="grid content-start gap-4">
            <select className="h-10 border border-border bg-background px-2 font-mono text-xs" value={selected.id} aria-label="Card to upgrade"
              onChange={(e) => void navigate({ search: { card: e.target.value } })}>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.bitmap}.BITMAP · {c.name}</option>)}
            </select>
            <MatchStats card={selected} workshopLink={false} />
            <ul className="grid gap-px border border-border bg-border sm:grid-cols-3">
              {KINDS.map((k) => {
                const lvl = upgradesOf(selected)[k];
                const check = canUpgrade(selected, k);
                return (
                  <li key={k} className="bg-card p-3">
                    <p className="label">{UPGRADE_LABEL[k]}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">LEVEL {lvl}/{UPGRADE_MAX[k]} · UNLOCKED {upgradeCap(selected, k)}</p>
                    <p className="mt-1 font-mono text-[10px]">{k === "efficiency" ? "−1 energy to play" : `+1 ${k}`} · {upgradeCost(selected, k)} XP</p>
                    <button type="button" className="btn-term mt-3 min-h-10 w-full" disabled={!check.ok} onClick={() => upgradeCard(selected.id, k)}>
                      {check.ok ? "FORGE" : check.reason}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="font-mono text-[10px] text-muted-foreground">XP comes from playing and winning matches. Spending it never lowers the card's evolution.</p>
          </div>
        </section>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">No cards yet. <Link to="/play" className="text-bitcoin">Play a match</Link> or craft one above.</p>
      )}
    </main>
  );
}
