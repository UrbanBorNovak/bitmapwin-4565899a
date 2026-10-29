import { createFileRoute } from "@tanstack/react-router";

/**
 * Rig wrapper: leases a slice, hands the range + target/canary addresses to any
 * range scanner (GPU or CPU), then posts the canary proof. The scanner must write
 * every matched private key (hex, one per line) to the {out} file.
 */
const SCRIPT = `#!/usr/bin/env bash
# bitmapwin.app Puzzle #71 pool rig — needs curl, jq, sha256sum.
# WORKER=<your btc address>  SCANNER='<cmd using {start} {end} {targets} {out}>'
# Note: 3 trap keys are evidence of scanning, NOT proof of full range coverage.
# Partial scans can still pass sometimes, and the pool cannot detect a hidden prize key.
set -euo pipefail
API="\${API:-https://bitmapwin.app/api/public/puzzle/\${POOL:-71}}"
: "\${WORKER:?set WORKER to your Bitcoin address}"
: "\${SCANNER:?set SCANNER, e.g. 'myscanner --range {start}:{end} -i {targets} -o {out}'}"
while true; do
  L=$(curl -sf "$API/range?worker=$WORKER") || { echo "lease failed, retry in 60s"; sleep 60; continue; }
  IDX=$(jq -r .index <<<"$L"); TOK=$(jq -r .token <<<"$L")
  S=$(jq -r .startHex <<<"$L"); E=$(jq -r .endHex <<<"$L")
  T=$(mktemp); O=$(mktemp)
  jq -r '.targetAddress, .canaryAddresses[]' <<<"$L" > "$T"
  echo "slice #$IDX  $S:$E"
  CMD=\${SCANNER//\\{start\\}/$S}; CMD=\${CMD//\\{end\\}/$E}; CMD=\${CMD//\\{targets\\}/$T}; CMD=\${CMD//\\{out\\}/$O}
  eval "$CMD" || true
  KEYS=$(tr 'A-F' 'a-f' < "$O" | grep -oE '[0-9a-f]{1,64}' | while read -r k; do printf '%064s\\n' "$k" | tr ' ' 0; done)
  N=$(grep -c . <<<"$KEYS" || true)
  if [ "$N" -gt 3 ]; then cp "$O" "found-$IDX.txt"; echo "!!! $N KEYS FOUND — ONE MAY BE THE PUZZLE KEY: found-$IDX.txt !!!"; fi
  PROOF=$(sort <<<"$KEYS" | tr -d '\\n' | sha256sum | cut -d' ' -f1)
  curl -sf -X POST "$API/share" -H 'content-type: application/json' \\
    -d "{\\"index\\":\\"$IDX\\",\\"token\\":\\"$TOK\\",\\"canaryProof\\":\\"$PROOF\\"}" ; echo
  rm -f "$T" "$O"
done
`;

export const Route = createFileRoute("/api/public/puzzle/71/rig.sh")({
  server: {
    handlers: {
      GET: async () => new Response(SCRIPT, { headers: { "content-type": "text/x-shellscript; charset=utf-8", "access-control-allow-origin": "*" } }),
    },
  },
});
