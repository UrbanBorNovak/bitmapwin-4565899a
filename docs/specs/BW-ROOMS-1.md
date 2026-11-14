# BW-ROOMS-1 — one public chat room per BITMAP

Status: draft v1 · Reference client: https://bitmapwin.app/bitchat

A BITMAP room is a public, ephemeral Nostr chat keyed by a Bitcoin block height.
It reuses BitChat's message shape (kind 20000, NIP-13 proof of work) so any
BitChat-style client can join by adding one filter.

## Message

| Field      | Value                                                        |
|------------|--------------------------------------------------------------|
| kind       | `20000` (ephemeral)                                          |
| tags       | `["b", "<height>"]` — decimal, no leading zeros, required     |
|            | `["n", "<nickname>"]` — optional, max 24 chars                |
|            | `["nonce", "<n>", "12"]` — NIP-13, at least 12 bits           |
| content    | plain text, max 500 chars                                     |

A message MUST NOT also carry a `g` (geohash) or `r` tag; clients drop events
that do, so BitChat location messages never leak into a room.

## Relays

Every client publishes to and reads from the same fixed set, so everyone in a
room sees the same messages regardless of where they are:

- wss://nos.lol
- wss://relay.primal.net
- wss://offchain.pub
- wss://nostr.mom
- wss://relay.nostr.net

Subscribe with `{ "kinds": [20000], "#b": ["<height>"], "since": now - 3600 }`.

## Identity

Clients SHOULD sign with a per-room key so a person is not linkable across
rooms: `sk = HMAC-SHA256(device_seed, "bitchat-geo:bitmap|<height>")`.
Display names are `nickname#<last 4 hex of pubkey>`.

## Holder proof (optional)

A holder may BIP-322-sign one delegation of the room's Nostr pubkey and attach it to
each message as `["proof", "<address>", "<signature>", "<issuedAt>", "<kind>?"]`.

- BITMAP holder (no kind): `bitmapwin.app BW-ROOMS-1: I hold <height>.bitmap at <address> and delegate room chat to nostr <pubkey>, issued <issuedAt>`
- Parcel holder (kind `parcel`): `bitmapwin.app BW-ROOMS-1: I hold parcels of <height>.bitmap at <address> and delegate room chat to nostr <pubkey>, issued <issuedAt>`

Readers show a badge only if the proof is under 24 hours old, the signature verifies
for that exact text, and the address holds right now the canonical BITMAP (landowner)
or at least one valid parcel `<index>.<height>.bitmap` child (first claim per index,
index below the block's tx count). Parcel numbers come from that live lookup, never
from the message. A failing proof shows as a plain visitor.

Readers MUST fail closed: if a custody source cannot be reached (holder lookup,
child scan, block tx count), the result is "unavailable" and no badge is shown,
never "holds nothing" and never a cached earlier answer. A partial child scan never
grants a parcel badge, because a missed earlier claim could invalidate it. Results
are re-checked after 5 minutes; an unavailable check may be retried with the same
signature.

## What this is not

- Joining or posting alone does not prove BITMAP ownership. Anyone can post in any room; only a holder proof (above) earns a badge.
- Messages are ephemeral; relays may drop them at any time. Nothing is stored by bitmapwin.app.
- The BitChat phone app does not support this format yet.
