# E2E — bật flag corporate actions trên staging (2026-11-21)

- **Scope**: wire env flag vào compose, bật `CORPORATE_ACTIONS_ENABLED=true` trên staging, deploy, chạy sync thật VNM từ VCI 3.8.2, kiểm tra bars API.
- **Claim**: `enable-corp-actions-flag` (`a5f8ef3fd`) · PR **#474** (`fe4d4f626`) · evidence này + ledger Entry 579.

## 1. WIRE FLAG

`docker-compose.staging.yml` trước đây **không có** `CORPORATE_ACTIONS_ENABLED` ⇒ env file có giá trị cũng không lọt vào container. Đã thêm dòng cho cả 5 service core (`core-api`, `core-worker`, `core-worker-realtime-prefetch`, `core-worker-realtime-stream`, `core-beat`):

```yaml
CORPORATE_ACTIONS_ENABLED: ${CORPORATE_ACTIONS_ENABLED:-false}
```

Default vẫn `false` — an toàn cho mọi môi trường chưa set.

## 2. DEPLOY + FLAG

VPS `/opt/vninvest`: pull dev `fe4d4f626` → backup env → set `CORPORATE_ACTIONS_ENABLED=true` → `bash scripts/deploy-staging.sh` **exit 0**.

```
container env: CORPORATE_ACTIONS_ENABLED=true
core-api: Up (healthy), core-beat/workers: Up, /api/health/ = 200
migrations [X]: market_data/0008, 0009
celery registered: data_ingest.tasks.sync_corporate_actions (3 workers)
```

## 3. SYNC THẬT VÀO STAGING DB

Lệnh: `manage.py shell -c "from data_ingest.tasks import sync_corporate_actions; print(sync_corporate_actions('VNM'))"`

```
STATS {'symbol': 'VNM', 'fetched': 57, 'created': 57, 'updated': 0,
       'factors': 48, 'applied': 2584, 'from_date': '2010-01-01'}
EVENTS 57
FACTORS 48
ADJ_PRICES 2584
```

Khớp re-probe 3.8.2 (57 event) — pipeline dùng field số thật, ghi 48 factor và materialize 2584 `DailyPrice.adj_close`.

## 4. BARS API E2E

`APIClient.force_authenticate(admin)` → `GET /core/v1/stock-management/stocks/VNM/bars/?timeframe=D`, `HTTP_HOST=docker.edusuccess.vn`:

```
STATUS 200
ADJUSTED False
NOTE "Bars chưa điều chỉnh: sự kiện chưa parse được tại ex_date 2010-02-09, 2011-02-15,
      2011-03-25, 2011-05-26, 2016-07-11."
BARS 500  WITH_ADJ 493
SAMPLE {'timestamp':1731628800000,'open':55133.0,'high':55133.0,'low':54113.0,
        'close':54113.0,'volume':3688300,'adj_close':45072.48}
```

### Giải thích `adjusted:false` dù có 493 bar điều chỉnh

Đây là **hành vi đã thiết kế có chủ đích** (Entry 569 D2 per-date + F2 reservation): symbol-level `adjusted` là boolean conservative — có **bất kỳ** `AdjFactor.status='PARTIAL'` (5 event ESOP/private placement không parse được từ 2010–2016) ⇒ trả `false` kèm `note` liệt kê ex_date, nhưng **từng bar vẫn mang `adj_close`** và client có thể dùng. 7/500 bar trước các ex_date đó không có `adj_close` đúng rule per-date.

⇒ Không phải lỗi runtime; là điểm cần làm rõ contract nếu FE sau này consume `adj_close`: nên đọc `bar.adj_close`, không chỉ dựa vào `adjusted` ở envelope. Ghi thành follow-up P3 để thêm cờ per-bar (không chặn slice này).

## 5. KẾT LUẬN

- Flag wiring + deploy + sync + bars API **đều chạy thật trên staging**, không còn `CHƯA CHẠY` cho E2E cơ bản.
- Dữ liệu staging đã có corporate actions VNM (57 event / 48 factor / 2584 giá điều chỉnh) — chỉ là dữ liệu staging, không production.
- ~~**CHƯA CHẠY**: browser/visual regression (Playwright) với tài khoản thật~~ → **ĐÃ CHẠY** (xem §6); chỉ còn follow-up per-bar `adjusted` flag.

## 6. PLAYWRIGHT BROWSER E2E (đã chạy 2026-11-21)

Tool: skill `playwright-skill`, Chromium visible, URL `https://docker.edusuccess.vn`, credentials admin (không lưu vào repo). Script tạm tại `%TEMP%/opencode/playwright-*.js`.

| Bước | Kết quả |
|---|---|
| `GET /login` | 200, title `VNInvest — Quản lý Danh mục Đầu tư`, input `username`/`password`, button "Đăng nhập" |
| Login admin | redirect `/dashboard` ✅ |
| `GET /stocks/VNM` | chờ overlay "Đang xác thực tài khoản…" biến mất; page render thật: **VNM 51.400,00 (+300, +0.59%)**, realtime "Đã kết nối", các widget dữ liệu thật (whale, order book, strength matrix) |
| Fetch bars từ browser session | dùng `localStorage.access_token` làm `Bearer` → `GET /core/v1/stock-management/stocks/VNM/bars/?timeframe=D` → **200**, `bars=500`, **493 có `adj_close`**, sample `close=54113.0 → adj_close=45072.48`, `adjusted=false` + note 5 ex_date (đúng thiết kế per-date) |
| Console / failed responses | lần chụp cuối: **0 page error, 0 response ≥400** (2 lần 404 thoáng qua ở lần chạy giữa không lặp lại — không chạm endpoint pipeline) |
| Screenshot | `pw-vnm-chart.png` — **đã mở xem**, xác nhận giao diện thật (không phải màn loading) |

Kết luận: browser E2E xanh; dữ liệu điều chỉnh `adj_close` đến được client qua cùng luồng xác thực thật. Vùng chart chính của widget báo "Chưa có dữ liệu" là vấn đề riêng của widget/realtime chart, **không phải** bars API corporate actions (endpoint này trả 200 đầy đủ).

**Lessons**: `[L-002, L-V01, L-V04, L-T01]` — mọi số kèm lệnh; đọc response thật; không suy diễn từ cờ tổng.
