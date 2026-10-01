#!/usr/bin/env pwsh
# Kiểm tra bàn giao của agent — thay vì để supervisor "nhớ" kiểm.
#
# ## Vì sao file này tồn tại
#
# Trong phiên làm việc này, supervision thất bại **hai lần**, cả hai đều do
# thiếu cơ chế chứ không phải do thiếu cẩn thận:
#
# 1. **Tiến trình con sống sót.** Task agent bị huỷ nhưng `run_tests.py` vẫn chạy,
#    giữ chặn test database ⇒ mọi lần chạy sau **deadlock**. Tìm ra mất thời
#    gian vì lọc process bằng `Name='python.exe'` — **bỏ sót `python3.13.exe`**,
#    đúng interpreter mà `manage.py` dùng. Và trước khi tìm ra, đã khẳng định
#    "có tiến trình khác" **không có bằng chứng**.
#
# 2. **Postgres chết giữa chừng.** Cổng 5433 vẫn OPEN nên tưởng DB còn; thật ra
#    handshake không hoàn tất (`ConnectionTimeout`). Đoán sai.
#
# Bài học: kiểm tra bằng **hành vi quan sát được** (exit code, số test), không
# bằng suy luận. Script này biến 4 thứ đó thành exit code.
#
# ## Dùng
#
# ```powershell
# pwsh -File scripts/verify-agent-handover.ps1 -Apps identity_access,service_ops
# ```
#
# Exit 0 = sạch. Exit khác = có vấn đề, và script nói vấn đề nào.

[CmdletBinding()]
param(
    # Các app phải có `UNWRAPPED: 0` sau khi bọc envelope.
    # Nhận cả hai dạng: `-Apps a,b` và `-Apps a b`.
    [string[]] $Apps = @(),

    # Branch/baseline đã biết là có sẵn, dùng để đối chiếu DB test.
    [string] $Database = 'w3seed',

    # Bỏ qua bước kiểm Postgres (khi DB chủ động không chạy).
    [switch] $SkipDatabase,

    # Đường dẫn `packages/core/backend` cần kiểm.
    #
    # Mặc định lấy từ vị trí script — nhưng điều đó **sai** khi gọi từ cây
    # chính để kiểm worktree của agent: nó sẽ đọc `dev` và báo xanh cho những
    # thứ chưa merge. Đã xảy ra đúng một lần. Worktree phải truyền tường minh.
    [string] $Backend = (Join-Path $PSScriptRoot '..\packages\core\backend')
)

$ErrorActionPreference = 'Continue'
$problems = New-Object System.Collections.Generic.List[string]

# `-Apps a,b` trong PowerShell PowerShell truyen **mot chuoi** "a,b", khong
# phai mang. Tach lai de ca hai dang deu dung — neu khong, lenh se bao gate
# fail tren ten app sai va tao canh bao gia.
$AppList = @($Apps | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne '' })

function Add-Problem([string] $message) {
    $problems.Add($message)
    Write-Host "  [VAN DE] $message" -ForegroundColor Red
}

Write-Host '=== 1. TIEN TRINH CON SOI SOT ===' -ForegroundColor Cyan
# Bắt **cả hai** tên: `manage.py test` có thể chạy dưới `python.exe` lẫn
# `python3.13.exe` tuỳ cach `python` duoc resolve. Lọc mot ten la sai cach
# (da gap mot lan roi).
$orphans = Get-CimInstance Win32_Process |
    Where-Object {
        $_.Name -match '^python' -and
        $_.CommandLine -match 'manage\.py test|run_tests\.py'
    }
if ($orphans) {
    foreach ($p in $orphans) {
        Add-Problem "tien trinh test con song: pid=$($p.ProcessId) $($p.Name)"
    }
} else {
    Write-Host '  OK: khong co tien trinh test troi' -ForegroundColor Green
}

