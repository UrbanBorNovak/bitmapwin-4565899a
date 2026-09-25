import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { nextAiAction } from "@/lib/game/ai";
import { abilityOf } from "@/lib/game/abilities";
import { createCardFromBitmap, emptyFacts } from "@/lib/game/cardFactory";
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
  type RivalDeck,
  type Unit,
} from "@/lib/game/engine";
import { dispatchWorldEvent } from "@/lib/game/worldState";
import type { CardChange, LivingCard as Card, PlayProfile } from "@/lib/game/types";
import { LivingCard, type CardUiState } from "./LivingCard";

export type RemoteAction = { kind: "play"; uid: string } | { kind: "attack"; uid: string; target: string } | { kind: "end" };
export type RemoteTable = { state: MatchState; rivalName: string; send: (a: RemoteAction) => void; busy: boolean };
type Props = { profile: PlayProfile; deck: Card[]; seed: number; leaderId: string | null; tableCode: string | null; onRestart: () => void; remote?: RemoteTable; onFinish?: (win: boolean) => void; restartLabel?: string; context?: string; rival?: RivalDeck | null };

const AI_STEP_MS = 750;

export function GameBoard({ profile, deck, seed, leaderId, tableCode, onRestart, remote, onFinish, restartLabel, context, rival }: Props) {
  const [localMatch, setMatch] = useState<MatchState>(() => (remote ? remote.state : newMatch(deck, seed, leaderId, rival)));
  const match = remote ? remote.state : localMatch;
  const act = (a: RemoteAction) => {
    if (remote) return remote.send(a);
    setMatch(a.kind === "play" ? playCard(match, "player", a.uid) : a.kind === "attack" ? attack(match, "player", a.uid, a.target) : endTurn(match));
  };
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
    if (remote || match.active !== "ai" || match.winner) return;
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
  }, [match, remote]);

  // Match end → world events.
  useEffect(() => {
    if (!match.winner || recorded.current) return;
    recorded.current = true;
    const win = match.winner === "player";
    onFinish?.(win);
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
  const myTurn = match.active === "player" && !match.winner && !remote?.busy;
  const rivalLabel = remote ? `RIVAL · ${remote.rivalName}` : rival?.heights[0] !== undefined ? `RIVAL · ${rival.heights[0]}.BITMAP · ${rival.builds[rival.heights[0]] ?? 0} BUILDS` : "RIVAL · LOCAL AI";
  const legal = attacker ? legalTargets(match, "player") : null;

  function onHand(u: Unit) {
    if (!myTurn) return;
    setAttacker(null);
    if (picked !== u.uid) return setPicked(u.uid);
    if (!canPlay(match, "player", u.uid)) return;
    act({ kind: "play", uid: u.uid });
    setPicked(null);
    const changes = dispatchWorldEvent({ kind: "CARD_PLAYED", cardId: u.cardId, actor });
    const evolution = changes.find((c) => c.from !== c.to || c.traitUnlocked || c.adaptationUnlocked);
    if (evolution) setMoment(evolution);
  }

  function onMine(u: Unit) {
    if (!myTurn || !u.ready) return;
    setPicked(null);
    setAttacker((a) => (a === u.uid ? null : u.uid));
  }

  function strike(target: string | "hero") {
    if (!attacker) return;
    const unit = me.board.find((candidate) => candidate.uid === attacker);
    act({ kind: "attack", uid: attacker, target });
    if (unit) {
      const changes = dispatchWorldEvent({ kind: "CARD_ATTACKED", cardId: unit.cardId, actor });
      const learned = changes.find((change) => change.adaptationUnlocked || change.from !== change.to);
      if (learned) setMoment(learned);
    }
    setAttacker(null);
  }

  const pickedUnit = me.hand.find((u) => u.uid === picked);

  return (
    <div className="play-table relative grid min-w-0 grid-cols-1 gap-3 [&>*]:min-w-0">
      {/* OPPONENT */}
      <PlayerStrip
        who={rivalLabel}
        hp={foe.hp}
        energy={foe.energy}
        hand={foe.hand.length}
        deck={foe.deck.length}
        hurt={foe.hurt}
        active={match.active === "ai" && !match.winner}
        targetable={!!legal?.hero}
        onTarget={() => strike("hero")}
      />
      <div className="play-arena">
      <Field lane="RIVAL FIELD" side="foe">
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

      <div className="play-divide">
        <span className="label text-[10px] text-muted-foreground">TURN {String(match.turn).padStart(2, "0")}</span>
        <span className={`play-turn ${match.winner ? "" : myTurn ? "play-turn-me" : "play-turn-foe"}`} aria-live="polite">{match.winner ? "MATCH COMPLETE" : myTurn ? "YOUR MOVE" : remote?.busy ? "SENDING MOVE…" : remote ? "RIVAL'S MOVE…" : "RIVAL IS THINKING…"}</span>
        <span className="hidden max-w-[40%] truncate font-mono text-[10px] text-muted-foreground md:block">{match.log[0]?.text}</span>
      </div>

      {/* PLAYER */}
      <Field lane="YOUR FIELD" side="me">
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
      </div>
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
                <span className="font-mono text-[10px] text-muted-foreground"><span className="text-bitcoin">{abilityOf(pickedUnit).name}</span> — {abilityOf(pickedUnit).text}</span>
                {pickedUnit.perks?.length ? <span className="font-mono text-[10px] text-signal">LIVING · {pickedUnit.perks.join(" · ")}</span> : null}
              </>
            )}
            {attacker && <span className="font-mono text-[10px] text-bitcoin">CHOOSE A TARGET ↑ {legal?.hero ? "— OR STRIKE THE RIVAL" : "— GUARDIANS FIRST"}</span>}
            <button type="button" className="btn-term-ghost ml-auto min-h-11" disabled={!myTurn} onClick={() => { setPicked(null); setAttacker(null); act({ kind: "end" }); }}>
              END TURN →
            </button>
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">Tap a card to inspect, tap again to play. Tap a ready card on your field, then a target, to attack.</p>
        </div>
        <ol className="play-log max-h-48 overflow-y-auto border border-border bg-card" aria-label="Match log">
          <li className="label sticky top-0 border-b border-border bg-card px-3 py-1.5 text-[10px] text-muted-foreground">MATCH LOG</li>
          {match.log.map((l) => (
            <li key={l.id} className={`border-b border-border/60 px-3 py-1.5 font-mono text-[10px] ${l.side === "ai" ? "text-signal" : l.side === "world" ? "text-muted-foreground" : ""}`}>{l.text}</li>
          ))}
        </ol>
      </div>

      {tableCode && <p className="font-mono text-[10px] text-muted-foreground">TABLE {tableCode}</p>}

      {moment && <MagicMoment change={moment} card={profile.cards[moment.cardId]} onClose={() => setMoment(null)} />}
      {result && !moment && <GameResult {...result} profile={profile} onRestart={onRestart} restartLabel={restartLabel} context={context} />}
    </div>
  );
}

