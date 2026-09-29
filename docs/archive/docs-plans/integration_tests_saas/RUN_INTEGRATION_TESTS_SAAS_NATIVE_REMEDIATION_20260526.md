# Hướng dẫn chạy Integration Tests Suite (PowerShell)

Write-Host "Running Integration Tests cho packages\core\backend\src\identity_access..."
python -m pytest packages\core\backend\src\identity_access\tests\ -v --keepdb
Write-Host "Running Integration Tests cho tasks / outbox (nếu có thư mục test tương ứng)..."