Write-Host '=== 2. DATABASE TEST CON SOT ===' -ForegroundColor Cyan
if ($SkipDatabase) {
    Write-Host '  BO QUA (theo -SkipDatabase)' -ForegroundColor Yellow
} else {
    $dockerOk = $false
    try { $null = docker ps 2>&1; $dockerOk = $LASTEXITCODE -eq 0 } catch { $dockerOk = $false }

    if (-not $dockerOk) {
        Add-Problem 'Docker daemon khong phan hoi — chua chay duoc gate nao can DB'
    } else {
        $q = "SELECT datname FROM pg_database WHERE datname LIKE 'test_%' AND datname NOT LIKE '%template%';"
        $rows = docker exec vninvest-dev-core-db psql -U vninvest -d postgres -t -c $q 2>&1 |
            ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ -match '^test_' }
        if ($rows) {
            foreach ($r in $rows) {
                Add-Problem "database test con sot: $r (can DROP neu khong dung)"
            }
        } else {
            Write-Host '  OK: khong co database test sot' -ForegroundColor Green
        }

        # Kiem tra **handshake** chu khong chi cong TCP. Cong 5433 mo nhung
        # Postgres da chet van de socket — day la cach toi doan sai mot lan.
        $env:CORE_DATABASE_URL = "postgresql://vninvest:devpassword@127.0.0.1:5433/$Database"
        $probe = python -c "import psycopg,sys; psycopg.connect('$env:CORE_DATABASE_URL', connect_timeout=5); print('OK')" 2>&1 |
            ForEach-Object { $_.ToString().Trim() }
        if ($probe -match '^OK$') {
            Write-Host "  OK: handshake Postgres thanh cong ($Database)" -ForegroundColor Green
        } else {
            Add-Problem "Postgres khong phan hoi tren 5433 — ket noi that bi that bai"
        }
    }
}

Write-Host '=== 3. GATE ENVELOPE ===' -ForegroundColor Cyan
if ($AppList.Count -eq 0) {
    Write-Host '  BO QUA (khong truyen -Apps)' -ForegroundColor Yellow
} else {
    Push-Location $Backend
    try {
        foreach ($app in $AppList) {
            $out = python scripts/check-envelope-contract.py $app 2>&1
            $code = $LASTEXITCODE
            $wrapped = ($out | Select-String -Pattern '^WRAPPED:' | ForEach-Object { $_.ToString().Trim() })
            $unwrapped = ($out | Select-String -Pattern '^UNWRAPPED:' | ForEach-Object { $_.ToString().Trim() })
            $unver = ($out | Select-String -Pattern '^UNVERIFIED' | ForEach-Object { $_.ToString().Trim() })
            Write-Host "  $app -> $wrapped | $unwrapped | $unver"
            if ($code -ne 0) {
                Add-Problem "gate $app exit=$code (con diem chua boc)"
            }
        }
    } finally { Pop-Location }
}

Write-Host '=== 4. WORKTREE CON LAI ===' -ForegroundColor Cyan
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
# `git worktree list` in duong dan **co khoang trang** ("C:/Mujoco Projects/..")
# nen tach theo 2+ khoang trang, khong phai bat ky khoang trang nao.
$trees = git -C $repoRoot worktree list |
    Select-Object -Skip 1 |
    ForEach-Object { $_ -replace '^\s*(\S.*?)\s{2,}\S+ .*$', '$1' } |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and ($_ -ne $repoRoot) -and ($_ -notlike '*vninvest*') }
if ($trees) {
    Write-Host '  (khong phai loi — chi thong bao)' -ForegroundColor DarkGray
    $trees | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
} else {
    Write-Host '  OK: khong con worktree agent' -ForegroundColor Green
}

Write-Host ''
if ($problems.Count -eq 0) {
    Write-Host 'KET QUA: SANCH — ban giao duoc chap nhan.' -ForegroundColor Green
    exit 0
}
Write-Host "KET QUA: $($problems.Count) VAN DE — ban giao CHUA duoc chap nhan." -ForegroundColor Red
exit 1