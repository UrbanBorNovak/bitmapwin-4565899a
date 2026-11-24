import { describe, expect, it } from "vitest";
import { Signer } from "bip322-js";
import { accountDraftSchema, accountMessage, legacyPasswordHash, passwordCommitment } from "./l2-account";
// The downloadable bridge and site must agree byte-for-byte on the signed contract.
// @ts-expect-error Standalone downloadable Node module has no TypeScript declarations.
import { accountMessage as bridgeMessage, verifyProof, authorized } from "../../../public/tools/l2-account-bridge/protocol.mjs";

describe("L2 registration proof", () => {
  it("accepts 3–14 lowercase alphanumeric logins and rejects bypass-shaped names", () => {
    const base = { address: "bc1q" + "a".repeat(38), passwordCommitment: "a".repeat(64) };
    expect(accountDraftSchema.safeParse({ ...base, login: "abc" }).success).toBe(true);
    expect(accountDraftSchema.safeParse({ ...base, login: "a".repeat(14) }).success).toBe(true);
    for (const login of ["ab", "a".repeat(15), "bob';--", "../bob", "Bob"]) expect(accountDraftSchema.safeParse({ ...base, login }).success).toBe(false);
  });
  it("uses the required legacy L2 password verifier", async () => {
    expect(await legacyPasswordHash("password")).toBe("W6ph5Mm5Pz8GgiULbPgzG37mj9g=");
  });
  it("binds real BIP-322 proof to wallet, login, verifier and five-minute expiry", async () => {
    const wif = "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn"; // Public test vector key 1, never funded.
    const address = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
    const passwordHash = await legacyPasswordHash("test-only-password");
    const draft = { login: "tester", address, passwordHash, passwordCommitment: await passwordCommitment(passwordHash), nonce: "12345678-1234-4234-8234-123456789012", userId: "12345678-1234-4234-8234-123456789013", expiresAt: 1_000_300_000 };
    expect(bridgeMessage(draft)).toBe(accountMessage(draft));
    const proof = { ...draft, signature: Signer.sign(wif, address, accountMessage(draft)) };
    expect(verifyProof(proof, 1_000_000_000)).toBe(true);
    expect(verifyProof({ ...proof, login: "attacker" }, 1_000_000_000)).toBe(false);
    expect(verifyProof({ ...proof, passwordHash: await legacyPasswordHash("different") }, 1_000_000_000)).toBe(false);
    expect(verifyProof(proof, draft.expiresAt)).toBe(false);
    expect(verifyProof(proof, 999_999_999)).toBe(false);
  });
  it("requires the exact private bearer secret", () => {
    const testSecret = "test-vector-not-a-real-secret-123456789";
    expect(authorized(`Bearer ${testSecret}`, testSecret)).toBe(true);
    expect(authorized("Bearer wrong", testSecret)).toBe(false);
    expect(authorized(undefined, testSecret)).toBe(false);
  });
});