param(
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$Username,
  [string]$Password,
  [string]$AccessToken,
  [string]$Symbol = "FPT",
  [switch]$SkipNetworkChecks
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$deployEvidenceParams = @{
  ApiBase = $ApiBase
}
if ($SkipNetworkChecks) {
  $deployEvidenceParams.SkipNetworkChecks = $true
}

Write-Host "=== Sprint 29 release gate: collect deploy evidence ==="
& (Join-Path $ScriptRoot "sprint29_collect_deploy_evidence.ps1") @deployEvidenceParams

Write-Host "=== Sprint 29 release gate: advisory auth smoke ==="
if ($AccessToken) {
  & (Join-Path $ScriptRoot "sprint29_advisory_auth_smoke.ps1") -ApiBase $ApiBase -AccessToken $AccessToken -Symbol $Symbol
} else {
  & (Join-Path $ScriptRoot "sprint29_advisory_auth_smoke.ps1") -ApiBase $ApiBase -Username $Username -Password $Password -Symbol $Symbol
}

Write-Host "=== Sprint 29 release gate completed ==="
Write-Host "Review artifacts under docs/ops-evidence/sprint29/ before final GO/NO-GO sign-off."