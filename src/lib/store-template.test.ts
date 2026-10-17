import { describe, expect, it } from "vitest";
import { buildStoreHtml, DEFAULT_FORM, DEFAULT_STORE, storeFormFromSearch, storeQuery } from "./store-template";

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
});
