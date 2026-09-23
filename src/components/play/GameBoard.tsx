import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { nextAiAction } from "@/lib/game/ai";
import { TYPE_RULE, createCardFromBitmap, emptyFacts } from "@/lib/game/cardFactory";
import {
  START_HP,
  attack,
  canPlay,
  endTurn,
  legalTargets,
  mvpOf,
  newMatch,
  playCard,
  type MatchState,
  type Unit,
} from "@/lib/game/engine";
import { dispatchWorldEvent } from "@/lib/game/worldState";
import type { CardChange, LivingCard as Card, PlayProfile } from "@/lib/game/types";
import { LivingCard, type CardUiState } from "./LivingCard";

type Props = { profile: PlayProfile; deck: Card[]; seed: number; leaderId: string | null; tableCode: string | null; onRestart: () => void };

const AI_STEP_MS = 750;

export function GameBoard({ profile, deck, seed, leaderId, tableCode, onRestart }: Props) {
  const [match, setMatch] = useState<MatchState>(() => newMatch(deck, seed, leaderId));
  const [picked, setPicked] = useState<string | null>(null);
  const [attacker, setAttacker] = useState<string | null>(null);
  const [moment, setMoment] = useState<CardChange | null>(null);
  const [result, setResult] = useState<{ win: boolean; changes: CardChange[] } | null>(null);
  const recorded = useRef(false);
  const actor = profile.owner === "guest" ? "A traveller" : `${profile.owner.slice(0, 6)}…${profile.owner.slice(-4)}`;

  const enemyCache = useMemo(() => new Map<number, Card>(), []);
  const cardFor = (u: Unit, mine: boolean): Card => {
    if (mine && profile.cards[u.cardId]) return profile.cards[u.cardId]!;
    let c = enemyCache.get(u.height);
    if (!c) {
      c = createCardFromBitmap(emptyFacts(u.height), 0);
      enemyCache.set(u.height, c);
    }
    return c;
  };

  // Local rival turn loop.
  useEffect(() => {
    if (match.active !== "ai" || match.winner) return;
    const t = window.setTimeout(() => {
      setMatch((m) => {
        const action = nextAiAction(m);
        if (action.kind === "play") return playCard(m, "ai", action.uid);
        if (action.kind === "attack") {
          const next = attack(m, "ai", action.uid, action.target);
          return next === m ? endTurn(m) : next;
        }
        return endTurn(m);
      });
    }, AI_STEP_MS);
    return () => window.clearTimeout(t);
  }, [match]);

  // Match end → world events.
  useEffect(() => {
    if (!match.winner || recorded.current) return;
    recorded.current = true;
    const win = match.winner === "player";
    const mvp = mvpOf(match);
    const changes = dispatchWorldEvent({ kind: win ? "PLAYER_WIN" : "PLAYER_LOSS", mvpId: mvp, deckIds: match.playerDeckIds, actor });
    if (win) {
      const found = match.enemyHeights.find((h) => !profile.cards[`bitmap-${h}`]);
      if (found !== undefined) changes.push(...dispatchWorldEvent({ kind: "CARD_DISCOVERED", facts: emptyFacts(found), actor }));
    }
    setResult({ win, changes });
  }, [match, actor, profile.cards]);

  const me = match.sides.player;
  const foe = match.sides.ai;
  const myTurn = match.active === "player" && !match.winner;
  const legal = attacker ? legalTargets(match, "player") : null;

  function onHand(u: Unit) {
    if (!myTurn) return;
    setAttacker(null);
    if (picked !== u.uid) return setPicked(u.uid);
    if (!canPlay(match, "player", u.uid)) return;
    setMatch(playCard(match, "player", u.uid));
    setPicked(null);
    const changes = dispatchWorldEvent({ kind: "CARD_PLAYED", cardId: u.cardId, actor });
    const wake = changes.find((c) => c.from === "DORMANT" && c.to !== "DORMANT");
    if (wake) setMoment(wake);
  }

  function onMine(u: Unit) {
    if (!myTurn || !u.ready) return;
    setPicked(null);
    setAttacker((a) => (a === u.uid ? null : u.uid));
  }

  function strike(target: string | "hero") {
    if (!attacker) return;
    setMatch(attack(match, "player", attacker, target));
    setAttacker(null);
  }

  const pickedUnit = me.hand.find((u) => u.uid === picked);

  return (
    <div className="play-table relative grid min-w-0 grid-cols-1 gap-3 [&>*]:min-w-0">
      {/* OPPONENT */}
      <PlayerStrip
        who="RIVAL · LOCAL AI"
        hp={foe.hp}
        energy={foe.energy}
        hand={foe.hand.length}
        deck={foe.deck.length}
        hurt={foe.hurt}
        active={match.active === "ai" && !match.winner}
        targetable={!!legal?.hero}
        onTarget={() => strike("hero")}
      />
      <Field>
        {foe.board.length ? (
          foe.board.map((u) => (
            <div key={u.uid} className={u.fx === "enter" ? "lc-enter" : ""}>
              <LivingCard
                card={cardFor(u, false)}
                size="sm"
                live={u}
                ui={legal?.units.includes(u.uid) ? "playable" : u.fx === "damaged" ? "damaged" : u.fx === "attacking" ? "attacking" : "idle"}
                onClick={legal?.units.includes(u.uid) ? () => strike(u.uid) : undefined}
                label={`Rival ${u.name}, ${u.atk} power, ${u.hp} defense`}
              />
            </div>
          ))
        ) : (
          <EmptyField text="RIVAL FIELD IS OPEN" />
        )}
      </Field>

      <div className="flex items-center gap-3 border-y border-border py-2">
        <span className="label text-muted-foreground">TURN {match.turn}</span>
        <span className={`label ${myTurn ? "text-bitcoin" : "text-signal"}`}>{match.winner ? "MATCH COMPLETE" : myTurn ? "YOUR MOVE" : "RIVAL IS THINKING…"}</span>
        <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground sm:block" aria-live="polite">{match.log[0]?.text}</span>
      </div>

      {/* PLAYER */}
      <Field>
        {me.board.length ? (
          me.board.map((u) => (
            <div key={u.uid} className={u.fx === "enter" ? "lc-enter" : ""}>
              <LivingCard
                card={cardFor(u, true)}
                size="sm"
                live={u}
                ui={attacker === u.uid ? "selected" : u.fx === "damaged" ? "damaged" : u.fx === "evolved" ? "evolved" : u.fx === "attacking" ? "attacking" : myTurn && u.ready ? "playable" : "idle"}
                onClick={myTurn && u.ready ? () => onMine(u) : undefined}
                label={`Your ${u.name}${u.ready ? ", ready to attack" : ", resting"}`}
              />
            </div>
          ))
        ) : (
          <EmptyField text="PLAY A CARD FROM YOUR HAND" />
        )}
      </Field>
      <PlayerStrip who="YOU" hp={me.hp} energy={me.energy} hand={me.hand.length} deck={me.deck.length} hurt={me.hurt} active={myTurn} />

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_16rem] [&>*]:min-w-0">
        <div>
          <div className="play-hand flex gap-2 overflow-x-auto pb-3 pt-4" role="list" aria-label="Your hand">
            {me.hand.map((u) => {
              const ok = canPlay(match, "player", u.uid);
              const ui: CardUiState = picked === u.uid ? "selected" : !myTurn ? "disabled" : ok ? "playable" : "idle";
              return (
                <div role="listitem" key={u.uid}>
                  <LivingCard card={cardFor(u, true)} ui={ui} onClick={() => onHand(u)} />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pickedUnit && (
              <>
                <button type="button" className="btn-term" disabled={!canPlay(match, "player", pickedUnit.uid)} onClick={() => onHand(pickedUnit)}>
                  PLAY {pickedUnit.name} · ⚡{pickedUnit.cost}
                </button>
                <span className="font-mono text-[10px] text-muted-foreground">{TYPE_RULE[pickedUnit.type]}</span>
              </>
            )}
            {attacker && <span className="font-mono text-[10px] text-bitcoin">CHOOSE A TARGET ↑ {legal?.hero ? "— OR STRIKE THE RIVAL" : "— GUARDIANS FIRST"}</span>}
            <button type="button" className="btn-term-ghost ml-auto min-h-11" disabled={!myTurn} onClick={() => { setPicked(null); setAttacker(null); setMatch(endTurn(match)); }}>
              END TURN →
            </button>
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">Tap a card to inspect, tap again to play. Tap a ready card on your field, then a target, to attack.</p>
        </div>
        <ol className="max-h-48 overflow-y-auto border border-border bg-card" aria-label="Match log">
          {match.log.map((l) => (
            <li key={l.id} className={`border-b border-border/60 px-3 py-1.5 font-mono text-[10px] ${l.side === "ai" ? "text-signal" : l.side === "world" ? "text-muted-foreground" : ""}`}>{l.text}</li>
          ))}
        </ol>
      </div>

      {tableCode && <p className="font-mono text-[10px] text-muted-foreground">TABLE {tableCode}</p>}

      {moment && <MagicMoment change={moment} card={profile.cards[moment.cardId]} onClose={() => setMoment(null)} />}
      {result && !moment && <GameResult {...result} profile={profile} onRestart={onRestart} />}
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="play-field flex min-h-[11.5rem] items-center justify-start sm:justify-center gap-2 overflow-x-auto border border-border px-2 py-3">{children}</div>;
}
function EmptyField({ text }: { text: string }) {
  return <span className="label text-muted-foreground/70">{text}</span>;
}

function PlayerStrip(p: { who: string; hp: number; energy: number; hand: number; deck: number; hurt: number; active: boolean; targetable?: boolean; onTarget?: () => void }) {
  const pct = Math.max(0, (p.hp / START_HP) * 100);
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 border bg-card px-3 py-2 ${p.active ? "border-bitcoin" : "border-border"} ${p.hurt ? "lc-shake" : ""}`}>
      <span className="label">{p.who}</span>
      <div className="flex min-w-[8rem] flex-1 items-center gap-2">
        <span className="font-mono text-xs text-bitcoin">♥ {Math.max(0, p.hp)}</span>
        <div className="h-1.5 flex-1 bg-surface"><div className="h-full bg-bitcoin transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
      </div>
      <span className="font-mono text-[10px] text-signal">⚡ {p.energy}</span>
      <span className="font-mono text-[10px] text-muted-foreground">HAND {p.hand} · DECK {p.deck}</span>
      {p.targetable && (
        <button type="button" className="btn-term min-h-9" onClick={p.onTarget}>STRIKE RIVAL</button>
      )}
    </div>
  );
}

function MagicMoment({ change, card, onClose }: { change: CardChange; card?: Card | undefined; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-background/85 p-4" role="dialog" aria-modal="true" aria-label="World event">
      <div className="lc-moment w-full max-w-md border border-bitcoin bg-card p-5 text-center">
        <p className="label text-signal">WORLD EVENT</p>
        <p className="display mt-2 text-lg">{change.height}.BITMAP RESPONDED</p>
        {card && <div className="my-4 flex justify-center"><LivingCard card={card} size="md" ui="evolved" /></div>}
        <p className="display text-xl text-bitcoin">{change.name}</p>
        <p className="label mt-1">BECAME {change.to}</p>
        <ul className="mt-3 space-y-1 font-mono text-xs">
          <li>+{change.activity} ACTIVITY</li>
          {change.traitUnlocked && <li className="text-bitcoin">NEW TRAIT UNLOCKED · {change.traitUnlocked}</li>}
        </ul>
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">This card remembers. Every play is written into its history.</p>
        <button type="button" className="btn-term mt-4 w-full" onClick={onClose} autoFocus>CONTINUE THE MATCH</button>
      </div>
    </div>
  );
}

function GameResult({ win, changes, profile, onRestart }: { win: boolean; changes: CardChange[]; profile: PlayProfile; onRestart: () => void }) {
  const main = changes.find((c) => c.xp > 0);
  const found = changes.find((c) => c.statNote === "NEW CARD");
  const card = main ? profile.cards[main.cardId] : undefined;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/90 p-4" role="dialog" aria-modal="true" aria-label="Match complete">
      <div className="lc-moment w-full max-w-md border border-border bg-card p-5 text-center">
        <p className="label text-signal">MATCH COMPLETE</p>
        <p className={`display mt-1 text-2xl ${win ? "text-bitcoin" : ""}`}>{win ? "THE FIELD IS YOURS" : "THE RIVAL HOLDS THE LAND"}</p>
        {main && card ? (
          <>
            <p className="label mt-4">{main.height}.BITMAP</p>
            <div className="my-3 flex justify-center"><LivingCard card={card} ui={main.from !== main.to ? "evolved" : "idle"} /></div>
            <p className="display text-lg">{main.name}</p>
            <p className="label text-bitcoin">{main.to}</p>
            <ul className="mt-3 space-y-1 font-mono text-xs">
              <li>+{main.xp} XP</li>
              <li>CARD ACTIVITY +{main.activity}</li>
              {found && <li className="text-bitcoin">NEW CARD DISCOVERED · {found.name}</li>}
              <li>NEW EVENT RECORDED</li>
            </ul>
          </>
        ) : (
          <p className="mt-4 font-mono text-xs text-muted-foreground">NEW EVENT RECORDED</p>
        )}
        <p className="display mt-4 text-sm">THE OASIS HAS CHANGED</p>
        <div className="mt-4 grid gap-2">
          <button type="button" className="btn-term" onClick={onRestart} autoFocus>PLAY AGAIN</button>
          {card && (
            <Link to="/play/card/$id" params={{ id: String(card.bitmap) }} className="btn-term-ghost">VIEW CARD</Link>
          )}
          <Link to="/oasis" search={card ? { height: card.bitmap } : profile.selectedBitmap !== null ? { height: profile.selectedBitmap } : {}} className="btn-term-ghost">VIEW IN THE OASIS</Link>
        </div>
      </div>
    </div>
  );
}
