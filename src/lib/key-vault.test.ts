import { describe, it, expect, beforeEach } from "vitest";
const store = new Map<string, string>();
(globalThis as any).window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } };
const v = await import("./key-vault");
const KEY = "a".repeat(63) + "1";
describe("key vault", () => {
  beforeEach(() => store.clear());
  it("seals without the passphrase and opens only with it", async () => {
    await v.setupVault("correct horse battery");
    expect(await v.sealFoundKey(KEY)).toBe(true);
    expect([...store.values()].join()).not.toContain(KEY);
    expect(await v.openSealed("correct horse battery")).toEqual([KEY]);
    await expect(v.openSealed("wrong passphrase!!")).rejects.toThrow("Wrong passphrase");
  }, 30000);
  it("does not seal without a vault", async () => { expect(await v.sealFoundKey(KEY)).toBe(false); });
  it("deletes only with the typed phrase", async () => {
    await v.setupVault("correct horse battery"); await v.sealFoundKey(KEY);
    expect(v.deleteSealed("yes")).toBe(false); expect(v.listSealed().length).toBe(1);
    expect(v.deleteSealed("DELETE MY BACKUP")).toBe(true); expect(v.listSealed().length).toBe(0);
  }, 30000);
  it("backup file restores on a fresh device", async () => {
    await v.setupVault("correct horse battery"); await v.sealFoundKey(KEY);
    const text = v.encryptedBackupText()!; store.clear();
    v.importBackupText(text);
    expect(await v.openSealed("correct horse battery")).toEqual([KEY]);
  }, 30000);
});
