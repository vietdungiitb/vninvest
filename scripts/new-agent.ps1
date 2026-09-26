#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Cấp phát agent mới: worktree + branch + junction + hook + DB + claim — 1 lệnh.

.DESCRIPTION
  Trước khi có script này, mỗi agent phải làm 6 lệnh thủ công và TÔI đã làm
  sai 2 lần trong quá trình đó (junction quên, hook chưa commit nên worktree
  không thấy). Script này biến 6 lệnh thành 1 và tự kiểm tra từng bước.

  Thứ tự quan trọng: hook PHẢI có trong dev TRƯỚC khi tạo worktree, nếu không
  worktree sẽ không có hook (đã xảy ra thật 2026-09-26).

.EXAMPLE
  # cấp phát agent mới
  pwsh -File scripts/new-agent.ps1 -Agent ai-advisory -Slice "R1 advisory effective_context"

  # liệt kê agent đang chạy
  pwsh -File scripts/new-agent.ps1 -List
#>
[CmdletBinding()]
param(
  [string]$Agent = "",
  [string]$Slice = "",
  [string]$Base = "dev",
  [switch]$List
)

$ErrorActionPreference = 'Stop'
$root = (git rev-parse --show-toplevel)
$parent = Split-Path $root -Parent
function Ok($m)  { Write-Host "OK  $m" -ForegroundColor Green }
function Die($m) { Write-Host "X   $m" -ForegroundColor Red; exit 1 }
function Step($m){ Write-Host "`n>> $m" -ForegroundColor Cyan }

# ── -List ───────────────────────────────────────────────────────────────────
if ($List) {
  Write-Host "`nWorktrees:" -ForegroundColor Cyan
  git worktree list | ForEach-Object { "   $_" }
  Write-Host "`nDatabase trong Postgres cua docker dev:" -ForegroundColor Cyan
  $db = docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core -tAc `
        "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1','vninvest_core')" 2>$null
  if ($db) { $db | ForEach-Object { "   $_" } } else { "   (chua co DB rieng nao)" }
  Write-Host "`nClaims:" -ForegroundColor Cyan
  if (Test-Path "$root\docs\CLAIMS.md") {
    Select-String -Path "$root\docs\CLAIMS.md" -Pattern "in-progress|proposed" |
      ForEach-Object { "   " + ($_.Line -replace '\s+',' ').Trim() }
  }
  exit 0
}

if (-not $Agent) { Die "Thieu -Agent (ten agent), hoac dung -List" }
if ($Agent -notmatch '^[a-z0-9][a-z0-9-]*$') { Die "Ten agent chi chu cai so va dau '-': $Agent" }
if (-not $Slice) { $Slice = "chua xac dinh" }

$branch = "feat/$Agent"
$wtPath = Join-Path $parent $Agent

# ── 1. điều kiện tiên quyết ─────────────────────────────────────────────────
Step "1/7 Kiem tra dieu kien tien quyet"

$hookInHead = (git cat-file -e "HEAD:.githooks/pre-commit" 2>$null; $LASTEXITCODE -eq 0)
if (-not $hookInHead) {
  Die ".githooks/pre-commit chua co trong HEAD. Hook phai commit TRUOC, worktree moi thay duoc (AGENT_PROTOCOL.md §3)."
}
Ok "hook da co trong HEAD"

$originBase = "origin/$Base"
git fetch origin $Base 2>&1 | Out-Null
Ok "da fetch origin/$Base ($((git rev-list --count "HEAD..$originBase") | Out-String | Select-Object -First 1).Trim() commit chua co local)"

