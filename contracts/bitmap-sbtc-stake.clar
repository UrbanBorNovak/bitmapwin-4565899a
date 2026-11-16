;; BW-STACKS-1 · BitmapWin soft-stake vault (DRAFT — not deployed, not audited)
;; BITMAPs stay on Bitcoin L1. An oracle attests live custody; rewards accrue
;; only while the attestation is unexpired. Reward-per-weight accumulator.

(use-trait ft 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8Q86VN88.sip-010-trait-ft-standard.sip-010-trait)

(define-constant OWNER tx-sender)
(define-constant SBTC 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)
(define-constant SCALE u1000000000000)
(define-constant TTL u144)
(define-constant ERR-AUTH (err u401))
(define-constant ERR-SIG (err u402))
(define-constant ERR-NONE (err u404))
(define-constant ERR-TOKEN (err u405))
(define-constant ERR-STALE (err u406))

(define-data-var oracle (buff 33) 0x000000000000000000000000000000000000000000000000000000000000000000)
(define-data-var total-weight uint u0)
(define-data-var acc uint u0) ;; sBTC sats per weight × SCALE

(define-map stakes uint
  { owner: principal, weight: uint, debt: uint, expires: uint })

(define-read-only (pending (h uint))
  (match (map-get? stakes h) s
    (/ (- (* (get weight s) (var-get acc)) (get debt s)) SCALE) u0))

(define-public (set-oracle (k (buff 33)))
  (begin (asserts! (is-eq tx-sender OWNER) ERR-AUTH) (ok (var-set oracle k))))

;; Anyone may fund; sBTC is split across current weight immediately.
(define-public (fund (amount uint) (token <ft>))
  (begin
    (asserts! (is-eq (contract-of token) SBTC) ERR-TOKEN)
    (asserts! (> (var-get total-weight) u0) ERR-NONE)
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
    (ok (var-set acc (+ (var-get acc) (/ (* amount SCALE) (var-get total-weight)))))))

(define-private (drop (h uint))
  (match (map-get? stakes h) s
    (begin (var-set total-weight (- (var-get total-weight) (get weight s))) (map-delete stakes h) true)
    true))

;; Oracle signs sha256(height | owner | weight | issued-burn-height).
;; A new owner replaces the old stake; unclaimed rewards of the old one are forfeited.
(define-public (attest (h uint) (weight uint) (issued uint) (sig (buff 65)))
  (let ((msg (sha256 (concat (concat (unwrap-panic (to-consensus-buff? h))
                                     (unwrap-panic (to-consensus-buff? tx-sender)))
                             (concat (unwrap-panic (to-consensus-buff? weight))
                                     (unwrap-panic (to-consensus-buff? issued)))))))
    (asserts! (secp256k1-verify msg sig (var-get oracle)) ERR-SIG)
    (asserts! (<= burn-block-height (+ issued u6)) ERR-STALE)
    (match (map-get? stakes h) s
      (asserts! (is-eq (get owner s) tx-sender) ERR-AUTH)
      true)
    (let ((owed (pending h)))
      (drop h)
      (map-set stakes h { owner: tx-sender, weight: weight,
                          debt: (- (* weight (var-get acc)) (* owed SCALE)),
                          expires: (+ issued TTL) })
      (var-set total-weight (+ (var-get total-weight) weight))
      (ok true))))

;; Anyone may evict an expired stake (no fresh custody proof).
(define-public (evict (h uint))
  (let ((s (unwrap! (map-get? stakes h) ERR-NONE)))
    (asserts! (> burn-block-height (get expires s)) ERR-AUTH)
    (ok (drop h))))

(define-public (claim (h uint) (token <ft>))
  (let ((s (unwrap! (map-get? stakes h) ERR-NONE)) (owed (pending h)) (me tx-sender))
    (asserts! (is-eq (contract-of token) SBTC) ERR-TOKEN)
    (asserts! (is-eq me (get owner s)) ERR-AUTH)
    (asserts! (<= burn-block-height (get expires s)) ERR-STALE)
    (map-set stakes h (merge s { debt: (* (get weight s) (var-get acc)) }))
    (if (> owed u0) (as-contract (contract-call? token transfer owed tx-sender me none)) (ok true))))
