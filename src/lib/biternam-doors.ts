/** Oasis landmarks that hold a walk-in Biternam interior. */
export type InteriorPath = "/biternam/cafe" | "/biternam/outpost" | "/biternam/museum" | "/biternam/safehouse" | "/biternam/arcade" | "/biternam/studio" | "/biternam/lab";

export const INTERIOR_DOORS: Record<string, { to: InteriorPath; label: string; color: string }> = {
  "bit-cafe": { to: "/biternam/cafe", label: "ENTER BIT-CAFÉ", color: "#f7931a" },
  "miner-rig-4": { to: "/biternam/outpost", label: "ENTER COOK OUTPOST", color: "#39ff88" },
  "bit-museum": { to: "/biternam/museum", label: "ENTER BIT MUSEUM", color: "#ffd23f" },
  "trading-post": { to: "/biternam/safehouse", label: "ENTER WIERDAMOTO'S SAFEHOUSE", color: "#c41e1e" },
  arena: { to: "/biternam/arcade", label: "ENTER MEMPOOL ARCADE", color: "#ff3df0" },
  "bitcoin-statue": { to: "/biternam/studio", label: "ENTER BITMAP NEWS STUDIO", color: "#ff4433" },
  "miner-rig-2": { to: "/biternam/lab", label: "ENTER BOPTIMIZATION LAB", color: "#28e0ff" },
};
