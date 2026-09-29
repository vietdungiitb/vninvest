# Hướng dẫn chạy Spec Audit / Contract Audit (PowerShell)

Write-Host "Kiểm tra endpoint /core/v1/operator/mail-configs/ có tồn tại không..."
$response = Invoke-WebRequest -Uri "http://localhost:8000/core/v1/operator/mail-configs/" -Method Get -SkipHttpErrorCheck
if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401 -or $response.StatusCode -eq 403) { Write-Host "PASS: Endpoint tồn tại" } else { Write-Host "FAIL: Endpoint trả về 404 hoặc không phản hồi" }

Write-Host "Kiểm tra trong tasks.py có select_for_update không..."
if (Select-String -Path "packages\core\backend\src\data_ingest\tasks.py" -Pattern "select_for_update" -Quiet) { Write-Host "PASS: Idempotency lock found" } else { Write-Host "FAIL: Idempotency lock missing" }
