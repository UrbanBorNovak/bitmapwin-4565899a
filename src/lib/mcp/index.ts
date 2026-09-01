import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchBitmaps from "./tools/search-bitmaps";
import getBitmap from "./tools/get-bitmap";
import myBitmaps from "./tools/my-bitmaps";
import myBids from "./tools/my-bids";
import myBitBalance from "./tools/my-bit-balance";
import recentBuilds from "./tools/recent-builds";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "bitmap-unhinged",
  title: "Bitmap Unhinged",
  version: "0.1.0",
  instructions:
    "Tools for Bitmap Unhinged, a marketplace and explorer for Bitcoin Bitmap digital land. Use `search_bitmaps` and `get_bitmap` to explore the registry, `my_bitmaps`, `my_bids` and `my_bit_balance` for the signed-in holder's position, and `recent_builds` for what people are building on their bitmaps.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchBitmaps, getBitmap, myBitmaps, myBids, myBitBalance, recentBuilds],
});
