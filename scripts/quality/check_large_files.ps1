param(
    [int]$WarnLines = 800,
    [int]$FailLines = 1200,
    [string]$AllowListPath = "scripts/quality/large_file_allowlist.txt"
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$scanRoot = Resolve-Path (Join-Path $repoRoot '..')
$allowListFile = Join-Path $scanRoot $AllowListPath

$allowedLargeFiles = @{}
if (Test-Path $allowListFile) {
    Get-Content -Path $allowListFile |
        Where-Object { $_ -and -not $_.TrimStart().StartsWith('#') } |
        ForEach-Object {
            $relative = $_.Trim().Replace('/', '\')
            if ($relative) {
                $allowedLargeFiles[$relative.ToLowerInvariant()] = $true
            }
        }
}

$includeExtensions = @('.py', '.js', '.jsx', '.ts', '.tsx')
$excludePathPattern = '(\\|/)(node_modules|\.venv|backend\.venv|\.git|__pycache__|dist|build|staticfiles|mobile-app/android/\.gradle|mobile-app/android/app/\.cxx)(\\|/)'

$files = Get-ChildItem -Path $scanRoot -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $includeExtensions -contains $_.Extension.ToLowerInvariant() -and
        $_.FullName -notmatch $excludePathPattern
    }

$violationsWarn = @()
$violationsFail = @()

foreach ($file in $files) {
    $lineCount = (Get-Content -Path $file.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
    $relativePath = $file.FullName
    if ($relativePath.StartsWith($scanRoot.Path, [System.StringComparison]::OrdinalIgnoreCase)) {
        $relativePath = $relativePath.Substring($scanRoot.Path.Length)
    }
    while ($relativePath.StartsWith('\') -or $relativePath.StartsWith('/')) {
        $relativePath = $relativePath.Substring(1)
    }
    $relativePath = $relativePath.Replace('/', '\')
    $isAllowListed = $allowedLargeFiles.ContainsKey($relativePath.ToLowerInvariant())

    if ($lineCount -ge $FailLines) {
        if ($isAllowListed) {
            $violationsWarn += [PSCustomObject]@{
                Path = $file.FullName
                Lines = $lineCount
                Note = 'ALLOWLISTED_BASELINE'
            }
            continue
        }

        $violationsFail += [PSCustomObject]@{
            Path = $file.FullName
            Lines = $lineCount
        }
    }
    elseif ($lineCount -ge $WarnLines) {
        $violationsWarn += [PSCustomObject]@{
            Path = $file.FullName
            Lines = $lineCount
        }
    }
}

Write-Host "[large-file-guard] Thresholds: warn >= $WarnLines, fail >= $FailLines"
Write-Host "[large-file-guard] Scanned files: $($files.Count)"
Write-Host "[large-file-guard] Allowlist: $AllowListPath ($($allowedLargeFiles.Count) entries)"

if ($violationsWarn.Count -gt 0) {
    Write-Host ""
    Write-Host "[large-file-guard] Warning files:"
    $violationsWarn |
        Sort-Object Lines -Descending |
        ForEach-Object {
            $note = if ($_.PSObject.Properties.Name -contains 'Note') { " [$($_.Note)]" } else { "" }
            Write-Host ("  WARN  {0} lines  {1}{2}" -f $_.Lines, $_.Path, $note)
        }
}

if ($violationsFail.Count -gt 0) {
    Write-Host ""
    Write-Host "[large-file-guard] Failing files:"
    $violationsFail |
        Sort-Object Lines -Descending |
        ForEach-Object { Write-Host ("  FAIL  {0} lines  {1}" -f $_.Lines, $_.Path) }

    Write-Error "Large file guard failed: one or more files exceed fail threshold ($FailLines lines)."
    exit 1
}

Write-Host ""
Write-Host "[large-file-guard] PASS"
exit 0
