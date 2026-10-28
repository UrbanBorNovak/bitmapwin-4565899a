# Contributing to BITMAPWIN

## Ground rules

1. **Only real on-chain data.** No mock data and no placeholder ownership.
2. **Never trust the browser** for rewards, access or ownership. Re-verify on the server.
3. **Say BITMAP**, not "parcel", in user-facing copy. A parcel is a child inscription.
4. **Keep shared scenes at 60 FPS.** Heavy geometry belongs in offline tools such as Forge export, never in shared worlds.
5. **Use design tokens only.** No hardcoded colors. Orange is for ownership and actions, cyan for live data.
6. Read the nearest `AGENTS.md` before changing a directory.

## Workflow

```bash
bun install
bun run dev        # http://localhost:8080
bunx vitest run    # tests
```

- Add a small test for any rule that involves prices, limits, permissions or proofs.
- Database changes go in `supabase/migrations/`, with row-level security and explicit grants.
- New protocols get a spec in `docs/specs/`.

## Security

Never commit keys, seeds or secrets. Report vulnerabilities privately via [X](https://x.com/bitmapwin).
