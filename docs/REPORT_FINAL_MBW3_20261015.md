# REPORT_FINAL — Wave 3 Cô lập & gộp danh mục (P1)

- Ngày: 2026-10-15 · Supervisor/PM · Nhánh: `feat/mbw3-isolation` → `dev` (1 PR)
- Chuỗi: PLAN (Stage 1) → audit AGREE sau 3 vòng O-1..O-5 (Stage 2) →
  2 claim + 2 worktree (Stage 3) → 2 agent song song (Stage 4) → audit code
  0 blocker + 1 major→loop đóng (Stage 5) → gates VPS (Stage 6) → PR+merge (Stage 7).

## 1. Việc làm (B3.1–B3.4 + 6 ticket nợ)

- BE (`mbw3-be`): GET bindings · kind/is_archived/provider/broker_config/
  source expose (read-only) + watchlist filter scope · guard `aggregate_read_only`
  5 write path + action `convert` (bảng chuyển làn, 3 codes, audit) · 0030 backfill
  DNSE broker_backed · B3.4 partial (NOT NULL có điều kiện, serializer-enforce).
- FE (`mbw3-fe`): BindingsPanel (confirm 2 bước + convert) · banner/khóa aggregate
  (unknown fail-closed) · watchlist scoped + derived (ADR-007) · FE-MERGE ·
  FE-DUPID (giữ `portfoliosManage.title`, grep == 1) · FE-STATUS · i18n
  `brokerWave3.*` 61/61 · VPS-FE-PROBE + sửa runbook §12.4.
- Sup (`mbw3-sup`): mount panel + loop F1/F2/F3/F5 + fix mount-crash Stage 6.

## 2. Waivers (coordinator chấp nhận bằng văn bản — ai, vì sao, rủi ro dư)

| # | Nội dung | Chấp nhận | Rủi ro dư |
|---|---|---|---|
| W1 | F6: GET bindings đòi `portfolio_write` (fail-closed, không đổi) | PM | Read cần quyền write — conservative, không rò rỉ; nới sau nếu UX phàn nàn |
| W2 | B3.4 partial: `broker_config`/`provider` giữ nullable + enforce serializer (leftovers chưa đếm được) | PM (đúng contract plan) | Contract NOT NULL dời post-deploy; ticket follow-up sau deploy |
| W3 | TEST-E2E + full BE + ruff CHƯA CHẠY | PM (nợ Wave 2, ticket riêng) | Hồi quy diện rộng chưa phủ; 101 test broker + 37 FE là vành đai wave |
| W4 | Warning claim row Wave 1 cũ (không sửa dòng agent khác) | PM | Cosmetic, gate PASS 0 lỗi |

## 3. Rủi ro dư

- Convert là write `kind` duy nhất qua API — đúng thiết kế (O-5) nhưng cần
  theo dõi audit `portfolio.convert` sau deploy.
- Backfill 0030 chạy lần đầu trên prod — idempotent + `[:100]` + `exists()`
  guard; rollback = noop (dữ liệu tạo thêm, không sửa cũ).
- Derived watchlist FE-compute từ positions — không có BE riêng; đổi shape
  positions phải update panel (ghi vào claim nếu slice sau chạm).

## 4. Bài học quy trình (→ Stage 8)

Xem ledger Entry. Ý chính: (1) mount file ngoài scope phải chạy test của
chính file đó; (2) runbook §12.3 stale tên biến — FE sửa §12.4 nhưng §12.3
còn sót; (3) ngoặc trong cột files của claim bị gate cảnh báo — viết path
thuần, ghi chú sang cột note.
