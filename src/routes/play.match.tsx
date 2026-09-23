import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GameBoard } from "@/components/play/GameBoard";
import { ensureCard, usePlayProfile } from "@/lib/game/worldState";

type Search = { table?: string; height?: number };

export const Route = createFileRoute("/play/match")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s.table === "string" && /^[0-9A-Za-z]{3,8}$/.test(s.table)) out.table = s.table.toUpperCase();
    const h = Number(s.height);
    if (Number.isInteger(h) && h >= 0 && h < 10_000_000) out.height = h;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Match — BITMAPWIN // PLAY" },
      { name: "description", content: "A 1v1 living-card match inside the Oasis against a local rival." },
      { property: "og:title", content: "A match inside the Oasis — BITMAPWIN // PLAY" },
      { property: "og:description", content: "Play cards born from BITMAPs. Every play is remembered." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchPage,
});

function MatchPage() {
  const { table, height } = Route.useSearch();
  const profile = usePlayProfile();
  const [round, setRound] = useState(0);
  const [seed, setSeed] = useState<number | null>(null);

  useEffect(() => {
    if (profile && height !== undefined) ensureCard(height);
  }, [profile, height]);

  useEffect(() => {
    setSeed(table ? parseInt(table, 36) + round * 7919 : Math.floor(Math.random() * 2 ** 31));
  }, [table, round]);

  const leaderHeight = height ?? profile?.selectedBitmap ?? null;
  const leaderId = leaderHeight !== null ? `bitmap-${leaderHeight}` : null;
  // Deck is fixed at match start; later card evolution only changes visuals.
  const deck = useMemo(() => {
    if (!profile) return null;
    const ids = profile.order.filter((id) => profile.cards[id]);
    if (leaderId && profile.cards[leaderId]) ids.sort((a) => (a === leaderId ? -1 : 0));
    return ids.map((id) => profile.cards[id]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.owner, seed, leaderId && profile?.cards[leaderId] ? leaderId : null]);

  return (
    <main className="play-district mx-auto max-w-[1200px] px-3 py-4 md:px-8 md:py-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/play" className="label hover:text-bitcoin">← LOBBY</Link>
        <p className="label"><span className="text-bitcoin">BITMAPWIN</span> // PLAY{table ? ` · TABLE ${table}` : " · VS AI"}</p>
        <Link to="/oasis" search={{ height: leaderHeight ?? undefined }} className="label hover:text-bitcoin">OASIS ↗</Link>
      </div>
      {profile && deck && seed !== null ? (
        <GameBoard key={`${seed}-${round}`} profile={profile} deck={deck} seed={seed} leaderId={leaderId} tableCode={table ?? null} onRestart={() => setRound((r) => r + 1)} />
      ) : (
        <p className="border border-border p-6 font-mono text-xs text-muted-foreground">&gt; DEALING LIVING CARDS…</p>
      )}
    </main>
  );
}
