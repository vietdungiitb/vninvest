#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Don dep worktree sau khi PR da merge.

.DESCRIPTION
  Tu choi xoa worktree neu:
    - con commit chua push
    - worktree chua sach
    - branch chua merge vao base
    - CLAIMS.md con claim in-progress tren branch nay

.EXAMPLE
  pwsh -File scripts/agent-cleanup.ps1 -Worktree "..\agent-ai-cc" -Branch feat/ai-cc-r0
#>
[CmdletBinding()]
param(
  [string]$Worktree = "",
  [string]$Branch = "",
  [string]$Base = "dev",
  [switch]$Execute,
  [switch]$Force
)

# Mac dinh KHONG xoa. Script huuy dien phai do -Execute moi chay that.
# That tai 2026-09-26: khong co -Execute, lenh da xoa worktree ma report
# "Permission denied" — git van xoa registration va .git, chi la thu muc con lai.
$ErrorActionPreference = 'Stop'
function Die($m) { Write-Host "X  $m" -ForegroundColor Red; exit 1 }
function Ok($m)  { Write-Host "OK  $m" -ForegroundColor Green }

if (-not $Branch) { Die "Thieu -Branch" }

# Resolve worktree tu danh sach git
$list = git worktree list --porcelain
$path = $Worktree
if (-not $path) {
  $cur = $null
  foreach ($line in $list) {
    if ($line -like "worktree *") { $cur = $line.Substring(9) }
    if ($line -eq "branch refs/heads/$Branch") { $path = $cur }
  }
}
if (-not $path) { Die "Khong tim thay worktree cho branch '$Branch'." }
if (-not (Test-Path $path)) { Die "Thu muc khong ton tai: $path" }
if (-not (Test-Path (Join-Path $path ".git"))) {
  Die "'$path' khong con .git — worktree da bi khuyet. Khong xoa them, tao lai bang 'git worktree add'."
}

# GUARD 1: dang dung chinh trong thu muc can xoa
$cwdFull = (Get-Location).ProviderPath
$pathFull = [System.IO.Path]::GetFullPath($path).TrimEnd('\')
if ($cwdFull.TrimEnd('\').StartsWith($pathFull, [System.StringComparison]::OrdinalIgnoreCase)) {
  Die "Ban dang DUNG TRONG worktree can xoa. Chuyen ra ngoai truoc: cd C:\Mujoco Projects\vninvest"
}

Write-Host "[1/6] Worktree: $path" -ForegroundColor Cyan

# GUARD 2: commit chua push
$unpushed = @(git -C $path log --oneline "origin/$Branch..HEAD" 2>$null)
$own = @(git -C $path log --oneline "$Base..HEAD" 2>$null)
Write-Host "    commit rieng cua branch : $($own.Count)"
Write-Host "    chua push len origin     : $($unpushed.Count)"
if ($unpushed.Count -gt 0 -and -not $Force) {
  Write-Host "  Commit chua push:" -ForegroundColor Yellow
  $unpushed | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
  Die "Co commit chua push. Push truoc, hoac -Force neu co chu dich."
}
if ($own.Count -eq 0) {
  Write-Host "    ! Branch khong co commit rieng nao (da ff bang $Base)." -ForegroundColor Yellow
}

# GUARD 3: worktree chua sach
$dirty = @(git -C $path status --porcelain | Where-Object { $_ -notmatch 'node_modules|\.venv' })
if ($dirty.Count -gt 0 -and -not $Force) {
  Write-Host $dirty -ForegroundColor DarkGray
  Die "Worktree chua sach. -Force neu thuc su muon xoa."
}

# GUARD 4: claim con in-progress?
$claim = Join-Path $path "docs\CLAIMS.md"
if (Test-Path $claim) {
  $open = Select-String -Path $claim -Pattern "\|\s*in-progress\s*\|" |
          Where-Object { $_.Line -match [regex]::Escape($Branch) }
  if ($open) {
    Write-Host "  CLAIMS.md con claim in-progress tren branch nay:" -ForegroundColor Yellow
    $open | ForEach-Object { Write-Host "    $($_.Line)" -ForegroundColor Yellow }
    Die "Chuyen claim sang 'done' hoac 'released' truoc khi xoa worktree."
  }
}

# GUARD 5: junction / symlink ben trong — git worktree remove co the lam hong
# chung vi no xoa recursive
$junctions = Get-ChildItem $path -Recurse -Directory -Force -ErrorAction SilentlyContinue |
             Where-Object { $_.LinkType } | Select-Object -First 5
if ($junctions) {
  Write-Host "  Worktree chua junction/symlink tro vao thu muc khac:" -ForegroundColor Yellow
  $junctions | ForEach-Object { Write-Host "    $($_.FullName)  -> $($_.Target)" -ForegroundColor Yellow }
  Write-Host "  git worktree remove --force co the lam hong CHUNG." -ForegroundColor Yellow
  if (-not $Force) { Die "Xoa junction truoc, hoac -Force neu ban chap nhan rui ro." }
}

# GUARD 6: PR da merge chua
if ($own.Count -gt 0 -and -not $Force) {
  Die "Branch con $($own.Count) commit chua merge vao $Base. Xoa worktree CHI sau khi PR merge."
}

# ── chưa chạy lệnh xoá nếu chưa có -Execute ──────────────────────────────────
if (-not $Execute) {
  Write-Host "`n[DRY RUN] Moi co bao loi truyen tren. Chua xoa gi ca." -ForegroundColor Yellow
  Write-Host "  -Worktree : $path" -ForegroundColor DarkGray
  Write-Host "  -Branch   : $Branch" -ForegroundColor DarkGray
  Write-Host "`nDe xoa THAT:" -ForegroundColor Yellow
  Write-Host "  pwsh -File scripts/agent-cleanup.ps1 -Branch $Branch -Execute"
  exit 0
}

# ── chạy thật ────────────────────────────────────────────────────────────────
Write-Host "[2/6] Xoa worktree" -ForegroundColor Cyan
git worktree remove --force $path
if ($LASTEXITCODE -ne 0) { Die "git worktree remove that bai" }
Ok "da xoa $path"

if (git branch --list $Branch) {
  git branch -D $Branch | Out-Null
  Ok "da xoa branch $Branch"
}

Write-Host "`nBuoc con lai (coordinator):" -ForegroundColor Cyan
Write-Host "  - gop file deny list (AGENTS.md, ledger, package.json) neu agent da ghi vao CLAIMS.md"
Write-Host "  - cap nhat CLAIMS.md: released"
Write-Host "  - push $Base"
