import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/lib/auth";
import { approvals, useApprovals, type BrokerPick, type Proposal } from "@/lib/agent-colony";

/**
 * Signed in: proposals + decisions live on the account (owner-only, audited by a
 * database trigger). Signed out: device-local queue. Neither path ever signs or
 * submits a transaction — approval only unlocks a link to the normal buy page.
 */
type Row = {
  id: string; citizen_id: string; kind: string; summary: string; href: string;
  offer_id: string | null; item: string | null; price_sats: number | null; reason: string | null;
  status: string; stale_why: string | null; created_at: string;
};
export type AuditEvent = { id: string; proposal_id: string; event: string; detail: string | null; created_at: string };

const toProposal = (r: Row): Proposal => ({
  id: r.id, citizenId: r.citizen_id, kind: r.kind as Proposal["kind"], summary: r.summary, href: r.href,
  offerId: r.offer_id ?? undefined, item: r.item ?? undefined, priceSats: r.price_sats ?? undefined,
  reason: r.reason ?? undefined, status: r.status as Proposal["status"], staleWhy: r.stale_why ?? undefined,
  createdAt: Date.parse(r.created_at),
});

export function useProposalStore() {
  const { user, loading } = useAuthSession();
  const local = useApprovals();
  const [rows, setRows] = useState<Proposal[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const uid = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!uid) return;
    const [p, a] = await Promise.all([
      supabase.from("agent_proposals").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("agent_proposal_events").select("id, proposal_id, event, detail, created_at").order("created_at", { ascending: false }).limit(30),
    ]);
    setRows(((p.data ?? []) as Row[]).map(toProposal));
    setAudit((a.data ?? []) as AuditEvent[]);
  }, [uid]);

  const insert = useCallback(async (list: Proposal[]) => {
    if (!uid || !list.length) return 0;
    const { data } = await supabase.from("agent_proposals").upsert(
      list.map((p) => ({
        id: p.id, user_id: uid, citizen_id: p.citizenId, kind: p.kind, summary: p.summary, href: p.href,
        offer_id: p.offerId ?? null, item: p.item ?? null, price_sats: p.priceSats ?? null, reason: p.reason ?? null,
      })),
      { onConflict: "user_id,id", ignoreDuplicates: true },
    ).select("id");
    return data?.length ?? 0;
  }, [uid]);

  // On sign-in, carry pending device-local proposals into the account once.
  useEffect(() => {
    if (!uid) return;
    void (async () => {
      const pending = approvals.get().filter((p) => p.status === "pending");
      if (pending.length) { await insert(pending); approvals.clear(pending.map((p) => p.id)); }
      await refresh();
    })();
  }, [uid, insert, refresh]);

  const list = uid ? rows : local;

  async function proposeTrades(picks: BrokerPick[]) {
    const fresh = approvals.toProposals(picks, list);
    if (!uid) { approvals.add(fresh); return fresh.length; }
    const n = await insert(fresh);
    await refresh();
    return n;
  }
  async function setStatus(id: string, status: "approved" | "rejected" | "stale", why?: string) {
    if (!uid) {
      if (status === "stale") approvals.markStale(id, why ?? ""); else approvals.decide(id, status === "approved");
      return;
    }
    await supabase.from("agent_proposals").update({ status, stale_why: why ?? null }).eq("id", id).eq("status", "pending");
    await refresh();
  }

  return { list, audit, signedIn: !!uid, loading, proposeTrades, setStatus };
}
