param(
  [string]$BackendDir = "c:/Mujoco Projects/vninvest/backend",
  [string]$FrontendDir = "c:/Mujoco Projects/vninvest/frontend",
  [string]$PythonExe = "c:/Mujoco Projects/vninvest/backend/.venv/Scripts/python.exe",
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$OutDir = "c:/Mujoco Projects/vninvest/docs/ops-evidence/sprint24",
  [switch]$SkipNetworkChecks
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Write-Step([string]$Title) {
  "`n=== $Title ===" | Tee-Object -FilePath "$OutDir/_run.log" -Append
}

Write-Step "Frontend build evidence"
Set-Location $FrontendDir
npm run build | Tee-Object "$OutDir/frontend-build.txt"

Write-Step "Backend route smoke evidence"
Set-Location $BackendDir
& $PythonExe manage.py test portfolio.tests.test_api_routes --verbosity=1 2>&1 | Select-String -Pattern "^(OK|Ran |FAILED|FAIL|ERROR)" | Tee-Object "$OutDir/backend-route-smoke.txt"

Write-Step "Network checks"
if ($SkipNetworkChecks) {
  "Skipped network checks (-SkipNetworkChecks)." | Tee-Object "$OutDir/network-checks.txt"
} else {
  Invoke-WebRequest "$ApiBase/api/health/" -UseBasicParsing | Select-Object StatusCode | Tee-Object "$OutDir/network-checks.txt"
}

Write-Step "Artifact index"
Get-ChildItem $OutDir | Select-Object Name,Length,LastWriteTime | Tee-Object "$OutDir/_artifact-index.txt"

Write-Step "Completed"
"Sprint24 dashboard evidence collection finished at $(Get-Date -Format o)" | Tee-Object -FilePath "$OutDir/_run.log" -Append
