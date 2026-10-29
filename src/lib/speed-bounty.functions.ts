import { createServerFn } from "@tanstack/react-start";
import { DP_BATCH_MAX, POOL_HERD, TEST_BOUNTY_BITS, keyFromCollision, poolParams, validDp } from "@/lib/kangaroo-pool";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Latest bounty; creates the unfunded test bounty if none exists. The key is born and discarded here. */
async function currentBounty() {
  const db = await admin();
  const { data } = await db.from("speed_bounties").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (data) return data;
  const { G } = await import("@/lib/kangaroo");
  const { lo, hi, jumps, dpBits } = poolParams(TEST_BOUNTY_BITS);
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  let r = 0n; for (const x of b) r = (r << 8n) | BigInt(x);
  const k = lo + (r % (hi - lo));
  const pub = G.multiply(k).toHex(true);
  const { data: row, error } = await db.from("speed_bounties").insert({
    label: `TEST · ${TEST_BOUNTY_BITS}-BIT · UNFUNDED`, pub_hex: pub, lo_hex: lo.toString(16), hi_hex: hi.toString(16),
    jumps, dp_bits: dpBits, herd: POOL_HERD, seed: crypto.randomUUID(), funded: false,
  }).select("*").single();
  if (error) throw new Error("Could not open bounty");
  return row;
}

type BountyRow = Awaited<ReturnType<typeof currentBounty>>;
const publicBounty = (b: BountyRow) => ({
  id: b.id, label: b.label, pubHex: b.pub_hex, loHex: b.lo_hex, hiHex: b.hi_hex, jumps: b.jumps, dpBits: b.dp_bits,
  herd: b.herd, funded: b.funded, status: b.status, solvedKeyHex: b.solved_key_hex, winnerName: b.winner_name, solvedAt: b.solved_at,
});

export const speedBountyStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const b = await currentBounty();
  const { data: s } = await db.from("speed_bounty_sessions").select("name, steps, dps, last_seen").eq("bounty_id", b.id).order("dps", { ascending: false }).limit(200);
  const per = new Map<string, { name: string; dps: number; steps: number; live: boolean }>();
  const live = Date.now() - 60_000;
  for (const r of s ?? []) {
    const e = per.get(r.name) ?? { name: r.name, dps: 0, steps: 0, live: false };
    e.dps += r.dps; e.steps += Number(r.steps); e.live ||= new Date(r.last_seen).getTime() > live;
    per.set(r.name, e);
  }
  const board = [...per.values()].sort((a, b) => b.dps - a.dps).slice(0, 15);
  const { count } = await db.from("speed_bounty_dps").select("x_hex", { count: "exact", head: true }).eq("bounty_id", b.id);
  return { bounty: publicBounty(b), board, totalDps: count ?? 0, totalSteps: board.reduce((a, r) => a + r.steps, 0), hunters: board.filter((r) => r.live).length };
});

/** Join: server assigns the next session number, which fixes this hunter's starting offsets. */
export const joinSpeedBountyFn = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string }) => {
    const name = String(d?.name ?? "").trim().replace(/[^\w .#-]/g, "").slice(0, 20);
    if (name.length < 2) throw new Error("Pick a hunter name (2–20 letters)");
    return { name };
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const b = await currentBounty();
    if (b.status !== "open") return { ok: false as const, error: "This bounty is already solved." };
    for (let i = 0; i < 6; i++) {
      const { count } = await db.from("speed_bounty_sessions").select("id", { count: "exact", head: true }).eq("bounty_id", b.id);
      const seq = (count ?? 0) + i;
      const { data: row, error } = await db.from("speed_bounty_sessions").insert({ bounty_id: b.id, seq, name: data.name }).select("id, seq").single();
      if (!error && row) {
        const { startsFor } = await import("@/lib/kangaroo-pool");
        const starts = startsFor(b.seed, row.seq, b.herd, BigInt("0x" + b.lo_hex), BigInt("0x" + b.hi_hex))
          .map((s) => ({ tame: s.tame, dHex: s.d.toString(16) }));
        return { ok: true as const, session: row.id, seq: row.seq, bounty: publicBounty(b), starts };
      }
    }
    return { ok: false as const, error: "Pool busy, try again." };
  });

/** Submit distinguished points. Each is recomputed on the server; a tame/wild meeting is checked against the key. */
export const submitDpsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { session: string; steps: number; dps: { xHex: string; tame: boolean; dHex: string }[] }) => ({
    session: String(d.session),
    steps: Math.max(0, Math.min(Number(d.steps) || 0, 1e12)),
    dps: (Array.isArray(d.dps) ? d.dps : []).slice(0, DP_BATCH_MAX).map((p) => ({
      xHex: String(p.xHex).toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 64), tame: !!p.tame,
      dHex: String(p.dHex).toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 64),
    })),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: s } = await db.from("speed_bounty_sessions").select("id, bounty_id, name, dps").eq("id", data.session).maybeSingle();
    if (!s) return { ok: false as const, error: "Unknown session" };
    const { data: b } = await db.from("speed_bounties").select("*").eq("id", s.bounty_id).single();
    if (!b) return { ok: false as const, error: "Unknown bounty" };
    if (b.status !== "open") return { ok: true as const, accepted: 0, rejected: 0, solved: true, winnerName: b.winner_name };
    const lo = BigInt("0x" + b.lo_hex), hi = BigInt("0x" + b.hi_hex);
    let accepted = 0, rejected = 0;
    for (const dp of data.dps) {
      if (!validDp(b.pub_hex, dp, b.dp_bits, lo, hi)) { rejected++; continue; }
      const { data: other } = await db.from("speed_bounty_dps").select("dist_hex, session_id")
        .eq("bounty_id", b.id).eq("x_hex", dp.xHex).eq("tame", !dp.tame).maybeSingle();
      const { error } = await db.from("speed_bounty_dps").insert({ bounty_id: b.id, x_hex: dp.xHex, tame: dp.tame, dist_hex: dp.dHex, session_id: s.id });
      if (!error) accepted++;
      if (!other) continue;
      const tameD = BigInt("0x" + (dp.tame ? dp.dHex : other.dist_hex));
      const wildD = BigInt("0x" + (dp.tame ? other.dist_hex : dp.dHex));
      const k = keyFromCollision(b.pub_hex, tameD, wildD);
      if (k === null) continue;
      // Winner = the hunter whose DP closed the trap. Only flips an open bounty.
      const { data: won } = await db.from("speed_bounties").update({
        status: "solved", solved_key_hex: k.toString(16), winner_name: s.name, winner_session: s.id, solved_at: new Date().toISOString(),
      }).eq("id", b.id).eq("status", "open").select("winner_name").maybeSingle();
      await db.from("speed_bounty_sessions").update({ dps: s.dps + accepted, steps: data.steps, last_seen: new Date().toISOString() }).eq("id", s.id);
      return { ok: true as const, accepted, rejected, solved: true, winnerName: won?.winner_name ?? s.name };
    }
    await db.from("speed_bounty_sessions").update({ dps: s.dps + accepted, steps: data.steps, last_seen: new Date().toISOString() }).eq("id", s.id);
    return { ok: true as const, accepted, rejected, solved: false, winnerName: null };
  });