function Field({ children, lane, side }: { children: React.ReactNode; lane: string; side: "foe" | "me" }) {
  return <div data-lane={lane} className={`play-field play-field-${side} flex min-h-[12rem] items-center justify-start gap-3 overflow-x-auto px-3 pb-3 pt-6 sm:justify-center`}>{children}</div>;
}
function EmptyField({ text }: { text: string }) {
  return <span className="label text-muted-foreground/70">{text}</span>;
}

function PlayerStrip(p: { who: string; hp: number; energy: number; hand: number; deck: number; hurt: number; active: boolean; targetable?: boolean; onTarget?: () => void }) {
  const hp = Math.max(0, p.hp);
  return (
    <div className={`play-strip flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 ${p.active ? "play-strip-active" : ""} ${p.hurt ? "lc-shake" : ""}`}>
      <span className="label min-w-[6rem] truncate">{p.who}</span>
      <div className={`flex min-w-[10rem] flex-1 items-center gap-2 ${hp <= 6 ? "play-hp-low" : ""}`} aria-label={`${hp} of ${START_HP} health`}>
        <span className="w-8 font-mono text-xs text-bitcoin">♥{hp}</span>
        <div className="flex flex-1 gap-[2px]">
          {Array.from({ length: START_HP }, (_, i) => <span key={i} className={`play-hp-seg ${i < hp ? "play-hp-seg-on" : ""}`} />)}
        </div>
        {p.hurt ? <span className="font-mono text-[10px] text-destructive">−{p.hurt}</span> : null}
      </div>
      <div className="flex items-center gap-1.5" aria-label={`${p.energy} energy`}>
        <span className="mr-1 font-mono text-[10px] text-signal">⚡{p.energy}</span>
        {Array.from({ length: 6 }, (_, i) => <span key={i} className={`play-pip ${i < p.energy ? "play-pip-on" : ""}`} />)}
      </div>
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
          {change.adaptationUnlocked && <li className="text-signal">ADAPTATION LEARNED · {change.adaptationUnlocked.replace(/_/g, " ")}</li>}
        </ul>
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">This card remembers. Every play is written into its history.</p>
        <button type="button" className="btn-term mt-4 w-full" onClick={onClose} autoFocus>CONTINUE THE MATCH</button>
      </div>
    </div>
  );
}

function GameResult({ win, changes, profile, onRestart, restartLabel, context }: { win: boolean; changes: CardChange[]; profile: PlayProfile; onRestart: () => void; restartLabel?: string | undefined; context?: string | undefined }) {
  const main = changes.find((c) => c.xp > 0);
  const found = changes.find((c) => c.statNote === "NEW CARD");
  const card = main ? profile.cards[main.cardId] : undefined;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/90 p-4" role="dialog" aria-modal="true" aria-label="Match complete">
      <div className="lc-moment w-full max-w-md border border-border bg-card p-5 text-center">
        <p className="label text-signal">{context ? `${context} · ` : ""}MATCH COMPLETE</p>
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
          <button type="button" className="btn-term" onClick={onRestart} autoFocus>{restartLabel ?? "PLAY AGAIN"}</button>
          {card && (
            <Link to="/play/card/$id" params={{ id: String(card.bitmap) }} className="btn-term-ghost">VIEW CARD</Link>
          )}
          <Link to="/oasis" search={card ? { height: card.bitmap } : profile.selectedBitmap !== null ? { height: profile.selectedBitmap } : {}} className="btn-term-ghost">VIEW IN THE OASIS</Link>
        </div>
      </div>
    </div>
  );
}
