# BL-13 fallback: host-native latency sampler (k6-via-docker blocked, see gates.md).
# Usage: pwsh infra/load-tests/smoke-fallback.ps1 -BaseUrl http://127.0.0.1:8001 -N 20
param([string]$BaseUrl = 'http://127.0.0.1:8001', [int]$N = 20)
$paths = @('/core/v1/health', '/api/core/v1/health', '/core/v1/capability-bootstrap')
$results = @()
foreach ($p in $paths) {
  $lat = @(); $fails = 0
  for ($i = 0; $i -lt $N; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try { $r = Invoke-WebRequest -Uri ($BaseUrl + $p) -UseBasicParsing -TimeoutSec 15; if ($r.StatusCode -ge 500) { $fails++ } }
    catch { $fails++ }
    $sw.Stop(); $lat += $sw.Elapsed.TotalMilliseconds
  }
  $s = ($lat | Sort-Object); $p50 = $s[[int](0.50 * ($N - 1))]; $p95 = $s[[int](0.95 * ($N - 1))]
  $results += [pscustomobject]@{path = $p; n = $N; fails = $fails; p50_ms = [math]::Round($p50, 1); p95_ms = [math]::Round($p95, 1); pass = ($fails / $N -lt 0.05 -and $p95 -lt 1000) }
}
$results | Format-Table -AutoSize | Out-String | Write-Output
if ($results.pass -contains $false) { exit 1 }
