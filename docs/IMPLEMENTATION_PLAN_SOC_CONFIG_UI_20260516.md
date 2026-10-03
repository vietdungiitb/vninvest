# Kế hoạch triển khai: SOC Configuration UI — Phiên bản 2
**Ngày lập**: 2026-05-16  
**Cập nhật**: 2026-05-16 (v2 — mở rộng scope sau phản hồi)  
**Phạm vi**: Nâng cấp toàn diện giao diện SOC (`/operations-center`) thành control center thực sự  
**Trạng thái**: AWAITING_CONFIRMATION

---

---

## ĐỌC TRƯỚC: Những gì phiên bản 1 bỏ sót

Phản hồi từ user session 2026-05-16 xác định 5 vấn đề cốt lõi v1 chưa xử lý:

1. **UX infrastructure bị bỏ qua** — trang dài không phân trang, list view không compact, render dữ liệu thô.
2. **Prefetch thiếu lớp timezone/market-hours** — 6 profiles đã có nhưng cần timezone selector, giờ mở/đóng cửa thị trường có thể chỉnh, và lịch ngày nghỉ/không giao dịch.
3. **VnBroker config không phải single-config** — mỗi provider (VCI, KBS, DNSE, TCBS, SSI) có rate limit riêng, timeout riêng. DNSE còn cần API ID/Key. UI phải per-provider.
4. **Benchmark tool đã tồn tại** trong `market_data/vnbroker_benchmark.py` và legacy admin-ops — cần tái sử dụng, không xây mới.
5. **Data ops không chỉ là nến lịch sử** — còn IntradayTick, Whale events, CVD/Strengths, Dark Money Flow, Session Facts. Cần cả **schedule tự động** lẫn **manual trigger ưu tiên** per-symbol.

---

## 1. Bối cảnh

Hệ thống hiện có **hai surface quản trị tách biệt**:

| Surface | Route | Trạng thái |
|---------|-------|------------|
| Admin Ops (legacy) | `/admin-ops` | Redirect sang SOC |
| SOC — Service Operations Center | `/operations-center` | Đang hoạt động (6 tabs) |

Screenshots từ `https://vninvest.edusuccess.vn/admin-ops` cho thấy legacy UI có các tính năng chưa được chuyển sang SOC: form cấu hình Prefetch đầy đủ, form VnBroker có structured fields, và Data Ops backfill. Mục tiêu là **nâng SOC lên tương đương hoặc vượt** legacy UI.

---

## 2. Audit Gap — Hiện trạng vs Yêu cầu

### 2.1 Tab Prefetch → `PrefetchPanel.jsx`

| Chức năng | Screenshots (legacy) | SOC hiện tại | Gap |
|-----------|---------------------|--------------|-----|
| Batch size | ✅ Form input | ❌ Không có | MISSING |
| Symbol limit | ✅ Form input | ❌ Không có | MISSING |
| Max retries | ✅ Form input | ❌ Không có | MISSING |
| Retry base/max delay | ✅ Form input | ❌ Không có | MISSING |
| Rate-limit cooldown | ✅ Form input | ❌ Không có | MISSING |
| Circuit breaker (window/threshold/cooldown) | ✅ 3 fields | ❌ Không có | MISSING |
| Cache TTL | ✅ Form input | ❌ Không có | MISSING |
| Số ngày lưu close | ✅ Form input | ❌ Không có | MISSING |
| Universe groups multiselect | ✅ Dropdown | ❌ Không có | MISSING |
| Feature toggles | ✅ Checkboxes | ❌ Không có | MISSING |
| Trigger Prefetch async / sync | ✅ 2 buttons | ❌ Chỉ có Purge | MISSING |
| Time policy intervals (editable) | ✅ Full form | ⚠️ Read-only | PARTIAL |
| Lưu / Apply settings | ✅ Button | ❌ Không có | MISSING |
| Cache status + Purge | Không hiện | ✅ Có | OK |

