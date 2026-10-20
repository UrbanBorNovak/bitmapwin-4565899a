import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGISTRY_MODELS } from "@/lib/model-registry";

const inserted: unknown[] = [];
const state = { holder: "bc1pholder", parcels: [] as { index: number; inscriptionId: string; ownerAddress: string | null }[], addresses: ["bc1pholder"] };

vi.mock("../addresses", async (orig) => ({ ...(await orig<typeof import("../addresses")>()), myAddresses: async () => state.addresses }));
vi.mock("@/lib/locate-bitmap.server", () => ({ locateBitmapHolder: async () => ({ ownerAddress: state.holder }) }));
vi.mock("@/lib/parcel-fief.server", () => ({ parcelHoldersFor: async () => ({ parcels: state.parcels }) }));
vi.mock("@/lib/block-bytes.server", () => ({ buildBlockBytes: async () => ({ bytes: new Uint8Array([1, 8]), txCount: 2, covered: 2 }) }));
vi.mock("@/lib/forge.server", () => ({ forgeBuildForHeight: async () => null, forgeLandFor: async () => ({ parcels: [], html: [], rejected: [] }) }));
vi.mock("../supabase", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) chain[m] = () => chain;
  chain["maybeSingle"] = async () => ({ data: null, error: null });
  chain["insert"] = (row: unknown) => { inserted.push(row); return { select: () => ({ single: async () => ({ data: { id: "p1", status: "pending" }, error: null }) }) }; };
  Object.assign(chain, { then: (r: (v: unknown) => void) => r({ data: [], error: null }) });
  return { supabaseForUser: () => ({ from: () => chain }) };
});

import submit from "./submit-build-proposal";
import boundaries from "./get-parcel-boundaries";
import inspect from "./inspect-build";
import mine from "./my-build-proposals";

type Res = { isError?: boolean; content: { text: string }[]; structuredContent?: Record<string, unknown> };
const ctx = (auth = true) => ({ isAuthenticated: () => auth, getUserId: () => "u1", getToken: () => "t" });
const call = (tool: unknown, input: unknown, c = ctx()) => (tool as { handler: (i: unknown, c: unknown) => Promise<Res> }).handler(input, c);

beforeEach(() => { inserted.length = 0; state.holder = "bc1pholder"; state.parcels = []; state.addresses = ["bc1pholder"]; });

describe("MCP build tools", () => {
  it("all four refuse unauthenticated callers", async () => {
    for (const t of [submit, boundaries, inspect, mine]) expect((await call(t, { height: 1, blocks: [] }, ctx(false))).isError).toBe(true);
  });

  it("refuses a proposal from a wallet that holds nothing", async () => {
    state.holder = "bc1pstranger";
    const r = await call(submit, { height: 1, blocks: [[0, 0, 0, "stone"]] });
    expect(r.isError).toBe(true);
    expect(inserted).toHaveLength(0);
  });

  it("drops out-of-bounds blocks and saves only the rest", async () => {
    const r = await call(submit, { height: 1, blocks: [[70, 0, 0, "stone"], [0, -1, 0, "stone"], [1, 0, 1, "stone"]] });
    expect(r.isError).toBeUndefined();
    expect((r.structuredContent!["dropped"] as { outOfBounds: number }).outOfBounds).toBe(2);
    expect((inserted[0] as { block_count: number }).block_count).toBe(1);
  });

  it("refuses unregistered models and accepts registered ones", async () => {
    expect((await call(submit, { height: 1, blocks: [], modelInscriptionId: "deadbeefi0" })).isError).toBe(true);
    expect((await call(submit, { height: 1, blocks: [], modelInscriptionId: REGISTRY_MODELS[0]!.inscription })).isError).toBeUndefined();
  });

  it("a parcel holder cannot claim the BITMAP holder's whole canvas or another parcel", async () => {
    state.holder = "bc1pother";
    state.parcels = [{ index: 0, inscriptionId: "x", ownerAddress: "bc1pholder" }];
    expect((await call(submit, { height: 1, parcelIndex: 1, blocks: [[0, 0, 0, "stone"]] })).isError).toBe(true);
    const { parcelRects } = await import("@/lib/forge-parcels");
    const [own, other] = parcelRects([1, 8]).map((p) => [...p.cells][0]!);
    const r = await call(submit, { height: 1, parcelIndex: 0, blocks: [[Math.floor(own! / 64), 0, own! % 64, "stone"], [Math.floor(other! / 64), 0, other! % 64, "stone"]] });
    expect(r.isError).toBeUndefined();
    expect((inserted[0] as { block_count: number; role: string }).role).toBe("parcel");
    expect((r.structuredContent!["dropped"] as { notYourGround: number }).notYourGround).toBeGreaterThan(0);
  });

  it("the BITMAP holder cannot pass a parcel index they don't hold", async () => {
    expect((await call(submit, { height: 1, parcelIndex: 0, blocks: [[0, 0, 0, "stone"]] })).isError).toBe(true);
  });

  it("boundaries and inspect return structured results", async () => {
    expect(((await call(boundaries, { height: 1 })).structuredContent!["parcels"] as unknown[]).length).toBe(2);
    expect((await call(inspect, { height: 1 })).structuredContent!["districtBuild"]).toBeNull();
  });

  it("accepts a .bwvx payload at absolute positions", async () => {
    const { exportBwvxBytes } = await import("@/lib/bwvx-export");
    const bytes = exportBwvxBytes([{ dx: 5, dy: 0, dz: 7, k: "stone" }, { dx: 6, dy: 0, dz: 7, k: "stone" }], 64);
    let bin = ""; for (const v of bytes) bin += String.fromCharCode(v);
    const r = await call(submit, { height: 1, bwvxBase64: btoa(bin) });
    expect(r.isError).toBeUndefined();
    expect((inserted[0] as { blocks: number[][] }).blocks).toEqual([[5, 0, 7, "stone"], [6, 0, 7, "stone"]]);
  });

  it("refuses a malformed .bwvx payload", async () => {
    expect((await call(submit, { height: 1, bwvxBase64: "AAAA" })).isError).toBe(true);
    expect(inserted).toHaveLength(0);
  });
});
