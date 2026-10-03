# stop_hybrid.ps1
# Tắt hybrid mode: dừng backend/frontend local, khởi động lại chúng bằng Docker.
# Dùng: .\stop_hybrid.ps1

$ErrorActionPreference = "SilentlyContinue"
$Root = Split-Path $MyInvocation.MyCommand.Path -Parent

Write-Host ""
Write-Host "======================================================"
Write-Host " STOP HYBRID  —  Khoi phuc full Docker mode"
Write-Host "======================================================"

# ── Dừng process cục bộ trên cổng 8000 (backend Daphne) ──────────
Write-Host ""
Write-Host "==> [1/3] Tat backend local (cong 8000)..."
$listening8000 = netstat -ano 2>$null |
    Select-String '^\s+TCP\s+.*:8000\s+.*LISTENING' |
    ForEach-Object { ($_ -split '\s+')[-1] } |
    Select-Object -Unique
foreach ($pid in $listening8000) {
    if ($pid -match '^\d+$' -and [int]$pid -gt 0) {
        try { Stop-Process -Id ([int]$pid) -Force; Write-Host "    Killed PID $pid" } catch {}
    }
}

# ── Dừng process cục bộ trên cổng 8080 (frontend node) ──────────
Write-Host "==> [2/3] Tat frontend local (cong 8080)..."
$listening8080 = netstat -ano 2>$null |
    Select-String '^\s+TCP\s+.*:8080\s+.*LISTENING' |
    ForEach-Object { ($_ -split '\s+')[-1] } |
    Select-Object -Unique
foreach ($pid in $listening8080) {
    if ($pid -match '^\d+$' -and [int]$pid -gt 0) {
        try { Stop-Process -Id ([int]$pid) -Force; Write-Host "    Killed PID $pid" } catch {}
    }
}

# ── Khởi động lại Docker backend + frontend ──────────────────────
Write-Host ""
Write-Host "==> [3/3] Khoi phuc backend va frontend Docker..."
docker start vninvest-dev-backend
docker start vninvest-dev-frontend

# ── Tóm tắt ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================================"
Write-Host " Full Docker mode da khoi phuc:"
Write-Host "   Backend  : http://localhost:8000  (Docker)"
Write-Host "   Frontend : http://localhost:8080  (Docker)"
Write-Host "======================================================"
Write-Host " De quay lai hybrid: .\start_hybrid.ps1"
Write-Host ""
