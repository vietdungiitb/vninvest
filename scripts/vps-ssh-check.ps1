# ─────────────────────────────────────────────────────────────────────────
# Kiểm tra key-based SSH tới VPS staging (14.225.255.47) — chạy TRÊN Windows.
#
# Dùng SAU khi đã chạy scripts/vps-authorize-key.sh trên VPS:
#
#   pwsh -File scripts/vps-ssh-check.ps1
#   pwsh -File scripts/vps-ssh-check.ps1 -User ubuntu
#   pwsh -File scripts/vps-ssh-check.ps1 -User root -Key "$HOME\.ssh\vninvest_deploy"
#
# Không cần tham số vẫn hữu ích: script tự thử mọi key trong ~/.ssh với vài user
# phổ biến và chỉ ra tổ hợp nào vào được.
# ─────────────────────────────────────────────────────────────────────────
[CmdletBinding()]
param(
    [string]$VpsHost = '14.225.255.47',
    [string]$User,
    [string]$Key,
    [int]$TimeoutSec = 8
)

$ErrorActionPreference = 'Continue'
$ssh = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $ssh) { Write-Error 'Không tìm thấy ssh.exe trong PATH.'; exit 2 }

function Get-LocalKeys {
    $dir = Join-Path $HOME '.ssh'
    if (-not (Test-Path -LiteralPath $dir)) { return @() }
    Get-ChildItem -LiteralPath $dir -File |
        Where-Object { $_.Name -notmatch '\.pub$|^known_hosts|^config$|\.old$' } |
        Select-Object -ExpandProperty FullName
}

$keys = if ($Key) { @($Key) } else { Get-LocalKeys }
if (-not $keys) { Write-Error "Không có private key nào trong $HOME\.ssh"; exit 2 }

$users = if ($User) { @($User) } else { @('root', 'ubuntu', 'deploy') }

Write-Host "VPS : $VpsHost" -ForegroundColor Cyan
Write-Host "Keys: $($keys.Count)  · Users thử: $($users -join ', ')" -ForegroundColor Cyan
Write-Host ''

$winners = @()
foreach ($u in $users) {
    foreach ($k in $keys) {
        $keyName = Split-Path -Leaf $k
        $out = & ssh -i $k -o BatchMode=yes -o ConnectTimeout=$TimeoutSec `
            -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR `
            "$u@$VpsHost" 'echo VNINVEST_OK; whoami; uname -s' 2>&1
        $text = ($out | Out-String).Trim()
        if ($text -match 'VNINVEST_OK') {
            Write-Host ("  [OK ] {0,-8} + {1}" -f $u, $keyName) -ForegroundColor Green
            $winners += [pscustomobject]@{ User = $u; Key = $k; KeyName = $keyName }
        } else {
            $reason = if ($text -match 'Permission denied') { 'permission denied' }
                      elseif ($text -match 'timed out|Timeout') { 'timeout' }
                      else { ($text -split "`n" | Select-Object -First 1) }
            Write-Host ("  [-- ] {0,-8} + {1,-20} {2}" -f $u, $keyName, $reason) -ForegroundColor DarkGray
        }
    }
}

Write-Host ''
if ($winners.Count -gt 0) {
    $w = $winners[0]
    Write-Host 'KẾT QUẢ: SSH được.' -ForegroundColor Green
    Write-Host ("Nhánh làm việc tiếp theo (dùng key `"$($w.KeyName)`", user `"$($w.User)`") :")
    Write-Host "  ssh -i `"$($w.Key)`" $($w.User)@$VpsHost 'bash -s' < scripts/bootstrap-staging.sh"
    Write-Host "  ssh -i `"$($w.Key)`" $($w.User)@$VpsHost"
    exit 0
} else {
    Write-Host 'KẾT QUẢ: CHƯA vào được. Chạy scripts/vps-authorize-key.sh trên VPS (qua web console).' -ForegroundColor Yellow
    Write-Host 'Hướng dẫn: docs/STAGING_VPS_RUNBOOK.md §1'
    exit 1
}
