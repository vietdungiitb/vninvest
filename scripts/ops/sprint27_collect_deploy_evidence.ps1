param(
  [string]$BackendDir = "c:/Mujoco Projects/vninvest/backend",
  [string]$PythonExe = "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe",
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$OutDir = "c:/Mujoco Projects/vninvest/docs/ops-evidence/sprint27",
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
Invoke-CheckedCommand -Label "Focused Sprint 27 regression tests" -Args @(
  "manage.py",
  "test",
  "portfolio.tests.test_onboarding_trial_service",
  "portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_register_endpoint_applies_active_onboarding_policy",
  "portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_register_endpoint_respects_signup_trial_feature_flag",
  "portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_google_oauth_endpoint_creates_user_and_applies_onboarding_policy",
  "portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_google_oauth_endpoint_existing_user_no_reassignment"
) -OutFile "focused-regression.txt" -CaptureSummary

Write-Step "Network checks"
if ($SkipNetworkChecks) {
  Set-Content -Path "$OutDir/network-checks.txt" -Value "Skipped network checks (-SkipNetworkChecks)." -Encoding utf8
} else {
  $health = Invoke-WebRequest "$ApiBase/api/health/" -UseBasicParsing
  Set-Content -Path "$OutDir/network-checks.txt" -Value "GET /api/health -> $($health.StatusCode)" -Encoding utf8
}

Write-Step "Artifact index"
$artifactLines = Get-ChildItem $OutDir | Select-Object Name, Length, LastWriteTime | Out-String
Set-Content -Path "$OutDir/_artifact-index.txt" -Value $artifactLines -Encoding utf8

Write-Step "Completed"
Write-Utf8Line -Path $RunLog -Text "Sprint27 deploy evidence collection finished at $(Get-Date -Format o)"
