;; BW-STACKS-1 - BitmapWin soft-stake vault (DRAFT - not deployed, not audited)
;; BITMAPs stay on Bitcoin L1. An oracle key attests live custody; rewards accrue
;; per weight only from sBTC actually deposited through `fund`.
;;
;; Key roles (see docs/specs/BW-STACKS-1-ORACLE.md):
;;   admin   - hardware-wallet multisig. Schedules/rotates/revokes keys, unpauses.
;;   pausers - can only pause. A stolen pauser key causes downtime, never loss.
;;   oracle  - per-epoch secp256k1 key. Can only sign custody attestations.

(define-constant SELF (as-contract tx-sender))
(define-constant SCALE u1000000000000)
(define-constant TTL u144)          ;; attestation lifetime, burn blocks (~1 day)
(define-constant SUBMIT-WINDOW u6)  ;; attestation must land within 6 blocks of issue
(define-constant ROTATE-DELAY u144) ;; scheduled key starts ~1 day after scheduling
(define-constant OVERLAP u144)      ;; previous key stays valid ~1 day after that
(define-constant MAX-WEIGHT u2922)  ;; (1 + 1460 days) x grade 10 / 5
(define-constant NEVER u340282366920938463463374607431768211455)

(define-constant ERR-AUTH (err u401))
(define-constant ERR-SIG (err u402))
(define-constant ERR-PAUSED (err u403))
(define-constant ERR-NONE (err u404))
(define-constant ERR-STALE (err u406))
(define-constant ERR-KEY (err u407))
(define-constant ERR-WEIGHT (err u408))
(define-constant ERR-RATE (err u409))
(define-constant ERR-STATE (err u410))
(define-constant ERR-CAP (err u411))

(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var epoch uint u0)          ;; newest key epoch, 0 = none yet
(define-data-var rate-cap uint u20000)   ;; max new weight per burn block
(define-data-var total-weight uint u0)
(define-data-var acc uint u0)            ;; sBTC sats per weight x SCALE
(define-data-var stranded uint u0)       ;; recycled while nobody was staked

;; Funding: only the treasury multisig, within caps. All caps start at 0 = funding off.
(define-data-var funder principal tx-sender)
(define-data-var cap-call uint u0)
(define-data-var cap-period uint u0)
(define-data-var cap-pool uint u0)         ;; max reward-pool balance right after a `fund`
(define-data-var fund-period uint u144)    ;; reward-period length, burn blocks (configurable)
(define-data-var funded-total uint u0)     ;; counts only `fund`, never unsolicited transfers
(define-data-var pool-held uint u0)        ;; funded and not yet paid out; unsolicited transfers excluded
(define-map funded-in uint uint)           ;; period index -> funded that period

(define-map pausers principal bool)
;; revoked-from: stakes attested at or after this burn height under this key are void.
(define-map keys uint { key: (buff 33), from: uint, until: uint, revoked-from: uint })
(define-map added uint uint)             ;; burn height -> weight added that block
(define-map stakes uint
  { owner: principal, weight: uint, debt: uint, expires: uint, epoch: uint, at: uint })

;; ---------- reads ----------
(define-read-only (pending (h uint))
  (match (map-get? stakes h) s
    (/ (- (* (get weight s) (var-get acc)) (get debt s)) SCALE)
    u0))

(define-read-only (key-usable (e uint))
  (match (map-get? keys e) k
    (and (>= burn-block-height (get from k))
         (<= burn-block-height (get until k))
         (< burn-block-height (get revoked-from k)))
    false))

(define-read-only (attestation-hash (e uint) (h uint) (owner principal) (weight uint) (issued uint))
  (sha256 (unwrap-panic (to-consensus-buff?
    { domain: "BW-STACKS-1", contract: SELF, chain: chain-id,
      epoch: e, height: h, owner: owner, weight: weight, issued: issued }))))

(define-read-only (stake-void (s { owner: principal, weight: uint, debt: uint, expires: uint, epoch: uint, at: uint }))
  (>= (get at s) (default-to NEVER (get revoked-from (map-get? keys (get epoch s))))))