**Đánh giá**: PrefetchPanel thiếu ~85% chức năng form. Backend **đã có đầy đủ** endpoint:
- `GET/POST /api/soc/prefetch/config/`
- `GET /api/soc/prefetch/config/profiles/`
- `POST /api/soc/prefetch/warm-now/`
- `GET /api/soc/prefetch/universe-groups/`

---

### 2.2 Tab Vnstock Config → `VnbrokerPanel.jsx`

| Chức năng | Screenshots (legacy) | SOC hiện tại | Gap |
|-----------|---------------------|--------------|-----|
| Benchmark Price Board tool | ✅ Provider select + Execute | ❌ Không có | MISSING |
| Max Concurrency, Retry, Backoff | ✅ Individual fields | ⚠️ Raw JSON textarea | PARTIAL |
| Rate Limit Cooldown, Timeouts | ✅ Individual fields | ⚠️ Raw JSON textarea | PARTIAL |
| Price Board Source / Fallback | ✅ Dropdown (KBS/VCI) | ⚠️ Raw JSON only | PARTIAL |
| Lưu / Apply | ✅ Button | ✅ Preview+Apply modal | OK |
| Reset về mặc định | ✅ Button | ❌ Không có trong SOC | MISSING |
| Health status / metrics | Không hiện | ✅ Có | OK |

**Đánh giá**: VnbrokerPanel có write capability nhưng UX kém (raw JSON). Backend đã có:
- `GET/POST /api/soc/vnbroker/config/`
- `POST /api/soc/vnbroker/config/preview/`
- `POST /admin-ops/vnbroker-config/reset-to-defaults/` (legacy, bridge qua)

---

### 2.3 Tab Data Ops → `DataOpsPanel.jsx`

| Chức năng | Screenshots (legacy) | SOC hiện tại | Gap |
|-----------|---------------------|--------------|-----|
| Write guard banner | ✅ "Chế độ xem chỉ đọc" (legacy) | ✅ `WriteGuardBanner` | ĐÃ HIỂU |
| Intraday side backfill | ✅ Hiển thị (legacy) | ❌ Không có trong SOC | MISSING |
| Historical OHLCV backfill (daily_prices) | ❌ Không có ở cả hai | ❌ Không có | MISSING |
| Coverage view + queue tiers | Không hiện rõ | ✅ Có đầy đủ | OK |
| Run logs + audit | Không hiện rõ | ✅ Có đầy đủ | OK |

**Ghi chú về write_block_reason**: Legacy admin-ops hiển thị write block vì dùng endpoint khác
(`/admin-ops/intraday-side-backfill/apply/`). SOC DataOps mặc định `can_apply: True` (xem
`ownership.py` `DEFAULT_DOMAIN_OWNERSHIP['dataops_market_data']`) — **viết được**.
Nếu có `OwnershipRecord` DB override, cần check và điều chỉnh.

---

### 2.4 Tab Screener → `ScreenerPanel.jsx`

**Hiện trạng ScreenerPanel.jsx** (đối chiếu screenshots legacy `/admin-ops` → tab "Global Screener"):

