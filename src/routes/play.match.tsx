import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CUP_ROUNDS, cupMatchSeed, readCup, reportCup, yourRival, type CupState } from "@/lib/game/cups";
import { fetchBuildCounts } from "@/lib/game/worldAdapter";
import type { RivalDeck } from "@/lib/game/engine";
import { useEffect, useMemo, useState } from "react";
import { GameBoard } from "@/components/play/GameBoard";
import { ensureCard, usePlayProfile } from "@/lib/game/worldState";

type Search = { table?: string; height?: number; cup?: number };

export const Route = createFileRoute("/play/match")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s["table"] === "string" && /^[0-9A-Za-z]{3,8}$/.test(s["table"])) out.table = s["table"].toUpperCase();
    const h = Number(s["height"]);
    if (Number.isInteger(h) && h >= 0 && h < 10_000_000) out.height = h;
    if (s["cup"] !== undefined && Number(s["cup"]) === 1) out.cup = 1;
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
  const { table, height, cup: cupFlag } = Route.useSearch();
  const navigate = useNavigate();
  const [cup, setCup] = useState<CupState | null>(null);
  useEffect(() => { if (cupFlag) setCup(readCup()); }, [cupFlag]);
  const cupLive = cupFlag && cup?.status === "running" ? cup : null;
  const profile = usePlayProfile();
  const [round, setRound] = useState(0);
  const [seed, setSeed] = useState<number | null>(null);
  // Solo cup: the rival fields their own real BITMAPs with live Oasis builds.
  const [rival, setRival] = useState<RivalDeck | null | undefined>(undefined);
  const rivalEntrant = cupLive ? yourRival(cupLive) : null;
  const rivalKey = rivalEntrant?.deck?.join(",") ?? "";
  useEffect(() => {
    if (!cupFlag) { setRival(null); return; }
    const heights = rivalEntrant?.deck ?? [];
    if (!heights.length) { setRival(null); return; }
    let live = true;
    setRival(undefined);
    void fetchBuildCounts(heights).then((m) => { if (live) setRival({ heights, builds: Object.fromEntries(m ?? []) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cupFlag, rivalKey]);

  useEffect(() => {
    if (profile && height !== undefined) ensureCard(height);
  }, [profile, height]);

  useEffect(() => {
    if (cupFlag) { if (cupLive) setSeed(cupMatchSeed(cupLive)); return; }
    setSeed(table ? parseInt(table, 36) + round * 7919 : Math.floor(Math.random() * 2 ** 31));
  }, [table, round, cupFlag, cupLive?.id, cupLive?.round]);

  const leaderHeight = height ?? profile?.selectedBitmap ?? null;
  const leaderId = leaderHeight !== null ? `bitmap-${leaderHeight}` : null;
  // Deck is fixed at match start; later card evolution only changes visuals.
  const deck = useMemo(() => {
    if (!profile) return null;
    const ids = profile.order.filter((id) => profile.cards[id]);
    if (leaderId && profile.cards[leaderId]) ids.splice(0, ids.length, leaderId, ...ids.filter((x) => x !== leaderId));
    return ids.map((id) => profile.cards[id]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.owner, seed, leaderId && profile?.cards[leaderId] ? leaderId : null]);

  return (
    <main className="play-district mx-auto max-w-[1200px] overflow-x-hidden px-3 py-4 md:px-8 md:py-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/play" className="label hover:text-bitcoin">← LOBBY</Link>
        <p className="label"><span className="text-bitcoin">BITMAPWIN</span> // PLAY{cupLive ? ` · SOLO CUP · ${CUP_ROUNDS[cupLive.round]}` : table ? ` · TABLE ${table}` : " · VS AI"}</p>
        <Link to="/oasis" search={leaderHeight !== null ? { height: leaderHeight } : {}} className="label hover:text-bitcoin">OASIS ↗</Link>
      </div>
      {profile && deck && seed !== null && rival !== undefined ? (
        <GameBoard key={`${seed}-${round}`} profile={profile} deck={deck} seed={seed} leaderId={leaderId} rival={rival} tableCode={table ?? null} onRestart={() => (cupFlag ? navigate({ to: "/play/tournaments" }) : setRound((r) => r + 1))}
          {...(cupLive ? { onFinish: (win: boolean) => reportCup(win), restartLabel: "BACK TO THE CUP", context: `SOLO CUP · ${CUP_ROUNDS[cupLive.round]}${rivalEntrant ? ` · VS ${rivalEntrant.name}` : ""}` } : {})} />
      ) : cupFlag && cup !== null && !cupLive ? (
        <p className="border border-border p-6 font-mono text-xs text-muted-foreground">&gt; THIS CUP IS OVER. <Link to="/play/tournaments" className="text-bitcoin">OPEN TOURNAMENTS</Link></p>
      ) : (
        <p className="border border-border p-6 font-mono text-xs text-muted-foreground">&gt; DEALING LIVING CARDS…</p>
      )}
    </main>
  );
}
