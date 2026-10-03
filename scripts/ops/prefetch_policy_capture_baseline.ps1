param(
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$Username,
  [string]$Password,
  [string]$AccessToken,
  [string]$Symbol = "FPT",
  [int]$Samples = 24,
  [int]$IntervalSeconds = 5,
  [int]$RequestTimeoutSec = 12,
  [string]$OutDir = "c:/Mujoco Projects/vninvest/docs/ops-evidence/prefetch-policy-baseline"
)

$ErrorActionPreference = "Stop"

if ($Samples -lt 3) {
  throw "Samples must be >= 3"
}
if ($IntervalSeconds -lt 1) {
  throw "IntervalSeconds must be >= 1"
}
if ($RequestTimeoutSec -lt 2) {
  throw "RequestTimeoutSec must be >= 2"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $OutDir $timestamp
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

function Save-JsonArtifact {
  param(
    [string]$Path,
    $Object
  )

  $json = $Object | ConvertTo-Json -Depth 20
  Set-Content -Path $Path -Value $json -Encoding utf8
}

function Write-RunLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format o), $Message
  Add-Content -Path (Join-Path $runDir "_run.log") -Value $line -Encoding utf8
  Write-Host $line
}

function Format-Maybe {
  param($Value)
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
    return "N/A"
  }
  return [string]$Value
}

function Percentile {
  param(
    [double[]]$Values,
    [double]$P
  )

  if (-not $Values -or $Values.Count -eq 0) {
    return 0.0
  }

  $sorted = $Values | Sort-Object
  $index = [int][Math]::Floor(($sorted.Count - 1) * $P)
  if ($index -lt 0) { $index = 0 }
  if ($index -ge $sorted.Count) { $index = $sorted.Count - 1 }
  return [double]$sorted[$index]
}

function Invoke-TrackedGet {
  param(
    [string]$Url,
    [hashtable]$Headers = @{},
    [int]$TimeoutSec = 20,
    [int[]]$AllowedStatusCodes = @(200)
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $resp = Invoke-WebRequest -Method Get -Uri $Url -Headers $Headers -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
    $sw.Stop()
    $status = [int]$resp.StatusCode
    $body = $null
    if ($resp.Content) {
      try {
        $body = $resp.Content | ConvertFrom-Json
      } catch {
        $body = @{ raw = $resp.Content }
      }
    }
  } catch {
    $sw.Stop()
    $webResponse = $_.Exception.Response
    if ($null -ne $webResponse) {
      $status = [int]$webResponse.StatusCode
      $stream = $webResponse.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $raw = $reader.ReadToEnd()
      $reader.Dispose()
      if ([string]::IsNullOrWhiteSpace($raw)) {
        $body = $null
      } else {
        try {
          $body = $raw | ConvertFrom-Json
        } catch {
          $body = @{ raw = $raw }
        }
      }
    } else {
      return @{
        status_code = -1
        latency_ms = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
        body = @{ error = [string]$_.Exception.Message }
      }
    }
  }

  if ($AllowedStatusCodes -notcontains $status) {
    return @{
      status_code = $status
      latency_ms = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
      body = $body
      unexpected = $true
    }
  }

  return @{
    status_code = $status
    latency_ms = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
    body = $body
  }
}

