/**
 * Biternam quest HUD: talk prompt near a character, the branching call on
 * the wrist-com, a free-question line, and the quest log with BIT claims.
 */
import { useEffect, useState, type MutableRefObject } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TracyCom } from "@/components/game/TracyCom";
import { PICKUP_REACH, QUESTS, heldItems, isComplete, itemSpot, landmarkInReach, missionScript, missionStepFor, pendingItems, nearestNpc, npcById, questStore, useQuestState, type QuestNpc } from "@/lib/biternam-quests";
import { askNpcFn, claimQuestRewardFn } from "@/lib/biternam-npc.functions";
import { questChime, voice } from "@/lib/synth-voice";
import { tracyCue } from "@/lib/tracy-com";
import { WORLD_CELL } from "@/lib/player-state";
import { useWalletSession } from "@/lib/wallet-session";

type Pose = { x: number; z: number };

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
};

export function OasisQuests({ pose, hidden }: { pose: MutableRefObject<Pose>; hidden?: boolean }) {
  const { progress, nearId } = useQuestState();
  const [talking, setTalking] = useState<{ npc: QuestNpc; n: number } | null>(null);
  const [reply, setReply] = useState<{ n: number; npc: QuestNpc; text: string } | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const ask = useServerFn(askNpcFn);
  const claim = useServerFn(claimQuestRewardFn);
  const wallet = useWalletSession();
  const address = wallet?.ordinalsAddress || wallet?.paymentAddress || null;

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

  const endCall = () => { if (talking) questStore.record("talk", talking.npc.id); };
  // A hero waiting on a mission step speaks their own lines; give steps offer your wrist inventory.
  const mission = talking ? missionStepFor(talking.npc.id, progress) : null;
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
    const r = await claim({ data: { address, quest: id } }).catch(() => ({ ok: false as const, already: false, error: "PAYOUT FAILED — TRY AGAIN" }));
    if (r.ok) { questStore.markClaimed(id); setNote(r.already ? "ALREADY CLAIMED ON THIS ACCOUNT" : "BIT PAID"); }
    else setNote(r.error ?? "PAYOUT FAILED");
    setTimeout(() => setNote(null), 4000);
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
            <TracyCom key={`${talking.n}:${mission?.quest.id ?? ""}`} script={mission ? missionScript(talking.npc, mission.step, held) : talking.npc.script} voice={talking.npc.voice} onEnd={endCall} onNode={onMissionNode} />
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
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </>
  );
}
