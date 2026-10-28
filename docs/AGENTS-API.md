# Agent & Public API

## Agent schema

`GET /api/public/agent-schema` returns a static `bitmapwin.agent/1` JSON Schema. It holds no data and accepts no writes.

## MCP

External agents can read BITMAPs, builds, floors and parcel bounds. A build proposal (voxel tuples or absolute-position `.bwvx`) lands only in the signed-in holder's own queue. There are never writes across accounts.

## Trading API

`/api/public/market/*`

- Reads are public.
- Every write must be proven by a seller PSBT, a BIP-322 signature, or a buyer-signed PSBT.
- Signatures carry a timestamp and are single-use. Rate limits are enforced in the database.
- Checkout holds are capped per buyer and can't be released through the API.

Bots and players trade under the same rules.
