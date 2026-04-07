# stop_test_stack.ps1 — One command to stop full local test stack on Windows
# Stops: backend (Daphne), Celery worker, Celery beat, frontend dev server
# Run from repo root: .\stop_test_stack.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$RepoVenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"

Write-Host "==> Stopping VNInvest full test stack"
Write-Host "    Repo:     $RepoRoot"

$targets = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and (
        ($_.CommandLine -like "*$BackendDir*") -or
        ($_.CommandLine -like "*$FrontendDir*") -or
        ($_.CommandLine -like "*$RepoVenvPython*")
    ) -and (
        ($_.CommandLine -match "-m daphne") -or
        ($_.CommandLine -match "-m celery") -or
        ($_.CommandLine -match "manage.py runserver") -or
        ($_.CommandLine -match "react-scripts start") -or
        ($_.CommandLine -match "npm start")
    )
}

if (-not $targets) {
    Write-Host "==> No stack processes found"
    exit 0
}

$stopped = 0
$failed = 0

$targets | ForEach-Object {
    try {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
        $stopped += 1
    } catch {
        $failed += 1
    }
}

Write-Host "==> Stopped: $stopped process(es)"
if ($failed -gt 0) {
    Write-Host "==> Failed to stop: $failed process(es)"
}

Start-Sleep -Milliseconds 300
$port8000 = netstat -ano | findstr ":8000"
if ($port8000) {
    Write-Host "==> Warning: port 8000 still has listeners/connections"
} else {
    Write-Host "==> Port 8000 is free"
}
