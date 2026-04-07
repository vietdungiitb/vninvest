# start_stack.ps1 — Khởi động backend throughput stack cho Windows
# Chạy từ thư mục backend: .\start_stack.ps1
# Mở 3 cửa sổ riêng: Daphne, Celery worker, Celery beat

$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $BackendDir "..")
$PythonExe = (Resolve-Path (Join-Path $RepoRoot ".venv\Scripts\python.exe")).Path

function Start-StackWindow {
    param(
        [string]$Title,
        [string]$Command
    )

    $escapedPython = $PythonExe.Replace("'", "''")
    $escapedBackendDir = $BackendDir.Replace("'", "''")
    $psCommand = "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$escapedBackendDir'; & '$escapedPython' $Command"

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        $psCommand
    ) | Out-Null
}

Write-Host "==> Starting VNInvest throughput stack"
Write-Host "    Backend dir: $BackendDir"
Write-Host "    Python:      $PythonExe"

Start-StackWindow -Title "VNInvest Backend" -Command "-m daphne --bind 127.0.0.1 --port 8000 config.asgi:application"
Start-StackWindow -Title "VNInvest Celery Worker" -Command "-m celery -A config worker -l info -P solo"
Start-StackWindow -Title "VNInvest Celery Beat" -Command "-m celery -A config beat -l info"

Write-Host "==> Started: backend + worker + beat"
Write-Host "==> Verify health: http://127.0.0.1:8000/api/health/prefetch/"