(define-read-only (get-stake (h uint)) (map-get? stakes h))

(define-read-only (status)
  { paused: (var-get paused), epoch: (var-get epoch), total-weight: (var-get total-weight),
    rate-cap: (var-get rate-cap), stranded: (var-get stranded) })

;; ---------- roles ----------
(define-private (is-admin) (is-eq tx-sender (var-get admin)))

(define-public (set-admin (p principal))
  (begin (asserts! (is-admin) ERR-AUTH) (ok (var-set admin p))))

(define-public (set-pauser (p principal) (on bool))
  (begin (asserts! (is-admin) ERR-AUTH) (ok (map-set pausers p on))))

(define-public (set-rate-cap (n uint))
  (begin (asserts! (is-admin) ERR-AUTH) (ok (var-set rate-cap n))))

;; Admin sets the treasury principal, the reward-period length and all three caps together.
(define-public (set-funding (who principal) (per-call uint) (period-len uint) (per-period uint) (pool-max uint))
  (begin (asserts! (is-admin) ERR-AUTH)
    (asserts! (> period-len u0) ERR-STATE)
    (var-set funder who) (var-set cap-call per-call) (var-set fund-period period-len)
    (var-set cap-period per-period) (var-set cap-pool pool-max)
    (ok true)))

(define-read-only (funding)
  { funder: (var-get funder), per-call: (var-get cap-call), per-period: (var-get cap-period),
    period-len: (var-get fund-period), pool-max: (var-get cap-pool),
    pool-held: (var-get pool-held), funded-total: (var-get funded-total),
    period: (/ burn-block-height (var-get fund-period)),
    funded-this-period: (default-to u0 (map-get? funded-in (/ burn-block-height (var-get fund-period)))) })

(define-public (pause)
  (begin
    (asserts! (or (is-admin) (default-to false (map-get? pausers tx-sender))) ERR-AUTH)
    (ok (var-set paused true))))

(define-public (unpause)
  (begin (asserts! (is-admin) ERR-AUTH) (ok (var-set paused false))))

;; ---------- keys ----------
;; Scheduled rotation: new key starts after ROTATE-DELAY, old key retires OVERLAP later.
;; The very first key is usable immediately.
(define-public (schedule-key (k (buff 33)))
  (let ((cur (var-get epoch))
        (next (+ cur u1))
        (from (if (is-eq cur u0) burn-block-height (+ burn-block-height ROTATE-DELAY))))
    (asserts! (is-admin) ERR-AUTH)
    (match (map-get? keys cur) old
      (map-set keys cur (merge old { until: (+ from OVERLAP) }))
      true)
    (map-set keys next { key: k, from: from, until: NEVER, revoked-from: NEVER })
    (var-set epoch next)
    (ok next)))

;; Void stakes attested under key e at or after `from` (compromise start) and stop the key now.
(define-public (revoke-epoch (e uint) (from uint))
  (let ((k (unwrap! (map-get? keys e) ERR-NONE)))
    (asserts! (is-admin) ERR-AUTH)
    (ok (map-set keys e (merge k {
      revoked-from: (if (< from (get revoked-from k)) from (get revoked-from k)),
      until: (if (< burn-block-height (get until k)) burn-block-height (get until k)) })))))

;; Emergency: only while paused. Revokes the newest key and installs a new one at once.
(define-public (emergency-key (k (buff 33)) (compromised-from uint))
  (let ((cur (var-get epoch)) (next (+ cur u1)))
    (asserts! (is-admin) ERR-AUTH)
    (asserts! (var-get paused) ERR-STATE)
    (try! (revoke-epoch cur compromised-from))
    (map-set keys next { key: k, from: burn-block-height, until: NEVER, revoked-from: NEVER })
    (var-set epoch next)
    (ok next)))

;; ---------- accounting ----------
;; Every payout lowers the tracked pool balance (never below zero).
(define-private (paid (n uint))
  (var-set pool-held (if (> n (var-get pool-held)) u0 (- (var-get pool-held) n))))

