/**
 * Biternam quest HUD: talk prompt near a character, the branching call on
 * the wrist-com, a free-question line, and the quest log with BIT claims.
 */
import { useEffect, useState, type MutableRefObject } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TracyCom } from "@/components/game/TracyCom";
import { PICKUP_REACH, QUESTS, heldItems, isComplete, itemSpot, landmarkInReach, missionScript, missionStepFor, pendingItems, nearestNpc, npcById, questStore, stepKey, useQuestState, type QuestNpc } from "@/lib/biternam-quests";
import { askNpcFn, claimQuestRewardFn, recordQuestStepFn } from "@/lib/biternam-npc.functions";
import { questChime, voice } from "@/lib/synth-voice";
import { tracyCue } from "@/lib/tracy-com";
import { WORLD_CELL } from "@/lib/player-state";
import { LANDMARKS } from "@/lib/world-landmarks";
import { useWalletSession } from "@/lib/wallet-session";

type Pose = { x: number; z: number };

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
};

export function OasisQuests({ pose, hidden }: { pose: MutableRefObject<Pose>; hidden?: boolean }) {
  const { progress, nearId } = useQuestState();
  const [talking, setTalkingRaw] = useState<{ npc: QuestNpc; n: number; mission: ReturnType<typeof missionStepFor>; held: ReturnType<typeof heldItems> } | null>(null);
  const setTalking = (t: { npc: QuestNpc; n: number } | null) => {
    if (!t) return setTalkingRaw(null);
    const p = questStore.get();
    setTalkingRaw({ ...t, mission: missionStepFor(t.npc.id, p), held: heldItems(p) });
  };
  const [reply, setReply] = useState<{ n: number; npc: QuestNpc; text: string } | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const ask = useServerFn(askNpcFn);
  const claim = useServerFn(claimQuestRewardFn);
  const recordStep = useServerFn(recordQuestStepFn);
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;

  // Dev-only hook for browser play-tests (never shipped: stripped from production builds).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __biternamTest?: unknown }).__biternamTest = { questStore, heldItems, landmarks: LANDMARKS, pose, cell: WORLD_CELL, nearestNpc };
  }, [pose]);

  // Proximity: who you can talk to, and which landmark you're standing at.
  useEffect(() => {
    const id = setInterval(() => {
      const { x, z } = pose.current;
      questStore.setNear(nearestNpc(x, z)?.id ?? null);
      const lm = landmarkInReach(x, z);
      if (lm) questStore.record("visit", lm);
      for (const it of pendingItems(questStore.get())) {
        const sp = itemSpot(it);
        if (sp && Math.hypot(sp.x - x, sp.z - z) <= PICKUP_REACH * WORLD_CELL) questStore.record("pickup", it.id);
      }
    }, 250);
    return () => clearInterval(id);
  }, [pose]);

  useEffect(() => questStore.onAdvance((quest, done, step) => {
    // The server keeps its own ordered copy of progress; rewards are paid only from that copy.
    const index = (questStore.get().step[quest.id] ?? 1) - 1;
    void recordStep({ data: { quest: quest.id, index, key: stepKey(step) } }).catch(() => {});
    questChime(done);
    if (step.cindy) tracyCue({ kind: "mission", id: `${quest.id}:${step.target}:${step.kind}`, title: quest.title, line: step.cindy });
    setNote(done ? `QUEST COMPLETE · ${quest.title} · +${quest.bit} BIT READY` : `QUEST UPDATED · ${quest.title}`);
    setTimeout(() => setNote(null), 4500);
  }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "q" && !talking && nearId) { const npc = npcById(nearId); if (npc) setTalking({ npc, n: Date.now() }); }
      if (k === "b") setLogOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nearId, talking]);

  // Walking away hangs up.
  useEffect(() => { if (talking && nearId !== talking.npc.id) { setTalking(null); setReply(null); } }, [nearId, talking]);

  // Hang up when the call ends, so finishing a step never restarts the conversation with idle chat.
  const endCall = () => { if (talking) { questStore.record("talk", talking.npc.id); setTalking(null); setReply(null); } };
  // A hero waiting on a mission step speaks their own lines; give steps offer your wrist inventory.
  // Frozen when the call opens: the step advancing mid-call must not swap the script under you.
  const mission = talking?.mission ?? null;
  const onMissionNode = (id: string) => {
    if (talking && mission?.step.kind === "give" && id === "ok") questStore.record("give", `${talking.npc.id}>${mission.step.item}`);
  };

  const sendQuestion = async () => {
    if (!talking || !q.trim() || busy) return;
    setBusy(true);
    const r = await ask({ data: { npc: talking.npc.id, question: q } }).catch(() => ({ ok: false as const, text: "", error: "SIGNAL LOST" }));
    setBusy(false);
    setQ("");
    setReply({ n: Date.now(), npc: talking.npc, text: r.ok ? r.text : `[${r.error}]` });
  };

  const claimQuest = async (id: string) => {
    if (!address) return setNote("CONNECT A VERIFIED WALLET TO CLAIM BIT");
    const r: { ok: boolean; already: boolean; error: string | null; unverified?: boolean } = await claim({ data: { address, quest: id } }).catch(() => ({ ok: false, already: false, error: "PAYOUT FAILED — TRY AGAIN" }));
    if (r.ok) { setUnverified(null); questStore.markClaimed(id); setNote(r.already ? "ALREADY CLAIMED ON THIS ACCOUNT" : "BIT PAID"); }
    else if (r.unverified) { setUnverified(id); setLogOpen(true); return; }
    else setNote(r.error ?? "PAYOUT FAILED");
    setTimeout(() => setNote(null), 4000);
  };
  const replay = (id: string) => {
    questStore.replay(id);
    setUnverified(null);
    setNote("CHAPTER RESTARTED · PLAY IT THROUGH WHILE SIGNED IN");
    setTimeout(() => setNote(null), 4500);
  };

  if (hidden) return null;
  const nearNpc = nearId ? npcById(nearId) : null;
  const held = heldItems(progress);

  return (
    <>
      {nearNpc && !talking ? (
        <button type="button" onClick={() => setTalking({ npc: nearNpc, n: Date.now() })} className="glass-panel pointer-events-auto absolute bottom-40 left-1/2 z-[86] -translate-x-1/2 rounded-full border border-primary/50 px-4 py-2 font-mono text-[12px] tracking-widest text-primary">
          [Q] TALK · {nearNpc.name}
        </button>
      ) : null}

      {talking ? (
        <div className="pointer-events-auto absolute bottom-24 left-1/2 z-[87] w-[min(440px,94vw)] -translate-x-1/2 space-y-2">
          {reply ? (
            <TracyCom key={reply.n} script={{ id: "reply", title: "OPEN CHANNEL", start: "a", nodes: [{ id: "a", speaker: reply.npc.name, mood: "idle", text: reply.text, next: null }] }} voice={reply.npc.voice} onEnd={() => setReply(null)} />
          ) : (
            <TracyCom key={talking.n} script={mission ? missionScript(talking.npc, mission.step, talking.held) : talking.npc.script} voice={talking.npc.voice} onEnd={endCall} onNode={onMissionNode} />
          )}
          <form className="glass-panel flex gap-2 rounded-[14px] border border-border p-2 font-mono text-[12px]" onSubmit={(e) => { e.preventDefault(); void sendQuestion(); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={240} placeholder={`Ask ${talking.npc.name.toLowerCase()} anything…`} aria-label="Question" className="min-w-0 flex-1 rounded bg-muted px-2 py-1 text-foreground outline-none" />
            <button type="submit" disabled={busy || !q.trim()} className="rounded border border-signal/40 px-2 text-signal disabled:opacity-40">{busy ? "…" : "ASK"}</button>
            <button type="button" onClick={() => { setTalking(null); setReply(null); }} className="rounded border border-border px-2 text-muted-foreground">BYE</button>
          </form>
        </div>
      ) : null}

      {note ? <div className="glass-panel pointer-events-none absolute left-1/2 top-24 z-[88] -translate-x-1/2 rounded-full border border-primary/50 px-4 py-1.5 font-mono text-[11px] tracking-widest text-primary">{note}</div> : null}

      <div className="pointer-events-auto absolute left-3 top-1/2 z-[84] -translate-y-1/2 font-mono">
        <div className="flex gap-1">
          <button type="button" onClick={() => setLogOpen((o) => !o)} className="glass-panel rounded-full border border-border px-3 py-1 text-[11px] tracking-widest text-signal">[B] QUESTS</button>
          <button type="button" aria-label={muted ? "Unmute voices" : "Mute voices"} onClick={() => { voice.setMuted(!muted); setMuted(!muted); }} className="glass-panel rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{muted ? "VOICE OFF" : "VOICE ON"}</button>
        </div>
        {logOpen ? (
          <div className="glass-panel mt-2 w-[min(300px,80vw)] space-y-3 rounded-[14px] border border-border p-3">
            <div>
              <div className="text-[11px] tracking-widest text-signal">WRIST INVENTORY</div>
              {held.length ? (
                <ul className="mt-1 space-y-1">
                  {held.map((it) => <li key={it.id} className="text-[11px]" title={it.blurb}><span className="mr-1 text-primary">{it.icon}</span>{it.name}</li>)}
                </ul>
              ) : <p className="text-[11px] text-muted-foreground">Empty. Items glow orange in the world.</p>}
            </div>
            {QUESTS.map((quest) => {
              const at = progress.step[quest.id] ?? 0;
              const done = isComplete(quest, progress);
              const claimed = progress.claimed.includes(quest.id);
              return (
                <div key={quest.id}>
                  <div className="text-[11px] tracking-widest text-primary">{quest.title}</div>
                  <p className="text-[11px] text-muted-foreground">{quest.blurb}</p>
                  <ol className="mt-1 space-y-0.5 text-[11px]">
                    {quest.steps.map((s, i) => (
                      <li key={i} className={i < at ? "text-muted-foreground line-through" : i === at ? "text-signal" : "text-muted-foreground/60"}>{i < at ? "✓" : i === at ? "▸" : "·"} {s.label}</li>
                    ))}
                  </ol>
                  {done ? (
                    <button type="button" disabled={claimed} onClick={() => void claimQuest(quest.id)} className="mt-1 rounded border border-primary/50 px-2 py-0.5 text-[11px] text-primary disabled:opacity-50">
                      {claimed ? `BADGE · ${quest.badge}` : `CLAIM ${quest.bit} BIT`}
                    </button>
                  ) : null}
                  {unverified === quest.id ? (
                    <div role="alert" className="mt-2 rounded-[10px] border border-signal/50 bg-signal/10 p-2 text-[11px] leading-relaxed">
                      <div className="tracking-widest text-signal">CHAPTER NOT VERIFIED</div>
                      <p className="mt-1 text-foreground/85">This device shows the chapter finished, but your account didn't see every step. That happens if you played it signed out or before step checks existed.</p>
                      <p className="mt-1 text-foreground/85">Sign in, then replay it. Steps your account already saw are kept, and BIT you already earned is never lost.</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => replay(quest.id)} className="rounded border border-primary/60 px-2 py-0.5 text-primary">REPLAY CHAPTER</button>
                        <button type="button" onClick={() => setUnverified(null)} className="rounded border border-border px-2 py-0.5 text-muted-foreground">LATER</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </>
  );
}