| Chức năng | Screenshots (legacy) | SOC hiện tại | Gap |
|-----------|---------------------|--------------|-----|
| Biểu thức lịch quét (scan schedule) | ✅ Cron expression input (`*/5 * * * *`) | ❌ Raw JSON dump | MISSING |
| Bật/tắt screener toàn cục | ✅ Checkbox "Bật screener người dùng" | ❌ Raw JSON dump | MISSING |
| Lưu cấu hình lịch | ✅ "Lưu cấu hình" button | ❌ Không có form | MISSING |
| Quét thủ công | ✅ "Gửi lệnh quét nền" button | ✅ Có, nhưng nhỏ | PARTIAL |
| Manual scan với symbol filter | ❌ (không có) | ❌ Không có | MISSING |
| Tạo luật mới | ✅ Form: tên luật + Luật JSON textarea | ❌ Không có | MISSING |
| Sửa/xóa luật | ✅ Cột "Thao tác" (edit+delete) | ❌ Không có | MISSING |
| Kích hoạt/tắt luật riêng lẻ | ✅ Checkbox "Kích hoạt" | ❌ Chỉ badge read-only | MISSING |
| Danh sách luật (table + phân trang) | ✅ Table: Tên luật / Trạng thái / Cập nhật / Thao tác | ⚠️ Cards read-only, no pagination | PARTIAL |
| Kết quả quét gần nhất | ❌ | ✅ Bảng symbol/rule/time | OK |
| Lịch sử cảnh báo | ❌ | ✅ Có | OK |
| Phân trang kết quả/alerts | ❌ | ❌ Không có | MISSING |
| Metrics (avg scan / hit rate) | ❌ | ✅ 2 số liệu | OK |

**Backend đã có đầy đủ** (7 endpoints, `ownership.screener.can_apply = True`):
- `GET /api/soc/screener/config/` + `POST /api/soc/screener/config/` — đọc/ghi config
- `GET /api/soc/screener/rules/` + `POST /api/soc/screener/rules/` — danh sách + tạo mới
- `GET /api/soc/screener/results/` — kết quả quét mới nhất
- `GET /api/soc/screener/alert-history/` — lịch sử cảnh báo (phân trang)
- `POST /api/soc/screener/manual-scan/` — quét thủ công (nhận `symbols` array)

**Backend gaps cần thêm**:
1. `DELETE /api/soc/screener/rules/{id}/` — **chưa có** (không có trong file header screener.py)
2. `PUT/PATCH /api/soc/screener/rules/{id}/` — **chưa có** (không thể edit rule hiện tại)

**Contract mismatch cần sửa**:
- `socApi.manualScan()` gửi `{rule_ids: [...]}` nhưng backend `ScreenerManualScanRequestSerializer` nhận `{symbols: [...]}` — **phải sửa trước khi code UI**

**`ScreenerDomainConfig` fields cần form**:
- `enabled` (bool, default `True`) — toggle bật/tắt
- `scan_interval_seconds` (int, default 60) — tương đương cron legacy
- `max_symbols_per_scan` (int, default 2000)
- `alert_cooldown_seconds` (int, default 300)
- `max_alerts_per_symbol_per_hour` (int, default 5)
- `result_retention_hours` (int, default 24)
- `publish_to_redis` (bool, default `True`)

**Valid rule types** (có thể dùng làm select list):
`price_change_pct`, `volume_spike_ratio`, `cvd_threshold`, `whale_count`, `dark_pool_ratio`,
`rsi_level`, `ma_cross`, `bollinger_band_break`, `custom`

---

### 2.5 Tabs còn thiếu trong SOC

| Admin Ops tab cũ | SOC tab hiện có | Tình trạng |
|------------------|-----------------|------------|
| Tổng quan | `overview` | ✅ |
| Trung tâm dòng tiền | `signals` | ✅ |
| Global Screener | `screener` | ✅ |
| Governance | ❌ Không có | MISSING |
| Prefetch | `prefetch` | ⚠️ Incomplete |
| Vnstock Config | (embedded in overview?) | ⚠️ Partial |
| Runtime KPI | ❌ Không có tab riêng | MISSING |
| Data Ops | `dataops` | ⚠️ Missing backfill |

`RuntimeKPIPanel.jsx` đã tồn tại tại `frontend/src/components/RuntimeKPIPanel.jsx` nhưng chưa
được thêm vào SOCPage tabs.

---

## 3. Kế hoạch Triển Khai — 4 Slices

### Slice 1 — PrefetchPanel: Runtime Settings Form
**Ước tính**: 3–4 giờ  
**Priority**: P0 — Impact cao nhất  

