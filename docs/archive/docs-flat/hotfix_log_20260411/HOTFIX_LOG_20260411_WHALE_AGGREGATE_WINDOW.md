# HOTFIX LOG 2026-04-11: Whale Aggregate Window, Fallback, Va Nhat Ky Theo Doi

## 1) Muc tieu

Tong hop dot sua tiep theo cho khu vuc Whale Aggregate de:
- Lam ro logic window `5m/15m/1h/session/5d`
- Chan hoi quy 502 khi aggregate fallback sang vnbroker gap loi
- Ghi lai cach verify dung de tranh debug lap lai do moi truong compose bi drift

## 2) Pham vi van de da xu ly

### 2.1 Window `session` va `5d` chua phan anh dung thoi gian thuc

Trieu chung:
- Ket qua `5m`, `15m`, `1h`, `session` gan nhu giong nhau
- `session` khong thuc su bi gioi han boi gio mo cua thi truong
- `5d` hoat dong gan giong lower-bound thong thuong, chua neo theo market open

Nguyen nhan:
- Loc timestamp truoc do chu yeu dua vao lower bound, chua chan tren theo `now`
- `session` tung duoc xu ly theo huong rong hon de phu hop fallback cu, dan den semantics khong thuc te

Xu ly:
- Cap nhat ham tinh moc bat dau cua window trong service va helper:
  - `session` bat dau tu `WHALE_MARKET_OPEN_HOUR/WHALE_MARKET_OPEN_MINUTE`
  - `5d` bat dau tu market-open cua ngay hien tai tru 4 ngay
- Chuan hoa kiem tra cua event/tick thanh `start <= ts <= now`

Anh huong:
- Window ngan gio phan biet ro hon theo thoi diem thuc
- `session` va `5d` gan hon voi ky vong nghiep vu user da mo ta

---

### 2.2 Aggregate endpoint co the tra `502` khi DB page rong va vnbroker loi

Trieu chung:
- Neu DB page khong co row hop le, endpoint co the roi vao fallback vnbroker
- Khi provider ngoai loi, aggregate response co the bi day thanh `502`

Nguyen nhan:
- Nhay qua vnbroker fallback nhung khong degrade an toan neu `ExternalSystemException` xay ra

Xu ly:
- Boc fallback bang `try/except ExternalSystemException`
- Neu provider loi, tra ve aggregate response tu local path/empty response thay vi bong bong loi 502
- Ap dung ca cho refactored service path va legacy view path de dong nhat hanh vi

Anh huong:
- Giam rui ro mat endpoint do loi provider ngoai
- Hanh vi aggregate on dinh hon khi data local khong co du row

---

### 2.3 Regression test window filter de vo do phu thuoc gio co dinh

Trieu chung:
- Test cu dung moc `10:15:00` co the khong con hop le sau khi semantics `session` duoc lam thuc te hon

Nguyen nhan:
- Fixture dung gio co dinh va `date.today()` nen nhay cam voi timezone/local date

Xu ly:
- Doi sang `timezone.localtime()` va `timezone.localdate()`
- Dung `patch.dict(os.environ, ...)` de pin market-open trong test
- Chuyen assertion tu exact-count sang quan he window hop ly hon

Anh huong:
- Test bot flake
- Regression test tap trung dung vao semantics thay vi moc gio ngau nhien

## 3) Files da tac dong

### Backend
- `backend/portfolio/market_data_service.py`
- `backend/portfolio/whale_feed_helpers.py`
- `backend/portfolio/views.py`
- `backend/portfolio/tests/test_api_routes.py`

### Frontend
- `frontend/src/i18n/vi.js`

### Docs
- `docs/SPRINT31_PHASE1_D2_EXECUTION_LOG_20260410.md`
- `docs/HOTFIX_LOG_20260411_WHALE_AGGREGATE_WINDOW.md`

## 4) Tom tat thay doi theo file

1. `backend/portfolio/market_data_service.py`
- Them market-open aware window start cho `session` va `5d`
- Chan tren `<= now` cho event va DB tick
- Degrade an toan neu vnbroker fallback loi

2. `backend/portfolio/whale_feed_helpers.py`
- Mirror logic window moi de helper path va service path khong lech nhau

3. `backend/portfolio/views.py`
- Mirror graceful fallback cho legacy aggregate view

4. `backend/portfolio/tests/test_api_routes.py`
- Sua fixture theo local date/time
- Pin env market-open trong test
- Lam assertion on dinh hon

5. `frontend/src/i18n/vi.js`
- Doi label `shortcutBySymbol` tu `Di tat theo ma` thanh `Thong ke theo ma`

## 5) Kiem tra da thuc hien

### Local verification bang `.venv` + SQLite

```powershell
$env:DB_ENGINE='sqlite'
Remove-Item Env:POSTGRES_DB -ErrorAction SilentlyContinue
Remove-Item Env:POSTGRES_USER -ErrorAction SilentlyContinue
Remove-Item Env:POSTGRES_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:POSTGRES_HOST -ErrorAction SilentlyContinue
Remove-Item Env:POSTGRES_PORT -ErrorAction SilentlyContinue
& 'c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe' backend/manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_refactored_whale_feed_aggregate_applies_window_filter --noinput -v 2
& 'c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe' backend/manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_refactored_whale_feed_aggregate_rejects_invalid_window portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_refactored_whale_feed_aggregate_rejects_cursor_window_mismatch --noinput -v 1
```

Ket qua:
- PASS `test_refactored_whale_feed_aggregate_applies_window_filter`
- PASS `test_refactored_whale_feed_aggregate_rejects_invalid_window`
- PASS `test_refactored_whale_feed_aggregate_rejects_cursor_window_mismatch`

### Static validation
- `get_errors` tren cac file backend vua sua: khong co loi

## 6) Ghi chu van hanh

- Trong workspace nay, `docker compose exec` co luc da tro vao runtime khong dung vi base stack va dev stack cung ton tai duoi cung project name.
- Neu can verify backend nhanh, uu tien:
  - Dung day du `docker compose -f docker-compose.yml -f docker-compose.dev.yml ...`
  - Hoac chay test bang `.venv` voi `DB_ENGINE=sqlite` de tach code khoi drift container/env
- Da bo sung wrapper script `scripts/ops/dev_compose.ps1` de chuan hoa command va giam nham lan stack:
  - Vi du: `./scripts/ops/dev_compose.ps1 up --build -d`
  - Vi du: `./scripts/ops/dev_compose.ps1 exec -T backend python manage.py test ...`
  - Vi du: `./scripts/ops/dev_compose.ps1 ps`

## 7) Trang thai hien tai

- Logic whale aggregate window: da sua xong
- Aggregate fallback khi provider loi: da sua xong
- Regression tests lien quan: da verify pass o local
- Docker runtime hygiene: chua don dep triet de, nen xem la cong viec van hanh tiep theo neu can verify bang container