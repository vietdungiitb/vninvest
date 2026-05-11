# R5 Monitoring Protocol — SaaS Services Recovery Soak Window

**Ngày bắt đầu**: 2026-05-11 02:45 UTC  
**Target**: SSR-R5.1 (24h soak) + SSR-R5.2 (72h optional hardening)  
**Owner**: DevOps Lead + QA Lead

---

## 1. Baseline Metrics — Capture trước soak (T=0)

### 1.1 Service health snapshot

```powershell
# Collect baseline health
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$health = @{
    timestamp = $timestamp
    services = @(
        (docker compose -f docker-compose.dev.yml ps --format "json" | ConvertFrom-Json | Select-Object Names, State, Status)
    )
    core_api = (curl -s http://localhost/core/v1/health)
    api_health = (curl -s http://localhost/api/health/ -w "`nHTTP:%{http_code}")
}

# Save as baseline
$health | ConvertTo-Json | Out-File "docs/evidence/SSR-R5-BASELINE-METRICS-$(Get-Date -Format 'yyyyMMdd-HHmm').json"
```

### 1.2 Queue baseline

```powershell
# Queue depth at T=0
docker compose -f docker-compose.dev.yml exec -T redis redis-cli -n 3 LLEN celery
docker compose -f docker-compose.dev.yml exec -T redis redis-cli -n 3 DBSIZE

