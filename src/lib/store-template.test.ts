import { describe, expect, it } from "vitest";
import { buildStoreHtml, DEFAULT_STORE, storeQuery } from "./store-template";

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
});
