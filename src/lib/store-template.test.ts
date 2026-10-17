import { describe, expect, it } from "vitest";
import { buildStoreHtml, DEFAULT_FORM, DEFAULT_STORE, isFormDefault, storeFormFromSearch, storeQuery } from "./store-template";

describe("store template", () => {
  it("filters to one seller when a valid address is set", () => {
    const q = storeQuery({ ...DEFAULT_STORE, seller: "bc1pqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq" });
    expect(new URL(q).searchParams.get("seller")).toMatch(/^bc1p/);
  });
  it("ignores an invalid seller", () => {
    expect(new URL(storeQuery({ ...DEFAULT_STORE, seller: "x<script>" })).searchParams.get("seller")).toBeNull();
  });
  it("escapes the shop name", () => {
    expect(buildStoreHtml({ ...DEFAULT_STORE, name: "<b>x</b>" })).not.toContain("<b>x</b>");
  });
  it("loads every setting a share link carries", () => {
    const f = storeFormFromSearch("?name=ORANGE%20KEEP&accent=%23ff0000&sort=recent&from=100&to=200&max=0.5");
    expect(f.config.name).toBe("ORANGE KEEP");
    expect(f.config.accent).toBe("#ff0000");
    expect(f.config.sort).toBe("recent");
    expect(f.minH).toBe("100");
    expect(f.maxH).toBe("200");
    expect(f.maxBtc).toBe("0.5");
  });
  it("keeps defaults for missing or malformed share values", () => {
    const f = storeFormFromSearch("?accent=red&sort=sideways&from=12ab&name=");
    expect(f.config).toEqual(DEFAULT_STORE);
    expect(f.minH).toBe("12");
    expect(f.maxBtc).toBe("");
  });
  it("resetting gives the same form as an empty link", () => {
    expect(storeFormFromSearch("")).toEqual(DEFAULT_FORM);
    expect(DEFAULT_FORM).toEqual({ config: DEFAULT_STORE, minH: "", maxH: "", maxBtc: "" });
  });
  it("treats an untouched or empty-linked shop as at defaults", () => {
    expect(isFormDefault(DEFAULT_FORM)).toBe(true);
    expect(isFormDefault(storeFormFromSearch(""))).toBe(true);
  });
  it("treats a customized shop as not at defaults", () => {
    expect(isFormDefault({ ...DEFAULT_FORM, config: { ...DEFAULT_STORE, name: "ORANGE KEEP" } })).toBe(false);
    expect(isFormDefault({ ...DEFAULT_FORM, config: { ...DEFAULT_STORE, seller: "bc1pqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq" } })).toBe(false);
    expect(isFormDefault({ ...DEFAULT_FORM, minH: "100" })).toBe(false);
    expect(isFormDefault({ ...DEFAULT_FORM, maxH: "200" })).toBe(false);
    expect(isFormDefault({ ...DEFAULT_FORM, maxBtc: "0.5" })).toBe(false);
    expect(isFormDefault(storeFormFromSearch("?name=ORANGE%20KEEP"))).toBe(false);
  });
  it("ignores the API host when judging defaults", () => {
    expect(isFormDefault({ ...DEFAULT_FORM, config: { ...DEFAULT_STORE, apiBase: "http://localhost:8080" } })).toBe(true);
  });
});

describe("store inscription pack", () => {
  it("brotli round-trips byte-for-byte and stays small", async () => {
    const zlib = await import("zlib");
    const raw = Buffer.from(buildStoreHtml(DEFAULT_STORE), "utf8");
    const packed = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
    expect(zlib.brotliDecompressSync(packed).equals(raw)).toBe(true);
    expect(packed.length).toBeLessThan(raw.length);
  });
});
