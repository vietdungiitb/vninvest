# HANDOFF — SSOT giá lịch sử: chốt điều kiện + PLAN P0 (2026-11-24)

- **Repo/branch**: `vninvest@feat/cafef-ref` (clean code, chỉ có doc mới + ledger) · vnbroker `feat/cafef-reference` (không đụng)
- **Trạng thái**: `plan-ready` — chốt 5 điều kiện + PLAN P0, audit 3 vòng **PASS**. **Chưa code.**
- **Ledger**: Entry 615 (audit đề xuất) + Entry 616 (decision + P0 plan).

## 1. Kết quả + evidence

1. Owner tự đo lại và xác nhận 3 blocker của đề xuất gốc → REVISION 1 (`c644d6654`) đã sửa.
2. Tôi chốt 5 mục §5 tại `docs/DECISION_SSOT_OWNER_ITEMS_20261124.md`:
   ToS defer sang P2 · UI default giữ provider-adjusted tới P3 · ngưỡng 95% chỉ gộp 3 sàn
   (CHƯA ĐO chỉ chặn mở rộng) · thứ tự P0→merge vnbroker→3.9.0→pin→P2 · tiêu chí dừng
   phân loại rebase trước khi alert.
3. PLAN P0 tại `docs/PLAN_PRICE_ADJUSTMENT_P0_20261124.md`: flag `PRICE_ADJUSTMENT_WRITES_ENABLED=False`,
   guard **đầu hàm `adjustment.py:83`** (freeze cả reset lẫn ghi), flag ON chỉ cho test F1 `:100-113`.
4. Audit độc lập 3 vòng: NEED_REVISION → NEED_REVISION → **PASS** (O-1..O-6, N-1..N-4 đều đóng).

## 2. Gate đã/chưa chạy

| Gate | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — 0 lỗi, exit 0 (tự chạy 2026-11-24) |
| BE test slice (VPS, cần `CORE_DATABASE_URL`) | **CHƯA CHẠY** — không có DB local |
| `node scripts/check-experiment-env.mjs`, `manage.py check`, pre-push-gate | **CHƯA CHẠY** |
| pytest-full vnbroker | **CHƯA ĐO LẠI** — không có evidence trong repo này |

## 3. Next steps / owner

1. Owner ký **ToS (trước P2 bulk)** và **UI default (trước P3)** — 2 mục còn lại trong §6 Decision.
2. Lập claim P0 (agent = tên branch `feat/price-adjustment-p0`), commit riêng phần docs hiện tại trước.
3. TDD theo PLAN §5: test flag OFF/ON → guard `:83` → đổi expectation `:70,71`, giữ `:100,102,113,114` flag ON.
4. Chạy gate có DB trên VPS → re-audit → bàn giao. Sau P0 mới lập P1 (`daily_bars` trên vnbroker).

## 4. Resume cho phiên kế tiếp

Đọc `docs/handoffs/HANDOFF_2026-11-24_SSOT_PRICE_P0_PLAN.md` → `PLAN_PRICE_ADJUSTMENT_P0_20261124.md`
→ `DECISION_SSOT_OWNER_ITEMS_20261124.md` → `AUDIT_PROPOSAL_VNBROKER_SSOT_20261124.md`.
Nguyên tắc không được quên: test phải assert **ngày**, không chỉ giá; không big-bang migrate;
giữ `CafefDailyPrice` làm staging; reconcile chỉ monitoring; `git status` đang có doc chưa commit.
