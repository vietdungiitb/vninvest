param(
  [string]$BackendDir = "c:/Mujoco Projects/vninvest/backend",
  [string]$PythonExe = "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe",
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$OutDir = "c:/Mujoco Projects/vninvest/docs/ops-evidence/sprint30",
  [switch]$SkipNetworkChecks
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$RunLog = "$OutDir/_run.log"

if (-not (Test-Path $RunLog)) {
  Set-Content -Path $RunLog -Value "" -Encoding utf8
}

function Write-Utf8Line {
  param([string]$Path, [string]$Text)
  Add-Content -Path $Path -Value $Text -Encoding utf8
}

function Write-Step([string]$Title) {
  $line = "`n=== $Title ==="
  Write-Output $line
  Write-Utf8Line -Path $RunLog -Text $line
}

function Invoke-CheckedCommand {
  param(
    [string]$Label,
    [string[]]$Args,
    [string]$OutFile,
    [switch]$CaptureSummary
  )

  Write-Step $Label
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & $PythonExe @Args 2>&1
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  $outPath = "$OutDir/$OutFile"
  Set-Content -Path $outPath -Value "" -Encoding utf8
  foreach ($line in $output) {
    Write-Output $line
    Write-Utf8Line -Path $outPath -Text $line
  }

  if ($CaptureSummary) {
    $summaryPath = "$OutDir/$($OutFile -replace '\\.txt$', '-summary.txt')"
    Set-Content -Path $summaryPath -Value "" -Encoding utf8
    $summaries = $output | Select-String -Pattern "^(OK|Ran |FAILED|FAIL|ERROR|No changes detected|System check identified)"
    foreach ($line in $summaries) {
      Write-Utf8Line -Path $summaryPath -Text $line
    }
  }

  if ($exitCode -ne 0) {
    throw "$Label failed with exit code $exitCode"
  }
}

Set-Location $BackendDir

Invoke-CheckedCommand -Label "Migration drift check" -Args @("manage.py", "makemigrations", "--check", "--noinput") -OutFile "makemigrations-check.txt" -CaptureSummary
Invoke-CheckedCommand -Label "Django system check" -Args @("manage.py", "check") -OutFile "django-check.txt" -CaptureSummary
Invoke-CheckedCommand -Label "Sprint 30 system AI regression" -Args @(
  "manage.py",
  "test",
  "portfolio.tests.test_ai_config_api",
  "portfolio.tests.test_system_ai_admin_api",
  "portfolio.tests.test_ai_runtime_config",
  "portfolio.tests.test_prune_system_ai_audit_logs_command"
) -OutFile "system-ai-regression.txt" -CaptureSummary

Write-Step "Network checks"
if ($SkipNetworkChecks) {
  Set-Content -Path "$OutDir/network-checks.txt" -Value "Skipped network checks (-SkipNetworkChecks)." -Encoding utf8
} else {
  $health = Invoke-WebRequest "$ApiBase/api/health/" -UseBasicParsing
  Set-Content -Path "$OutDir/network-checks.txt" -Value @(
    "GET /api/health -> $($health.StatusCode)",
    "Manual follow-up required: /api/ai-options, /api/ai-config, /api/admin-ops/system-ai-settings (admin auth)."
  ) -Encoding utf8
}

Write-Step "Manual production gate reminders"
Set-Content -Path "$OutDir/manual-gates.txt" -Value @(
  "1. Smoke /api/ai-options and advisory model dropdown on frontend.",
  "2. Smoke admin-only endpoints: /api/admin-ops/system-ai-settings, /test-connection, /audit-logs.",
  "3. Smoke observability endpoints: /api/admin-ops/runtime-kpi and /api/admin-ops/runtime-kpi/advisory-merge.",
  "4. Verify user-first -> system fallback path with one user missing API key.",
  "5. Run prune_system_ai_audit_logs --dry-run and archive output for ops evidence.",
  "6. Run scripts/ops/sprint30_runtime_kpi_smoke.ps1 to archive runtime KPI evidence.",
  "7. Collect QA/BE/DevOps/PM sign-off before production GO."
) -Encoding utf8

Write-Step "Artifact index"
$artifactLines = Get-ChildItem $OutDir | Select-Object Name, Length, LastWriteTime | Out-String
Set-Content -Path "$OutDir/_artifact-index.txt" -Value $artifactLines -Encoding utf8

Write-Step "Completed"
Write-Utf8Line -Path $RunLog -Text "Sprint30 deploy evidence collection finished at $(Get-Date -Format o)"