**Files thay đổi**:
- `frontend/src/components/soc/PrefetchPanel.jsx` — refactor toàn bộ

**Nội dung**:
1. Thêm form section **"Cài đặt Runtime"** với các fields:
   - `batch_size` (number input, default 20)
   - `symbol_limit` (number input, default 40)
   - `max_retries` (number input, default 4)
   - `retry_base_delay_seconds` (number, default 15)
   - `retry_max_delay_seconds` (number, default 120)
   - `rate_limit_cooldown_seconds` (number, default 30)
   - `circuit_breaker_window_seconds` (number, default 300)
   - `circuit_breaker_failure_threshold` (number, default 3)
   - `circuit_breaker_cooldown_seconds` (number, default 1800)
   - `cache_ttl_seconds` (number, default 3600)
   - `close_history_days` (number, default 7)
2. Thêm **Universe Groups** multiselect (gọi `socApi.getPrefetchUniverseGroups()`)
3. Thêm feature toggles (per-profile checkboxes nếu API trả về)
4. Buttons: **Xem trước & Lưu** (qua `ConfigPreviewModal`), **Warm Now (Async)**, **Warm Now (Sync)**
5. Chuyển Time Policy intervals sang editable inputs (giữ readonly card cũ bên cạnh)
6. Xóa raw JSON dump hiện tại

**API dùng**:
```javascript
socApi.getPrefetchConfig()           // GET /api/soc/prefetch/config/
socApi.applyPrefetchConfig(payload)  // POST /api/soc/prefetch/config/
socApi.getPrefetchUniverseGroups()   // GET /api/soc/prefetch/universe-groups/
socApi.warmPrefetchNow(mode)         // POST /api/soc/prefetch/warm-now/?mode=async|sync
socApi.previewPrefetchConfig(payload)  // POST /api/soc/prefetch/config/preview/ (nếu có)
```

**DoD**:
- [ ] Form render đúng với giá trị từ API
- [ ] Lưu → ConfigPreviewModal → Apply → reload config thành công
- [ ] Warm Now async/sync gọi API trả task_id
- [ ] Universe groups load và multiselect hoạt động
- [ ] i18n tiếng Việt đầy đủ cho tất cả labels/buttons
- [ ] Không có regression với Purge Cache / Cache Status
- [ ] Build frontend pass

---

### Slice 2 — VnbrokerPanel: Structured Form + Benchmark Tool
**Ước tính**: 2–3 giờ  
**Priority**: P1

**Files thay đổi**:
- `frontend/src/components/soc/VnbrokerPanel.jsx` — thêm section + structured form

**Nội dung**:
1. **Thay** raw JSON textarea bằng structured fields:
   - `max_concurrency` (number, default 12)
   - `retry` (number, default 1)
   - `backoff_factor` (number/float, default 0.35)
   - `rate_limit_cooldown_seconds` (number, default 20)
   - `price_board_source` (select: `KBS` | `VCI` | `DNSE`)
   - `fallback_sources` (multiselect: `VCI` | `KBS`)
   - `connect_timeout_seconds` (number)
   - `read_timeout_seconds` (number)
2. Giữ `ConfigPreviewModal` flow (preview → apply)
3. Thêm button **Reset về mặc định** → `resetAdminVnbrokerConfig()`
4. Thêm collapsible card **"Benchmark Price Board"**:
   - Provider selector (KBS / VCI / Tất cả)
   - Nút **Chạy Benchmark**
   - Kết quả: latency per provider, status, timestamp
   - Gọi `runAdminVnbrokerBenchmark({provider: selected})` hoặc `socApi.testVnbrokerConnection()`

**DoD**:
- [ ] Structured fields bind đúng với config object từ API
- [ ] Preview/Apply hoạt động sau khi thay form
- [ ] Reset về mặc định confirm trước khi apply
- [ ] Benchmark tool gọi API và hiển thị kết quả latency
- [ ] Không có regression với Health / Metrics section
- [ ] i18n đầy đủ

