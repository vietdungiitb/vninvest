# Hướng dẫn chạy Code Review Gate (PowerShell)

Write-Host "Bắt đầu chạy Code Review Gate..."
flake8 packages\core\backend\src\
eslint packages\web\src\
Write-Host "Vui lòng kiểm tra thủ công xem có file nào chứa password rò rỉ không."
