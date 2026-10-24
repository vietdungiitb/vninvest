# PLAN W1.4-salvage — cứu chỉ báo kỹ thuật thật ở chart endpoint (2026-10-24)

> **KẾT LUẬN ĐIỀU TRA (fail-before BÁC BỎ):** 2 test chart PASS ngay trên dev chưa fix — route/test dùng `StockManagementChartView` + `_compute_chart_technical_payload` (đã tính thật), còn slice sửa `StockChartView` không được route (0 reference). Quyết định: HOÀN TÁC cherry-pick, KHÔNG salvage. Chi tiết: ledger Entry 407.

> **TRANG THAI: SUPERSEDED** — §1/§2/§4 duoi day la gia thuyet ban dau (giu lam tai lieu tham khao). Quyet dinh cuoi: KHONG salvage views.py (revert xong), GIU fix bash-guard. Re-audit: AGREE, 0 blocker.

`Lessons áp dụng: [L-001, L-002, L-003, L-007, L-008, L-M02, L-V02, L-V03, L-V04, L-A01]`

## 1. Mục tiêu & cơ sở (đã tự đọc code, không tin claim kế thừa)
- `packages/core/backend/src/market_data/views.py` (`StockChartView`, `origin/dev:195-260`) trả `technical.* = None` cho 8 field; FE ~53 chỗ đọc `rsi_14`/`atr_14`... đang hiện `--`/`—` (`CoreDashboardPositionDeck.tsx:451-474`, `WatchlistTable.tsx:250,266`).
- Cứu đúng 1 commit feat `279d2c975` (chỉ chạm `views.py`, +77/−6): tính RSI14/MACD(12,26,9)/ATR14/volatility20/volume_ratio/change_percent + thêm `latest_close`. Không lấy passenger Phase A (đã có người khác làm/done riêng).
- Bằng chứng fail-before có sẵn trong repo (chưa chạy): `test_stock_chart_reads_daily_prices_with_native_envelope` (`test_stock_management_native_api.py:329-359`) assert `assertIn('latest_close', technical)` — code cũ thiếu key ⇒ đỏ; code mới ⇒ xanh.

## 2. Tiêu chí nghiệm thu (Given/When/Then)
- G1: Khi chạy `test_stock_chart_reads_daily_prices_with_native_envelope` trên worktree `origin/dev` (VPS, DB tạm) thì ĐỎ (thiếu key); trên nhánh slice thì XANH.
- G2: `test_stock_chart_returns_envelope_when_no_native_candles` giữ nguyên hành vi trước/sau (không hồi quy; nếu đỏ sẵn thì ghi rõ pre-existing, không sửa trong slice này).
- G3: `manage.py check` PASS; `check-multi-agent` exit 0; `normalize-eol` OK; audit độc lập PASS/AGREE (0 blocker).
- G4: PR merge-commit, claim done, ledger Entry mới.

## 3. Baseline cổng hiện tại (local, trước code)
- `check-multi-agent`: PASS (170 claim, 0 lỗi). `normalize-eol`: OK.
- `manage.py check`: CHƯA CHẠY (chạy sau khi có code, cần `.venv` + `DJANGO_DEBUG=1`).
- BE test: CHƯA CHẠY (chỉ chạy trên VPS staging, DB tạm riêng — runbook §12.3).

## 4. SCOPE / Non-goals / LIMIT / Rollback
- SCOPE: `packages/core/backend/src/market_data/views.py` (cherry-pick `279d2c975`, đúng 1 file) + `docs/PLAN_W14_SALVAGE_20261024.md` + `docs/CLAIMS.md` + `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
- Non-goals: KHÔNG đụng Phase A (pricing/openclaw/test envelope/i18n đã có chủ); KHÔNG sửa test đỏ sẵn; KHÔNG đụng deny-list; KHÔNG migration.
- LIMIT: tối đa 3 vòng sửa/bước (luật cứng). VPS: 1 DB tạm `w14_salvage`, 2 worktree tạm (`/tmp/wt-w14-base`, `/tmp/wt-w14-slice`), xoá sau chạy kể cả khi đỏ.
- Rollback: `git checkout dev` + xoá branch + DROP DB tạm + xoá worktree tạm.

## 5. Rủi ro đã biết
- Công thức RSI (trung bình đơn, không Wilder) / MACD / ATR là xấp xỉ — auditor kiểm lại math; sai số nhỏ chấp nhận được cho hiển thị, không dùng để khớp lệnh.
- `_atr` dùng 3 mảng lọc `None` độc lập → lệch chỉ số nếu bar thiếu high/low giữa chừng (dữ liệu intraday thường đầy đủ; ghi nhận, không chặn).
- Test no-candles đòi key `bias` mà code không sinh ở nhánh này — kiểm chứng trên VPS xem đỏ sẵn hay không; đỏ sẵn ⇒ ghi pre-existing, không sửa.
