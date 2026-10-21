/** Live server checks with a random throwaway user id (no account). Rows are deleted; no BIT moves. */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { hideoutStepCount, recordHideoutStep } from "./hideout-progress.server";
import { HIDEOUT_STEPS } from "./hideout-progress";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const live = !!url && !!key;
const db = live ? createClient(url!, key!, { auth: { persistSession: false } }) : (null as never);
const user = crypto.randomUUID();
const started = new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!live)("hideout steps on the server (throwaway user)", () => {
  afterAll(async () => {
    const ledger = await db.from("coin_ledger").select("id", { count: "exact", head: true }).gte("created_at", started).ilike("ref", `%${user}%`);
    expect(ledger.count ?? 0).toBe(0);
    await db.from("biternam_quest_steps").delete().eq("user_id", user);
  });
  it("refuses a wrong key", async () => {
    expect((await recordHideoutStep(db, user, { room: "batcave", index: 1, key: HIDEOUT_STEPS.island[1] })).status).toBe("invalid");
  });
  it("refuses skipping straight to the solve step", async () => {
    expect((await recordHideoutStep(db, user, { room: "island", index: 1, key: HIDEOUT_STEPS.island[1] })).status).toBe("out_of_order");
    expect(await hideoutStepCount(db, user, "island")).toBe(0);
  });
  it("saves both batcave steps in order, once each", async () => {
    const s = HIDEOUT_STEPS.batcave;
    expect((await recordHideoutStep(db, user, { room: "batcave", index: 0, key: s[0] })).ok).toBe(true);
    expect((await recordHideoutStep(db, user, { room: "batcave", index: 0, key: s[0] })).status).toBe("already");
    await sleep(2200);
    expect((await recordHideoutStep(db, user, { room: "batcave", index: 1, key: s[1] })).ok).toBe(true);
    expect(await hideoutStepCount(db, user, "batcave")).toBe(2);
  }, 15000);
});
