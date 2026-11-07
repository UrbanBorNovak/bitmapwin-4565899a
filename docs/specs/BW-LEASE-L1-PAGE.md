# BW-LEASE-L1 — Lease page display draft

Status: DRAFT. Nothing here is built. The live `/leases` page (BIT leases) and all
mainnet code stay unchanged until this draft is approved and the browser-wallet
signet run passes.

Source rules: `src/lib/lease-tapscript.ts` (bond address, mutual / refund / penalty
paths) and `src/lib/lease-rent.ts` (prepaid rent chain, `rentReceipts`).

---

## 1. Where it lives

A second section on `/leases`, below the existing BIT sections, titled
**BITCOIN-LOCKED LEASES**, with a `SIGNET PREVIEW` tag until mainnet is approved.
Each lease opens a detail panel (same page, `?lease=<funding txid:vout>`).

BIT leases and Bitcoin-locked leases are never mixed in one list or one total:
BIT rent is an app ledger entry, Bitcoin rent is a confirmed transaction.

---

## 2. Detail panel layout (desktop)

```text
+--------------------------------------------------------------------------+
| 840,000.BITMAP  · BITCOIN-LOCKED LEASE · [ACTIVE]          SIGNET PREVIEW |
| LANDLORD bc1p…a9 · TENANT bc1p…7k · BOND bc1p…q3  [view on explorer]       |
+--------------------------------+-----------------------------------------+
| RENT SCHEDULE                  | REFUND DEADLINE                         |
|                                |                                         |
| #  STATUS     RENT     BLOCK   | NEXT RENT COLLECTABLE FROM  975,120     |
| 1  PAID       20,000   974,840 | TENANT REFUND OPENS AT      975,400     |
| 2  PAID       20,000   974,990 |   ~1d 22h (estimate, 10 min/block)      |
| 3  NEXT       20,000   ≥975,120| After 975,400 the tenant may take back  |
| 4  UPCOMING   20,000   ≥+130   | everything left. Whichever transaction  |
| 5  UPCOMING   20,000   ≥+130   | confirms first wins.                    |
|                                |                                         |
| PAID 40,000 / 100,000 SATS     | DEPOSIT 40,000 SATS · returns after the |
| [receipt txids link to chain]  | last period + refund lock               |
+--------------------------------+-----------------------------------------+
| WHAT BITCOIN ENFORCES          | WHAT YOU STILL TRUST                    |
| ✓ Rent already locked          | • Building rights come from the app     |
| ✓ One period per 130 blocks    | • Tenant cannot leave early alone       |
| ✓ Rent amounts cannot change   | • Landlord must collect on time         |
| ✓ Tenant refund after the lock | • Fees fixed at signing                 |
| ✓ Contradictions reveal key    | • Landlord checks before granting       |
+--------------------------------+-----------------------------------------+
| PENALTY PATH: no contradictory statement seen                            |
+--------------------------------------------------------------------------+
```

Mobile (narrow container): the four blocks stack in this order — status header,
refund deadline, rent schedule, trust panels. The schedule becomes a list of rows
(`#3 · NEXT · 20,000 SATS · FROM BLOCK 975,120`). The page uses container
queries, not viewport breakpoints, per AGENTS.md.

---

## 3. Rent schedule rows

Every row comes from the pre-signed chain (`rentChain`) plus what the chain says.

| Row status | Shown when | Block column |
|---|---|---|
| **PAID** | the period tx is confirmed (`rentReceipts`) | its confirmation height, linked txid |
| **PENDING** | the period tx is in the mempool, not confirmed | `IN MEMPOOL` — never counted as paid |
| **NEXT** | first unpaid period while the bond is still unspent | `≥ prevConf + periodBlocks` (exact) |
| **UPCOMING** | later unpaid periods | `≥ +periodBlocks after the previous` |
| **RETURNED** | unpaid periods after a tenant refund or mutual close | `—`, with the closing txid |

Honesty rules for the schedule:

- Rent dates are **not fixed calendar dates**. Each period can only start a set
  number of blocks after the previous one confirmed, so the schedule slides when
  the landlord collects late. Only the NEXT row gets an exact block number;
  later rows show a minimum gap, not a promised date.