(define-private (recycle (amount uint))
  (if (> (var-get total-weight) u0)
    (var-set acc (+ (var-get acc) (/ (* amount SCALE) (var-get total-weight))))
    (var-set stranded (+ (var-get stranded) amount))))

;; Close a stake: pay its owner, or return its rewards to the pool if it is void.
(define-private (settle (h uint))
  (match (map-get? stakes h) s
    (let ((owed (pending h)))
      (var-set total-weight (- (var-get total-weight) (get weight s)))
      (map-delete stakes h)
      (if (is-eq owed u0)
        (ok true)
        (if (stake-void s)
          (begin (recycle owed) (ok true))
          (begin (paid owed) (as-contract (contract-call? .mock-sbtc
                         transfer owed tx-sender (get owner s) none))))))
    (ok true)))

(define-public (fund (amount uint))
  (let ((period (/ burn-block-height (var-get fund-period)))
        (in-period (+ amount (default-to u0 (map-get? funded-in period))))
        (held (+ amount (var-get pool-held)))
        (total (+ amount (var-get funded-total))))
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (is-eq tx-sender (var-get funder)) ERR-AUTH)
    (asserts! (and (> amount u0) (<= amount (var-get cap-call))) ERR-CAP)
    (asserts! (<= in-period (var-get cap-period)) ERR-CAP)
    (asserts! (<= held (var-get cap-pool)) ERR-CAP)
    (try! (contract-call? .mock-sbtc
            transfer amount tx-sender SELF none))
    (map-set funded-in period in-period)
    (var-set funded-total total)
    (var-set pool-held held)
    (print { event: "fund", amount: amount, period: period, pool-held: held, funded-total: total, epoch: (var-get epoch) })
    ;; Only `amount` (plus stranded) is shared out; tokens sent outside `fund` stay unshared.
    (let ((share (+ amount (var-get stranded))))
      (var-set stranded u0)
      (recycle share)
      (ok true))))

;; ---------- staking ----------
(define-public (attest (e uint) (h uint) (weight uint) (issued uint) (sig (buff 65)))
  (let ((k (unwrap! (map-get? keys e) ERR-KEY))
        (prev (map-get? stakes h))
        (increase (match prev p
                    (if (is-eq (get owner p) tx-sender)
                      (if (> weight (get weight p)) (- weight (get weight p)) u0)
                      weight)
                    weight))
        (used (default-to u0 (map-get? added burn-block-height))))
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (key-usable e) ERR-KEY)
    (asserts! (and (> weight u0) (<= weight MAX-WEIGHT)) ERR-WEIGHT)
    (asserts! (and (<= issued burn-block-height) (<= burn-block-height (+ issued SUBMIT-WINDOW))) ERR-STALE)
    (asserts! (secp256k1-verify (attestation-hash e h tx-sender weight issued) sig (get key k)) ERR-SIG)
    (asserts! (<= (+ used increase) (var-get rate-cap)) ERR-RATE)
    (map-set added burn-block-height (+ used increase))
    (try! (settle h))
    (map-set stakes h { owner: tx-sender, weight: weight, debt: (* weight (var-get acc)),
                        expires: (+ issued TTL), epoch: e, at: burn-block-height })
    (var-set total-weight (+ (var-get total-weight) weight))
    (ok true)))

(define-public (claim (h uint))
  (let ((s (unwrap! (map-get? stakes h) ERR-NONE)) (owed (pending h)) (me tx-sender))
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (is-eq me (get owner s)) ERR-AUTH)
    (asserts! (<= burn-block-height (get expires s)) ERR-STALE)
    (asserts! (not (stake-void s)) ERR-KEY)
    (map-set stakes h (merge s { debt: (* (get weight s) (var-get acc)) }))
    (if (> owed u0)
      (begin (paid owed) (as-contract (contract-call? .mock-sbtc
                     transfer owed tx-sender me none)))
      (ok true))))

;; Anyone may close an expired or void stake (the watcher does this every block).
(define-public (evict (h uint))
  (let ((s (unwrap! (map-get? stakes h) ERR-NONE)))
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (or (> burn-block-height (get expires s)) (stake-void s)) ERR-STATE)
    (settle h)))
