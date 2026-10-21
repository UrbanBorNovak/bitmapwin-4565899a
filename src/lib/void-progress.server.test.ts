/**
 * Live server checks against the real database, using random throwaway user ids
 * that belong to no account. Any rows they create are deleted afterwards, no BIT
 * claim is ever made, and the BIT ledger is checked to be untouched.
 */
import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { recordVoidStep } from "./void-progress.server";
import { VOID_QUEST_ID, VOID_STEPS, voidStateFromCount } from "./void-progress";
import { HEIST_QUEST_ID, HEIST_STEPS, heistStepKey } from "./void-heist";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const live = !!url && !!key;
const db = live ? createClient(url!, key!, { auth: { persistSession: false } }) : (null as never);
const locked = crypto.randomUUID(); // never finishes the Heist
const runner = crypto.randomUUID(); // finished Heist, plays the Void
const users = [locked, runner];
const started = new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const rows = async (user: string, quest: string) => {
  const { count, error } = await db.from("biternam_quest_steps").select("step_index", { count: "exact", head: true }).eq("user_id", user).eq("quest_id", quest);
  if (error) throw error;
  return count ?? 0;
};

describe.skipIf(!live)("void steps on the server (throwaway users)", () => {
  beforeAll(async () => {
    // Seed a finished Heist for the runner only, dated an hour back so pacing never interferes.
    const at = new Date(Date.now() - 3600_000).toISOString();
    const { error } = await db.from("biternam_quest_steps").insert(HEIST_STEPS.map((s, i) => ({ user_id: runner, quest_id: HEIST_QUEST_ID, step_index: i, step_key: heistStepKey(s), created_at: at })));
    if (error) throw error;
  });

  afterAll(async () => {
    if (!live) return;
    const claims = await db.from("biternam_quest_claims").select("*", { count: "exact", head: true }).in("user_id", users);
    expect(claims.count ?? 0).toBe(0);
    // No BIT moved for the Void or these users while the tests ran.
    const ledger = await db.from("coin_ledger").select("id", { count: "exact", head: true }).gte("created_at", started).or(`ref.ilike.%${runner}%,ref.ilike.%${locked}%,ref.ilike.%${VOID_QUEST_ID}:%`);
    expect(ledger.error).toBeNull();
    expect(ledger.count ?? 0).toBe(0);
    await db.from("biternam_quest_steps").delete().in("user_id", users);
    expect(await rows(runner, VOID_QUEST_ID)).toBe(0);
  });

  it("refuses any Void step before the Heist is finished and saves nothing", async () => {
    for (let i = 0; i < VOID_STEPS.length; i++) {
      expect(await recordVoidStep(db, locked, { index: i, key: VOID_STEPS[i]! })).toEqual({ ok: false, status: "locked" });
    }
    expect(await rows(locked, VOID_QUEST_ID)).toBe(0);
  });

  it("refuses a wrong step key", async () => {
    expect((await recordVoidStep(db, runner, { index: 1, key: VOID_STEPS[0] })).status).toBe("invalid");
  });

  it("refuses skipped steps and saves nothing", async () => {
    for (const i of [1, 2]) expect((await recordVoidStep(db, runner, { index: i, key: VOID_STEPS[i]! })).status).toBe("out_of_order");
    expect(await rows(runner, VOID_QUEST_ID)).toBe(0);
  });

  it("saves the ghost step, and a repeat is 'already' without a second row", async () => {
    expect(await recordVoidStep(db, runner, { index: 0, key: VOID_STEPS[0] })).toEqual({ ok: true, status: "ok" });
    expect(await recordVoidStep(db, runner, { index: 0, key: VOID_STEPS[0] })).toEqual({ ok: true, status: "already" });
    expect(await rows(runner, VOID_QUEST_ID)).toBe(1);
  });

  it("rejects a next step sent too fast", async () => {
    expect((await recordVoidStep(db, runner, { index: 1, key: VOID_STEPS[1] })).status).toBe("too_fast");
    expect(await rows(runner, VOID_QUEST_ID)).toBe(1);
  });

  it("simultaneous submissions of the same step save it exactly once", async () => {
    await sleep(2200);
    const results = await Promise.all(Array.from({ length: 6 }, () => recordVoidStep(db, runner, { index: 1, key: VOID_STEPS[1] })));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(1);
    expect(results.every((r) => r.status === "ok" || r.status === "already")).toBe(true);
    expect(await rows(runner, VOID_QUEST_ID)).toBe(2);
  });

  it("completes the Void and reads back as confirmed", async () => {
    await sleep(2200);
    expect((await recordVoidStep(db, runner, { index: 2, key: VOID_STEPS[2] })).status).toBe("ok");
    const n = await rows(runner, VOID_QUEST_ID);
    expect(n).toBe(3);
    expect(voidStateFromCount(n)).toEqual({ heard: true, hasBlock: false, confirmed: true });
  });
}, 30_000);
