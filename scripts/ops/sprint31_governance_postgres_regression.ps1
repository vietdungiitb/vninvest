param(
  [string]$ProjectRoot = "c:\Mujoco Projects\vninvest",
  [string]$PythonExe = "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe",
  [string]$DbName = "vninvest",
  [string]$DbUser = "postgres",
  [System.Security.SecureString]$DbPassword,
  [string]$DbHost = "localhost",
  [string]$DbPort = "5432",
  [switch]$NoKeepDb
)

$ErrorActionPreference = "Stop"

Write-Host "=== Sprint 31 governance postgres regression ==="

$backendPath = Join-Path $ProjectRoot "backend"
if (-not (Test-Path $backendPath)) {
  throw "Backend path not found: $backendPath"
}
if (-not (Test-Path $PythonExe)) {
  throw "Python executable not found: $PythonExe"
}

$tcp = Test-NetConnection -ComputerName $DbHost -Port ([int]$DbPort) -WarningAction SilentlyContinue
if (-not $tcp.TcpTestSucceeded) {
  throw "PostgreSQL is not reachable at ${DbHost}:${DbPort}."
}

if (-not $DbPassword) {
  $passwordFromEnv = [string]$env:POSTGRES_PASSWORD
  if ([string]::IsNullOrWhiteSpace($passwordFromEnv)) {
    throw "Missing DB password. Provide -DbPassword or set POSTGRES_PASSWORD env variable."
  }
  $DbPassword = ConvertTo-SecureString -String $passwordFromEnv -AsPlainText -Force
}

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPassword)
try {
  $dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$env:DB_ENGINE = "postgres"
$env:POSTGRES_DB = $DbName
$env:POSTGRES_USER = $DbUser
$env:POSTGRES_PASSWORD = $dbPasswordPlain
$env:POSTGRES_HOST = $DbHost
$env:POSTGRES_PORT = $DbPort

$testArgs = @(
  "manage.py",
  "test",
  "portfolio.tests.test_system_ai_admin_api",
  "portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_supports_governance_day_bucket",
  "portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_returns_400_for_invalid_governance_bucket",
  "portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_applies_governance_endpoint_reason_filters",
  "portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_observability_get_includes_governance_delta_thresholds",
  "--noinput"
)

if (-not $NoKeepDb) {
  $testArgs += "--keepdb"
}

Push-Location $backendPath
try {
  & $PythonExe @testArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Regression tests failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

Write-Host "=== Governance postgres regression: OK ==="