---

### Slice 3 — DataOps: Historical OHLCV Backfill Section
**Ước tính**: 2–3 giờ  
**Priority**: P0 — Linked với nhu cầu fill dữ liệu nến VN30/VN100

**Files thay đổi**:
- `frontend/src/components/soc/DataOpsPanel.jsx` — thêm section mới

**Nội dung**:
1. Thêm collapsible section **"Backfill Dữ Liệu Nến Lịch Sử (Daily Prices)"**:
   - Symbol group selector (radio/select):
     - VN30 (30 mã)
     - VN100 (100 mã)
     - Tất cả niêm yết (~1700 mã)
     - Tùy chỉnh (textarea nhập danh sách)
   - Số ngày lịch sử (select: 30 / 90 / 365 / 1825 ngày, hoặc custom input)
   - Mode: `missing_only` (mặc định, recommended) / `force_refresh` (toggle)
   - Execution mode: `async` (mặc định) / `sync`
   - Nút **Xem trước (Dry-run)** → gọi `socApi.previewDataOpsPlanner(payload)` với `datasets: ['daily_prices']`
   - Nút **Chạy Backfill** (confirm dialog trước khi run) → `socApi.runDataOpsPlanner(payload)`
   - Hiển thị kết quả: `task_id`, ước tính số symbols, trạng thái dispatch
2. **Không cần endpoint mới** — `DataOpsPlannerRunView` đã hỗ trợ `datasets=['daily_prices']`

**Payload mẫu**:
```json
{
  "symbols": ["VNM", "VIC", ...],   // empty = lấy từ group
  "datasets": ["daily_prices"],
  "mode": "missing_only",
  "force_refresh": false,
  "execution_mode": "async",
  "reason": "operator_backfill_daily_prices"
}
```

**DoD**:
- [ ] Section hiển thị đúng dưới Coverage section
- [ ] Dry-run preview hiển thị ước tính symbols và datasets
- [ ] Chạy backfill dispatch task_id thành công
- [ ] Symbol group VN30/VN100 resolve đúng từ API group registry
- [ ] Không ảnh hưởng coverage / queue-tiers / run-logs sections
- [ ] i18n đầy đủ

---

### Slice 4 — SOCPage: Thêm tab VnBroker riêng + Runtime KPI
**Ước tính**: 1–2 giờ  
**Priority**: P2 — Navigation polish

**Files thay đổi**:
- `frontend/src/pages/SOCPage.jsx`
- `frontend/src/components/soc/SOCDomainTabs.jsx`

**Nội dung**:
1. Thêm tab **`vnbroker`**:
   - Render `VnbrokerPanel` (hiện đang ở đâu chưa rõ — cần xác nhận khi bắt đầu)
2. Thêm tab **`runtime-kpi`**:
   - Render `RuntimeKPIPanel` (đã có tại `frontend/src/components/RuntimeKPIPanel.jsx`)
3. Cập nhật `activeDomain` validation list
4. Cập nhật `SOCDomainTabs` với 2 tab mới và label tiếng Việt

**DoD**:
- [ ] Tab `?tab=vnbroker` và `?tab=runtime-kpi` routing hoạt động
- [ ] Labels tiếng Việt: "Cấu hình VnBroker", "Runtime KPI"
- [ ] Không phá vỡ 6 tabs hiện tại

---

### Slice 5 — ScreenerPanel: Config Form + Rule CRUD + Pagination
**Ước tính**: 3–4 giờ  
**Priority**: P1 — Tương đương Slice 2 (UX admin thiết yếu)  
**Điều kiện tiên quyết**: Backend cần thêm 2 endpoints mới (DELETE + PUT rule)

#### 5.1 Backend — Thêm rule edit + delete endpoints (bắt buộc trước)

**File backend**: `packages/core/backend/src/service_ops/views/screener.py`

Thêm 2 views mới:

