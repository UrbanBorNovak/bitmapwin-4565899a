import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClanCrest } from "@/components/game/ClanCrest";
import { useAuthSession } from "@/lib/auth";
import { clanStateQuery } from "@/lib/clans";
import {
  createClanFn,
  decideClanRequestFn,
  inviteClanMemberFn,
  requestClanJoinFn,
  updateClanCrestFn,
} from "@/lib/clans.functions";

export function ClanPanel() {
  const { session } = useAuthSession();
  const queryClient = useQueryClient();
  const state = useQuery(clanStateQuery(Boolean(session)));
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [crest, setCrest] = useState("");
  const [inviteUserId, setInviteUserId] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["clan-state"] });
  const fail = (title: string) => (error: Error) => toast(title, { description: error.message });

  const create = useMutation({
    mutationFn: () => createClanFn({ data: { name, tag, crestInscriptionId: crest } }),
    onSuccess: () => { setName(""); setTag(""); setCrest(""); void refresh(); },
    onError: fail("CLAN NOT CREATED"),
  });
  const join = useMutation({
    mutationFn: (clanId: string) => requestClanJoinFn({ data: { clanId } }),
    onSuccess: () => void refresh(),
    onError: fail("REQUEST NOT SENT"),
  });
  const decide = useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      decideClanRequestFn({ data: { requestId, accept } }),
    onSuccess: () => void refresh(),
    onError: fail("REQUEST NOT UPDATED"),
  });
  const updateCrest = useMutation({
    mutationFn: (clanId: string) => updateClanCrestFn({ data: { clanId, crestInscriptionId: crest } }),
    onSuccess: () => { setCrest(""); void refresh(); },
    onError: fail("CREST NOT UPDATED"),
  });
  const invite = useMutation({
    mutationFn: (clanId: string) => inviteClanMemberFn({ data: { clanId, userId: inviteUserId } }),
    onSuccess: () => { setInviteUserId(""); void refresh(); },
    onError: fail("INVITE NOT SENT"),
  });

  if (!session) return <p className="font-mono text-[10px] text-muted-foreground">SIGN IN TO CREATE OR JOIN A CLAN.</p>;
  if (state.isLoading) return <p className="font-mono text-[10px] text-muted-foreground">LOADING CLANS…</p>;
  if (state.isError) return <p className="font-mono text-[10px] text-bitcoin">CLAN NETWORK UNAVAILABLE.</p>;

  const membership = state.data?.membership ?? null;
  const leaderClan = state.data?.clans.find((clan) => clan.leader) ?? null;
  const hasActiveClan = membership?.status === "accepted";

  return (
    <div className="flex max-h-[42vh] flex-col gap-2 overflow-y-auto font-mono text-[10px]" data-no-translate>
      {membership ? (
        <div className="flex items-center gap-2 border border-border bg-background/70 p-2">
          <ClanCrest clan={membership} className="size-10" />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-foreground">[{membership.tag}] {membership.name}</div>
            <div className={membership.status === "accepted" ? "text-bitcoin" : "text-muted-foreground"}>
              {membership.leader ? "CLAN LEADER" : membership.status.toUpperCase()}
            </div>
          </div>
        </div>
      ) : null}

      {leaderClan ? (
        <div className="border border-border p-2">
          <div className="mb-2 text-muted-foreground">LEADER CONTROL · IMAGE INSCRIPTIONS ONLY</div>
          <div className="flex gap-1">
            <Input value={crest} onChange={(event) => setCrest(event.target.value)} placeholder="CREST INSCRIPTION ID" className="h-8 rounded-none font-mono text-[10px]" />
            <Button variant="ghost" className="btn-term shrink-0" disabled={updateCrest.isPending || !crest.trim()} onClick={() => updateCrest.mutate(leaderClan.id)}>[ SET ]</Button>
          </div>
          <div className="mt-1 flex gap-1">
            <Input value={inviteUserId} onChange={(event) => setInviteUserId(event.target.value)} placeholder="PLAYER USER ID" className="h-8 rounded-none font-mono text-[10px]" />
            <Button variant="ghost" className="btn-term shrink-0" disabled={invite.isPending || !inviteUserId.trim()} onClick={() => invite.mutate(leaderClan.id)}>[ INVITE ]</Button>
          </div>
          {state.data?.requests.map((request) => (
            <div key={request.id} className="mt-2 flex items-center gap-1 border-t border-border pt-2">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">REQUEST · {request.userId.slice(0, 8).toUpperCase()}</span>
              <Button variant="ghost" className="btn-term" onClick={() => decide.mutate({ requestId: request.id, accept: true })}>[ ACCEPT ]</Button>
              <Button variant="ghost" className="btn-term-ghost" onClick={() => decide.mutate({ requestId: request.id, accept: false })}>[ DENY ]</Button>
            </div>
          ))}
          {state.data?.requests.length === 0 ? <div className="mt-2 text-muted-foreground">NO PENDING REQUESTS</div> : null}
        </div>
      ) : null}

      {!membership ? (
        <form className="grid gap-1 border border-border p-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <div className="mb-1 text-muted-foreground">FOUND A CLAN</div>
          <div className="grid grid-cols-[1fr_5rem] gap-1">
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="CLAN NAME" className="h-8 rounded-none font-mono text-[10px]" />
            <Input value={tag} onChange={(event) => setTag(event.target.value.toUpperCase())} maxLength={6} placeholder="TAG" className="h-8 rounded-none font-mono text-[10px]" />
          </div>
          <Input value={crest} onChange={(event) => setCrest(event.target.value)} placeholder="IMAGE INSCRIPTION ID" className="h-8 rounded-none font-mono text-[10px]" />
          <Button type="submit" variant="ghost" className="btn-term" disabled={create.isPending || !name.trim() || !tag.trim() || !crest.trim()}>[ CREATE CLAN ]</Button>
        </form>
      ) : null}

      <div className="grid gap-1">
        {(state.data?.clans ?? []).map((clan) => (
          <div key={clan.id} className="flex items-center gap-2 border border-border p-1.5">
            <ClanCrest clan={clan} className="size-8" />
            <span className="min-w-0 flex-1 truncate text-foreground">[{clan.tag}] {clan.name}</span>
            {!hasActiveClan && membership?.status !== "pending" && !clan.leader ? (
              <Button variant="ghost" className="btn-term-ghost shrink-0" disabled={join.isPending} onClick={() => join.mutate(clan.id)}>[ REQUEST ]</Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
