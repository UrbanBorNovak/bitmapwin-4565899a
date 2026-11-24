# BITMAPWIN L2 account bridge

This is a separate registration service, not a replacement for your working WebSocket bridge. It creates NEW accounts only. Existing accounts cannot be claimed or overwritten. One account per Bitcoin address and Passport. Wallet signing does not prove BITMAP ownership, grant territory rights, or enable rewards.

## Local setup (Windows PowerShell)

Download this folder's `bridge.mjs`, `protocol.mjs`, and `schema.sql` from bitmapwin.app after publishing. Keep all three in a new local folder, separate from your working L2 server.

```powershell
npm install mysql2 bip322-js
```

Back up the local login database first. Run `schema.sql` there. Confirm the existing `accounts` table has `login` and `password` columns and other required columns have defaults. All four tables must use InnoDB; the bridge refuses to start otherwise. Do not blindly convert an existing table without a backup. Create a dedicated localhost database user with only the permissions listed in `schema.sql`, never root.

Use secure prompts to set environment values in this PowerShell window (input is not echoed or saved to command history):

```powershell
$env:L2_DB_NAME = Read-Host 'Local L2 login database name'
$env:L2_DB_USER = Read-Host 'Dedicated local database user'
$env:L2_DB_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host 'Database password' -AsSecureString)).Password
$env:L2_ACCOUNT_BRIDGE_SECRET = [System.Net.NetworkCredential]::new('', (Read-Host 'Shared secret from the secure BITMAPWIN form' -AsSecureString)).Password
node .\bridge.mjs
```

The shared secret must have at least 32 characters. Use the secret form's Generate/Copy option, then paste it only into this secure prompt. Never send it in chat. The process keeps credentials in memory; do not print environment variables or put credentials in source files.

In a second PowerShell window:

```powershell
cloudflared tunnel --url http://127.0.0.1:8091
```

Save that tunnel's HTTPS origin as `L2_ACCOUNT_BRIDGE_URL` in project secrets and save the same shared secret as `L2_ACCOUNT_BRIDGE_SECRET`. Publish the app after saving. The earlier tunnel on port 8080 is for the web client and cannot substitute for this registration tunnel. Quick Tunnel URLs change when restarted; use a named tunnel for a stable deployment.

## Security and verification

- No port forwarding: keep 3306, 2106, 7777 and 8091 closed to internet access. The listener binds only to 127.0.0.1. It supplies no browser CORS access.
- The site requires a real Passport session and a fresh BIP-322 wallet proof. The local bridge verifies the proof again and atomically consumes a five-minute nonce with account creation.
- The browser computes L2's required Base64(SHA-1(password)) verifier. Neither service receives plaintext; the verifier is still sensitive and L2's legacy hash is NOT a modern password storage scheme. Use a unique game-only password.
- Register a fresh login from the site, confirm the local account and wallet link, and log into your real L2 server. Try duplicate login/wallet registration and a repeated nonce; no additional account may appear.
- The private wallet-link table is not a public API. Do not expose it, game accounts, or credentials. Live BITMAP ownership must be verified separately before future land or reward features use this link.
- Disable LoginServer auto-account creation for this deployment so users cannot bypass website registration. This does not prevent guessing existing passwords: keep LoginServer's flood protection enabled and consider tunnel-level access controls for tester-only operation.
- Prune expired challenge rows locally after one day. Never delete wallet links automatically. This setup still needs end-to-end testing on your machine; it is not a guarantee against all attacks.