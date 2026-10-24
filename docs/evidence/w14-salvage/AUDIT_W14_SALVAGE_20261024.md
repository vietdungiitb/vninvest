# AUDIT W1.4-salvage — cứu chỉ báo kỹ thuật chart endpoint (2026-10-24)

> **Kết luận trước (1 dòng):** KHÔNG salvage `views.py` — slice cũ sửa nhầm view chết (`StockChartView`, 0 route); endpoint thật đã tính chỉ báo thật qua helper. Đã hoàn tác cherry-pick, giữ lại fix bash-guard plugin. Re-audit độc lập: AGREE, 0 blocker.

## 1. Bối cảnh & mục tiêu

- Slice gốc `tech-indicators` (checkout `agent-tech-indicators`, branch `feat/tech-indicators`, 2026-10-23) claim "chart endpoint trả None placeholder" và tính RSI14/MACD/ATR14/volatility20/volume_ratio/change_percent/latest_close trong `StockChartView` (`packages/core/backend/src/market_data/views.py`), nhưng **không merge, không test BE** (ghi CHƯA CHẠY), không audit.
- Nhiệm vụ cứu hộ: tách đúng 1 file `views.py` (cherry-pick `279d2c975`), fail-before → pass-after trên VPS staging, re-audit, PR.

## 2. Phương pháp (L-V02: không tin claim kế thừa)

1. Đọc diff slice thật thay vì tin mô tả (`git show 279d2c975`).
2. Chạy 2 test chart liên quan **trên dev chưa fix** (VPS staging, DB tạm riêng) làm fail-before, thay vì đoán.
3. Trace route → view thật sự phục vụ endpoint, thay vì tin tên class trong commit message.

## 3. Bằng chứng

### 3.1. Fail-before THẤT BẠI trên VPS (bằng chứng quyết định)

| Test | Trên dev chưa fix (`origin/dev`) | Kết quả |
|---|---|---|
| `test_stock_chart_reads_daily_prices_with_native_envelope` (đòi `assertIn('latest_close', technical)`, test file dòng 359) | PASS | Đỏ kỳ vọng **không xảy ra** |
| `test_stock_chart_returns_envelope_when_no_native_candles` (đòi `technical['bias'] == 'neutral'`, dòng 228) | PASS | — |

Chạy bằng image staging + mount worktree, `CORE_DATABASE_URL` trỏ DB tạm `w14_salvage`, `DJANGO_DEBUG=1`, DB + worktree đã xoá sau chạy (runbook §12.3). Vì fail-before không đỏ, toàn bộ tiền đề "endpoint trả None" bị bác bỏ → dừng salvage theo đúng vòng kín.

### 3.2. Slice sửa nhầm view chết

- Route chart (`core_urls.py:14,62` + `public_urls.py:17,64`) và cả 2 test trên đều trỏ `StockManagementChartView` (`stock_mgmt_native_views.py:1787`), không phải `StockChartView` (`views.py:177`) mà slice sửa.
- `git grep StockChartView origin/dev` = **1 hit duy nhất** (dòng định nghĩa class). 0 route, 0 import — view chết.
- Helper của view thật `_compute_chart_technical_payload` (`stock_mgmt_native_views.py:805-859`) **đã tính thật**: SMA20/50, RSI14 (`_compute_rsi14`), momentum_20d_pct, range_position_pct, bias + `bias_label`/`bias_description` tiếng Việt, latest_close, rvol, avg_volume_20. Test xanh trên là hệ quả trực tiếp.

### 3.3. So sánh tập chỉ báo (tránh cứu trùng)

| Slice (view chết) | Helper live (đã chạy) |
|---|---|
| RSI14, MACD/macd_signal, ATR14, volatility_20, volume_ratio, change_percent, latest_close | SMA20/50, RSI14, momentum_20d_pct, range_position_pct, bias(+label VI), latest_close, rvol, avg_volume_20 |

Trùng: RSI14, latest_close. Riêng slice: MACD, ATR14, volatility_20 — **chỉ có nghĩa nếu port vào helper live**, không phải merge nguyên slice.

### 3.4. FE đã đọc rsi_14 ở đâu (đo thật, 53 hit)

Dashboard/watchlist/AI advisor đọc `rsi_14` và fallback `--`/`"—"` khi null (`CoreDashboardPositionDeck.tsx:451-474`, `FactsFirstModularPositionDeck.jsx:429-452`, `WatchlistTable.tsx:250,266`, `WatchlistDetailPanel.tsx:187`, `useAIAdvisor.js:119`), i18n có sẵn label (`vi.js:3300`, `en.js:3296`). Các chỗ này đọc qua endpoint/field khác (screener/technicals), **không** qua view chết — nên slice cũng không sửa được chúng.

### 3.5. Phát hiện ngoài lề (không sửa trong slice, ghi nhận)

- **A1 còn đỏ trên dev:** `pricing.py:159-160` vẫn `django.utils.timezone.utc` (Django 6 đã xoá) — fix của slice close-w0-loose-ends chưa từng lên dev (đối chiếu `git show origin/dev:...`).
- **pm-w11 treo:** claim `in-progress` từ 2026-10-23 chỉ có 1 dòng, 0 code — chặn `orchestrator.py`, `serializers.py`, `tasks.py`, i18n theo protocol.
- **Claim vô hình lặp lại:** cả 2 checkout cũ giữ claim/ledger local mà `dev` không thấy (đúng anti-pattern Entry 404 §I-2).
- **Ledger trùng số:** Entry 405 của nhánh tech-indicators vs Entry 405 của dev (plugin fix) — merge nguyên nhánh sẽ phải đánh lại số.

## 4. Quyết định & lý do

1. **HOÀN TÁC cherry-pick `views.py`** (commit revert, đã verify byte-identical với `origin/dev`) — merge code vào view chết = thêm nợ bảo trì + duplicate logic RSI, 0 tác dụng người dùng.
2. **GIỮ fix bash-guard** (`.opencode-plugins/vninvest-hooks.ts`): V1 `cmd.includes('backend/')` chặn nhầm cả lệnh hợp lệ trên code mới (`git add packages/core/backend/...`); chuyển sang tách token + relativize, verify 4/4 case (ALLOW new-code, DENY legacy).
3. **Không mở slice W1.4 mới trong phiên này** — AC "59 series" đã bị PM Review C-7 tuyên bố stale; muốn làm tiếp phải đo lại AC (đếm series đang serve) rồi mới lập plan.

## 5. Gates đã chạy (bằng chứng, không báo PASS miệng)

- `manage.py check`: `no issues` (local, `DJANGO_DEBUG=1`, §12.2 cho phép).
- VPS staging: 2/2 test chart PASS trên base (fail-before thất bại -> refute) và trên slice cuối (không hồi quy); DB tạm `w14_salvage` đã DROP, worktree tạm đã xoá.
- `check-multi-agent`: exit 0. `normalize-eol`: OK. `pre-push-gate`: **34 PASS / 0 FAIL** (chạy 2 lần: trước và sau revert).
- Re-audit độc lập: **AGREE, 0 blocker** (5 reservation đã xử lý).
- CHƯA CHẠY: full BE/FE suite + build + E2E (slice rút về docs + hook + revert; không chạm logic BE chạy thật).

## 6. Lessons áp dụng

L-001 L-002 L-003 L-007 L-008 L-M02 L-V02 L-V03 L-V04 L-A01.
Bài học rút ra (đề xuất ghi lesson nếu coordinator duyệt): **fail-before là ran lọc bắt buộc trước mọi cứu code người khác để lại** — tiết kiệm 1 PR vô dụng; và file server đang watch phải atomic 1 write.
