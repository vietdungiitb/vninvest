# start_backend.ps1 — Khởi động Daphne cho local backend
# Chạy từ thư mục backend: .\start_backend.ps1

$ErrorActionPreference = "Stop"
$VENV_PYTHON = "..\\.venv\\Scripts\\python.exe"
$DAPHNE_HOST = if ($env:DAPHNE_HOST)    { $env:DAPHNE_HOST }    else { "127.0.0.1" }
$PORT        = if ($env:DAPHNE_PORT)    { $env:DAPHNE_PORT }    else { "8000" }

Write-Host "==> Daphne $DAPHNE_HOST`:$PORT"
& $VENV_PYTHON -m daphne `
    --bind $DAPHNE_HOST `
    --port $PORT `
    config.asgi:application