```python
# DELETE /api/soc/screener/rules/{rule_id}/
class ScreenerRuleDeleteView(SOCBaseView):
    """Xóa rule khỏi config hiện tại (tìm theo id trong rules list)."""

# PUT /api/soc/screener/rules/{rule_id}/
class ScreenerRuleUpdateView(SOCBaseView):
    """Cập nhật name/conditions/enabled cho một rule theo id."""
```

**File backend**: `packages/core/backend/src/service_ops/urls.py`

```python
path('screener/rules/<str:rule_id>/', ScreenerRuleUpdateView.as_view()),
path('screener/rules/<str:rule_id>/delete/', ScreenerRuleDeleteView.as_view()),
```

**Sửa contract mismatch** trong `frontend/src/api/socApi.js`:

```javascript
// Từ:
manualScan: async (ruleIds = []) => { body: { rule_ids: ruleIds } }
// Thành:
manualScan: async (symbols = []) => { body: { symbols } }
```

Thêm helper functions mới vào `socApi.js`:
```javascript
createScreenerRule(payload)   // POST /api/soc/screener/rules/
updateScreenerRule(ruleId, payload)  // PUT /api/soc/screener/rules/{ruleId}/
deleteScreenerRule(ruleId)    // DELETE /api/soc/screener/rules/{ruleId}/delete/
applyScreenerConfig(config)   // POST /api/soc/screener/config/ (đã có, giữ nguyên)
```

#### 5.2 Frontend — ScreenerPanel.jsx

**Refactor toàn bộ ScreenerPanel.jsx** thành 4 sections:

**Section A: Cấu hình lịch quét** (`ScreenerConfigSection`):
```
┌─ Cấu hình lịch quét ──────────────────────────────────────┐
│  ● Kích hoạt screener toàn cục    [toggle ON/OFF]          │
│  Chu kỳ quét (giây)               [  60  ] s               │
│  Số symbol tối đa mỗi lần quét    [ 2000 ]                 │
│  Cooldown cảnh báo (giây)         [  300 ]                 │
│  Tối đa cảnh báo/symbol/giờ       [   5  ]                 │
│  Lưu kết quả (giờ)                [  24  ]                 │
│  ● Phát lên Redis                 [toggle]                  │
│                                                             │
│  [Xem trước & Lưu cấu hình]                                │
└─────────────────────────────────────────────────────────────┘
```
- Gọi `socApi.applyScreenerConfig(payload)` khi lưu
- Hiển thị diff preview với `ConfigPreviewModal` (reuse pattern từ các panel khác)

**Section B: Quét thủ công** (`ScreenerManualScanSection`):
```
┌─ Quét thủ công ─────────────────────────────────────────────┐
│  Mô tả: Gửi lệnh quét nền, phù hợp khi chạy lại snapshot   │
│  Symbol filter (tùy chọn):  [input, comma-separated]        │
│  [Gửi lệnh quét nền] ← nút xanh lớn                        │
│                                                             │
│  ✓ Đã gửi lệnh (scan_id: xxx, status: queued) ← sau khi run│
└─────────────────────────────────────────────────────────────┘
```
- Gọi `socApi.manualScan(symbolsArray)` (sau khi sửa contract)

