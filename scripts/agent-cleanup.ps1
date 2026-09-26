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
  [switch]$Force
)

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

Write-Host "[1/5] Worktree: $path" -ForegroundColor Cyan

# 1. sach?
$dirty = git -C $path status --porcelain | Where-Object { $_ -notmatch 'node_modules|\.venv' }
if ($dirty -and -not $Force) {
  Write-Host $dirty -ForegroundColor DarkGray
  Die "Worktree chua sach. Dung -Force neu thuc su muon xoa."
}

# 2. commit chua push?
$unpushed = git -C $path log --oneline "origin/$Branch..HEAD" 2>$null
$hasLocal = @(git -C $path log --oneline "$Base..HEAD" 2>$null).Count
if ($hasLocal -gt 0 -and -not $unpushed) {
  Write-Host "  Commit chua push:" -ForegroundColor Yellow
  git -C $path log --oneline "$Base..HEAD" | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
  Die "Co commit chua push. Push truoc, hoac -Force neu co chu dich."
}

# 3. da merge chua?
$merged = @(git -C $path log --oneline "$Base..HEAD" 2>$null).Count
if ($merged -gt 0) {
  Write-Host "  Branch con $merged commit chua merge vao $Base." -ForegroundColor Yellow
  if (-not $Force) { Die "PR chua merge. Xoa worktree chi sau khi PR merge." }
}

# 4. claim con in-progress?
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

# 5. xoa
Write-Host "[2/5] Xoa worktree" -ForegroundColor Cyan
git worktree remove --force $path
if ($LASTEXITCODE -ne 0) { Die "git worktree remove that bai" }
Ok "da xoa $path"

if (git branch --list $Branch) {
  git branch -d $Branch 2>$null
  if ($LASTEXITCODE -ne 0) { git branch -D $Branch | Out-Null }
  Ok "da xoa branch $Branch"
}

Write-Host "`nBuoc con lai (coordinator):" -ForegroundColor Cyan
Write-Host "  - gop file deny list (AGENTS.md, ledger, package.json) neu agent da ghi vao CLAIMS.md"
Write-Host "  - cap nhat CLAIMS.md: released"
Write-Host "  - push $Base"
