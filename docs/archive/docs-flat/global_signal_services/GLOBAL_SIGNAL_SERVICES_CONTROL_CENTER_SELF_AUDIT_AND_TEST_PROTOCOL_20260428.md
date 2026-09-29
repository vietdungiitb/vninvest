# SELF-AUDIT AND TEST PROTOCOL - Global Signal Services Control Center

## 1. Mục đích

Protocol này là checklist bắt buộc cho đội code và QA nội bộ sau mỗi slice của chương trình `Global Signal Services Control Center`.

Mục tiêu là chặn sớm các nhóm lỗi nguy hiểm nhất:

1. detection bị phụ thuộc user,
2. canonical store sai domain,
3. distribution bỏ sót audience,
4. retention purge xóa raw trước khi canonical an toàn,
5. admin control center cho phép apply/rerun nguy hiểm mà không có preview hay confirmation,
6. báo hoàn thành nhưng thiếu evidence và doc sync.

## 2. Nguyên tắc vận hành

1. Không có evidence thì xem như chưa làm.
2. Không có focused validation ngay sau edit đầu tiên thì slice chưa pass.
3. UI/runtime slice phải refresh stack trước khi chụp evidence final.
4. Docs-only slice phải có audit report riêng và sync ledger/progress.
5. Mọi coding slice đều phải đối chiếu explicit consent trước khi bắt đầu.

## 3. Workflow audit bắt buộc cho mỗi slice

### Bước 1 - Khóa phạm vi slice

Ghi rõ:

1. Slice ID
2. Req IDs liên quan
3. File thực tế đã chạm
4. Loại slice: backend / frontend / integration / ops / docs-only
5. Required AI skill đã dùng

### Bước 2 - Focused validation ngay sau slice

#### Backend model/service slice

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
Pop-Location
```

Nếu slice thuộc whale/global signal canonical store, phải bổ sung targeted suite mới tương ứng.

#### Admin API slice

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_admin_signal_control_center --keepdb
Pop-Location
```

#### Frontend admin UI slice

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

Nếu có suite hẹp cho slice:

```powershell
Push-Location ./frontend
npm test -- --watchAll=false <test-path>
Pop-Location
```

#### Ops / retention slice

Validation tối thiểu:

1. retention preview payload đúng,
2. job registry phản ánh đúng trạng thái,
3. nếu chạm runtime thì có rebuild/restart evidence.

#### Docs-only slice

Validation tối thiểu:

1. đối chiếu cross-reference giữa docs,
2. naming consistency,
3. sync `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`,
4. có audit report riêng cho bundle.

### Bước 3 - Runtime refresh nếu slice chạm UI/runtime

```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend backend
```

Nếu chạm Celery/beat/backend jobs, refresh thêm service tương ứng đang bị ảnh hưởng.

### Bước 4 - Thu bằng chứng

Bắt buộc lưu tối thiểu:

1. command đã chạy và PASS/FAIL,
2. screenshot hoặc video nếu slice là UI,
3. payload snapshot nếu slice chạm contract,
4. residual risk note,
5. danh sách file đổi thực tế.

### Bước 5 - Đồng bộ audit docs

Sau mỗi slice đã PASS nội bộ:

1. cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`,
2. cập nhật `PROGRESS_DASHBOARD.md`,
3. điền evidence template của pack này.

## 4. Test matrix theo bề mặt rủi ro

## A. Service boundary and SSOT

### A1. User-independence of detection

PASS khi cùng một input market event cho cùng symbol tạo cùng canonical event dù user context khác nhau.

### A2. Canonical domain correctness

PASS khi whale global đọc từ `WhaleAlertEvent`, dark-flow global đọc từ `OrderFlowSignal`, không có shortcut dùng `WhaleAdvisory` làm truth.

## B. Universe resolution

### B1. Hybrid universe preview

PASS khi preview thể hiện rõ count của admin curated, tracked, watchlist và effective.

### B2. Cache invalidation

PASS khi apply universe/config làm refresh cache snapshot đúng.

## C. Whale event integrity

### C1. Deterministic event_id

PASS khi cùng một trade được detect lại vẫn cho cùng `event_id`.

### C2. Multi-threshold duplicate suppression

PASS khi một trade không sinh nhiều canonical whale events chỉ vì vượt nhiều ngưỡng.

## D. Dark-flow integrity

### D1. Severity semantics

PASS khi severity dark-flow bám `strength/confidence/cvd_change`, không flatten theo whale threshold ratio.

### D2. Detector purity

PASS khi detector không còn tự làm advisory fan-out trong detect phase chính.

## E. Distribution

### E1. Audience union

PASS khi user trong tracked và watchlist đều nhận signal cho symbol tương ứng.

### E2. Delivery log

PASS khi `UserAlertHistory` có bản ghi tối thiểu cho event đã phân phối.

## F. Admin control center

### F1. Summary health

PASS khi admin thấy đầy đủ health, universe count, recent run, recent failure, cache freshness.

### F2. Preview-before-apply

PASS khi mọi action thay config/universe/retention có preview trước.

### F3. Dangerous action guard

PASS khi manual run, recompute, purge có confirmation và disabled state hợp lệ.

### F4. Pagination and i18n

PASS khi list lớn dùng `PaginationBar` và text mới đi qua i18n tiếng Việt.

## G. Retention and performance

### G1. Retention safety

PASS khi purge raw tick bị chặn nếu canonical safety chưa được xác nhận trong preview.

### G2. Read-model reuse

PASS khi global consumer chính không phải quét raw tick để dựng dữ liệu runtime cơ bản.

## 5. Suggested suites to run or create

### Backend

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_global_signal_universe --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_global_whale_alerts_service --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_global_dark_flow_service --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_global_signal_distribution --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_admin_signal_control_center --keepdb
Pop-Location
```

### Frontend

```powershell
Push-Location ./frontend
npm test -- --watchAll=false src/components/adminops/signal-center/SignalControlCenter.test.jsx
npm test -- --watchAll=false src/components/adminops/signal-center/SignalUniversePanel.test.jsx
npm test -- --watchAll=false src/components/adminops/signal-center/WhaleServicePanel.test.jsx
npm test -- --watchAll=false src/components/adminops/signal-center/DarkFlowServicePanel.test.jsx
npm test -- --watchAll=false src/components/adminops/signal-center/SignalJobsAuditPanel.test.jsx
Pop-Location
```

## 6. Evidence standard theo loại slice

### Backend slice

1. Focused tests pass.
2. Payload snapshot hoặc model schema proof.
3. Residual risk note.

### Frontend UI slice

1. Build pass.
2. Screenshot/video.
3. Runtime refresh log nếu touched runtime.
4. i18n/pagination compliance note.

### Ops / retention slice

1. Preview payload.
2. Runtime logs.
3. Safety rationale.

### Docs-only slice

1. Audit report doc cho bundle.
2. Ledger/progress sync.
3. Cross-reference proof.