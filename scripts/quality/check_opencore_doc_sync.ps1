param(
    [string]$EventName = "pull_request",
    [string]$BaseRef = "",
    [string]$BeforeSha = "",
    [string]$HeadSha = ""
)

$ErrorActionPreference = 'Stop'

function Get-ChangedFiles {
    param(
        [string]$EventName,
        [string]$BaseRef,
        [string]$BeforeSha,
        [string]$HeadSha
    )

    if ([string]::IsNullOrWhiteSpace($HeadSha)) {
        $HeadSha = (git rev-parse HEAD).Trim()
    }

    if ($EventName -eq 'pull_request' -and -not [string]::IsNullOrWhiteSpace($BaseRef)) {
        git fetch --no-tags --depth=1 origin $BaseRef | Out-Null
        $range = "origin/$BaseRef...$HeadSha"
        return (git diff --name-only $range)
    }

    if ($EventName -eq 'push' -and -not [string]::IsNullOrWhiteSpace($BeforeSha) -and $BeforeSha -ne '0000000000000000000000000000000000000000') {
        $range = "$BeforeSha...$HeadSha"
        return (git diff --name-only $range)
    }

    return (git diff --name-only HEAD~1 HEAD)
}

$changedFilesRaw = Get-ChangedFiles -EventName $EventName -BaseRef $BaseRef -BeforeSha $BeforeSha -HeadSha $HeadSha
$changedFiles = @($changedFilesRaw | Where-Object { $_ -and $_.Trim() -ne '' } | ForEach-Object { $_.Trim().Replace('\\', '/') })

Write-Host "[opencore-doc-sync] Event: $EventName"
Write-Host "[opencore-doc-sync] Changed files: $($changedFiles.Count)"

if ($changedFiles.Count -eq 0) {
    Write-Host "[opencore-doc-sync] No changed files detected. PASS"
    exit 0
}

$requiresGate = $false
foreach ($path in $changedFiles) {
    if (
        $path -match '^backend/.*(opencore|entitlement|quota|trial|grace|feature_gate|pricing|package|subscription|billing|plan)' -or
        $path -match '^frontend/.*(opencore|entitlement|quota|trial|grace|feature_gate|pricing|package|subscription|billing|plan)'
    ) {
        $requiresGate = $true
        break
    }
}

if (-not $requiresGate) {
    Write-Host "[opencore-doc-sync] No OpenCore-impacting code change detected. PASS"
    exit 0
}

Write-Host "[opencore-doc-sync] OpenCore-impacting change detected. Enforcing OC-19 doc sync gate."

$mustAlways = @(
    'docs/CODE_CHANGE_AUDIT_LEDGER.md',
    'PROGRESS_DASHBOARD.md'
)

$missingAlways = @()
foreach ($required in $mustAlways) {
    if (-not ($changedFiles -contains $required)) {
        $missingAlways += $required
    }
}

$needsT2 = $false
$needsT3 = $false
$needsT4 = $false

foreach ($path in $changedFiles) {
    if ($path -match '(feature_gate|pricing|package|subscription|billing|plan|community|pro)') {
        $needsT2 = $true
    }
    if ($path -match '(quota|entitlement|trial|grace)') {
        $needsT3 = $true
    }
    if ($path -match '(public|publish|allowlist|governance|docs)') {
        $needsT4 = $true
    }
}

$missingByTrigger = @()

if ($needsT2) {
    $t2Options = @(
        'docs/OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md',
        'docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md',
        'docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md'
    )
    $hasT2 = ($changedFiles | Where-Object { $t2Options -contains $_ }).Count -gt 0
    if (-not $hasT2) {
        $missingByTrigger += 'T2 requires one of: OPEN_CORE_05 / OPEN_CORE_13 / OPEN_CORE_15'
    }
}

if ($needsT3) {
    $t3Options = @(
        'docs/OPEN_CORE_11_NUMERIC_LOCK_SHEET_V1.md',
        'docs/OPEN_CORE_12_ENTITLEMENT_QUOTA_IMPLEMENTATION_CHECKLIST_V1.md',
        'docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md',
        'docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md'
    )
    $hasT3 = ($changedFiles | Where-Object { $t3Options -contains $_ }).Count -gt 0
    if (-not $hasT3) {
        $missingByTrigger += 'T3 requires one of: OPEN_CORE_11 / OPEN_CORE_12 / OPEN_CORE_13 / OPEN_CORE_15'
    }
}

if ($needsT4) {
    $t4Options = @(
        'docs/OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md',
        'docs/OPEN_CORE_18_PUBLIC_DOCS_ALLOWLIST_V1_20260418.md',
        'docs/OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md',
        'docs/OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md'
    )
    $hasT4 = ($changedFiles | Where-Object { $t4Options -contains $_ }).Count -gt 0
    if (-not $hasT4) {
        $missingByTrigger += 'T4 requires one of: OPEN_CORE_17 / OPEN_CORE_18 / OPEN_CORE_13 / OPEN_CORE_15'
    }
}

if ($missingAlways.Count -eq 0 -and $missingByTrigger.Count -eq 0) {
    Write-Host "[opencore-doc-sync] PASS"
    exit 0
}

Write-Host ""
Write-Host "[opencore-doc-sync] FAIL: OC-19 mandatory gate not satisfied."
if ($missingAlways.Count -gt 0) {
    Write-Host "Missing mandatory files:"
    foreach ($item in $missingAlways) {
        Write-Host "  - $item"
    }
}
if ($missingByTrigger.Count -gt 0) {
    Write-Host "Missing trigger docs evidence:"
    foreach ($item in $missingByTrigger) {
        Write-Host "  - $item"
    }
}

exit 1