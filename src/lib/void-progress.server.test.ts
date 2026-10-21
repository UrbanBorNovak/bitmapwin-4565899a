/**
 * Live server checks against the real database, using a random throwaway user id
 * that belongs to no account. Every attempt is a refusal, so no rows are written
 * and no BIT claim is ever touched.
 */
import { describe, expect, it, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { recordVoidStep } from "./void-progress.server";
import { VOID_QUEST_ID, VOID_STEPS } from "./void-progress";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const live = !!url && !!key;
const db = live ? createClient(url!, key!, { auth: { persistSession: false } }) : (null as never);
const ghost = crypto.randomUUID();

const rows = async (quest: string) => {
  const { count, error } = await db.from("biternam_quest_steps").select("step_index", { count: "exact", head: true }).eq("user_id", ghost).eq("quest_id", quest);
  if (error) throw error;
  return count ?? 0;
};
const claims = async () => {
  const { count, error } = await db.from("biternam_quest_claims").select("*", { count: "exact", head: true }).eq("user_id", ghost);
  if (error) throw error;
  return count ?? 0;
};

describe.skipIf(!live)("void steps on the server (throwaway user)", () => {
  it("refuses any Void step before the Heist is finished and saves nothing", async () => {
    for (let i = 0; i < VOID_STEPS.length; i++) {
      expect(await recordVoidStep(db, ghost, { index: i, key: VOID_STEPS[i]! })).toEqual({ ok: false, status: "locked" });
    }
    expect(await rows(VOID_QUEST_ID)).toBe(0);
  });

  it("refuses a wrong step key", async () => {
    expect((await recordVoidStep(db, ghost, { index: 1, key: VOID_STEPS[0] })).status).toBe("invalid");
  });

  it("database refuses skipped steps (block or confirm before the ghost) and saves nothing", async () => {
    for (const i of [1, 2]) {
      const { data, error } = await db.rpc("biternam_record_step", { _user: ghost, _quest: VOID_QUEST_ID, _index: i, _key: VOID_STEPS[i] });
      expect(error).toBeNull();
      expect(data).toBe("out_of_order");
    }
    expect(await rows(VOID_QUEST_ID)).toBe(0);
  });

  afterAll(async () => {
    if (!live) return;
    expect(await claims()).toBe(0);
  });
});
