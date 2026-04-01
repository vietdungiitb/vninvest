# VNInvest - Pro Stock Tracker & Robo-Advisor

Portfolio Tracker cho chứng khoán Việt Nam (HOSE/HNX/UPCOM). React + Django DRF + Pandas + Redis + Celery + vnstock.

## Quick Start Local

### Backend
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_user  # tạo testuser/Test@123456
python manage.py runserver
```

### Docker services dùng cho local
- PostgreSQL: `my-postgres` -> `localhost:5432`
- Redis: `redis-server` -> `localhost:6379`
- Backend local đã đọc cấu hình từ `backend/.env` và dùng `DB_ENGINE=postgres`

### Celery và realtime
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
celery -A config worker -l info --pool=solo
```

- Health: http://127.0.0.1:8000/health/
- API: http://127.0.0.1:8000/
