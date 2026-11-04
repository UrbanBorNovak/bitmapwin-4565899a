/** Reads BW-BARTER-1 tickets (kind 30403) from public Nostr relays. Malformed tickets are dropped. */
import { NOSTR_RELAYS, verifyEvent, type NostrEvent } from "@/lib/nostr-listing";
import { BARTER_KIND, BARTER_TAG, ticketProblem, type BarterCriteria, type BarterTicket } from "@/lib/barter-protocol";

export type FeedTicket = BarterTicket & { eventId: string; createdAt: number; note: string };

const tag = (e: NostrEvent, k: string) => e.tags.find((t) => t[0] === k)?.[1];

export function parseTicketEvent(e: NostrEvent): FeedTicket | null {
  if (e.kind !== BARTER_KIND || !e.tags.some((t) => t[0] === "t" && t[1] === BARTER_TAG)) return null;
  let criteria: BarterCriteria;
  try {
    const raw = JSON.parse(tag(e, "criteria_rules") ?? "{}") as Record<string, unknown>;
    criteria = {};
    for (const k of ["exactHeight", "minHeight", "maxHeight", "minTxCount", "maxTxCount"] as const)
      if (typeof raw[k] === "number") criteria[k] = raw[k] as number;
    for (const k of ["exactInscriptionId", "parentInscriptionId"] as const)
      if (typeof raw[k] === "string") criteria[k] = raw[k] as string;
    if (raw["patoshiOnly"] === true) criteria.patoshiOnly = true;
    const at = raw["assetType"];
    if (at === "bitmap" || at === "guardian" || at === "voxel" || at === "ordinal") criteria.assetType = at;
  } catch {
    return null;
  }
  const dir = tag(e, "sweetener_dir");
  const t: BarterTicket = {
    makerAddress: tag(e, "maker_address") ?? "",
    offeringOutpoint: tag(e, "offering_outpoint") ?? "",
    offeringInscription: tag(e, "offering_inscription") ?? "",
    offeringValue: Number(tag(e, "offering_value")),
    sweetenerSats: Number(tag(e, "sweetener_sats") ?? 0),
    sweetenerDir: dir === "give" ? "give" : "demand",
    criteria,
  };
  if (!t.makerAddress || ticketProblem(t)) return null;
  return { ...t, eventId: e.id, createdAt: e.created_at, note: e.content.slice(0, 280) };
}

/** Collects tickets from relays until EOSE or timeout. Only signature-valid events are kept. */
export function fetchBarterTickets(relays = NOSTR_RELAYS, timeoutMs = 6000): Promise<FeedTicket[]> {
  return new Promise((resolve) => {
    const seen = new Map<string, FeedTicket>();
    let open = relays.length;
    const sockets: WebSocket[] = [];
    const finish = () => {
      sockets.forEach((s) => { try { s.close(); } catch { /* ignore */ } });
      resolve([...seen.values()].sort((a, b) => b.createdAt - a.createdAt));
    };
    const timer = setTimeout(finish, timeoutMs);
    const done = () => { if (--open <= 0) { clearTimeout(timer); finish(); } };
    for (const url of relays) {
      let ws: WebSocket;
      try { ws = new WebSocket(url); } catch { done(); continue; }
      sockets.push(ws);
      const sub = "barter" + Math.random().toString(36).slice(2, 8);
      ws.onopen = () => ws.send(JSON.stringify(["REQ", sub, { kinds: [BARTER_KIND], "#t": [BARTER_TAG], limit: 200 }]));
      ws.onmessage = (m) => {
        try {
          const msg = JSON.parse(String(m.data)) as unknown[];
          if (msg[0] === "EVENT") {
            const e = msg[2] as NostrEvent;
            if (!verifyEvent(e)) return;
            const t = parseTicketEvent(e);
            if (t) seen.set(t.offeringOutpoint, t);
          } else if (msg[0] === "EOSE") done();
        } catch { /* ignore */ }
      };
      ws.onerror = () => done();
    }
  });
}

export function describeCriteria(c: BarterCriteria): string {
  const p: string[] = [];
  if (c.assetType) p.push(c.assetType.toUpperCase());
  if (c.exactHeight !== undefined) p.push(`${c.exactHeight}.bitmap`);
  if (c.minHeight !== undefined && c.maxHeight !== undefined) p.push(`blocks ${c.minHeight}–${c.maxHeight}`);
  else if (c.maxHeight !== undefined) p.push(`sub-${c.maxHeight + 1}`);
  else if (c.minHeight !== undefined) p.push(`block ≥ ${c.minHeight}`);
  if (c.maxTxCount !== undefined) p.push(`≤ ${c.maxTxCount} tx`);
  if (c.minTxCount !== undefined) p.push(`≥ ${c.minTxCount} tx`);
  if (c.patoshiOnly) p.push("Patoshi block");
  if (c.exactInscriptionId) p.push(`inscription ${c.exactInscriptionId.slice(0, 8)}…`);
  if (c.parentInscriptionId) p.push(`child of ${c.parentInscriptionId.slice(0, 8)}…`);
  return p.join(" · ") || "—";
}
