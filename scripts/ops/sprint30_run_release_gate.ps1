param(
  [string]$ApiBase = "http://127.0.0.1:8000",
  [System.Management.Automation.PSCredential]$Credential,
  [System.Security.SecureString]$AccessToken,
  [System.Security.SecureString]$PostgresPassword,
  [switch]$SkipNetworkChecks,
  [switch]$SkipDeployEvidence,
  [switch]$SkipRuntimeKpiSmoke,
  [switch]$SkipGovernanceRegression
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$deployEvidenceParams = @{
  ApiBase = $ApiBase
}
if ($SkipNetworkChecks) {
  $deployEvidenceParams.SkipNetworkChecks = $true
}

if (-not $SkipDeployEvidence) {
  Write-Host "=== Sprint 30 release gate: collect deploy evidence ==="
  & (Join-Path $ScriptRoot "sprint30_collect_deploy_evidence.ps1") @deployEvidenceParams
} else {
  Write-Host "=== Sprint 30 release gate: skip deploy evidence (-SkipDeployEvidence) ==="
}

if (-not $SkipRuntimeKpiSmoke) {
  Write-Host "=== Sprint 30 release gate: runtime KPI smoke ==="
  if ($AccessToken) {
    & (Join-Path $ScriptRoot "sprint30_runtime_kpi_smoke.ps1") -ApiBase $ApiBase -AccessToken $AccessToken
  } else {
    if ($null -eq $Credential) {
      throw "Provide either -AccessToken or -Credential when running runtime KPI smoke."
    }
    & (Join-Path $ScriptRoot "sprint30_runtime_kpi_smoke.ps1") -ApiBase $ApiBase -Credential $Credential
  }
} else {
  Write-Host "=== Sprint 30 release gate: skip runtime KPI smoke (-SkipRuntimeKpiSmoke) ==="
}

if (-not $SkipGovernanceRegression) {
  Write-Host "=== Sprint 30 release gate: governance postgres regression ==="
  $governanceScript = Join-Path $ScriptRoot "sprint31_governance_postgres_regression.ps1"
  if ($PostgresPassword) {
    & $governanceScript -DbPassword $PostgresPassword
  } else {
    & $governanceScript
  }
} else {
  Write-Host "=== Sprint 30 release gate: skip governance regression (-SkipGovernanceRegression) ==="
}

Write-Host "=== Sprint 30 release gate completed ==="
Write-Host "Review artifacts under docs/ops-evidence/sprint30/ before final GO/NO-GO sign-off."
