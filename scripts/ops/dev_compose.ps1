param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ComposeArgs
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

$baseCompose = 'docker-compose.yml'
$devCompose = 'docker-compose.dev.yml'

if (-not (Test-Path $baseCompose)) {
    throw "Missing $baseCompose in repo root: $repoRoot"
}
if (-not (Test-Path $devCompose)) {
    throw "Missing $devCompose in repo root: $repoRoot"
}

$cmdArgs = @('-f', $baseCompose, '-f', $devCompose)
if ($ComposeArgs) {
    $cmdArgs += $ComposeArgs
}

Write-Host "Running: docker compose $($cmdArgs -join ' ')" -ForegroundColor Cyan
& docker compose @cmdArgs
exit $LASTEXITCODE
