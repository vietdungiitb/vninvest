# Upgrade Plan - Whale Bubble Chart (Implementation Ready)

Tai lieu nay duoc chot lai theo huong coding-ready de doi code co the implement ngay cho tab Ca map.

## 1) Scope va Muc tieu

- Muc tieu chinh: bien Whale Bubble Chart thanh dashboard phan tich dong tien trong phien, uu tien doc nhanh theo gia tri giao dich.
- Muc tieu UI/UX:
    - Truc Y mac dinh theo `matched_value` (VND).
    - Co MA line de nhin xu huong dong tien.
    - Co zoom de soi khoang thoi gian nong.
    - Tooltip chi tiet va canh bao lenh cuc lon.
- Muc tieu du lieu:
    - Gia tham chieu co fallback ro rang, giam toi da truong hop null.
    - Payload co metadata du de frontend render degraded mode va summary.

## 2) API Contract (Chot de code)

Endpoint:
- `GET /api/whale/orders/{symbol}/?timeframe=5m|15m|30m|1h|session&start=&end=`

Response bat buoc:
- `ok`, `symbol`, `ref_price`, `session_start`, `session_end`, `timeframe`
- `degraded_mode`, `degraded_mode_reason`, `event_count`
- `orders.buy[]`, `orders.sell[]`, `orders.internal[]`
- `summary.total_orders`, `summary.buy_orders`, `summary.sell_orders`, `summary.internal_orders`
- `summary.avg_matched_value`, `summary.avg_volume`

Response nen co them (de hoan tat full plan):
- `summary.extreme_threshold_value`: nguong lenh cuc lon sau khi tinh.
- `summary.extreme_order_count`: tong so lenh cuc lon.
- `summary.yesterday_total_value` (optional): tong gia tri hom truoc (neu co du lieu).

Quy tac fallback gia tham chieu (thu tu uu tien):
1. `TickerSessionClose.prev_close_price` voi `session_date <= trade_date` (ban ghi moi nhat).
2. `TickerSessionClose.close_price` voi cung rule.
3. `DailyPrice.close_price` voi `date <= trade_date` (ban ghi moi nhat).
4. Neu van khong co thi `ref_price = null`, bat `degraded_mode=true`.

## 3) Dinh nghia "Extreme Order" (Chot logic)

- Cong thuc de xep lenh cuc lon:
    - `matched_value >= max(whale_threshold_vnd, avg_matched_value * 10)`
- Dieu kien an toan de tranh false-positive:
    - Neu `total_orders < 10` thi khong dung he so 10x, chi dung `whale_threshold_vnd`.
- Truong output:
    - Moi order them `is_extreme: true|false`.

## 4) Frontend Implementation Tasks

Tap tin chinh:
- `frontend/src/hooks/useOrderBubbleCoordinates.js`
- `frontend/src/components/WhaleBubbleChart.jsx`

Chi tiet can lam:
1. Bubble coordinates
- X-axis: phut tu dau phien.
- Y-axis mode:
    - `value`: dung `matched_value`.
    - `volume`: dung `volume`.
- Van giu metadata gia/chenh lech trong tooltip.

2. MA line
- Chot ten MA theo dung window su dung (vd MA10 hoac MA20), khong de mismatch ten/hang so.
- MA tinh tren cung truong Y voi mode dang chon.

3. Tooltip
- Bat buoc hien: loai lenh, thoi gian, gia, khoi luong, gia tri, bien dong, nhan "Lenh cuc lon" neu `is_extreme=true`.

4. Summary + Ratio bar
- Guard chia cho 0 cho tat ca ty le (`total_orders == 0` -> 0%).

5. CSV export
- Header chot: `Timestamp,Side,Price,Volume,Value,IsExtreme`.
- Timestamp dang ISO, locale doc trong Excel.

6. Degraded mode
- Neu `degraded_mode=true`, hien banner canh bao ro ly do.

## 5) Test Matrix (Bat buoc truoc merge)

Backend tests:
- Fallback ref price: co du lieu TickerSessionClose, fallback DailyPrice, va truong hop null.
- Extreme order classification dung theo quy tac da chot.
- Response schema day du cac field bat buoc.

Frontend tests:
- Render chart voi data co/khong co ref_price.
- Zoom slider va inside zoom hoat dong.
- Tooltip hien dung side + formatted fields.
- Summary ratio khong NaN/Infinity khi `total_orders = 0`.
- CSV export dung header va so dong.

Manual UAT:
- Kiem tra tab Ca map tren 3 ma co thanh khoan cao + 1 ma thanh khoan thap.
- Kiem tra timeframe: 5m, 15m, 30m, 1h, session.
- Kiem tra hieu nang: chart render < 1.5s voi 1000 points.

## 6) Rollout va Risk Control

- Feature flag: `WHALE_BUBBLE_UPGRADE_ENABLED=True`.
- Rollout 2 buoc:
    1. Bat cho internal/pro users.
    2. Bat toan bo sau 24h neu khong co regression.
- Rollback:
    - Tat feature flag de quay ve rendering cu.

## 7) Definition of Done

- API contract dung theo muc 2.
- Frontend dung theo muc 4.
- Test matrix muc 5 pass.
- Khong co loi runtime console/backend logs critical.
- Tai lieu deploy/usage cap nhat neu co thay doi contract.

## 8) File Impact Checklist

- `backend/portfolio/views_whale_orders.py`
- `backend/portfolio/tests/test_whale_orders_ssot_parity.py`
- `frontend/src/hooks/useOrderBubbleCoordinates.js`
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/pages/WhaleAlertsHub.jsx` (neu can dong bo container/tab)

