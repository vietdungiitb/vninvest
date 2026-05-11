param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ComposeArgs
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

$devCompose = 'docker-compose.dev.yml'
$devEnvFile = Join-Path $repoRoot 'backend/.env.dev'
$setupScript = Join-Path $repoRoot 'scripts/dev-setup.ps1'

function Get-EnvValueFromFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Key
    )

    if (-not (Test-Path $Path)) {
        return $null
    }

    $escapedKey = [regex]::Escape($Key)
    foreach ($line in Get-Content $Path) {
        if ($line -match "^\s*${escapedKey}=(.*)$") {
            return $Matches[1].Trim()
        }
    }

    return $null
}

if ([string]::IsNullOrWhiteSpace($env:VNBROKER_GITHUB_TOKEN)) {
    $env:VNBROKER_GITHUB_TOKEN = Get-EnvValueFromFile -Path $devEnvFile -Key 'VNBROKER_GITHUB_TOKEN'
}

if ([string]::IsNullOrWhiteSpace($env:VNBROKER_GITHUB_TOKEN) -and (Test-Path $setupScript)) {
    & $setupScript
    $env:VNBROKER_GITHUB_TOKEN = Get-EnvValueFromFile -Path $devEnvFile -Key 'VNBROKER_GITHUB_TOKEN'
}

if ([string]::IsNullOrWhiteSpace($env:VNBROKER_GITHUB_TOKEN)) {
    throw "VNBROKER_GITHUB_TOKEN is still missing after backend/.env.dev bootstrap."
}

if (-not (Test-Path $devCompose)) {
    throw "Missing $devCompose in repo root: $repoRoot"
}

$cmdArgs = @('-f', $devCompose)
if ($ComposeArgs) {
    $cmdArgs += $ComposeArgs
}

Write-Host "Running: docker compose $($cmdArgs -join ' ')" -ForegroundColor Cyan
& docker compose @cmdArgs
exit $LASTEXITCODE
