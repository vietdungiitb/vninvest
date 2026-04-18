param(
    [Parameter(Mandatory = $true)]
    [string]$Owner,

    [Parameter(Mandatory = $true)]
    [string]$Repo,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string[]]$RequiredChecks = @(
        'OpenCore Doc Sync Gate / opencore-doc-sync-gate'
    ),

    [string[]]$RecommendedChecks = @(
        'Large File Guard / large-file-guard',
        'Governance Release Gate / governance-postgres-regression'
    ),

    [switch]$IncludeRecommendedChecks,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Token) -or $Token -match '^<.*>$') {
    throw "[oc19-ruleset] Token khong hop le. Ban dang dung placeholder (vd: <GITHUB_TOKEN_ADMIN_REPO>). Hay thay bang GitHub token that co quyen administration:write."
}

function Get-HttpErrorBody {
    param(
        [System.Exception]$Exception
    )

    try {
        if ($null -eq $Exception.Response) {
            return ''
        }

        $stream = $Exception.Response.GetResponseStream()
        if ($null -eq $stream) {
            return ''
        }

        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        $reader.Close()
        return $body
    }
    catch {
        return ''
    }
}

function Invoke-GitHubApi {
    param(
        [string]$Method,
        [string]$Uri,
        [object]$Body = $null
    )

    $headers = @{
        Authorization = "Bearer $Token"
        Accept        = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = '2022-11-28'
    }

    try {
        if ($null -eq $Body) {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
        }

        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -Body ($Body | ConvertTo-Json -Depth 20) -ContentType 'application/json'
    }
    catch {
        $httpStatus = 'UNKNOWN'
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $httpStatus = [int]$_.Exception.Response.StatusCode
        }

        $errorBody = Get-HttpErrorBody -Exception $_.Exception
        $errorDetailsMessage = ''
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $errorDetailsMessage = $_.ErrorDetails.Message
        }
        Write-Host "[oc19-ruleset] HTTP call failed"
        Write-Host "  Method: $Method"
        Write-Host "  Uri: $Uri"
        Write-Host "  Status: $httpStatus"
        if (-not [string]::IsNullOrWhiteSpace($errorBody)) {
            Write-Host "  Response: $errorBody"
        }
        if (-not [string]::IsNullOrWhiteSpace($errorDetailsMessage)) {
            Write-Host "  ErrorDetails: $errorDetailsMessage"
        }

        if ($httpStatus -eq 401) {
            throw "[oc19-ruleset] 401 Unauthorized: Token sai/het han hoac chua dang ky dung loai."
        }
        if ($httpStatus -eq 403) {
            throw "[oc19-ruleset] 403 Forbidden: Token thieu quyen administration:write hoac repo ruleset permissions."
        }
        if ($httpStatus -eq 404) {
            throw "[oc19-ruleset] 404 Not Found: Sai Owner/Repo hoac token khong co quyen thay repo nay."
        }
        if ($httpStatus -eq 422) {
            throw "[oc19-ruleset] 422 Unprocessable Entity: Payload ruleset chua hop le. Kiem tra Response/ErrorDetails o tren."
        }

        throw "[oc19-ruleset] Loi API khong xac dinh. Xem thong tin HTTP o tren de debug."
    }
}

function Build-StatusChecks {
    param(
        [string[]]$Checks
    )

    return @($Checks | ForEach-Object {
        @{
            context = $_
        }
    })
}

function Build-RulesetPayload {
    param(
        [string]$Branch,
        [string]$RulesetName,
        [string[]]$Checks
    )

    @{
        name        = $RulesetName
        target      = 'branch'
        enforcement = 'active'
        conditions  = @{
            ref_name = @{
                include = @("refs/heads/$Branch")
                exclude = @()
            }
        }
        bypass_actors = @()
        rules = @(
            @{
                type = 'pull_request'
                parameters = @{
                    dismiss_stale_reviews_on_push = $true
                    require_code_owner_review      = $false
                    require_last_push_approval     = $false
                    required_approving_review_count = 1
                    required_review_thread_resolution = $true
                }
            },
            @{
                type = 'required_status_checks'
                parameters = @{
                    strict_required_status_checks_policy = $true
                    do_not_enforce_on_create = $false
                    required_status_checks = (Build-StatusChecks -Checks $Checks)
                }
            },
            @{
                type = 'deletion'
            }
        )
    }
}

$apiBase = "https://api.github.com/repos/$Owner/$Repo/rulesets"

Write-Host "[oc19-ruleset] Repository: $Owner/$Repo"
Write-Host "[oc19-ruleset] Dry run: $DryRun"

$checks = @($RequiredChecks)
if ($IncludeRecommendedChecks) {
    $checks += $RecommendedChecks
}

Write-Host "[oc19-ruleset] Required checks payload:"
$checks | ForEach-Object { Write-Host "  - $_" }

$existing = Invoke-GitHubApi -Method 'GET' -Uri $apiBase
$branches = @('dev', 'main', 'deploy')

foreach ($branch in $branches) {
    $rulesetName = "OpenCore Protection - $branch"
    $payload = Build-RulesetPayload -Branch $branch -RulesetName $rulesetName -Checks $checks

    $current = $existing | Where-Object { $_.name -eq $rulesetName } | Select-Object -First 1

    if ($DryRun) {
        if ($null -eq $current) {
            Write-Host "[oc19-ruleset] DRYRUN create: $rulesetName"
        } else {
            Write-Host "[oc19-ruleset] DRYRUN update: $rulesetName (id=$($current.id))"
        }
        continue
    }

    if ($null -eq $current) {
        Invoke-GitHubApi -Method 'POST' -Uri $apiBase -Body $payload | Out-Null
        Write-Host "[oc19-ruleset] Created: $rulesetName"
    } else {
        Invoke-GitHubApi -Method 'PUT' -Uri "$apiBase/$($current.id)" -Body $payload | Out-Null
        Write-Host "[oc19-ruleset] Updated: $rulesetName (id=$($current.id))"
    }
}

Write-Host "[oc19-ruleset] DONE"
