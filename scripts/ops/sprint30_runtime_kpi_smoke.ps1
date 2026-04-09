param(
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$Username,
  [string]$Password,
  [string]$AccessToken,
  [string]$OutDir = "c:/Mujoco Projects/vninvest/docs/ops-evidence/sprint30/runtime-kpi"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$RunLog = "$OutDir/_run.log"
Set-Content -Path $RunLog -Value "" -Encoding utf8

function Write-Utf8Line {
  param([string]$Path, [string]$Text)
  Add-Content -Path $Path -Value $Text -Encoding utf8
}

function Write-Step([string]$Title) {
  $line = "`n=== $Title ==="
  Write-Output $line
  Write-Utf8Line -Path $RunLog -Text $line
}

function Save-JsonArtifact {
  param(
    [string]$Path,
    $Object
  )

  $json = $Object | ConvertTo-Json -Depth 10
  Set-Content -Path $Path -Value $json -Encoding utf8
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    $Body,
    [int[]]$AllowedStatusCodes
  )

  $requestParams = @{
    Method = $Method
    Uri = $Url
    Headers = $Headers
    ContentType = 'application/json'
    ErrorAction = 'Stop'
  }

  if ($null -ne $Body) {
    $requestParams.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  try {
    $response = Invoke-WebRequest @requestParams
    $statusCode = [int]$response.StatusCode
    $content = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
  } catch {
    $webResponse = $_.Exception.Response
    if ($null -eq $webResponse) {
      throw
    }

    $statusCode = [int]$webResponse.StatusCode
    $stream = $webResponse.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $rawContent = $reader.ReadToEnd()
    $reader.Dispose()
    if ([string]::IsNullOrWhiteSpace($rawContent)) {
      $content = $null
    } else {
      try {
        $content = $rawContent | ConvertFrom-Json
      } catch {
        $content = @{ raw = $rawContent }
      }
    }
  }

  if ($AllowedStatusCodes -notcontains $statusCode) {
    throw "Unexpected status code $statusCode for $Method $Url"
  }

  return @{ status_code = $statusCode; body = $content }
}

if (-not $AccessToken) {
  if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw "Provide either -AccessToken or both -Username and -Password."
  }

  Write-Step "Authenticate"
  $authResponse = Invoke-JsonRequest -Method "POST" -Url "$ApiBase/api/auth/token/" -Headers @{} -Body @{
    username = $Username
    password = $Password
  } -AllowedStatusCodes @(200)

  Save-JsonArtifact -Path "$OutDir/auth-token.json" -Object $authResponse.body
  $AccessToken = [string]$authResponse.body.access
}

$headers = @{ Authorization = "Bearer $AccessToken" }

Write-Step "Auth me"
$meResponse = Invoke-JsonRequest -Method "GET" -Url "$ApiBase/api/auth/me/" -Headers $headers -Body $null -AllowedStatusCodes @(200)
Save-JsonArtifact -Path "$OutDir/auth-me.json" -Object $meResponse.body

Write-Step "Runtime KPI (full)"
$runtimeKpiResponse = Invoke-JsonRequest -Method "GET" -Url "$ApiBase/api/admin-ops/runtime-kpi/" -Headers $headers -Body $null -AllowedStatusCodes @(200)
Save-JsonArtifact -Path "$OutDir/runtime-kpi.json" -Object $runtimeKpiResponse.body

Write-Step "Runtime KPI advisory merge"
$mergeKpiResponse = Invoke-JsonRequest -Method "GET" -Url "$ApiBase/api/admin-ops/runtime-kpi/advisory-merge/" -Headers $headers -Body $null -AllowedStatusCodes @(200)
Save-JsonArtifact -Path "$OutDir/runtime-kpi-advisory-merge.json" -Object $mergeKpiResponse.body

Write-Step "Summary"
$mergeStats = $mergeKpiResponse.body.advisory_event_merge
$summary = [ordered]@{
  user = [string]$meResponse.body.username
  plan = [string]$meResponse.body.plan
  runtime_kpi_status = [int]$runtimeKpiResponse.status_code
  runtime_kpi_advisory_merge_status = [int]$mergeKpiResponse.status_code
  advisory_merge = [ordered]@{
    scheduled = [int]($mergeStats.scheduled)
    merged = [int]($mergeStats.merged)
    flushed = [int]($mergeStats.flushed)
    skipped = [int]($mergeStats.skipped)
  }
}
Save-JsonArtifact -Path "$OutDir/_summary.json" -Object $summary
Write-Utf8Line -Path $RunLog -Text ("Completed at {0}" -f (Get-Date -Format o))
