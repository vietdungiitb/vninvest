# start_test_stack.ps1 — One command to start full local test stack on Windows
# Launches: backend (Daphne), Celery worker, Celery beat, frontend dev server
# Run from repo root: .\start_test_stack.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$RepoVenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $BackendDir)) {
    throw "Backend directory not found: $BackendDir"
}
if (-not (Test-Path $FrontendDir)) {
    throw "Frontend directory not found: $FrontendDir"
}

Write-Host "==> Starting VNInvest full test stack"
Write-Host "    Repo:     $RepoRoot"
Write-Host "    Backend:  $BackendDir"
Write-Host "    Frontend: $FrontendDir"

# Stop old stack processes from this repo to avoid duplicate workers/port conflicts.
$targets = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and (
        ($_.CommandLine -like "*$BackendDir*") -or
        ($_.CommandLine -like "*$FrontendDir*") -or
        ($_.CommandLine -like "*$RepoVenvPython*")
    ) -and (
        ($_.CommandLine -match "-m daphne") -or
        ($_.CommandLine -match "-m celery") -or
        ($_.CommandLine -match "manage.py runserver") -or
        ($_.CommandLine -match "react-scripts start")
    )
}

if ($targets) {
    $targets | ForEach-Object {
        try {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
        } catch {
        }
    }
    Write-Host "==> Cleaned old stack processes: $($targets.Count)"
}

# Start backend + worker + beat in separate windows
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$BackendDir'; .\start_stack.ps1"
) | Out-Null

# Start frontend dev server in another window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$FrontendDir'; npm start"
) | Out-Null

Write-Host "==> Launched: backend + celery worker + celery beat + frontend"
Write-Host "==> Open: http://localhost:3000"
Write-Host "==> API:  http://127.0.0.1:8000"
