# Kế hoạch — Unblock Phase 0 bằng Anchor A cho 963 mã (Rev.2, 2026-11-28)

**Lessons áp dụng:** [L-V01, L-V02, L-V03, L-007, L-T01].

## 1. Số liệu có lệnh tái hiện (objection 1)
```
u = {symbol | DailyPrice(date__gte='2026-01-01', price_source='unmapped_cafef')}
count(2026 unmapped) = 140.182
|u| = 963 ; overlap cafef = 915 ; clean = 48
DailyPrice(symbol in u) = 2.652.748 dòng (cafef 885.728 / unmapped 1.473.620 / legacy 293.400)
```
Lệnh: `docker exec ... python -` với ORM query như đã chạy sau audit v1 (ghi trong evidence).

## 2. Quyết định Anchor A (objection 2)
Không relabel riêng 2026. Chuyển **toàn chuỗi** của 963 mã về **một basis duy nhất** `vnbroker_fallback`:
- `adj_close = close` (giá provider-adjusted legacy đã có sẵn), `adj_factor = 1`, `is_adjusted = True`,
- `price_source = 'vnbroker_fallback'`, `adj_as_of = now()`, `adj_version = F('adj_version') + 1`.
- Bản gốc CafeF vẫn ở `CafefDailyPrice` (bảng đối chiếu) — đúng D-08.

## 3. AC
- **AC1**: Given 2.652.748 dòng thuộc 963 mã / When `--apply` / Then 100% được gán basis fallback như §2; `close`/OHLC/volume **không đổi**.
- **AC2**: Given bất kỳ dòng `adj_close IS NOT NULL` trước apply / When quét / Then `halt` (skip_count>0 ⇒ exit≠0, 0 UPDATE). Hiện probe = 0 dòng.
- **AC3**: Given backup table `market_data_anchorA_backup_20261128` / When `--apply` / Then từ chối nếu bảng chưa tồn tại hoặc `COUNT(*) != 2.652.748`. Backup lưu **`id` + 6 cột** (`price_source`, `adj_close`, `adj_factor`, `is_adjusted`, `adj_as_of`, `adj_version`) snapshot TRƯỚC apply.
- **AC4**: Sau apply, `DailyPrice` 2026 `unmapped_cafef = 0`; đo lại coverage theo Phase 0 ≥0.95; `check_price_integrity` 0 violation.
- **AC5**: `--rollback-sql` in lệnh khôi phục 6 cột từ backup theo `id`; test trên DB riêng.
- **AC6**: Cập nhật `cafef/integrity.py` để `vnbroker_fallback` vào `foreign_adjusted` (để guard vẫn thấy basis lạ nếu trộn). Không đổi migration.
- **AC7**: Ghi rõ flag staging `PRICE_ADJUSTED_DISPLAY=0`; **FE hiển thị nhãn là non-goal** (Phase 4), slice này chỉ đảm bảo dữ liệu + coverage.

## 4. SCOPE / rollback
- Code: 1 management command (`anchor_a_relabel`) + pure helper + test + `integrity.py`. Bảng backup là **ops artifact DDL**, không phải Django migration.
- Không đổi flag, không đổi `CafefDailyPrice`, không đụng file deny-list.
- LIMIT 3 vòng; STOP nếu backup fail, skip>0, hoặc coverage sau apply <0.95.
- Rollback: `UPDATE DailyPrice d SET ... FROM backup b WHERE d.id=b.id`.

## 5. Audit trail
`AUDIT_PLAN_REMEDIATE_20261128.md` vòng 1 NEED_REVISION (5 objection) → Rev.2 này → re-audit vòng 2 (vòng cuối).
