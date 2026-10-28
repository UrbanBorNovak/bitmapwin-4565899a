# BW-STAND-1 — Sovereign Grandstand

Status: Draft · Reference: `src/lib/sovereign-stand.ts`

A Grandstand is an **inscribed JSON config**. Its inscription id is the stand's identity, so anyone can deploy one and every site can re-check its seats.

## Config (inscription body)

```json
{
  "p": "BW-STAND-1",
  "name": "string",
  "range": [minHeight, maxHeight],
  "seats": 1000
}
```

## Claiming a seat

1. The wallet signs a BIP-322 message that names the stand id and a timestamp.
2. The server checks the signature and that the wallet **currently** holds a BITMAP inside `range`.
3. The seat is stored along with its signature. The signature is a public proof that anyone can verify again.

## Convention Badge

Tiers count the **distinct stands** a wallet holds seats in: 3, 5 and 10. Seats in the same stand don't add up.

## Why inscribed config

Inscription viewers block network access, so the inscription carries identity and rules. Live checks happen in any site that reads it.
