param(
  [string]$AppDir = "c:/Mujoco Projects/vninvest/backend",
  [string]$PythonExe = "c:/Mujoco Projects/vninvest/backend/.venv/Scripts/python.exe",
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$OutDir = "c:/Mujoco Projects/vninvest/docs/ops-evidence/sprint23",
  [switch]$SkipTests,
  [switch]$SkipNetworkChecks
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Write-Step([string]$Title) {
  "`n=== $Title ===" | Tee-Object -FilePath "$OutDir/_run.log" -Append
}

Write-Step "Preflight health checks"
if ($SkipNetworkChecks) {
  "Skipped network health checks (-SkipNetworkChecks)." | Tee-Object "$OutDir/preflight.txt"
} else {
  Invoke-WebRequest "$ApiBase/api/health/" -UseBasicParsing | Select-Object StatusCode | Tee-Object "$OutDir/preflight.txt"
  Invoke-WebRequest "$ApiBase/api/health/realtime/" -UseBasicParsing | Select-Object StatusCode | Tee-Object -Append "$OutDir/preflight.txt"
  Invoke-WebRequest "$ApiBase/api/health/prefetch/" -UseBasicParsing | Select-Object StatusCode | Tee-Object -Append "$OutDir/preflight.txt"
  Invoke-WebRequest "$ApiBase/api/health/market-observability/" -UseBasicParsing | Select-Object StatusCode | Tee-Object -Append "$OutDir/preflight.txt"
}

Write-Step "Capture observability snapshot"
if ($SkipNetworkChecks) {
  "{}" | Out-File "$OutDir/market-observability.json" -Encoding utf8
} else {
  Invoke-WebRequest "$ApiBase/api/health/market-observability/" -UseBasicParsing | Select-Object -ExpandProperty Content | Out-File "$OutDir/market-observability.json" -Encoding utf8
}

Write-Step "Flag snapshot"
Set-Location $AppDir
& $PythonExe manage.py shell -c "from django.conf import settings; print({'ENABLE_NEW_MARKET_VIEWS': settings.ENABLE_NEW_MARKET_VIEWS, 'MARKET_VIEWS_CANARY_PERCENT': settings.MARKET_VIEWS_CANARY_PERCENT, 'ENABLE_NEW_TRADING_VIEWS': settings.ENABLE_NEW_TRADING_VIEWS, 'MARKET_OBSERVABILITY_ENABLED': settings.MARKET_OBSERVABILITY_ENABLED, 'MARKET_OBSERVABILITY_LATENCY_WINDOW': settings.MARKET_OBSERVABILITY_LATENCY_WINDOW})" | Tee-Object "$OutDir/flags-snapshot.txt"

if (-not $SkipTests) {
  Write-Step "Focused backend regression"
  & $PythonExe manage.py test portfolio.tests.test_observability portfolio.tests.test_order_flow portfolio.tests.test_realtime_compute portfolio.tests.test_api_routes --verbosity=1 | Tee-Object "$OutDir/focused-regression.txt"
}

Write-Step "Artifact index"
Get-ChildItem $OutDir | Select-Object Name,Length,LastWriteTime | Tee-Object "$OutDir/_artifact-index.txt"

Write-Step "Completed"
"Sprint23 rollout evidence collection finished at $(Get-Date -Format o)" | Tee-Object -FilePath "$OutDir/_run.log" -Append
