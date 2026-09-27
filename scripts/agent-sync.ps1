#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Agent sync: đồng bộ branch của agent với dev mới nhất, an toàn.

.DESCRIPTION
  Chạy đúng thứ tự này, KHÔNG đảo. Mỗi bước có lý do cụ thể:

   1. Kiểm tra worktree sạch        — rebase trên code bẩn sẽ tạo conflict ở chỗ lạ
   2. git fetch origin              — luôn lấy dev mới nhất từ remote
   3. Rebase lên origin/dev         — đưa code của agent lên trên dev mới
   4. ĐÁNH SỐ LẠI MIGRATION        — SAU rebase, dev có thể đã có migration mới
                                     mà worktree không thấy (đã xảy ra thật:
                                     aicc_r0 145 vs vninvest_core 147)
   5. Chạy gate                    — rebase xong thì gate trước đó không còn đáng tin

  Bước 4 là bước hay bị bỏ, và là bước đã phá deploy trong phiên 2026-09-26.

.PARAMETER Rebase
  Dùng rebase (mặc định, lịch sử gọn, an toàn khi branch chưa push).
  Dùng -Merge nếu branch đã push và muốn giữ merge commit.

.PARAMETER SkipGates
  Chỉ dùng khi đang debug. KHÔNG dùng để "cho qua" rồi push.

.EXAMPLE
  pwsh -File scripts/agent-sync.ps1
  pwsh -File scripts/agent-sync.ps1 -SkipGates
#>
[CmdletBinding()]
param(
  [switch]$Merge,
  [switch]$SkipGates
)

$ErrorActionPreference = 'Stop'
function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Ok($msg)       { Write-Host "    OK  $msg" -ForegroundColor Green }
function Warn($msg)     { Write-Host "    !   $msg" -ForegroundColor Yellow }
function Die($msg)      { Write-Host "    X   $msg" -ForegroundColor Red; exit 1 }

$branch = git rev-parse --abbrev-ref HEAD
if ($branch -in @('main','dev','master')) {
  Die "Dang o branch '$branch'. Agent khong nen commit truc tiep vao branch tich hop. Hay tao feat/<...> truoc."
}

# ── 1. worktree sạch ─────────────────────────────────────────────────────────
Step 1 "Kiem tra worktree sach"
$dirty = git status --porcelain | Where-Object { $_ -notmatch 'node_modules|\.venv' }
if ($dirty) {
  Write-Host $dirty -ForegroundColor DarkGray
  Die "Worktree chua sach. Commit hoac stash truoc khi sync — rebase tren code ban se gay conflict o cho la."
}
Ok "sach"

# ── 2. fetch ─────────────────────────────────────────────────────────────────
Step 2 "git fetch origin"
git fetch origin --prune 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Die "fetch that bai" }
$behind = git rev-list --count HEAD..origin/dev
$ahead  = git rev-list --count origin/dev..HEAD
Ok "origin/dev: commit chua co o local=$behind, commit chua push=$ahead"

if ($behind -eq 0) {
  Ok "Da o bang voi origin/dev — khong co gi de sync."
}

# ── 3. rebase / merge ────────────────────────────────────────────────────────
if ($behind -gt 0) {
  Step 3 $(if ($Merge) { "Merge origin/dev vao branch" } else { "Rebase len origin/dev" })
  if ($Merge) { git merge --no-edit origin/dev } else { git rebase origin/dev }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "    Conflict. Giai quyet TAY, xong roi chay lai script nay." -ForegroundColor Yellow
    Die "rebase/merge that bai — xem git status"
  }
  Ok "xong, commit moi: " + (git rev-parse --short HEAD)
}

# ── 4. ĐÁNH SỐ LẠI MIGRATION ─────────────────────────────────────────────────
# Đây là bước chống lỗi phá deploy. Sau rebase, origin/dev có thể đã có
# migration mới mà worktree lúc tạo chưa có.
Step 4 "Kiem tra trung so migration (SAU khi sync)"
$migRoot = "packages/core/backend/src"
$conflicts = @()
foreach ($app in (Get-ChildItem $migRoot -Directory -ErrorAction SilentlyContinue)) {
  $mdir = Join-Path $app.FullName "migrations"
  if (-not (Test-Path $mdir)) { continue }
  $byNum = @{}
  Get-ChildItem $mdir -Filter "*.py" | Where-Object { $_.Name -ne '__init__.py' } | ForEach-Object {
    if ($_.Name -match '^(\d{4})_') {
      $n = $Matches[1]
      if (-not $byNum[$n]) { $byNum[$n] = @() }
      $byNum[$n] += $_.Name
    }
  }
  foreach ($n in $byNum.Keys) {
    if ($byNum[$n].Count -gt 1) {
      $conflicts += "  $($app.Name) so=$n : $($byNum[$n] -join ' + ')"
    }
  }
}
if ($conflicts) {
  $conflicts | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  Die "TRUNG SO MIGRATION tren branch nay. migrate se loi 'multiple leaf nodes'. Xem AGENT_PROTOCOL.md §4."
}
Ok "khong trung so migration tren branch"

# Head thật để đối chiếu, in ra cho agent tự động biết
Write-Host "    head hien tai:" -ForegroundColor DarkGray
Get-ChildItem $migRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
  $mdir = Join-Path $_.FullName "migrations"
  if (-not (Test-Path $mdir)) { return }
  $last = Get-ChildItem $mdir -Filter "0*.py" | Sort-Object Name | Select-Object -Last 1
  if ($last) { Write-Host ("      {0,-22} {1}" -f $_.Name, $last.Name) -ForegroundColor DarkGray }
}