- Time is shown as an estimate next to block numbers (`~1d 22h`), never alone.
- "Receipt" means the confirmed transaction itself. There is no signed note from
  the landlord and the page never shows one as proof.
- Totals: `PAID x / y SATS` counts only confirmed periods.

---

## 4. Refund deadline block

Two numbers, both relative to the current bond output's confirmation height
(`H` = height at which the latest bond output — funding or last paid period —
confirmed):

- **Next rent collectable from:** `H + periodBlocks`.
- **Tenant refund opens at:** `H + refundCsv`.

Wording by viewer (wallet connected and matching a lease key; otherwise neutral):

- Landlord: "Collect period 3 between block 975,120 and 975,399. From 975,400 the
  tenant may refund the rest — if both are broadcast, whichever confirms first wins."
- Tenant: "From block 975,400 you may take back 60,000 sats (3 unpaid periods +
  deposit) if the landlord has not collected by then."
- Visitor: both facts, no call to action.

After the last period: "Deposit 40,000 sats returns to the tenant from block X,
or earlier if both sign a close."

The deadline is **not** a hard cut-off for the landlord: the pre-signed rent tx
stays valid after the refund opens. The page must say "race", not "expired".

---

## 5. Lease states (header badge)

Derived from chain data only, in this order:

| Badge | Rule |
|---|---|
| AWAITING FUNDING | no confirmed output at the bond address for the agreed amount |
| VERIFYING | funded; landlord has not yet run `verifyRentBundle` (local check) |
| SIGNATURE PROBLEM | `verifyRentBundle` returned problems — list them, no building rights |
| ACTIVE | bond unspent, refund not yet open |
| REFUND OPEN | bond unspent, current height ≥ `H + refundCsv` |
| COMPLETE | all periods paid and deposit returned |
| CLOSED BY AGREEMENT | bond spent through the mutual path by a tx outside the rent chain |
| REFUNDED | bond spent through the refund path |
| PENALTY TAKEN | bond spent through the penalty path |

The spend path is read from the spending transaction's witness (which leaf script
and control block it reveals), not from app records. If the spending tx cannot be
fetched, the badge is `SPENT · PATH UNKNOWN`, never a guess.

---

## 6. Trust panels

Two side-by-side lists, always visible, never collapsed:

**What Bitcoin enforces** (each item links to the rule it comes from):
1. All rent for the lease is locked before the lease starts.
2. Each period can confirm only `periodBlocks` after the previous one.
3. The landlord cannot change amounts or destinations (tenant signatures).
4. The tenant can reclaim everything left after the refund lock.
5. Two contradictory signed statements reveal the penalty key.

**What you still trust:**
1. Building rights on the BITMAP are granted by the app; Bitcoin cannot check the
   land was usable.
2. The tenant cannot leave early alone; unpaid rent is released on schedule
   unless both sign a close.
3. The landlord must collect each period before the refund opens, or risk losing
   the rest of the schedule.
4. Fees are fixed when the tenant signs. Raising them if fees spike is not yet
   tested.
5. The landlord must check the tenant's signed payouts and the confirmed deposit
   before granting building rights.

**Not offered:** "pay as you go or lose your deposit". Bitcoin cannot tell an
unpaid rent from a refused signature, so the page never offers that option.

---

## 7. Data sources

- Bond address, leaf scripts, rent chain: rebuilt client-side from the agreed
  terms with `leaseAddress` + `rentChain` (pure, deterministic).
- Confirmations, outspends, current height: block explorer reads (mempool.space
  with existing fallbacks), batched per lease, respecting the existing back-off.
- Tenant pre-signatures: stored with the lease offer; they are public-safe
  (each only authorises its fixed payout).
- No private keys, signed landlord transactions or wallet secrets are stored or
  logged.
- Numbers are formatted with `toLocaleString("en-US")`.

---

## 8. Open before building

- Browser-wallet signing of the tenant bundle on public signet.
- Fee-spike handling (landlord bumping with their own output) — untested.
- Where tenant pre-signatures are stored and who may read them.
- Whether the landlord sees a "collect now" button (needs a landlord signature in
  the browser wallet) or collects through a separate flow.
