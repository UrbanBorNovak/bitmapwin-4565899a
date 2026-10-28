/**
 * RGB capability probe. Reads only what the user's own wallet extension exposes;
 * nothing is stored or sent to the server. RGB state is client-side validated,
 * so we can never know another wallet's RGB holdings — only the visitor's own.
 */
export type RgbStatus = "ready" | "unsupported" | "no-wallet";

const RGB_METHODS = ["getRgbAssets", "rgbGetAssets", "getRgbBalance", "sendRgb", "rgbTransfer"];

export function probeRgb(): RgbStatus {
  if (typeof window === "undefined") return "no-wallet";
  const w = window as unknown as { unisat?: Record<string, unknown> & { rgb?: unknown } };
  const u = w.unisat;
  if (!u) return "no-wallet";
  if (u.rgb && typeof u.rgb === "object") return "ready";
  return RGB_METHODS.some((m) => typeof u[m] === "function") ? "ready" : "unsupported";
}

export const RGB_LABEL: Record<RgbStatus, string> = {
  ready: "RGB READY",
  unsupported: "RGB NOT YET IN WALLET",
  "no-wallet": "NO RGB WALLET",
};