# ── 5. gates ─────────────────────────────────────────────────────────────────
if ($SkipGates) { Warn "SkipGates — KHONG chay gate. Chi dung khi debug."; exit 0 }

Step 5 "Chay gate"
& node packages/web/scripts/check-multi-agent.mjs
if ($LASTEXITCODE -ne 0) { Die "check:multi-agent that bai" }

$touchedBE = git diff --name-only origin/dev...HEAD | Where-Object { $_ -like 'packages/core/backend/*' }
$touchedFE = git diff --name-only origin/dev...HEAD | Where-Object { $_ -like 'packages/web/*' -or $_ -like 'packages/web/*' }

if ($touchedFE) {
  Step 5b "tsc + build (web bi cham)"
  Push-Location packages/web
  npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { Pop-Location; Die "tsc that bai" }
  Ok "tsc 0 loi"

  # BUILD LA BAT BUOC, khong phai "cho co".
  #
  # 2026-09-27: Wave 2 (PR #27) import `alertCenterFormat.js` nhung file that la
  # `.ts`. `tsc` PASS (tu map `.js`->`.ts` theo allowJs) va `vitest` PASS 52/52
  # (resolver dev/test lenient hon Rollup) — CHI `vite build` bat. `dev` khong
  # bundle duoc, hotfix bang PR #28. Ba wave lien tiep deu bo qua vi tsc+vitest
  # deu xanh tren code lam hong build.
  #
  # Rollup resolve that hon cac gate kia, nen day moi la gate chung ta can.
  Step 5b2 "npm run build (bat Rollup resolve)"
  npm run build --silent
  if ($LASTEXITCODE -ne 0) { Pop-Location; Die "npm run build that bai — code se khong bundle duoc tren dev" }
  Pop-Location
  Ok "build thanh cong"
}

if ($touchedBE) {
  if (-not $env:CORE_DATABASE_URL) {
    Warn "Branch sua backend nhung CORE_DATABASE_URL chua set — BO QUA test BE."
    Warn "Khong duoc bao cao 'test PASS' khi chua chay. Xem AGENT_PROTOCOL.md §4."
  } else {
    Step 5c "manage.py check + test BE"
    $log = Join-Path $env:TEMP "agent-be-test.txt"
    Push-Location packages/core/backend
    python manage.py check
    if ($LASTEXITCODE -ne 0) { Pop-Location; Die "manage.py check that bai" }
    python manage.py test tests -v 0 *> $log
    $te = $LASTEXITCODE
    Pop-Location
    if ($te -ne 0) {
      Write-Host "    X   test BE that bai. Log: $log" -ForegroundColor Red
      Get-Content $log -Tail 12 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
      exit 1
    }
    Ok "test BE PASS (log: $log)"
  }
}

# ---------------------------------------------------------------------------
# Gate do bo GitHub Actions (2026-09-27) chuyen sang chay local.
#
# Ly do: 200/200 run gan nhat that bai, khong mot run xanh nao. Nguyen nhan goc
# la billing ("recent account payments have failed"), job fail sau 2-3 giay voi
# `steps=0` — runner chua chay buoc nao. Ca run cua `dev` cung fail nen CI
# khong bao gio co tin hieu. Xem `.github/workflows-disabled/README.md`.
#
# Logic gate nam trong script PowerShell local, KHONG nam trong YAML, nen tat
# Actions khong mat logic — chi mat lop thuc thi tu dong.
# ---------------------------------------------------------------------------

Step 5c "OpenCore doc sync gate"
& pwsh -File scripts/quality/check_opencore_doc_sync.ps1 `
  -EventName "push" -BaseRef "dev" -BeforeSha "" -HeadSha "HEAD" | Out-Null
if ($LASTEXITCODE -ne 0) { Die "OpenCore doc sync gate that bai" }
Ok "OpenCore doc sync PASS"

# CHI CANH BAO, khong chan. Script dang FAIL tren `dev` (exit 1) vi no den
# 77 file — trong do nhiều file thuocc cay legacy `frontend/` da bi thay bang
# `packages/web/`. Gate nay CHUA BAO GIO chay xanh tren CI nen chua ai thay
# vie pham; bat chan ngay bay se chan moi agent vi no ton do, gate se bi bo qua
# — te hon khong co gate. Nang len chan khi no duoc xu ly xong.
Step 5d "Large file guard (CANH BAO, khong chan)"
$lf = & pwsh -File scripts/quality/check_large_files.ps1 `
  -WarnLines 700 -FailLines 1000 -AllowListPath scripts/quality/large_file_allowlist.txt 2>&1
if ($LASTEXITCODE -ne 0) {
  Warn "check_large_files FAIL tren dev (no ton do, KHONG phai do branch nay)."
  Warn "Khong chan. Xem .github/workflows-disabled/README.md §Sau."
  Warn "Chi bao loi o file branch nay:"
  # Path Windows dung dau `\` nen phai khop `packages[\\/]` chu khong phai `packages/`.
  $lf | ForEach-Object { $_.ToString() } |
    Where-Object { $_ -match '(WARN|FAIL)\s+\d+' -and $_ -match 'packages[\\/]|scripts[\\/]' } |
    Select-Object -First 5 |
    ForEach-Object { Warn ("  " + ($_ -replace "`e\[[0-9;]*m", "").Trim()) }
} else {
  Ok "check_large_files PASS"
}

Step 0 "Sync xong"
Ok "branch $branch da dong bo vao origin/dev"
Write-Host "`nBuoc tiep theo:" -ForegroundColor Cyan
Write-Host "  1. Cap nhat CLAIMS.md: in-progress -> done"
Write-Host "  2. git push -u origin $branch"
Write-Host "  3. Tao PR:  pwsh -File scripts/agent-pr.ps1"
