# Evidence điều tra VCI 400 + fix stale-row realtime

Ngày: 2026-09-23. Yêu cầu: việc #3 (VCI 400).

## Kết luận VCI 400: TRANSIENT phía upstream, không phải regression

- 14:58 + 17:5x: `VCI history` 400 Bad Request (cả ngày quá khứ lẫn hôm nay).
- 19:31+: cùng calls trả 200 (4 rows 21-22, 3 rows today).
- Bằng chứng không phải code: URL + endpoint trùng hệt v1.1.0
  (`https://trading.vietcap.com.vn/api/chart/OHLCChart/gap-chart`,
  `explorer/vci/const.py:_TRADING_URL` giống nhau); KBS cùng máy vẫn tốt.
- Adapter single-source (VCI default) nên lúc upstream lỗi → realtime None (pre-existing,
  cả 2 version). Không đổi code cho 400.

## Phát hiện thêm (fix luôn): realtime VCI trả bar CŨ

- VCI frame **ascending** theo `time`, code `frame.iloc[0]` lấy bar cũ nhất
  (VCI SSI ra 21/09 close 20900 thay vì hôm nay 20850); KBS descending nên đúng tình cờ.
- Không lib nào sort (cả 2 version) → thứ tự phụ thuộc upstream → quirk pre-existing.
- Fix `vnbroker_adapter.py`: `_pick_latest_bar()` chọn max `time`, fallback `iloc[0]`.
- Live sau fix: VCI SSI → close 20850.0 vol 15632800 (bar 23/09) ✓
- Tests `test_vnbroker_realtime_latest.py` 5/5 (ascending/descending/no-col/unparsable/datetime).

## gates

- `Ran 23 tests OK`: latest 5 + adapter-history/guard 18. `manage.py check` 0 (chạy ở lượt này).
