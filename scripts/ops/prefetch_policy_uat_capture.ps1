param(
  [string]$ApiBase = "http://127.0.0.1:8010",
  [string]$AccessToken,
  [string]$OutDir = "c:/Mujoco Projects/vninvest/docs/ops-evidence/prefetch-policy-uat",
  [string]$RunLabel = "20260412-canary-exit",
  [string]$ValidPolicyPatchPath,
  [string]$InvalidPolicyPatchPath
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AccessToken)) {
  throw "AccessToken is required (Bearer token for admin endpoints)."
}

$runDir = Join-Path $OutDir $RunLabel
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$headers = @{ Authorization = "Bearer $AccessToken" }

function Save-Json {
  param([string]$Path, $Value)
  $json = $Value | ConvertTo-Json -Depth 30
  Set-Content -Path $Path -Value $json -Encoding utf8
}

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    $Body = $null,
    [switch]$AllowFailure
  )

  $params = @{
    Method = $Method
    Uri = $Url
    Headers = $headers
    TimeoutSec = 20
    UseBasicParsing = $true
    ErrorAction = "Stop"
  }

  if ($null -ne $Body) {
    $params["ContentType"] = "application/json"
    $params["Body"] = ($Body | ConvertTo-Json -Depth 30)
  }

  try {
    $resp = Invoke-WebRequest @params
    $data = $null
    if ($resp.Content) {
      try {
        $data = $resp.Content | ConvertFrom-Json
      } catch {
        $data = @{ raw = $resp.Content }
      }
    }
    return @{ ok = $true; status = [int]$resp.StatusCode; body = $data }
  } catch {
    $webResponse = $_.Exception.Response
    if ($null -eq $webResponse) {
      if ($AllowFailure) {
        return @{ ok = $false; status = -1; body = @{ error = [string]$_.Exception.Message } }
      }
      throw
    }

    $reader = New-Object System.IO.StreamReader($webResponse.GetResponseStream())
    $raw = $reader.ReadToEnd()
    $reader.Dispose()

    $parsed = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
      try {
        $parsed = $raw | ConvertFrom-Json
      } catch {
        $parsed = @{ raw = $raw }
      }
    }

    if ($AllowFailure) {
      return @{ ok = $false; status = [int]$webResponse.StatusCode; body = $parsed }
    }

    throw
  }
}

# S1 - capture before/after around save
$settingsBefore = Invoke-Json -Method "GET" -Url "$ApiBase/api/admin-ops/system-ai-settings/"
Save-Json -Path (Join-Path $runDir "s1-settings-before.json") -Value $settingsBefore

if (-not [string]::IsNullOrWhiteSpace($ValidPolicyPatchPath) -and (Test-Path $ValidPolicyPatchPath)) {
  $validPatch = Get-Content -Path $ValidPolicyPatchPath -Raw -Encoding utf8 | ConvertFrom-Json
  $s1Update = Invoke-Json -Method "PUT" -Url "$ApiBase/api/admin-ops/system-ai-settings/" -Body @{ prefetch_time_policy = $validPatch }
  Save-Json -Path (Join-Path $runDir "s1-settings-update-response.json") -Value $s1Update
}

$settingsAfter = Invoke-Json -Method "GET" -Url "$ApiBase/api/admin-ops/system-ai-settings/"
Save-Json -Path (Join-Path $runDir "s1-settings-after.json") -Value $settingsAfter

# Health/policy metadata snapshot
$healthPrefetch = Invoke-Json -Method "GET" -Url "$ApiBase/api/health/prefetch/" -AllowFailure
$healthMarketObs = Invoke-Json -Method "GET" -Url "$ApiBase/api/health/market-observability/" -AllowFailure
$adminStats = Invoke-Json -Method "GET" -Url "$ApiBase/api/admin-ops/stats/" -AllowFailure

Save-Json -Path (Join-Path $runDir "health-policy-metadata.json") -Value @{
  collected_at = (Get-Date -Format o)
  prefetch_health = $healthPrefetch
  market_observability = $healthMarketObs
  admin_ops_stats = $adminStats
}

# S2 metrics snapshot (offhours verification input)
Save-Json -Path (Join-Path $runDir "s2-offhours-skip-metrics.json") -Value @{
  collected_at = (Get-Date -Format o)
  source = "health + market observability"
  prefetch_health = $healthPrefetch
  market_observability = $healthMarketObs
  note = "Run this during offhours after query_enabled=false to assert skip counters increase."
}

# S3 adaptive interval snapshot (without forcing 429)
$policy = $settingsAfter.body.prefetch_time_policy
$guard = $null
if ($policy -and $policy.rate_limit_guard) {
  $guard = $policy.rate_limit_guard
}

Save-Json -Path (Join-Path $runDir "s3-429-adaptive-interval.json") -Value @{
  collected_at = (Get-Date -Format o)
  rate_limit_guard = $guard
  prefetch_health = $healthPrefetch
  market_observability = $healthMarketObs
  note = "This file captures current guard config and counters. To complete S3, run with a real/simulated 429 event."
}

# S4 invalid config attempt
$invalidPayload = $null
if (-not [string]::IsNullOrWhiteSpace($InvalidPolicyPatchPath) -and (Test-Path $InvalidPolicyPatchPath)) {
  $invalidPayload = Get-Content -Path $InvalidPolicyPatchPath -Raw -Encoding utf8 | ConvertFrom-Json
} else {
  $invalidPayload = @{
    market = @{
      timezone = "Asia/Ho_Chi_Minh"
      open_time = "15:30"
      close_time = "09:00"
      lunch_start = "11:30"
      lunch_end = "13:00"
      pre_open_minutes = 30
      post_close_minutes = 30
    }
  }
}

$s4Resp = Invoke-Json -Method "PUT" -Url "$ApiBase/api/admin-ops/system-ai-settings/" -Body @{ prefetch_time_policy = $invalidPayload } -AllowFailure
Save-Json -Path (Join-Path $runDir "s4-invalid-config-400.json") -Value $s4Resp

# Fallback/log placeholder
Set-Content -Path (Join-Path $runDir "fallback-log-snippet.txt") -Encoding utf8 -Value @(
  "Capture app log lines that indicate fallback path during this UAT run.",
  "Suggested grep keywords: fallback, throttled_by_policy, rate-limited, multiplier.",
  "If no fallback occurred, write 'NO_FALLBACK_OBSERVED'."
)

# Manual screenshot placeholder
Set-Content -Path (Join-Path $runDir "s1-admin-save-before-after.png.txt") -Encoding utf8 -Value @(
  "Manual step required:",
  "1) Take screenshot before save.",
  "2) Take screenshot after save.",
  "3) Export/merge as s1-admin-save-before-after.png"
)

Write-Host "UAT evidence captured in: $runDir"
