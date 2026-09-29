# Run Integration Tests — Project Hardening Backend
**Ngày**: 2026-05-28

---

## 1. Environment bootstrap prerequisites

### Core backend

Nếu dùng shared local venv `backend/.venv`, bootstrap trước:

```powershell
& "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\python.exe" -m pip install -r packages/core/backend/requirements.txt
$env:DJANGO_DEBUG='true'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1,testserver'
```

Nếu dependency install cần private source:

```powershell
$env:VNBROKER_GITHUB_TOKEN='<provisioned-team-token>'
```

### Web build lane

Local host lane chỉ hợp lệ khi shell có sibling source `c:\Mujoco Projects\stockchart` hoặc build image nội bộ tương đương, vì `frontend/package.json` đang trỏ `../../stockchart/...`.

---

## 2. Backend focused suite

```powershell
& "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\python.exe" packages/core/backend/manage.py test identity_access market_data user_workspace service_ops --keepdb
```

### Kỳ vọng

1. Django settings bootstrap thành công.
2. Không còn lỗi `ModuleNotFoundError: dj_database_url`.
3. Không có cross-tenant regression ở `user_workspace`.

---

## 3. Web packaging gate

```powershell
npm --prefix packages/web run build-community
```

### Kỳ vọng

1. Build hoàn tất thành công.
2. Output nằm tại `packages/web/dist/community`.
3. Refactor `packages/web` không làm vỡ shell build chain.

---

## 4. Optional focused web tests

```powershell
npm --prefix packages/web test -- --runInBand
```

Chỉ cần chạy subset phù hợp với slice hiện tại nếu suite đầy đủ quá rộng.

---

## 5. Runtime refresh

Nếu slice chạm runtime code hoặc config deploy:

```powershell
Set-Location "c:/Mujoco Projects/vninvest"
./start_dev.ps1
```

### Kỳ vọng

1. Core API healthy.
2. Frontend healthy.
3. Stack đang chạy bundle/config mới.