# ── 2. DB riêng ─────────────────────────────────────────────────────────────
Step "2/7 Tao database rieng"
$dbName = $Agent -replace '-','_'
$dbName = "ag_$dbName"
$exists = docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core -tAc `
          "SELECT 1 FROM pg_database WHERE datname='$dbName'" 2>$null
if ($exists -match '1') {
  Ok "DB $dbName da ton tai"
} else {
  docker exec vninvest-dev-core-db createdb -U vninvest -O vninvest $dbName 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "tao DB that bai" }
  Ok "da tao DB $dbName"
}

# ── 3. branch ───────────────────────────────────────────────────────────────
Step "3/7 Tao branch $branch"
if (git branch --list $branch) {
  Write-Host "    ! Branch $branch da ton tai — dung lai branch cu" -ForegroundColor Yellow
} else {
  git branch $branch $originBase 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Die "tao branch that bai" }
  Ok "da tao branch $branch tu $originBase"
}

# ── 4. worktree ─────────────────────────────────────────────────────────────
Step "4/7 Tao worktree $wtPath"
if (Test-Path $wtPath) { Die "Thu muc $wtPath da ton tai. Xoa hoac chon ten khac." }
git worktree add $wtPath $branch 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Die "git worktree add that bai" }
Ok "da tao worktree"

# ── 5. junction (tiết kiệm 561 MB) ──────────────────────────────────────────
Step "5/7 Junction node_modules + .venv"
$junctions = @(
  @{ path = "$wtPath\packages\web\node_modules"; target = "$root\packages\web\node_modules" },
  @{ path = "$wtPath\node_modules";                  target = "$root\node_modules" },
  @{ path = "$wtPath\.venv";                         target = "$root\.venv" }
)
foreach ($j in $junctions) {
  if (-not (Test-Path $j.target)) { Write-Host "    - bo qua $($j.path) (khong co dich)" -ForegroundColor DarkGray; continue }
  cmd /c mklink /J "$($j.path)" "$($j.target)" 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "junction $(Split-Path $j.path -Leaf)" }
  else { Write-Host "    - that bai: $($j.path)" -ForegroundColor DarkGray }
}
Write-Host "    LUU Y: junction dung chung. Khong chay npm install khi chua hoi coordinator." -ForegroundColor Yellow

# ── 6. hook riêng ───────────────────────────────────────────────────────────
Step "6/7 Cai hook rieng cho worktree"
$gitBash = "C:\Program Files\Git\bin\sh.exe"
if (Test-Path $gitBash) {
  & $gitBash -c "cd '$(($wtPath -replace '\\','/'))' && sh scripts/agent-install-hooks.sh" 2>&1 |
    Select-Object -First 4 | ForEach-Object { "    $_" }
  $hp = git -C $wtPath config --get core.hooksPath
  if ($hp -eq '.githooks') { Ok "hook da cai (core.hooksPath=.githooks)" }
  else { Die "hook chua cai duoc. Chay: cd $wtPath; sh scripts/agent-install-hooks.sh" }
} else {
  Die "Khong tim thay Git Bash. Chay: cd $wtPath; sh scripts/agent-install-hooks.sh"
}

# ── 7. claim stub ───────────────────────────────────────────────────────────
Step "7/7 Ghi claim vao docs/CLAIMS.md"
$claim = "$root\docs\CLAIMS.md"
if (Test-Path $claim) {
  $rel = $wtPath.Replace($parent + "\", "")
  $row = "| ``$Agent`` | ``$branch`` | $Slice | (chua khai file cu the) | proposed | $(Get-Date -Format 'yyyy-MM-dd') | Worktree ``$rel``. DB ``$dbName``. Env: ``CORE_DATABASE_URL=postgresql://vninvest:devpassword@127.0.0.1:5433/$dbName`` + ``DJANGO_DEBUG=1``. Hoan tat: ``pwsh -File scripts/agent-sync.ps1`` rồi ``pwsh -File scripts/agent-pr.ps1`` |"
  Add-Content -LiteralPath $claim -Value "`n$row"
  Ok "da them claim (status proposed). Agent PHAI khai file cu the truoc khi sua dong dau tien."
} else {
  Write-Host "    ! khong tim thay docs/CLAIMS.md" -ForegroundColor Yellow
}

# ── tổng kết ───────────────────────────────────────────────────────────────
Write-Host "`n================= AGENT SAN SANG =================" -ForegroundColor Green
Write-Host "  worktree : $wtPath"
Write-Host "  branch   : $branch"
Write-Host "  database : $dbName"
Write-Host "  hook     : .githooks (pre-commit + pre-push)"
Write-Host ""
Write-Host "Buoc tiep theo cua agent:" -ForegroundColor Cyan
@"
  1. cd "$wtPath"
  2. `$env:CORE_DATABASE_URL = "postgresql://vninvest:devpassword@127.0.0.1:5433/$dbName"
     `$env:DJANGO_DEBUG = "1"
  3. pwsh -File scripts/agent-sync.ps1          # rebase + check migration + gate
  4. git -C "$root" status --short              # xem agent khac dang sua gi
  5. Khai file cu the trong docs/CLAIMS.md, COMMIT RIENG truoc khi sua
  6. ... lam viec ...
  7. pwsh -File scripts/agent-sync.ps1          # khep phi lam viec
  8. chuyen claim sang 'done', push, tao PR:
     pwsh -File scripts/agent-pr.ps1 -Title "feat($Agent): $Slice"
"@ -replace '\\\$','$'
Write-Host "`nDanh sach tat ca agent:" -ForegroundColor Cyan
Write-Host "  pwsh -File scripts/new-agent.ps1 -List"
