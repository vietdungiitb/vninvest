# start_backend.ps1 — Khởi động Daphne với thread pool tăng cường
# Chạy từ thư mục backend: .\start_backend.ps1
# Biến DAPHNE_THREADS điều chỉnh số thread (mặc định 20)

$ErrorActionPreference = "Stop"
$VENV_PYTHON = "..\\.venv\\Scripts\\python.exe"
$THREADS     = if ($env:DAPHNE_THREADS) { $env:DAPHNE_THREADS } else { "20" }
$HOST        = if ($env:DAPHNE_HOST)    { $env:DAPHNE_HOST }    else { "127.0.0.1" }
$PORT        = if ($env:DAPHNE_PORT)    { $env:DAPHNE_PORT }    else { "8000" }

Write-Host "==> Daphne $HOST`:$PORT  threads=$THREADS"
& $VENV_PYTHON -m daphne `
    --bind $HOST `
    --port $PORT `
    --threads $THREADS `
    config.asgi:application