# Queue consumer stats (if available)
docker logs --since 1h vninvest-dev-core-worker | Select-String "received|succeeded" | Measure-Object
```

### 1.3 Database connection pool baseline

```powershell
docker compose -f docker-compose.dev.yml exec -T db psql -U postgres -c "SELECT datname, numbackends FROM pg_stat_database WHERE datname = 'vninvest_core';"
```

### 1.4 Redis memory baseline

```powershell
docker compose -f docker-compose.dev.yml exec -T redis redis-cli INFO memory | Select-String "used_memory|used_memory_peak|maxmemory"
```

---

## 2. SLO Thresholds (per TECH_SPEC)

| SLO | Threshold | Method | Frequency |
|---|---|---|---|
| API Availability | >= 99.5% | `/core/v1/health` + `/api/health/` 200 | Every 5 min |
| API Latency (p95) | <= 200ms | Response time distribution | Every 15 min |
| Queue Depth | < 100 messages | `LLEN celery` | Every 10 min |
| Task Failure Rate | < 1% | Celery task.failed / task.succeeded | Hourly |
| Worker Uptime | >= 99% | Container restart_count | Every 30 min |
| Restart Count | <= 2 per 24h | `docker inspect` | Every 4h |

---

## 3. Periodic Check Cadence (Run during soak)

### T+0 to T+6h: Intensive check every 1 hour

```powershell
function Invoke-R5HealthCheck {
    param([string]$OutputDir = "docs/evidence/r5-checks")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $checkId = Get-Date -Format "HHmmss"
    
    Write-Host "[$timestamp] Running R5 health check $checkId..."
    
    # 3.1 Service status
    $services = docker compose -f docker-compose.dev.yml ps --format "json" | ConvertFrom-Json
    $down_services = $services | Where-Object { $_.State -ne "running" }
    
    if ($down_services) {
        Write-Host "⚠️  DOWN SERVICES: $(($down_services | Select-Object -ExpandProperty Names) -join ', ')"
    }
    
    # 3.2 API health
    $health_core = (curl -s -w "%{http_code}" -o $null http://localhost/core/v1/health)
    $health_api = (curl -s -w "%{http_code}" -o $null http://localhost/api/health/)
    
    if ($health_core -ne "200" -or $health_api -ne "200") {
        Write-Host "❌ API HEALTH FAIL: core=$health_core, api=$health_api"
    } else {
        Write-Host "✅ API health: core=200, api=200"
    }
    
    # 3.3 Queue depth
    $queue_depth = docker compose -f docker-compose.dev.yml exec -T redis redis-cli -n 3 LLEN celery
    Write-Host "📊 Queue depth: $queue_depth"
    
    if ([int]$queue_depth -gt 100) {
        Write-Host "⚠️  QUEUE BACKLOG ANOMALY: $queue_depth > 100"
    }
    
    # 3.4 Worker/Beat status
    $worker_logs = docker logs --since 5m vninvest-dev-core-worker 2>&1 | Select-String "ERROR|CRITICAL" | Measure-Object
    $beat_logs = docker logs --since 5m vninvest-dev-core-beat 2>&1 | Select-String "ERROR|CRITICAL" | Measure-Object
    
    if ($worker_logs.Count -gt 0) {
        Write-Host "⚠️  Worker errors in last 5m: $($worker_logs.Count)"
    }
    
    if ($beat_logs.Count -gt 0) {
        Write-Host "⚠️  Beat errors in last 5m: $($beat_logs.Count)"
    }
    
    # 3.5 Container restarts
    $restarts = docker compose -f docker-compose.dev.yml ps --format "json" | ConvertFrom-Json | 
        Where-Object { $_.State -eq "running" } |
        ForEach-Object { 
            $restart_count = docker inspect --format='{{.RestartCount}}' $_.Names
            if ([int]$restart_count -gt 0) {
                Write-Host "⚠️  Restart detected: $($_.Names) = $restart_count"
            }
        }
    
    # 3.6 Save checkpoint
    $checkpoint = @{
        timestamp = $timestamp
        check_id = $checkId
        api_health_core = $health_core
        api_health_api = $health_api
        queue_depth = $queue_depth
        worker_errors = $worker_logs.Count
        beat_errors = $beat_logs.Count
    }
    
    $checkpoint | ConvertTo-Json | Out-File "$OutputDir/check-$checkId.json" -ErrorAction SilentlyContinue
    Write-Host "Checkpoint saved: check-$checkId.json`n"
}

# Run baseline check at T=0
Invoke-R5HealthCheck
```

### T+6h to T+24h: Check every 4 hours

```powershell
# Same Invoke-R5HealthCheck function
# Run at: 08:45, 12:45, 16:45, 20:45, 00:45 (next day)
```

### T+24h: Daily summary (after 24h milestone)

```powershell
function Invoke-R5DailySummary {
    param([int]$HoursSinceStart = 24)
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "=== R5 DAILY SUMMARY (T+$HoursSinceStart) ===" 
    
    # Count checks in past 24h
    $checks = Get-ChildItem "docs/evidence/r5-checks" -Filter "check-*.json" -ErrorAction SilentlyContinue | 
        Sort-Object CreationTime -Descending | Select-Object -First 10
    
    if ($checks) {
        Write-Host "Health checks performed: $($checks.Count)"
        
        # Parse for failures
        $failed_checks = $checks | ForEach-Object {
            $json = Get-Content $_.FullName | ConvertFrom-Json
            if ($json.api_health_core -ne "200" -or $json.api_health_api -ne "200") {
                $json | Add-Member -NotePropertyName file -NotePropertyValue $_.Name -PassThru
            }
        }
        
        if ($failed_checks) {
            Write-Host "❌ Failed health checks: $($failed_checks.Count)"
            foreach ($check in $failed_checks) {
                Write-Host "  - $($check.file): core=$($check.api_health_core), api=$($check.api_health_api)"
            }
        } else {
            Write-Host "✅ All health checks passed"
        }
    }
    
    # Service restart summary
    Write-Host "Container restart count (since T=0):"
    docker compose -f docker-compose.dev.yml ps --format "json" | ConvertFrom-Json |
        Where-Object { $_.State -eq "running" } |
        ForEach-Object {
            $count = docker inspect --format='{{.RestartCount}}' $_.Names
            Write-Host "  $($_.Names): $count restart(s)"
        }
    
    # Queue trend
    $latest_queue = (Get-ChildItem "docs/evidence/r5-checks" -Filter "check-*.json" -ErrorAction SilentlyContinue | 
        Sort-Object CreationTime -Descending | Select-Object -First 1 | 
        ForEach-Object { Get-Content $_.FullName | ConvertFrom-Json }).queue_depth
    
    Write-Host "Latest queue depth: $latest_queue"
    
    # Decision
    Write-Host ""
    if (-not $failed_checks -and ([int]$latest_queue -lt 100)) {
        Write-Host "🟢 R5.$($HoursSinceStart/24 -as [int]).$($HoursSinceStart%24) STATUS: PASS (ready for next milestone)"
    } else {
        Write-Host "🔴 R5.$($HoursSinceStart/24 -as [int]).$($HoursSinceStart%24) STATUS: ISSUES DETECTED"
    }
}

Invoke-R5DailySummary -HoursSinceStart 24
```

---

## 4. Incident Response (During Soak)

### If P1 Incident Detected:

```powershell
# 4.1 Incident log
"P1 Incident at $(Get-Date)" | Tee-Object -Append "docs/evidence/SSR-R5-INCIDENTS.log"

# 4.2 Full diagnostics snapshot
docker compose -f docker-compose.dev.yml logs --since 30m > docs/evidence/r5-incident-logs-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt
docker stats --no-stream >> docs/evidence/r5-incident-stats-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt

# 4.3 Notification
Write-Host "⛔ P1 INCIDENT: Check docs/evidence/SSR-R5-INCIDENTS.log and logs"
```

### If Queue Backlog Detected (> 100):

```powershell
# Collect queue details
docker compose -f docker-compose.dev.yml exec -T redis redis-cli -n 3 LRANGE celery 0 10
docker logs --since 1h vninvest-dev-core-worker | Select-String "Task|Error" | Tail -20
```

---

## 5. SLO Gate Checklist (T+24h)

**Requirement**: All criteria must PASS to proceed beyond R5.1

- [ ] API availability >= 99.5% (max 7 minutes downtime in 24h)
- [ ] Queue depth never exceeded 100 sustained
- [ ] No worker/beat critical errors in logs
- [ ] Container restart count <= 2 per service
- [ ] Latency p95 acceptable (< 200ms for health endpoints)
- [ ] No P1 incidents during soak

**Sign-off**: DevOps Lead + QA Lead must validate all checkboxes.

---

## 6. R5.2 Extended Soak (72h Optional)

If R5.1 (24h) PASS and user requests 72h:

1. Continue periodic checks (every 6h)
2. Monitor for hourly/daily/weekly trends
3. Tune resource limits if needed (CPU, memory, connections)
4. Run secondary smoke test suite every 12h

**Decision point at T+72h**:
- All SLOs maintained → R5.2 PASS, proceed to R6
- SLOs degraded → Investigate, tune, repeat soak

---

## 7. R5 Evidence Template

Final evidence file (at T+24h or T+72h): `docs/evidence/SSR-R5-SOAK-EVIDENCE-{duration}-{endtime}.md`

Content:
1. Soak duration (24h/72h)
2. Summary of health checks (count, pass/fail rate)
3. Incident log (if any)
4. SLO validation matrix (all green ✅)
5. Resource utilization trend
6. Tuning actions taken (if any)
7. Decision: PASS/FAIL with sign-off

---

## 8. Monitoring Quick Links

**During soak, use these one-liners to check status:**

```powershell
# Quick health check
docker compose -f docker-compose.dev.yml ps | Select-String "running|restarting"

# Quick queue check
docker compose -f docker-compose.dev.yml exec -T redis redis-cli -n 3 LLEN celery

# Quick error scan (past 10 min)
docker logs --since 10m vninvest-dev-core-worker | Select-String "ERROR|CRITICAL"

# Quick latency check (health endpoint)
@(1..5) | % { (Measure-Command { curl -s http://localhost/core/v1/health > $null }).TotalMilliseconds } | Measure-Object -Average

# Quick restart summary
docker inspect $(docker compose -f docker-compose.dev.yml ps -q) --format='{{.Name}}: {{.RestartCount}} restarts' 2>/dev/null | Select-String -NotMatch "null"
```
