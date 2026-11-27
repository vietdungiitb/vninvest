# Quyết định Owner bổ sung cho SSOT Rev.2 (2026-11-27) — DOC-ONLY

> Bổ sung vào `SSOT_ADJUSTMENT_DESIGN_REV2_20261127.md` (D-01..D-07).
> **Không code, không migrate, không lưu secret vào repo.**

## D-08 — Anchor lịch sử: chọn **phương án A** (Owner chốt)

- Với toàn bộ dòng `DailyPrice` có `date <= T0`, dùng **một nguồn duy nhất VCI hoặc KBS** làm anchor, ghi `base_as_of = T0` và `adj_basis = 'anchor_provider'`.
- Dữ liệu CafeF 2011–2025 **giữ nguyên trong bảng đối chiếu `CafefDailyPrice`** (`models.py:113-142`) để so sánh, **không dùng làm nguồn hiển thị**.
- Mục tiêu: **0 vết nối lệch basis** tại ranh giới 2025/2026 (trường hợp TPB cafef dừng 2025-12-31 + legacy 2026).
- Phase 2 exit gate cập nhật: ngoài `adj_close IS NULL = 0` và integrity 0 violation, phải có **báo cáo đối chiếu anchor vs CafeF** theo symbol, và `base_as_of` đồng nhất trong toàn chuỗi `<= T0`.
- Rollback: backup `DailyPrice` trước anchor + SQL khôi phục đã test trên DB riêng.

## D-09 — DNSE: cấp credential nhưng **rate-limit nặng** ⇒ dùng làm nguồn dự phòng có giới hạn, không phải nguồn throughput

### D-09.1 Phân tầng provider (sửa D-05)

| Tầng | Provider | Vai trò | Concurrency đề xuất |
|---|---|---|---|
| Tier 1 (throughput) | VCI, KBS | Nguồn adjusted chính; anchor + ingest + canary | theo profile: VCI ≈ 8, KBS ≈ 4 (phải đo VPS theo D-07) |
| Tier 2 (dự phòng có giới hạn) | **DNSE** | Chỉ nhận symbol khi VCI/KBS đang cooldown hoặc khi cần đối chiếu chéo | **1–2**, caps cứng, budget riêng |
| Reference only | CafeF | Đối chiếu raw/adjusted, **không bao giờ ghi `adj_close`** | 0 (read-only) |

### D-09.2 Ràng buộc kỹ thuật DNSE (đã đọc source)

- Credential: `DNSE_API_KEY` + `DNSE_API_SECRET` (`explorer/dnse/quote.py:282-288`, `provider_pool.py:34-35`) — **chỉ inject qua env/secret store của staging**, không commit vào repo hay compose file tracked.
- `history()` có **auto page_size, giới hạn 1–1000** (`explorer/dnse/quote.py:443-458`) ⇒ lịch sử 15 năm = nhiều page/mã. Với rate-limit nặng, **cấm dùng DNSE cho deep backfill**; chỉ dùng cho cửa sổ gần (ví dụ ≤30 ngày) hoặc chia lô nhỏ.
- `dnse/quote.py:125-142` đã convert marker `401/403/429/timeout/...` thành `ConnectionError` để `source_router` failover — **tốt**, nhưng vẫn **không nhận diện 418** (grep `418` toàn vnbroker = 0) ⇒ phải thêm `418` vào `_FAILOVER_MARKERS` và vào `RateLimitError` chung của D-05.
- Do rate-limit nặng: DNSE **không được retry cùng provider** (D-05 đã bỏ 429 khỏi `_is_retryable_status`); dính limit → cooldown ngay + trả symbol về work-queue cho VCI/KBS, nếu tất cả cooldown thì **defer batch** + alert, không spin.

### D-09.3 Ngân sách & đo lường

- Mỗi provider có `rate_budget` riêng; DNSE budget nhỏ nhất và **không được chia sẻ** với bucket của VCI/KBS.
- D-07 mở rộng: benchmark VPS phải đo riêng DNSE với **ramp thận trọng** (bắt đầu 1 request, tăng dần đến khi thấy 418/429), ghi `safe_rps_dnse` vào cấu hình. Trước khi có số đo này, DNSE chạy ở cap **1 worker**.
- **Mức độ rate-limit của DNSE: CHƯA XÁC MINH** (mới chỉ có nhận định của Owner + cấu trúc pagination trong code). Không suy ra con số.

## D-09.4 Cập nhật cổng nghiệm thu

- Phase 0: có `safe_rps_dnse` đo thật trên VPS + xác nhận secret được inject qua env (không nằm trong git).
- Phase 1: test mock DNSE trả 418/429 giữa batch → cooldown DNSE, symbol chuyển sang VCI/KBS, `symbols_missing = 0`; deep backfill **không** gọi DNSE.
- Phase 4: benchmark 1834 mã với 3 provider; báo cáo rõ tỉ lệ symbol do DNSE gánh (dự kiến nhỏ). Nếu DNSE làm chậm tổng thể hoặc gây cooldown lan, giữ DNSE ở chế độ **manual/đối chiếu**.

## Trạng thái các quyết định

| ID | Nội dung | Trạng thái |
|---|---|---|
| D-08 | Anchor A (VCI/KBS thống nhất, CafeF chỉ đối chiếu) | **Owner chốt** |
| D-09 | DNSE credential có sẵn, rate-limit nặng ⇒ Tier 2, cap 1–2, cấm deep backfill | **Owner chốt** |
| D-07 | Benchmark VPS ≥100 mã, thêm DNSE ramp | **CHƯA CHẠY** |

## Không làm trong slice này

Không đổi code, không thêm secret, không đổi migration/flag; chỉ cập nhật hồ sơ thiết kế.
