# Probe Q-B2 — `Company.events()` có ex-date/ratio không? (2026-11-13, VPS staging, read-only)

> **Claim:** `closeout-dot1-20261113` · **Kết luận:** KHONG có ex-date/ratio → B-3 đi nhánh B.

## Lệnh (tái hiện)

```bash
# local: scp probe lên VPS rồi exec trong container API (DB/code của staging, không ghi gì)
scp tmp-qb2probe.py root@14.225.255.47:/tmp/qb2probe.py
ssh root@14.225.255.47 "docker cp /tmp/qb2probe.py vninvest-core-api:/tmp/qb2probe.py && docker exec -i vninvest-core-api sh -c 'cd /app/src && python manage.py shell < /tmp/qb2probe.py'"
```

Probe gọi `market_data.vnbroker_adapter.fetch_company_info('VNM'/'VCB')` (`vnbroker_adapter.py:1138`, `company.events()` ở `:1188`).

## Kết quả (chạy thật)

| Symbol | overview_keys | officers | shareholders | events |
|---|---|---|---|---|
| VNM | 30 | 16 | 3 | **0** |
| VCB | 30 | 22 | 3 | **0** |

Probe sâu (`Company(symbol='VNM').events()` trực tiếp): type `pandas.DataFrame`, `empty=True`, `shape=(0, 0)`, **không exception**.

## Kết luận

- vnbroker **tới được** (overview/officers/shareholders đầy đủ) → events rỗng là **thật**, không phải lỗi mạng.
- `Company.events()` trả DataFrame rỗng → **KHÔNG có ex-date/ratio/loại sự kiện** từ nguồn này.
- ⇒ **B-3 (S3.1) đi nhánh B**: bars trả `adjusted: false` + `note` ("backend chưa điều chỉnh"), **không** bịa `adj_close`. Không cần probe thêm.
- File tạm trên VPS (`/tmp/qb2probe.py`, `/tmp/qb2.json`) không chứa secret (market data public); container không bị đổi (chỉ `docker exec` đọc).
