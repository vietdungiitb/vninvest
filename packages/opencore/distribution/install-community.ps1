param(
    [string]$WebDistDir = (Join-Path $PSScriptRoot '..\..\web\dist\community'),
    [int]$Port = 8088
)

$composeFile = Join-Path $PSScriptRoot '..\docker-compose.opencore.yml'

if (-not (Test-Path $WebDistDir)) {
    throw "Khong tim thay thu muc build community: $WebDistDir. Hay chay 'npm run build-community' trong packages/web truoc."
}

$resolvedDistDir = (Resolve-Path $WebDistDir).Path
$env:OPENCORE_WEB_DIST_DIR = $resolvedDistDir
$env:OPENCORE_HTTP_PORT = $Port.ToString()

Write-Host "Khoi dong OpenCore community bundle voi dist dir: $resolvedDistDir"
docker compose -f $composeFile up -d