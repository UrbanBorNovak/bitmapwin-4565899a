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

## What this is not

- Joining or posting does not prove BITMAP ownership. Anyone can post in any room.
- Messages are ephemeral; relays may drop them at any time. Nothing is stored by bitmapwin.app.
- The BitChat phone app does not support this format yet.