**Section C: Quản lý luật** (`ScreenerRuleManagerSection`):
```
┌─ Quản lý luật ─────────────────────────────────────────── [Tạo luật mới ▲] ┐
│                                                                              │
│  ── Form tạo/sửa luật (collapsible, đóng mặc định) ───────────────────────  │
│  Tên luật:    [________________]                                             │
│  Loại luật:   [select: price_change_pct / volume_spike_ratio / ...]          │
│  Điều kiện (JSON):                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ [{"field":"whale_count","op":"gte","value":3}]                        │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│  ☑ Kích hoạt                                                                │
│  [Lưu luật]  [Hủy]                                                          │
│                                                                              │
│  ── Danh sách luật ─────────────────────────────────────────────────────── │
│  Tên luật          │ Loại            │ Trạng thái │ Cập nhật  │ Thao tác   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Whale Intensity   │ whale_count     │ ✓ Kích hoạt│ 10/5/26   │ [Sửa][Xóa]│
│  Volume Spike      │ volume_spike..  │ ✗ Tắt      │ 9/5/26    │ [Sửa][Xóa]│
│                                                                              │
│  Trang 1 / 2  [< Trước] [Sau >]                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```
- "Tạo luật mới" button → expand form (hoặc inline toggle `showRuleForm`)
- Click "Sửa" → load rule vào form (edit mode)
- Click "Xóa" → confirm dialog → `socApi.deleteScreenerRule(id)`
- Toggle trạng thái → `socApi.updateScreenerRule(id, {enabled: !current})`
- Phân trang: gọi `socApi.getScreenerRules(page)` khi đổi trang
- Validate JSON trong textarea trước khi submit (JSON.parse try/catch)
- Hiển thị error inline nếu JSON invalid

**Section D: Kết quả & Cảnh báo** (giữ gần như cũ + thêm pagination):
- Kết quả quét gần nhất: giữ bảng symbol/rule/timestamp
- Lịch sử cảnh báo: thêm pagination gọi `socApi.getScreenerAlerts(page)`
- Metrics: giữ nguyên (avg scan / hit rate)

#### 5.3 DoD

- [ ] Config form load đúng giá trị từ `GET /api/soc/screener/config/`
- [ ] Save config → preview diff → apply thành công
- [ ] Manual scan gửi đúng `{symbols: [...]}` (sửa contract mismatch)
- [ ] Tạo rule mới: form validate JSON, gọi `POST /api/soc/screener/rules/`, reload list
- [ ] Sửa rule: load data vào form edit, gọi `PUT /api/soc/screener/rules/{id}/`
- [ ] Xóa rule: confirm dialog → `DELETE .../rules/{id}/delete/` → reload
- [ ] Bật/tắt luật: toggle inline → update enabled field
- [ ] Pagination hoạt động cho rules list và alert history
- [ ] Rule type select hiển thị đúng 9 loại hợp lệ từ `VALID_RULE_TYPES`
- [ ] i18n tiếng Việt đầy đủ dấu cho tất cả labels/buttons
- [ ] `WriteGuardBanner` hiển thị nếu `can_apply = False`
- [ ] Backend endpoints `DELETE/PUT rule` được thêm và test
- [ ] Build frontend pass không lỗi

---

## 4. Thứ tự thực hiện đề xuất

```
Slice 1 (Prefetch form — P0)
  → Slice 3 (DataOps backfill — P0)
    → Slice 5 (Screener CRUD — P1) ← Điều kiện: backend DELETE/PUT rule cần xong trước UI
      → Slice 2 (VnBroker structured form — P1)
        → Slice 4 (Tabs navigation — P2)
```

**Ghi chú**: Slice 5 được ưu tiên trước Slice 2 và 4 vì:
- Backend endpoints (DELETE + PUT rule) cần build trước → có thể làm song song với Slice 3
- Screenshots legacy cho thấy Rule CRUD là core flow của screener admin, không phải add-on

---

## 5. Rủi ro & Giải pháp

