param(
  [string]$TrackerPath = 'docs/HOLISTIC_ADVISORY_H4_CI_STABILITY_TRACKER_20260411.md',
  [string]$GatePath = 'docs/HOLISTIC_ADVISORY_H4_GO_NO_GO_GATE_20260411.md'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $TrackerPath)) {
  throw "Tracker file not found: $TrackerPath"
}
if (-not (Test-Path $GatePath)) {
  throw "GO/NO-GO file not found: $GatePath"
}

$trackerLines = Get-Content -Path $TrackerPath

function Get-RunResultFromRow {
  param([string]$Row)
  $parts = $Row -split '\|'
  if ($parts.Count -lt 8) { return '' }
  return ($parts[6].Trim())
}

$runRows = @()
for ($n = 1; $n -le 3; $n++) {
  $pattern = "^\|\s*$n\s*\|"
  $row = $trackerLines | Where-Object { $_ -match $pattern } | Select-Object -First 1
  if ($null -eq $row) {
    throw "Run row #$n not found in tracker table."
  }
  $runRows += $row
}

$results = $runRows | ForEach-Object { Get-RunResultFromRow -Row $_ }
$resolvedSet = @('OK', 'FAIL', 'CANCELLED')
$resolvedResults = $results | Where-Object { $resolvedSet -contains $_ }
$okCount = ($results | Where-Object { $_ -eq 'OK' }).Count
$resolvedCount = $resolvedResults.Count

$allThreeResolved = ($resolvedCount -eq 3)
$allThreeOk = ($okCount -eq 3)
$hasFail = ($results | Where-Object { $_ -eq 'FAIL' }).Count -gt 0

$passRateText = if ($resolvedCount -eq 0) {
  'TBD (chua co run nao duoc xac nhan)'
} else {
  "$okCount/$resolvedCount runs OK (scope: #1..#3)"
}

$flakyText = if (-not $allThreeResolved) {
  'TODO (chua du du lieu #1..#3)'
} elseif ($hasFail) {
  'Co dau hieu instability (co run FAIL), can dieu tra them'
} else {
  'Chua thay dau hieu flaky trong #1..#3'
}

$failurePatternText = if ($hasFail) {
  'Co run FAIL trong #1..#3 - xem Notes + run URL tung dong'
} elseif (-not $allThreeResolved) {
  'Chua co pattern ro rang (du lieu chua day du)'
} else {
  'Khong ghi nhan failure pattern trong #1..#3'
}

$falsePositiveText = if (-not $allThreeResolved) {
  'Dang theo doi (chua du du lieu #1..#3)'
} else {
  'Khong ghi nhan false-positive moi; known noise: OpenCore DPIPlan'
}

for ($i = 0; $i -lt $trackerLines.Count; $i++) {
  if ($trackerLines[$i] -match '^- Pass rate:') {
    $trackerLines[$i] = "- Pass rate: $passRateText"
  } elseif ($trackerLines[$i] -match '^- Co flaky\?') {
    $trackerLines[$i] = "- Co flaky? $flakyText"
  } elseif ($trackerLines[$i] -match '^- Failure pattern:') {
    $trackerLines[$i] = "- Failure pattern: $failurePatternText"
  } elseif ($trackerLines[$i] -match '^- False-positive pattern:') {
    $trackerLines[$i] = "- False-positive pattern: $falsePositiveText"
  }
}
Set-Content -Path $TrackerPath -Value $trackerLines -Encoding UTF8

$gateLines = Get-Content -Path $GatePath

$newHeaderStatus = if ($allThreeOk) {
  'Status: GO CANDIDATE - CI STABILITY BASELINE MET (3/3)'
} else {
  'Status: DRAFT - WAITING CI STABILITY DATA'
}

$newGateRow = if ($allThreeOk) {
  '| CI stability 3-5 runs | PASS | `docs/HOLISTIC_ADVISORY_H4_CI_STABILITY_TRACKER_20260411.md` | Dat 3/3 run dau tien = OK |'
} elseif ($hasFail) {
  '| CI stability 3-5 runs | FAIL | `docs/HOLISTIC_ADVISORY_H4_CI_STABILITY_TRACKER_20260411.md` | Co run FAIL trong #1..#3, can dieu tra |'
} else {
  '| CI stability 3-5 runs | PENDING | `docs/HOLISTIC_ADVISORY_H4_CI_STABILITY_TRACKER_20260411.md` | Can dien Result/Duration tu Actions UI |'
}

$newConclusion1 = if ($allThreeOk) {
  '- Ket qua hien tai: GO CANDIDATE'
} else {
  '- Ket qua hien tai: NO-GO TAM THOI'
}

$newConclusion2 = if ($allThreeOk) {
  '- Ly do: da dat dieu kien toi thieu 3 run lien tiep OK cho governance gate; con cho production deploy smoke khi moi truong san sang.'
} elseif ($hasFail) {
  '- Ly do: co run FAIL trong CI stability tracker (#1..#3) hoac du lieu khong on dinh.'
} else {
  '- Ly do: thieu du lieu CI stability runs (3-5 lan) va production deploy smoke dang skip.'
}

for ($i = 0; $i -lt $gateLines.Count; $i++) {
  if ($gateLines[$i] -match '^Status:') {
    $gateLines[$i] = $newHeaderStatus
  } elseif ($gateLines[$i] -match '^\| CI stability 3-5 runs \|') {
    $gateLines[$i] = $newGateRow
  } elseif ($gateLines[$i] -match '^- Ket qua hien tai:') {
    $gateLines[$i] = $newConclusion1
  } elseif ($gateLines[$i] -match '^- Ly do:') {
    $gateLines[$i] = $newConclusion2
  }
}
Set-Content -Path $GatePath -Value $gateLines -Encoding UTF8

Write-Host "Refreshed tracker metrics from run #1..#3"
Write-Host "Results: $($results -join ', ')"
Write-Host "Updated files: $TrackerPath, $GatePath"
