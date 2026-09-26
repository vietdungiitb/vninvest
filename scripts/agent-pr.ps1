#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Tao PR cho agent branch, kem review checklist.

.DESCRIPTION
  PR body duoc sinh tu commit thuc te + gate thuc te, nhung CHUA tu dien
  "PASS" — nguoi ta phai xac nhan. Muc dich chong bao cao "PASS" khi chua verify.

  Quy trinh review bat buoc (xem §10 AGENT_PROTOCOL.md):
    - File trong deny list §2 co bi keo vao PR khong?
    - Co file nao agent khac da claim ma khong xin phep khong?
    - So migration co trung khong?
    - Gate nao PASS that, gate nao CHUA chay?

.EXAMPLE
  pwsh -File scripts/agent-pr.ps1 -Title "feat(ai-cc): R0.1 effective_context" -Scope "R0.1-R0.3"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Title,
  [string]$Scope = "",
  [string]$Base = "dev"
)

$ErrorActionPreference = 'Stop'
function Die($m) { Write-Host "X  $m" -ForegroundColor Red; exit 1 }

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Die "gh CLI chua co" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Die "node chua co" }

$branch = git rev-parse --abbrev-ref HEAD
if ($branch -in @('main','dev','master')) { Die "Dang o '$branch'. Phai tren feature branch moi tao duoc PR." }

# ── 1. pre-flight: gate truoc khi tao PR ────────────────────────────────────
Write-Host "[1/4] Gate truoc khi tao PR" -ForegroundColor Cyan
& node packages/web/scripts/check-multi-agent.mjs
if ($LASTEXITCODE -ne 0) { Die "Gate that bai — khong tao PR. Xem loi o tren." }

# ── 2. dinh danh file ───────────────────────────────────────────────────────
$files = @(git diff --name-only "$Base...HEAD")
if ($files.Count -eq 0) { Die "Branch khong co gi khac $Base — khong co gi de review." }

$deny = @('AGENTS.md','docs/CODE_CHANGE_AUDIT_LEDGER.md','packages/web/package.json',
          'pyproject.toml','requirements.txt','package-lock.json',
          'docker-compose.yml','docker-compose.dev.yml','docker-compose.prod.yml',
          '.env','.env.example')
$violation = $files | Where-Object { $deny -contains $_ }
if ($violation) {
  Write-Host "PR nay chua file deny list:" -ForegroundColor Red
  $violation | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  Die "Bo cac file do khoi commit truoc khi tao PR (AGENT_PROTOCOL.md §2)"
}

$be = @($files | Where-Object { $_ -like 'packages/core/backend/*' })
$fe = @($files | Where-Object { $_ -like 'packages/web/*' })
$docs = @($files | Where-Object { $_ -like 'docs/*' })

# ── 3. migration check ──────────────────────────────────────────────────────
Write-Host "[2/4] Kiem tra migration" -ForegroundColor Cyan
$mig = @($files | Where-Object { $_ -match 'migrations/0\d{4}_' })
if ($mig.Count -gt 0) {
  Write-Host "    PR tao migration:" -ForegroundColor Yellow
  $mig | ForEach-Object { Write-Host "      $_" -ForegroundColor Yellow }
  Write-Host "    NGUOI REVIEW phai xac nhan so nay khong trung voi branch khac." -ForegroundColor Yellow
}

# ── 4. tao PR ───────────────────────────────────────────────────────────────
Write-Host "[3/4] Tao PR" -ForegroundColor Cyan
$tmp = Join-Path $env:TEMP "agent-pr-body.md"

$commits = (git log --oneline "$Base..HEAD" 2>$null) -join "`n"
$fileList = ($files | ForEach-Object { "- ``$_``" }) -join "`n"

@"
## Muc dich
$Title

$Scope

## Pham vi
$fileList

| Nhom | So file |
|---|---|
| Backend (`packages/core/backend/`) | $($be.Count) |
| Frontend (`packages/web/`) | $($fe.Count) |
| Tai lieu (`docs/`) | $($docs.Count) |
| **Tong** | **$($files.Count)** |

## Gate — NHA SUA DONG NAY, KHONG DE TRONG

Xac nhan bang cach chay lai. Khong danh PASS cho thu chua chay.

- [ ] `node packages/web/scripts/check-multi-agent.mjs` — ket qua: ______
- [ ] `npx tsc --noEmit` (neu co doi tuoi packages/web) — ket qua: ______
- [ ] `npx eslint <file da doi>` — ket qua: ______
- [ ] `python manage.py check` (neu co doi tuoi backend) — ket qua: ______
- [ ] `python manage.py test tests` — ket qua: ______
- [ ] `npm run build` — ket qua: ______

> Khong set ``CORE_DATABASE_URL`` / ``DJANGO_DEBUG=1`` thi test BE **khong chay duoc**.
> Neu chua chay, ghi "CHUA CHAY" o tren — khong ghi PASS.

## Check list reviewer (bat buoc)

1. [ ] Khong file nao trong deny list AGENT_PROTOCOL.md §2
2. [ ] Moi file sua deu duoc claim trong `docs/CLAIMS.md` cua branch nay
3. [ ] So migration khong trung voi bat ky branch nao khac
4. [ ] `docs/CLAIMS.md` da chuyen tu `in-progress` sang `done`
5. [ ] Da chay `pwsh -File scripts/agent-sync.ps1` **sau** khi lam xong, va gate chay lai **sau** do
6. [ ] Cac muc "CHUA CHAY" tren da duoc doc va chap nhan

## Rui ro biet truoc

<!-- Liet ke: migration co the trung, phu thuoc dang chua merge, feature flag... -->
-

## Commit

```
$commits
```
"@ | Set-Content -Path $tmp -Encoding utf8

gh pr create --base $Base --head $branch --title $Title --body-file $tmp
if ($LASTEXITCODE -ne 0) { Die "gh pr create that bai" }

Write-Host "`n[4/4] Xong" -ForegroundColor Green
Write-Host "  - Cap nhat CLAIMS.md: chuyen claim sang 'done'"
Write-Host "  - Sau khi PR merge: chay 'pwsh -File scripts/agent-cleanup.ps1' de xoa worktree"
