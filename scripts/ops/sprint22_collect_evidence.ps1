param(
  [string]$AppDir = "c:/Mujoco Projects/vninvest/backend",
  [string]$PythonExe = "c:/Mujoco Projects/vninvest/backend/.venv/Scripts/python.exe",
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$FrontendDir = "c:/Mujoco Projects/vninvest/frontend",
  [string]$OutDir = "c:/Mujoco Projects/vninvest/docs/ops-evidence/sprint22"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Write-Step([string]$Title) {
  "`n=== $Title ===" | Tee-Object -FilePath "$OutDir/_run.log" -Append
}

Write-Step "Preflight health checks"
Invoke-WebRequest "$ApiBase/admin/login/" -UseBasicParsing | Select-Object StatusCode | Tee-Object "$OutDir/preflight.txt"
Invoke-WebRequest "$ApiBase/api/health/realtime/" -UseBasicParsing | Select-Object StatusCode | Tee-Object -Append "$OutDir/preflight.txt"

Write-Step "Flag snapshot"
Set-Location $AppDir
& $PythonExe manage.py shell -c "from django.conf import settings; print({'ENABLE_NEW_MARKET_VIEWS': settings.ENABLE_NEW_MARKET_VIEWS, 'ENABLE_NEW_TRADING_VIEWS': settings.ENABLE_NEW_TRADING_VIEWS, 'ENABLE_REALTIME_CONNECTION_MANAGER': settings.ENABLE_REALTIME_CONNECTION_MANAGER})" | Tee-Object "$OutDir/flags-snapshot.txt"

Write-Step "Focused backend regression"
& $PythonExe manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_realtime_ticker_endpoint_uses_refactored_market_view_when_flag_enabled portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_whale_feed_aggregate_endpoint_uses_refactored_market_view_when_flag_enabled portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_portfolio_endpoint_uses_refactored_trading_view_when_flag_enabled | Tee-Object "$OutDir/focused-regression.txt"

Write-Step "Frontend build evidence"
Set-Location $FrontendDir
npm run build | Tee-Object "$OutDir/frontend-build.txt"

Write-Step "Artifact index"
Get-ChildItem $OutDir | Select-Object Name,Length,LastWriteTime | Tee-Object "$OutDir/_artifact-index.txt"

Write-Step "Completed"
"Sprint22 evidence collection finished at $(Get-Date -Format o)" | Tee-Object -FilePath "$OutDir/_run.log" -Append
