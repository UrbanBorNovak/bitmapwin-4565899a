import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchBitmaps from "./tools/search-bitmaps";
import getBitmap from "./tools/get-bitmap";
import myBitmaps from "./tools/my-bitmaps";
import myBids from "./tools/my-bids";
import myBitBalance from "./tools/my-bit-balance";
import recentBuilds from "./tools/recent-builds";
import getBitmapActivity from "./tools/get-bitmap-activity";
import getPortfolioActivity from "./tools/get-portfolio-activity";
import watchBitmap from "./tools/watch-bitmap";
import myWatchlist from "./tools/my-watchlist";
import getParcelBoundaries from "./tools/get-parcel-boundaries";
import inspectBuild from "./tools/inspect-build";
import submitBuildProposal from "./tools/submit-build-proposal";
import myBuildProposals from "./tools/my-build-proposals";
import getLeaseStatus from "./tools/get-lease-status";
import getFloorPrices from "./tools/get-floor-prices";
import discoverOpenParcels from "./tools/discover-open-parcels";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "bitmap-unhinged",
  title: "Bitmap Unhinged",
  version: "0.1.0",
  instructions:
    "Tools for Bitmap Unhinged, a marketplace and explorer for Bitcoin Bitmap digital land. Use `search_bitmaps` and `get_bitmap` to explore the registry, `my_bitmaps`, `my_bids` and `my_bit_balance` for the signed-in holder's position, and `recent_builds` for what people are building on their bitmaps, `get_bitmap_activity` for the full event timeline of a single bitmap (visits, bids, trades, build updates, leases, chat, BIT events), `get_portfolio_activity` for one aggregated stream across every bitmap the holder owns or watches (with an attention list), and `watch_bitmap` / `my_watchlist` to manage which bitmaps are being watched. For building: `get_parcel_boundaries` derives tile rights from the block, `inspect_build` shows what is already built, and `submit_build_proposal` saves a build suggestion (live ownership checked, clipped to the holder's own ground, never inscribed or signed) listed by `my_build_proposals` (accepts voxel tuples or a base64 .bwvx payload). `discover_open_parcels` finds unbuilt parcel tiles with live holders, `get_lease_status` shows who may build during a lease, and `get_floor_prices` lists the cheapest real open listings; buying always needs the holder's own wallet signature. Schemas: /api/public/agent-schema. Behave like a property manager: surface what needs attention first.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchBitmaps, getBitmap, myBitmaps, myBids, myBitBalance, recentBuilds, getBitmapActivity, getPortfolioActivity, watchBitmap, myWatchlist, getParcelBoundaries, inspectBuild, submitBuildProposal, myBuildProposals, getLeaseStatus, getFloorPrices, discoverOpenParcels] as unknown as Parameters<typeof defineMcp>[0]["tools"],
});