function Login-AccessToken {
  param(
    [string]$Base,
    [string]$User,
    [string]$Pass,
    [int]$TimeoutSec
  )

  $resp = Invoke-WebRequest -Method Post -Uri "$Base/api/auth/token/" -Body (@{ username = $User; password = $Pass } | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
  $body = $resp.Content | ConvertFrom-Json
  return [string]$body.access
}

$token = $AccessToken
if ([string]::IsNullOrWhiteSpace($token) -and -not [string]::IsNullOrWhiteSpace($Username) -and -not [string]::IsNullOrWhiteSpace($Password)) {
  Write-RunLog "Authenticating with username/password"
  $token = Login-AccessToken -Base $ApiBase -User $Username -Pass $Password -TimeoutSec $RequestTimeoutSec
}

$authHeaders = @{}
if (-not [string]::IsNullOrWhiteSpace($token)) {
  $authHeaders = @{ Authorization = "Bearer $token" }
  Write-RunLog "Auth enabled for admin/ticker probes"
} else {
  Write-RunLog "No auth token provided. Admin stats and ticker probes will be skipped"
}

$samplesRaw = @()
$prefetchLatencies = New-Object System.Collections.Generic.List[Double]
$marketObsLatencies = New-Object System.Collections.Generic.List[Double]
$adminStatsLatencies = New-Object System.Collections.Generic.List[Double]
$tickerLatencies = New-Object System.Collections.Generic.List[Double]
$tickerStatusCodes = New-Object System.Collections.Generic.List[Int]

$prefetchHealthyCount = 0
$freshnessValues = New-Object System.Collections.Generic.List[Double]
$multiplierTotals = New-Object System.Collections.Generic.List[Double]
$skipTotals = New-Object System.Collections.Generic.List[Double]

for ($i = 1; $i -le $Samples; $i++) {
  Write-RunLog ("Collect sample {0}/{1}" -f $i, $Samples)

  $prefetchResp = Invoke-TrackedGet -Url "$ApiBase/api/health/prefetch/" -TimeoutSec $RequestTimeoutSec -AllowedStatusCodes @(200, 503)
  $marketObsResp = Invoke-TrackedGet -Url "$ApiBase/api/health/market-observability/" -TimeoutSec $RequestTimeoutSec -AllowedStatusCodes @(200)

  $adminResp = $null
  $tickerResp = $null

  if ($authHeaders.Count -gt 0) {
    $adminResp = Invoke-TrackedGet -Url "$ApiBase/api/admin-ops/stats/" -Headers $authHeaders -TimeoutSec $RequestTimeoutSec -AllowedStatusCodes @(200)
    $tickerResp = Invoke-TrackedGet -Url "$ApiBase/api/realtime/ticker/$Symbol/" -Headers $authHeaders -TimeoutSec $RequestTimeoutSec -AllowedStatusCodes @(200, 429)
  }

  $prefetchLatencies.Add([double]$prefetchResp.latency_ms)
  $marketObsLatencies.Add([double]$marketObsResp.latency_ms)

  if ($prefetchResp.body -and $prefetchResp.body.healthy -eq $true) {
    $prefetchHealthyCount += 1
  }

  if ($prefetchResp.body -and $null -ne $prefetchResp.body.freshness_seconds) {
    $freshnessValues.Add([double]$prefetchResp.body.freshness_seconds)
  }

  $metaMetrics = $null
  if ($prefetchResp.body -and $prefetchResp.body.prefetch -and $prefetchResp.body.prefetch.metrics) {
    $metaMetrics = $prefetchResp.body.prefetch.metrics
  } elseif ($adminResp -and $adminResp.body -and $adminResp.body.ticker_prefetch -and $adminResp.body.ticker_prefetch.prefetch -and $adminResp.body.ticker_prefetch.prefetch.metrics) {
    $metaMetrics = $adminResp.body.ticker_prefetch.prefetch.metrics
  }

  if ($metaMetrics) {
    if ($null -ne $metaMetrics.'429_multiplier_total') {
      $multiplierTotals.Add([double]$metaMetrics.'429_multiplier_total')
    }
    if ($null -ne $metaMetrics.skip_total) {
      $skipTotals.Add([double]$metaMetrics.skip_total)
    }
  }

  if ($adminResp) {
    $adminStatsLatencies.Add([double]$adminResp.latency_ms)
  }
  if ($tickerResp) {
    $tickerLatencies.Add([double]$tickerResp.latency_ms)
    $tickerStatusCodes.Add([int]$tickerResp.status_code)
  }

  $samplesRaw += [ordered]@{
    ts = (Get-Date -Format o)
    prefetch = $prefetchResp
    market_observability = $marketObsResp
    admin_stats = $adminResp
    ticker_probe = $tickerResp
  }

  if ($i -lt $Samples) {
    Start-Sleep -Seconds $IntervalSeconds
  }
}

$marketOverallLast = $null
$marketEndpointsLast = $null
if ($samplesRaw.Count -gt 0) {
  $last = $samplesRaw[$samplesRaw.Count - 1]
  $marketOverallLast = $last.market_observability.body.overall
  $marketEndpointsLast = $last.market_observability.body.endpoints
}

$tickerRequestCount = [double]($tickerStatusCodes.Count)
$ticker429Count = [double](($tickerStatusCodes | Where-Object { $_ -eq 429 }).Count)
$ticker429Ratio = if ($tickerRequestCount -gt 0) { [Math]::Round(($ticker429Count / $tickerRequestCount) * 100, 2) } else { $null }

$multiplierDelta = $null
if ($multiplierTotals.Count -ge 2) {
  $multiplierDelta = [double]($multiplierTotals[$multiplierTotals.Count - 1] - $multiplierTotals[0])
}
$skipDelta = $null
if ($skipTotals.Count -ge 2) {
  $skipDelta = [double]($skipTotals[$skipTotals.Count - 1] - $skipTotals[0])
}

$summary = [ordered]@{
  collected_at = (Get-Date -Format o)
  api_base = $ApiBase
  samples = $Samples
  interval_seconds = $IntervalSeconds
  symbol_probe = $Symbol
  auth_enabled = ($authHeaders.Count -gt 0)
  kpi = [ordered]@{
    prefetch_healthy_ratio_pct = [Math]::Round(($prefetchHealthyCount / $Samples) * 100, 2)
    prefetch_freshness = [ordered]@{
      sample_count = $freshnessValues.Count
      p50_seconds = [Math]::Round((Percentile -Values $freshnessValues.ToArray() -P 0.50), 2)
      p95_seconds = [Math]::Round((Percentile -Values $freshnessValues.ToArray() -P 0.95), 2)
      max_seconds = if ($freshnessValues.Count -gt 0) { [Math]::Round(($freshnessValues | Measure-Object -Maximum).Maximum, 2) } else { $null }
    }
    endpoint_latency_p95_ms = [ordered]@{
      prefetch_health = [Math]::Round((Percentile -Values $prefetchLatencies.ToArray() -P 0.95), 2)
      market_observability = [Math]::Round((Percentile -Values $marketObsLatencies.ToArray() -P 0.95), 2)
      admin_ops_stats = if ($adminStatsLatencies.Count -gt 0) { [Math]::Round((Percentile -Values $adminStatsLatencies.ToArray() -P 0.95), 2) } else { $null }
      realtime_ticker_probe = if ($tickerLatencies.Count -gt 0) { [Math]::Round((Percentile -Values $tickerLatencies.ToArray() -P 0.95), 2) } else { $null }
    }
    ticker_probe_429_ratio_pct = $ticker429Ratio
    policy_counters = [ordered]@{
      multiplier_total_first = if ($multiplierTotals.Count -gt 0) { $multiplierTotals[0] } else { $null }
      multiplier_total_last = if ($multiplierTotals.Count -gt 0) { $multiplierTotals[$multiplierTotals.Count - 1] } else { $null }
      multiplier_total_delta = $multiplierDelta
      skip_total_first = if ($skipTotals.Count -gt 0) { $skipTotals[0] } else { $null }
      skip_total_last = if ($skipTotals.Count -gt 0) { $skipTotals[$skipTotals.Count - 1] } else { $null }
      skip_total_delta = $skipDelta
    }
    market_observability_overall_last = $marketOverallLast
    market_observability_endpoints_last = $marketEndpointsLast
  }
}

Save-JsonArtifact -Path (Join-Path $runDir "baseline-samples.json") -Object $samplesRaw
Save-JsonArtifact -Path (Join-Path $runDir "baseline-summary.json") -Object $summary

$summaryLines = @(
  "# Prefetch Policy Baseline Summary",
  "",
  "- Collected at: $($summary.collected_at)",
  "- API base: $ApiBase",
  "- Samples: $Samples (interval ${IntervalSeconds}s)",
  "- Request timeout: ${RequestTimeoutSec}s",
  "- Auth enabled: $($summary.auth_enabled)",
  "",
  "## KPI Snapshot",
  "",
  "- Prefetch healthy ratio: $(Format-Maybe $summary.kpi.prefetch_healthy_ratio_pct)%",
  "- Freshness p95: $(Format-Maybe $summary.kpi.prefetch_freshness.p95_seconds)s",
  "- Latency p95 /api/health/prefetch: $(Format-Maybe $summary.kpi.endpoint_latency_p95_ms.prefetch_health)ms",
  "- Latency p95 /api/health/market-observability: $(Format-Maybe $summary.kpi.endpoint_latency_p95_ms.market_observability)ms",
  "- Latency p95 /api/admin-ops/stats: $(Format-Maybe $summary.kpi.endpoint_latency_p95_ms.admin_ops_stats)ms",
  "- Latency p95 /api/realtime/ticker/${Symbol}: $(Format-Maybe $summary.kpi.endpoint_latency_p95_ms.realtime_ticker_probe)ms",
  "- Ticker probe 429 ratio: $(Format-Maybe $summary.kpi.ticker_probe_429_ratio_pct)%",
  "- Policy counter delta (429 multiplier): $(Format-Maybe $summary.kpi.policy_counters.multiplier_total_delta)",
  "- Policy counter delta (skip): $(Format-Maybe $summary.kpi.policy_counters.skip_total_delta)",
  "",
  "## Artifacts",
  "",
  "- baseline-samples.json",
  "- baseline-summary.json",
  "- _run.log"
)

Set-Content -Path (Join-Path $runDir "README.md") -Value $summaryLines -Encoding utf8
Write-RunLog "Baseline capture completed. Artifacts: $runDir"