| Rủi ro | Mức độ | Giải pháp |
|--------|--------|-----------|
| `getPrefetchConfig()` trả về field names khác form | Trung bình | Kiểm tra actual response trước khi bind fields |
| `OwnershipRecord` DB override chặn DataOps write | Thấp | `DEFAULT_DOMAIN_OWNERSHIP` mặc định `can_apply: True`; nếu gặp, query DB để reset |
| VnBroker reset endpoint: legacy `resetAdminVnbrokerConfig()` vs SOC `/api/soc/vnbroker/config/` | Trung bình | Bridge qua `client.js` trước; migrate sau khi SOC có endpoint reset |
| `socApi.warmPrefetchNow()` — kiểm tra mode param signature | Thấp | Đọc `prefetch.py` view trước khi code |
| Universe groups API trả về cấu trúc group_id / label khác expected | Thấp | Map từ `PrefetchUniverseGroupsView` response |
| **Screener: `manualScan` contract mismatch** (frontend gửi `rule_ids`, backend nhận `symbols`) | **Cao** | **Sửa `socApi.manualScan()` trong cùng commit với Slice 5** — không để mismatch tồn tại |
| **Screener: Backend DELETE/PUT rule chưa có** | **Cao** | **Thêm 2 views + 2 URL patterns trước khi code frontend** — Slice 5 bắt buộc phần backend trước |
| Screener rules lưu dưới dạng list trong `ScreenerDomainConfig.rules` JSON — edit/delete cần tìm theo `id` trong list | Trung bình | Backend views cần implement tìm rule theo `id`, patch list, save lại config record |
| Rule JSON textarea validation phức tạp nếu user nhập sai cú pháp | Thấp | `JSON.parse()` try/catch với inline error message, không submit nếu invalid |

---

## 6. Files tham chiếu

### Frontend
- `frontend/src/components/soc/PrefetchPanel.jsx` — **Slice 1 target**
- `frontend/src/components/soc/VnbrokerPanel.jsx` — **Slice 2 target**
- `frontend/src/components/soc/DataOpsPanel.jsx` — **Slice 3 target**
- `frontend/src/pages/SOCPage.jsx` — **Slice 4 target**
- `frontend/src/components/soc/SOCDomainTabs.jsx` — **Slice 4 target**
- `frontend/src/components/soc/ScreenerPanel.jsx` — **Slice 5 target** (refactor toàn bộ)
- `frontend/src/components/soc/ConfigPreviewModal.jsx` — reusable
- `frontend/src/components/soc/WriteGuardBanner.jsx` — reusable
- `frontend/src/components/RuntimeKPIPanel.jsx` — đã có, dùng ở Slice 4
- `frontend/src/api/socApi.js` — **Slice 5 cần sửa `manualScan` + thêm `createScreenerRule`/`updateScreenerRule`/`deleteScreenerRule`**
- `frontend/src/api/client.js` — legacy bridge functions

### Backend (đọc để biết response contract trước khi bind form)
- `packages/core/backend/src/service_ops/views/prefetch.py` — PrefetchConfigView
- `packages/core/backend/src/service_ops/views/vnbroker.py` — VnbrokerConfigView
- `packages/core/backend/src/service_ops/views/dataops.py` — DataOpsPlannerRunView
- `packages/core/backend/src/service_ops/views/screener.py` — **Slice 5: thêm RuleDeleteView + RuleUpdateView**
- `packages/core/backend/src/service_ops/domain_configs/screener.py` — `ScreenerDomainConfig` fields
- `packages/core/backend/src/service_ops/urls.py` — **Slice 5: thêm 2 URL patterns cho DELETE/PUT rule**
- `packages/core/backend/src/service_ops/ownership.py` — ServiceOwnershipMatrix

---

## 7. Trạng thái

| Slice | Trạng thái | Commit |
|-------|------------|--------|
| Slice 1 — PrefetchPanel form + timezone/interval | ⏳ Chờ xác nhận | — |
| Slice 2 — VnbrokerPanel structured form + benchmark | ⏳ Chờ xác nhận | — |
| Slice 3 — DataOps comprehensive backfill | ⏳ Chờ xác nhận | — |
| Slice 4 — SOCPage tabs navigation | ⏳ Chờ xác nhận | — |
| **Slice 5 — ScreenerPanel config form + Rule CRUD + pagination** | ⏳ **Chờ xác nhận** | — |
| Backend: DELETE/PUT screener rule endpoints | ⏳ Chờ xác nhận (bắt buộc trước Slice 5 UI) | — |
