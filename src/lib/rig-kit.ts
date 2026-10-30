/**
 * GPU Rig Launch Kit: scanner presets + wrapper scripts (bash and PowerShell).
 * Scripts lease a slice, run the scanner, keep any extra key locally and post
 * only the sha256 canary proof. The prize key is never uploaded.
 */
export type ScannerPreset = { id: string; label: string; note: string; linux: string; windows: string };

export const SCANNER_PRESETS: ScannerPreset[] = [
  {
    id: "bitcrack",
    label: "BitCrack (CUDA)",
    note: "Upstream BitCrack supports key ranges and address lists directly.",
    linux: "./cuBitCrack -b 896 -t 256 -p 32 --keyspace {start}:{end} -i {targets} -o {out}",
    windows: ".\\cuBitCrack.exe -b 896 -t 256 -p 32 --keyspace {start}:{end} -i {targets} -o {out}",
  },
  {
    id: "vanitysearch",
    label: "VanitySearch (range fork)",
    note: "Needs a fork with key-range support; upstream VanitySearch has none. Check your fork's flags.",
    linux: "./VanitySearch -gpu -stop --keyspace {start}:{end} -i {targets} -o {out}",
    windows: ".\\VanitySearch.exe -gpu -stop --keyspace {start}:{end} -i {targets} -o {out}",
  },
  {
    id: "keyhunt",
    label: "KeyHunt (CPU/CUDA)",
    note: "Address mode with a range. Some builds write to a fixed file; adjust {out} if so.",
    linux: "./keyhunt -m address -f {targets} -r {start}:{end} -o {out}",
    windows: ".\\keyhunt.exe -m address -f {targets} -r {start}:{end} -o {out}",
  },
];

export const BASH_RIG = `#!/usr/bin/env bash
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

export const PS_RIG = `# bitmapwin.app Puzzle #71 pool rig — Windows PowerShell 5+, no extra tools.
# Set $env:WORKER and $env:SCANNER (uses {start} {end} {targets} {out}).
# Note: 3 trap keys are evidence of scanning, NOT proof of full range coverage.
$ErrorActionPreference = "Stop"
$pool = if ($env:POOL) { $env:POOL } else { "71" }
$api = if ($env:API) { $env:API } else { "https://bitmapwin.app/api/public/puzzle/$pool" }
if (-not $env:WORKER) { throw "set `$env:WORKER to your Bitcoin address" }
if (-not $env:SCANNER) { throw "set `$env:SCANNER to your scanner command" }
while ($true) {
  try { $L = Invoke-RestMethod "$api/range?worker=$($env:WORKER)" } catch { Write-Host "lease failed, retry in 60s"; Start-Sleep 60; continue }
  $T = New-TemporaryFile; $O = New-TemporaryFile
  (@($L.targetAddress) + $L.canaryAddresses) | Set-Content -Encoding ascii $T
  Write-Host "slice #$($L.index)  $($L.startHex):$($L.endHex)"
  $cmd = $env:SCANNER.Replace("{start}", $L.startHex).Replace("{end}", $L.endHex).Replace("{targets}", $T.FullName).Replace("{out}", $O.FullName)
  try { Invoke-Expression $cmd } catch { Write-Host $_ }
  $keys = @([regex]::Matches((Get-Content -Raw $O) + "", "[0-9a-fA-F]{1,64}") | ForEach-Object { $_.Value.ToLower().PadLeft(64, "0") })
  if ($keys.Count -gt 3) { Copy-Item $O "found-$($L.index).txt"; Write-Host "!!! $($keys.Count) KEYS FOUND — ONE MAY BE THE PUZZLE KEY: found-$($L.index).txt !!!" -ForegroundColor Red }
  $joined = (($keys | Sort-Object) -join "")
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $proof = -join ($sha.ComputeHash([Text.Encoding]::ASCII.GetBytes($joined)) | ForEach-Object { $_.ToString("x2") })
  $body = @{ index = "$($L.index)"; token = $L.token; canaryProof = $proof } | ConvertTo-Json
  try { Invoke-RestMethod -Method Post "$api/share" -ContentType "application/json" -Body $body | ConvertTo-Json -Compress } catch { Write-Host $_ }
  Remove-Item $T, $O -ErrorAction SilentlyContinue
}
`;

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const psq = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** A ready-to-run script with the worker address and scanner baked in. */
export function buildKit(os: "linux" | "windows", worker: string, scanner: string, pool = "71"): string {
  if (os === "windows") {
    return `$env:WORKER = ${psq(worker)}\n$env:SCANNER = ${psq(scanner)}\n$env:POOL = ${psq(pool)}\n${PS_RIG}`;
  }
  const [shebang, ...rest] = BASH_RIG.split("\n");
  return `${shebang}\nexport WORKER=${shq(worker)}\nexport SCANNER=${shq(scanner)}\nexport POOL=${shq(pool)}\n${rest.join("\n")}`;
}
