;; BW-BOUNTY-1 - Builder Bounties escrow (Stacks testnet, test sBTC, no value).
;; A poster locks tokens for a build on a BITMAP. Builders submit an inscription id.
;; Only the poster can release to one submitted builder. After the deadline an
;; unreleased bounty can only be refunded to the poster. No admin, no fee, no pause.
(define-constant TOKEN 'ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-test-sbtc)
(define-constant SELF (as-contract tx-sender))
(define-constant MIN-AMOUNT u1000)
(define-constant MIN-BLOCKS u6)
(define-constant MAX-BLOCKS u4320)
(define-constant MAX-SUBMISSIONS u20)
(define-constant ERR-AMOUNT (err u100))
(define-constant ERR-WINDOW (err u101))
(define-constant ERR-NONE (err u102))
(define-constant ERR-NOT-POSTER (err u103))
(define-constant ERR-CLOSED (err u104))
(define-constant ERR-EXPIRED (err u105))
(define-constant ERR-NOT-EXPIRED (err u106))
(define-constant ERR-NO-SUBMISSION (err u107))
(define-constant ERR-SELF (err u108))
(define-constant ERR-FULL (err u109))

(define-data-var last-id uint u0)
;; status: u0 open, u1 paid, u2 refunded
(define-map bounties uint { poster: principal, height: uint, amount: uint, title: (string-utf8 120),
  deadline: uint, created: uint, status: uint, winner: (optional principal), submissions: uint })
(define-map submissions { id: uint, builder: principal } { ref: (string-ascii 80), at: uint })

(define-public (create-bounty (height uint) (amount uint) (title (string-utf8 120)) (blocks uint))
  (let ((id (+ (var-get last-id) u1)))
    (asserts! (>= amount MIN-AMOUNT) ERR-AMOUNT)
    (asserts! (and (>= blocks MIN-BLOCKS) (<= blocks MAX-BLOCKS)) ERR-WINDOW)
    (try! (contract-call? 'ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-test-sbtc transfer amount tx-sender SELF none))
    (map-set bounties id { poster: tx-sender, height: height, amount: amount, title: title,
      deadline: (+ burn-block-height blocks), created: burn-block-height, status: u0, winner: none, submissions: u0 })
    (var-set last-id id)
    (ok id)))

(define-public (submit-work (id uint) (ref (string-ascii 80)))
  (let ((b (unwrap! (map-get? bounties id) ERR-NONE)) (key { id: id, builder: tx-sender }) (fresh (is-none (map-get? submissions key))))
    (asserts! (is-eq (get status b) u0) ERR-CLOSED)
    (asserts! (<= burn-block-height (get deadline b)) ERR-EXPIRED)
    (asserts! (not (is-eq tx-sender (get poster b))) ERR-SELF)
    (asserts! (or (not fresh) (< (get submissions b) MAX-SUBMISSIONS)) ERR-FULL)
    (map-set submissions key { ref: ref, at: burn-block-height })
    (if fresh (map-set bounties id (merge b { submissions: (+ (get submissions b) u1) })) true)
    (ok true)))

;; Poster may release any time while open, even after the deadline, to a builder who submitted in time.
(define-public (accept-and-pay (id uint) (builder principal))
  (let ((b (unwrap! (map-get? bounties id) ERR-NONE)))
    (asserts! (is-eq tx-sender (get poster b)) ERR-NOT-POSTER)
    (asserts! (is-eq (get status b) u0) ERR-CLOSED)
    (asserts! (is-some (map-get? submissions { id: id, builder: builder })) ERR-NO-SUBMISSION)
    (map-set bounties id (merge b { status: u1, winner: (some builder) }))
    (as-contract (contract-call? 'ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-test-sbtc transfer (get amount b) SELF builder none))))

(define-public (cancel-and-refund (id uint))
  (let ((b (unwrap! (map-get? bounties id) ERR-NONE)) (poster (get poster b)))
    (asserts! (is-eq tx-sender poster) ERR-NOT-POSTER)
    (asserts! (is-eq (get status b) u0) ERR-CLOSED)
    (asserts! (> burn-block-height (get deadline b)) ERR-NOT-EXPIRED)
    (map-set bounties id (merge b { status: u2 }))
    (as-contract (contract-call? 'ST37VBHJYMWAPABF1ARD0CY3THYEPKPSM4HE7QS6F.bw-test-sbtc transfer (get amount b) SELF poster none))))

(define-read-only (get-bounty (id uint)) (map-get? bounties id))
(define-read-only (get-submission (id uint) (builder principal)) (map-get? submissions { id: id, builder: builder }))
(define-read-only (get-last-id) (var-get last-id))
