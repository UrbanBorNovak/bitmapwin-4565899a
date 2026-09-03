import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const PARTY_MAX_MEMBERS = 3;
export const PARTY_CHAT_MAX_LENGTH = 140;

export type PartyMember = { id: string; handle: string };
export type PartyInvite = { partyId: string; leaderId: string; leaderHandle: string; at: number };
export type PartyMessage = { id: string; senderId: string; handle: string; body: string; at: number };

type PartySnapshot = { partyId: string; leaderId: string; members: PartyMember[] };

export function useMapParty(selfId: string, handle: string, enabled = true) {
  const [party, setParty] = useState<PartySnapshot | null>(null);
  const [invites, setInvites] = useState<PartyInvite[]>([]);
  const [messages, setMessages] = useState<PartyMessage[]>([]);
  const partyRef = useRef<PartySnapshot | null>(null);
  partyRef.current = party;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const send = (event: string, payload: Record<string, unknown>) => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event, payload });
  };

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("map-parties", { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "party-invite" }, ({ payload }) => {
        const p = payload as { to?: string; partyId?: string; leaderId?: string; leaderHandle?: string };
        if (p.to !== selfId || !p.partyId || !p.leaderId || !p.leaderHandle || partyRef.current) return;
        const partyId = p.partyId;
        const leaderId = p.leaderId;
        const leaderHandle = p.leaderHandle.slice(0, 32);
        setInvites((current) => [...current.filter((invite) => invite.leaderId !== leaderId), {
          partyId,
          leaderId,
          leaderHandle,
          at: Date.now(),
        }].slice(-3));
      })
      .on("broadcast", { event: "party-decline" }, ({ payload }) => {
        const p = payload as { to?: string };
        if (p.to === selfId) return;
      })
      .on("broadcast", { event: "party-accept" }, ({ payload }) => {
        const p = payload as { to?: string; id?: string; handle?: string; partyId?: string };
        const current = partyRef.current;
        if (p.to !== selfId || !p.id || !p.handle || !current || current.leaderId !== selfId || p.partyId !== current.partyId) return;
        if (current.members.some((member) => member.id === p.id) || current.members.length >= PARTY_MAX_MEMBERS) return;
        const next = { ...current, members: [...current.members, { id: p.id, handle: p.handle.slice(0, 32) }] };
        partyRef.current = next;
        setParty(next);
        void channel.send({ type: "broadcast", event: "party-state", payload: next });
      })
      .on("broadcast", { event: "party-state" }, ({ payload }) => {
        const p = payload as PartySnapshot;
        if (!p?.partyId || !p.leaderId || !Array.isArray(p.members) || p.members.length > PARTY_MAX_MEMBERS) return;
        const members = p.members.filter((member) => member?.id && member?.handle).slice(0, PARTY_MAX_MEMBERS);
        if (!members.some((member) => member.id === selfId)) return;
        const next = { partyId: p.partyId, leaderId: p.leaderId, members };
        partyRef.current = next;
        setParty(next);
        setInvites([]);
      })
      .on("broadcast", { event: "party-kick" }, ({ payload }) => {
        const p = payload as { to?: string; partyId?: string; leaderId?: string };
        const current = partyRef.current;
        if (p.to !== selfId || !current || p.partyId !== current.partyId || p.leaderId !== current.leaderId) return;
        partyRef.current = null;
        setParty(null);
        setMessages([]);
      })
      .on("broadcast", { event: "party-leave" }, ({ payload }) => {
        const p = payload as { partyId?: string; id?: string };
        const current = partyRef.current;
        if (!current || current.leaderId !== selfId || p.partyId !== current.partyId || !p.id) return;
        const next = { ...current, members: current.members.filter((member) => member.id !== p.id) };
        partyRef.current = next;
        setParty(next);
        void channel.send({ type: "broadcast", event: "party-state", payload: next });
      })
      .on("broadcast", { event: "party-disband" }, ({ payload }) => {
        const p = payload as { partyId?: string; leaderId?: string };
        const current = partyRef.current;
        if (!current || p.partyId !== current.partyId || p.leaderId !== current.leaderId) return;
        partyRef.current = null;
        setParty(null);
        setMessages([]);
      })
      .on("broadcast", { event: "party-say" }, ({ payload }) => {
        const p = payload as PartyMessage & { partyId?: string };
        const current = partyRef.current;
        if (!current || p.partyId !== current.partyId || !current.members.some((member) => member.id === p.senderId) || !p.body) return;
        setMessages((lines) => [...lines, { id: p.id, senderId: p.senderId, handle: p.handle.slice(0, 32), body: p.body.slice(0, PARTY_CHAT_MAX_LENGTH), at: p.at }].slice(-30));
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      const current = partyRef.current;
      if (current) {
        const event = current.leaderId === selfId ? "party-disband" : "party-leave";
        void channel.send({ type: "broadcast", event, payload: { partyId: current.partyId, leaderId: current.leaderId, id: selfId } });
      }
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [enabled, handle, selfId]);

  const invite = (targetId: string) => {
    let current = partyRef.current;
    if (!current) {
      current = { partyId: `${selfId}-${Date.now()}`, leaderId: selfId, members: [{ id: selfId, handle }] };
      partyRef.current = current;
      setParty(current);
    }
    if (current.leaderId !== selfId || current.members.length >= PARTY_MAX_MEMBERS || current.members.some((member) => member.id === targetId)) return;
    send("party-invite", { to: targetId, partyId: current.partyId, leaderId: selfId, leaderHandle: handle });
  };

  const respond = (inviteItem: PartyInvite, accept: boolean) => {
    setInvites((current) => current.filter((invite) => invite !== inviteItem));
    if (!accept || partyRef.current) {
      send("party-decline", { to: inviteItem.leaderId, from: selfId });
      return;
    }
    send("party-accept", { to: inviteItem.leaderId, partyId: inviteItem.partyId, id: selfId, handle });
  };

  const kick = (memberId: string) => {
    const current = partyRef.current;
    if (!current || current.leaderId !== selfId || memberId === selfId) return;
    const next = { ...current, members: current.members.filter((member) => member.id !== memberId) };
    partyRef.current = next;
    setParty(next);
    send("party-kick", { to: memberId, partyId: current.partyId, leaderId: selfId });
    send("party-state", next);
  };

  const leave = () => {
    const current = partyRef.current;
    if (!current) return;
    send(current.leaderId === selfId ? "party-disband" : "party-leave", { partyId: current.partyId, leaderId: current.leaderId, id: selfId });
    partyRef.current = null;
    setParty(null);
    setMessages([]);
  };

  const say = (body: string) => {
    const current = partyRef.current;
    const clean = body.trim().slice(0, PARTY_CHAT_MAX_LENGTH);
    if (!current || !clean) return;
    const message = { id: `${selfId}-${Date.now()}`, senderId: selfId, handle, body: clean, at: Date.now() };
    setMessages((lines) => [...lines, message].slice(-30));
    send("party-say", { ...message, partyId: current.partyId });
  };

  return useMemo(() => ({ party, invites, messages, invite, respond, kick, leave, say }), [party, invites, messages]);
}