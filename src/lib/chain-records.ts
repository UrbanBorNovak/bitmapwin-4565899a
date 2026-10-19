import type { ProvenanceEvent } from "@/lib/passport";

/**
 * Notable blocks shown in the S.A.T.O.S.H.I. history simulation.
 * Height, hash, timestamp, tx count and pool were checked against mempool.space
 * (2026-10-19). Context lines are attributed commentary, labelled as such.
 */
export const CHAIN_RECORDS: ProvenanceEvent[] = [
  {
    id: "chain-record-367853", sourceKey: "chain-record:367853", eventType: "tx record",
    actorWallet: null, bitmapHeight: 367853, sourceType: "block",
    sourceId: "00000000000000001080e6de32add416cd6cda29f35ec9bce694fea4b964c7be", proofLevel: "CHAIN",
    title: "ALL-TIME TX RECORD · 12,239 TX",
    summary: "Chain: 12,239 transactions, mined 1 Aug 2015. Context (via @mononautical): packed with tiny non-standard transactions sweeping dust from the July 2015 spam attack.",
    metadata: { txCount: 12239, source: "https://mempool.space/block/00000000000000001080e6de32add416cd6cda29f35ec9bce694fea4b964c7be", attribution: "https://x.com/mononautical" },
    occurredAt: "2015-08-01T01:06:41Z",
  },
  {
    id: "chain-record-963853", sourceKey: "chain-record:963853", eventType: "stale race",
    actorWallet: null, bitmapHeight: 963853, sourceType: "block",
    sourceId: "000000000000000000000258f8107849bdd8b1866769633d29825e1aaffe542c", proofLevel: "CHAIN",
    title: "TWO BLOCKS, ONE HEIGHT",
    summary: "Chain: winning block mined by SpiderPool, 24 Aug 2026, 6,508 transactions. Context (via @mononautical / @0xB10C): SpiderPool also mined a competing stale block at this height.",
    metadata: { txCount: 6508, pool: "SpiderPool", source: "https://mempool.space/block/000000000000000000000258f8107849bdd8b1866769633d29825e1aaffe542c", attribution: "https://x.com/mononautical" },
    occurredAt: "2026-08-24T11:28:27Z",
  },
  {
    id: "chain-record-972161", sourceKey: "chain-record:972161", eventType: "mega district",
    actorWallet: null, bitmapHeight: 972161, sourceType: "block",
    sourceId: "0000000000000000000151b5a143aa6c2bf4e7b3a87f2815f4c6e6838e4e0edc", proofLevel: "CHAIN",
    title: "2026 MEGA-DISTRICT · 7,929 TX",
    summary: "Chain: 7,929 transactions, mined 19 Oct 2026. Context (via @mononautical): only 30 earlier blocks ever held more.",
    metadata: { txCount: 7929, source: "https://mempool.space/block/0000000000000000000151b5a143aa6c2bf4e7b3a87f2815f4c6e6838e4e0edc", attribution: "https://x.com/mononautical" },
    occurredAt: "2026-10-19T14:13:48Z",
  },
];
