# Phase 0 — Pre-flight SSOT (2026-11-27) — STOP

**Branch** `feat/ssot-phase0`, claim `ssot-phase0`. B3 audit vòng 1 NEED_REVISION (3 objection) → v2 **PASS**. B1–B4 hoàn tất; B6 chạy probe thật thì **STOP condition kích hoạt**.

## 1. Probe coverage (lệnh tái hiện)

```python
active = StockProfile.objects.filter(status='active').values_list('symbol', flat=True)
with2026 = DailyPrice.objects.filter(date__gte='2026-01-01').values_list('symbol', flat=True).distinct()
denominator = active ∩ with2026
covered = {s in denominator | DailyPrice(s, 2026, price_source in
           ('vnbroker_legacy','cafef','vnbroker_fallback'))}
```

Kết quả trên staging `docker exec vninvest-core-api python -`:

```
ACTIVE 1400  WITH2026 1835  DENOM 1351  COVERED 1005  RATIO 0.7439
STOP True
```

⇒ **74,39% < 95%** — STOP đúng kế hoạch `PLAN_PHASE0_20261127.md:16`.

## 2. Giải thích số (không tự sửa định nghĩa)

- Trong 1835 mã có dòng 2026, 963 mã có 2026 toàn `price_source='unmapped_cafef'` (số liệu `CHART_GAP_ANALYSIS_20261127.md:16`). Các dòng này vẫn là giá provider-adjusted legacy nhưng **không nằm trong tập `covered`**.
- **Diễn giải/đặc tả lại** (B8 objection không chặn): plan viết `covered` theo `price_source` không giới hạn năm; evidence chạy thêm điều kiện `2026` để khớp `denominator` (cùng cửa sổ). Đây là **thu hẹp conservative** — không làm tỉ lệ tăng để qua STOP, và không đổi định nghĩa ngưỡng 95%.
- Có thể tỉ lệ "thực" cao hơn nếu tính `unmapped_cafef` là đã phủ — **nhưng đó là đổi định nghĩa STOP**, phải đi vòng plan + audit mới. Tôi **không** tự làm.

## 3. Các hạng mục khác

| Hạng mục | Kết quả |
|---|---|
| Benchmark ≥100 mã × 1 năm, 2 khung giờ ICT | **CHƯA CHẠY** — dừng do STOP ở AC1 |
| Probe rights trong `CorporateAction` | **CHƯA CÓ** cột `rights_ratio_pct`/`rights_issue_price` (`models.py:148-199`) — đúng plan, thêm ở Phase 2 |
| `safe_rps_dnse` | **CHƯA CHẠY** — Owner waiver "dnse để sau" (`SSOT_DECISIONS_REV2_20261127.md`) |
| Ghi dữ liệu / đổi flag / migration | **Không** — Phase 0 read-only |

## 4. Kết luận & next step

Phase 0 **KHÔNG ĐẠT** exit gate. Theo `workflow-dev-loop` STOP condition: dừng slice, báo partial state + blocker, không chuyển Phase 1/2 code dữ liệu.

Cần Owner chốt một trong hai trước khi mở plan v3 (có audit lại):
1. Giữ định nghĩa `covered` hiện tại ⇒ phải xử lý 963 mã `unmapped_cafef` (relabel sang basis mới) rồi đo lại; hoặc
2. Sửa định nghĩa `covered` để tính `unmapped_cafef` là dữ liệu provider-adjusted đã có, kèm rationale + audit — **không phải tôi tự đổi trong slice này**.

## 5. Gates

`pre-push-gate` chạy lại trước commit; không có code runtime thay đổi.
