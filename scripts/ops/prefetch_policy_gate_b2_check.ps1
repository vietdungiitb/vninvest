param(
  [string]$BaselineSummaryPath,
  [string]$BaselineRoot = "c:/Mujoco Projects/vninvest/docs/ops-evidence/prefetch-policy-baseline"
)

$ErrorActionPreference = "Stop"

function Get-LatestBaselineSummaryPath {
  param([string]$Root)

  if (-not (Test-Path $Root)) {
    throw "Baseline root not found: $Root"
  }

  $latestDir = Get-ChildItem -Path $Root -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if ($null -eq $latestDir) {
    throw "No baseline run directories found under: $Root"
  }

  $summaryPath = Join-Path $latestDir.FullName "baseline-summary.json"
  if (-not (Test-Path $summaryPath)) {
    throw "baseline-summary.json not found in latest run: $($latestDir.FullName)"
  }

  return $summaryPath
}

function As-NullableDouble {
  param($Value)

  if ($null -eq $Value) {
    return $null
  }

  $s = [string]$Value
  if ([string]::IsNullOrWhiteSpace($s)) {
    return $null
  }

  $parsed = 0.0
  if ([double]::TryParse($s, [ref]$parsed)) {
    return [double]$parsed
  }
  return $null
}

if ([string]::IsNullOrWhiteSpace($BaselineSummaryPath)) {
  $BaselineSummaryPath = Get-LatestBaselineSummaryPath -Root $BaselineRoot
}

if (-not (Test-Path $BaselineSummaryPath)) {
  throw "Baseline summary file not found: $BaselineSummaryPath"
}

$summary = Get-Content -Path $BaselineSummaryPath -Raw -Encoding utf8 | ConvertFrom-Json

$checks = @()

$checks += [ordered]@{
  key = "auth_enabled"
  title = "Auth enabled during baseline capture"
  expected = "true"
  actual = [bool]$summary.auth_enabled
  pass = [bool]$summary.auth_enabled
}

$ticker429 = As-NullableDouble $summary.kpi.ticker_probe_429_ratio_pct
$checks += [ordered]@{
  key = "baseline_429_rate"
  title = "Baseline 429 rate captured"
  expected = "non-null"
  actual = $ticker429
  pass = ($null -ne $ticker429)
}

$cooldownDelta = As-NullableDouble $summary.kpi.policy_counters.multiplier_total_delta
$cooldownFirst = As-NullableDouble $summary.kpi.policy_counters.multiplier_total_first
$cooldownLast = As-NullableDouble $summary.kpi.policy_counters.multiplier_total_last
$cooldownCaptured = ($null -ne $cooldownDelta) -or ($null -ne $cooldownFirst) -or ($null -ne $cooldownLast)
$cooldownNotObservedButAcceptable = (-not $cooldownCaptured) -and ($null -ne $ticker429) -and ($ticker429 -eq 0)
$cooldownPass = $cooldownCaptured -or $cooldownNotObservedButAcceptable
$checks += [ordered]@{
  key = "baseline_cooldown_events"
  title = "Baseline cooldown events captured"
  expected = "counter present or no-429 observed"
  actual = [ordered]@{
    multiplier_total_first = $cooldownFirst
    multiplier_total_last = $cooldownLast
    multiplier_total_delta = $cooldownDelta
    ticker_probe_429_ratio_pct = $ticker429
    no_429_observed = $cooldownNotObservedButAcceptable
  }
  pass = $cooldownPass
}

$freshnessP95 = As-NullableDouble $summary.kpi.prefetch_freshness.p95_seconds
$checks += [ordered]@{
  key = "baseline_freshness"
  title = "Baseline freshness captured"
  expected = "non-null"
  actual = $freshnessP95
  pass = ($null -ne $freshnessP95)
}

$latPrefetch = As-NullableDouble $summary.kpi.endpoint_latency_p95_ms.prefetch_health
$latMarketObs = As-NullableDouble $summary.kpi.endpoint_latency_p95_ms.market_observability
$latAdmin = As-NullableDouble $summary.kpi.endpoint_latency_p95_ms.admin_ops_stats
$checks += [ordered]@{
  key = "baseline_latency_p95"
  title = "Baseline p95 latency endpoints captured"
  expected = "prefetch + market-observability + admin-ops-stats non-null"
  actual = [ordered]@{
    prefetch_health = $latPrefetch
    market_observability = $latMarketObs
    admin_ops_stats = $latAdmin
  }
  pass = (($null -ne $latPrefetch) -and ($null -ne $latMarketObs) -and ($null -ne $latAdmin))
}

$allPass = @($checks | Where-Object { -not $_.pass }).Count -eq 0

$runDir = Split-Path -Parent $BaselineSummaryPath
$result = [ordered]@{
  generated_at = (Get-Date -Format o)
  baseline_summary_path = $BaselineSummaryPath
  gate_b2_ready = $allPass
  checks = $checks
}

$resultJsonPath = Join-Path $runDir "gate-b2-check.json"
$resultMdPath = Join-Path $runDir "gate-b2-check.md"

$result | ConvertTo-Json -Depth 20 | Set-Content -Path $resultJsonPath -Encoding utf8

$md = @(
  "# Gate B2 Check",
  "",
  "- Generated at: $($result.generated_at)",
  "- Baseline summary: $BaselineSummaryPath",
  "- Gate B2 ready: $($result.gate_b2_ready)",
  "",
  "## Checks",
  ""
)

foreach ($c in $checks) {
  $marker = if ($c.pass) { "[x]" } else { "[ ]" }
  $md += "- $marker $($c.title)"
  $md += "  - expected: $($c.expected)"
  $md += "  - actual: $($c.actual | ConvertTo-Json -Compress)"
}

$md | Set-Content -Path $resultMdPath -Encoding utf8

Write-Host "Gate B2 check generated: $resultMdPath"

if (-not $allPass) {
  Write-Host "Gate B2 check FAILED. Re-run baseline with auth-enabled capture."
  exit 2
}

Write-Host "Gate B2 check PASSED."
exit 0
