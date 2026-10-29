import { createFileRoute } from "@tanstack/react-router";

/**
 * Rig wrapper: leases a slice, hands the range + target/canary addresses to any
 * range scanner (GPU or CPU), then posts the canary proof. The scanner must write
 * every matched private key (hex, one per line) to the {out} file.
 */
const SCRIPT = `#!/usr/bin/env bash
# bitmapwin.app Puzzle #71 pool rig — needs curl, jq, sha256sum.
# WORKER=<your btc address>  SCANNER='<cmd using {start} {end} {targets} {out}>'
set -euo pipefail
API="\${API:-https://bitmapwin.app/api/public/puzzle/71}"
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
  # Order keys as the lease lists canaries: derive each key's slot by matching addresses is scanner-specific,
  # so the scanner output must keep lease order; the target key (if any) is printed loudly.
  PROOF=$(printf '%s' "$(head -n3 <<<"$KEYS" | tr -d '\\n')" | sha256sum | cut -d' ' -f1)
  [ "$(wc -l <<<"$KEYS")" -gt 3 ] && echo "!!! EXTRA KEY FOUND — CHECK $O, IT MAY BE THE PUZZLE KEY !!!" && cp "$O" "found-$IDX.txt"
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
