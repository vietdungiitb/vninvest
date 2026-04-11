param(
  [ValidateRange(1, 5)]
  [int]$RunNumber,

  [Parameter(Mandatory = $true)]
  [string]$Timestamp,

  [Parameter(Mandatory = $true)]
  [string]$Branch,

  [Parameter(Mandatory = $true)]
  [ValidateSet('push', 'pull_request', 'workflow_dispatch')]
  [string]$Trigger,

  [Parameter(Mandatory = $true)]
  [string]$Commit,

  [Parameter(Mandatory = $true)]
  [ValidateSet('OK', 'FAIL', 'CANCELLED', 'PENDING_UI_VERIFY')]
  [string]$Result,

  [Parameter(Mandatory = $true)]
  [string]$Duration,

  [string]$RunUrl,
  [string]$Notes,

  [string]$TrackerPath = 'docs/HOLISTIC_ADVISORY_H4_CI_STABILITY_TRACKER_20260411.md'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $TrackerPath)) {
  throw "Tracker file not found: $TrackerPath"
}

$runUrlText = if ([string]::IsNullOrWhiteSpace($RunUrl)) { '' } else { "run: $RunUrl" }
$noteParts = @()
if (-not [string]::IsNullOrWhiteSpace($runUrlText)) {
  $noteParts += $runUrlText
}
if (-not [string]::IsNullOrWhiteSpace($Notes)) {
  $noteParts += $Notes
}
$finalNotes = ($noteParts -join ' | ')

$rows = Get-Content -Path $TrackerPath
$targetPattern = "^\|\s*$RunNumber\s*\|"
$targetIndex = -1
for ($i = 0; $i -lt $rows.Count; $i++) {
  if ($rows[$i] -match $targetPattern) {
    $targetIndex = $i
    break
  }
}

if ($targetIndex -lt 0) {
  throw "Run row #$RunNumber not found in tracker table."
}

$newRow = "| $RunNumber | $Timestamp | $Branch | $Trigger | $Commit | $Result | $Duration | $finalNotes |"
$rows[$targetIndex] = $newRow
Set-Content -Path $TrackerPath -Value $rows -Encoding UTF8

Write-Host "Updated tracker row #$RunNumber in $TrackerPath"
Write-Host $newRow
