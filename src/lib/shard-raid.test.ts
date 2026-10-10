import { describe, expect, it } from "vitest";
import { pickShards, raidIdAt, RAID_BIT_REWARD, SHARDS_PER_RAID } from "./shard-raid";

describe("shard raids", () => {
  it("pays a fixed 150 BIT per completed raid", () => {
    expect(RAID_BIT_REWARD).toBe(150);
  });
  it("starts a new raid every hour", () => {
    expect(raidIdAt(3_600_000 * 5 + 10)).toBe(5);
    expect(raidIdAt(3_600_000 * 6)).toBe(6);
  });
  it("picks the same shards for everyone in one raid, only from inscribed BITMAPs", () => {
    const pool = [10, 20, 30, 40, 50, 60];
    const a = pickShards(42, pool);
    expect(a).toEqual(pickShards(42, [...pool].reverse()));
    expect(a).toHaveLength(SHARDS_PER_RAID);
    for (const h of a) expect(pool).toContain(h);
  });
});
