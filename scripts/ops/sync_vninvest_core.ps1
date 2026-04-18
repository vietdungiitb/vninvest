param(
  [string]$SourceRepoPath = 'C:\Mujoco Projects\vninvest',
  [string]$SeedRepoPath = 'C:\Mujoco Projects\vninvest-core-seed',
  [string]$TargetRepoUrl = 'https://github.com/vietdungiitb/vninvest-core.git',
  [string]$TargetBranch = 'main',
  [string]$CommitMessage = '',
  [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Remove-SeedWorkingTree {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
    return
  }

  Get-ChildItem -Path $Path -Force | ForEach-Object {
    if ($_.Name -eq '.git') {
      return
    }
    Remove-Item -Recurse -Force -LiteralPath $_.FullName
  }
}

Assert-Command -Name 'git'
Assert-Command -Name 'robocopy'

if (-not (Test-Path $SourceRepoPath)) {
  throw "Source repo path not found: $SourceRepoPath"
}

$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
  $CommitMessage = "chore: sync vninvest-core snapshot $timestamp"
}

Write-Host "[1/5] Preparing seed working tree: $SeedRepoPath"
Remove-SeedWorkingTree -Path $SeedRepoPath

Write-Host "[2/5] Copying snapshot from source repo"
$copyResult = robocopy $SourceRepoPath $SeedRepoPath /E /XD ".git" ".venv" "node_modules" "__pycache__" ".pytest_cache" "build" "dist" "/XF" "*.pyc" "*.pyo"
$rc = $LASTEXITCODE
if ($rc -gt 7) {
  throw "Robocopy failed with exit code $rc"
}

Push-Location $SeedRepoPath
try {
  Write-Host "[3/5] Initializing git repository (if needed)"
  if (-not (Test-Path (Join-Path $SeedRepoPath '.git'))) {
    git init | Out-Null
  }

  git checkout -B $TargetBranch | Out-Null

  if ((git remote) -notcontains 'origin') {
    git remote add origin $TargetRepoUrl
  } else {
    git remote set-url origin $TargetRepoUrl
  }

  Write-Host "[4/5] Creating snapshot commit"
  git add -A
  $hasChanges = (& git status --porcelain)
  if ([string]::IsNullOrWhiteSpace(($hasChanges -join ''))) {
    Write-Host "No changes detected in seed repo."
  } else {
    git commit -m $CommitMessage | Out-Null
    Write-Host "Committed: $CommitMessage"
  }

  if ($SkipPush) {
    Write-Host "[5/5] SkipPush enabled. Local snapshot is ready."
  } else {
    Write-Host "[5/5] Pushing to $TargetRepoUrl ($TargetBranch)"
    git push -u origin $TargetBranch
  }
}
finally {
  Pop-Location
}

Write-Host "Sync completed successfully."
