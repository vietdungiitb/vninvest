# RE-PROBE — vnbroker 3.8.1 sau bump pin (2026-11-20)

- **Scope**: Slice 4 Entry 573 — verify PyPI release, bump `vnbroker==3.7.2 → 3.8.1`, re-probe VNM/FPT/VCB.
- **Nguồn sự thật**:
  - PyPI JSON `https://pypi.org/pypi/vnbroker/3.8.1/json` → `version=3.8.1`, `upload_time_iso_8601=2026-11-20T13:17:40.951813Z`, wheel + sdist, release_url đúng.
  - Package cài trong **venv tạm** `/tmp/vnb381venv` của container staging `vninvest-core-api` — `importlib.metadata.version('vnbroker') = 3.8.1`. **Không** pip install vào `/app`, không Docker local, không đụng DB `vninvest_core`.
- **Citation package**: `vnbroker@main:6020aac:path:line` (clone local cùng nội dung bản PyPI 3.8.1 theo release notes).

## TÓM TẮT

1. ✅ Pin đã bump: `packages/core/backend/requirements.txt:38` → `vnbroker==3.8.1`.
2. ✅ Có cấu trúc thật: `VCI.corporate_actions()` trả đúng 14 cột contract (`symbol, action_type, ex_date, record_date, payment_date, cash_amount, stock_ratio_pct, currency, source, source_event_id, raw_title, parse_status, group_id, fetched_at`); facade `Company.corporate_actions()` chạy được, `source='VCI'`.
3. 🔴 **P0 MỚI PHÍA VNBROKER — `ex_date = None` cho 100% dòng**. Raw key VCI là **`exrightDate`** (probe), nhưng `vnbroker/common/corporate_actions.py:155` gọi `_pick(row, "exright_date", "exRightDate", "ex_date")` — **thiếu `"exrightDate"`**. Hệ quả mọi `group_id = f"{symbol}:{ex_date}"` thành `"VNM:None"`, 1057 dòng cùng "ngày" ⇒ dedup/group vô nghĩa. **Không thể chuyển ingest sang API có cấu trúc cho tới khi họ sửa.**
4. ⚠️ `corporate_actions()` trả cả **1000 dòng tin tức** (`isEvent=False`, không có `eventCode`/`exrightDate`) lẫn vào 57 sự kiện thật ⇒ `action_type=''`, `parse_status='unparsed'`. Consumer phải lọc `is_event`/`event_code` như pipeline hiện tại đang làm với `events()`.
5. ✅ Pipeline vninvest **không ảnh hưởng**: vẫn gọi legacy `VCI.events()` + parser riêng, tự lọc theo `exright_date`/`event_code`. Bump pin không breaking (release notes xác nhận), 66/66 test của pipeline ở HEAD trước bump vẫn xanh; re-run sau bump nằm trong gate CI/deploy (xem §Gates).

## LỆNH TÁI TẠO

```bash
# 1. verify PyPI
curl -s https://pypi.org/pypi/vnbroker/3.8.1/json  # hoặc webfetch URL đó

# 2. cài venv tạm trong container staging
ssh root@14.225.255.47 "docker exec vninvest-core-api sh -c \
  'python -m venv /tmp/vnb381venv && /tmp/vnb381venv/bin/pip install -q vnbroker==3.8.1'"

# 3. probe (file local C:\Users\Pham Viet Dung\AppData\Local\Temp\opencode\probe381.sh)
(Get-Content probe381.sh -Raw) -replace "`r","" | ssh ... "bash -s"
```

## KẾT QUẢ PROBE THẬT

```
INSTALLED 3.8.1
VERSION 3.8.1
COLUMNS ['symbol','action_type','ex_date','record_date','payment_date','cash_amount',
         'stock_ratio_pct','currency','source','source_event_id','raw_title',
         'parse_status','group_id','fetched_at']

SYM VNM rows 1057 cols_ok True
STATUS {'unparsed': 1005, 'parsed_from_text': 52}
SAME_EXDATE 1057   <- toàn bộ ex_date=None (bug)
LEGACY_EVENTS 1057
SYM FPT rows 1079 cols_ok True
STATUS {'unparsed': 1031, 'parsed_from_text': 48}
LEGACY_EVENTS 1079
SYM VCB rows 1023 cols_ok True
STATUS {'unparsed': 1004, 'parsed_from_text': 19}
LEGACY_EVENTS 1023
FACADE 234 source VCI
```

Raw VCI (cùng venv, `_fetch_news_events('20100101', None, 'DIV,ISS')`):

```
RAW_ROWS 1057
ALLKEYS ['displayDate','event','eventCode','eventNameEn','eventNameVi','eventTitleEn',
         'eventTitleVi','exrightDate','id','isEvent','newsShortContent','newsTitle','publicDate']
EVENT_ROWS 57
EVENT_SAMPLE {..., 'eventCode': 'ISS', 'eventTitleVi': '... CBCNV',
              'exrightDate': '2010-02-09T00:00:00', 'isEvent': True}
```

## ĐỐI CHIẾU SOURCE LỖI

| file:line | Nội dung | Kết luận |
|---|---|---|
| `vnbroker@main:6020aac:vnbroker/common/corporate_actions.py:155` | `_pick(row, "exright_date", "exRightDate", "ex_date")` | ⚠️ Thiếu key **`exrightDate`** (key thật từ API) ⇒ `ex_date=None` |
| `vnbroker@main:6020aac:vnbroker/common/corporate_actions.py:183` | `group_id = f"{symbol}:{ex_date}"` | `VNM:None` cho mọi dòng — R3 vô nghĩa |
| `vnbroker@main:6020aac:vnbroker/explorer/vci/company.py:333-336` | `normalize_events(data, self.symbol)` nhận **raw dict**, không qua snake_case như `events()` | Giải thích tại sao key camel `exrightDate` lọt qua |
| `vnbroker@main:6020aac:vnbroker/explorer/vci/company.py:310-315` | `events()` snake_case sang `exright_date` | Đây là lý do pipeline cũ vẫn chạy đúng |

## ĐỀ XUẤT GỬI VNBROKER (ticket mới, P0 package)

1. Sửa `_pick` tại `common/corporate_actions.py:155` thành `_pick(row, "exrightDate", "exright_date", "exRightDate", "ex_date")` (hoặc normalize camel→snake trước khi `_pick`).
2. Lọc `isEvent=True` / có `eventCode` trong `normalize_events` — không trả 1000 dòng tin tức vào contract corporate action.
3. Thêm test golden: `VCI('VNM').corporate_actions(from_date='20100101')` phải có **57 dòng có `ex_date`**, 2 dòng cùng `2024-09-24` (950 + 1.500) giữ riêng, `group_id='VNM:2024-09-24'`.
4. Release 3.8.2 → vninvest bump pin lại + re-probe; **chỉ sau đó** mới chuyển `ingest.fetch_corporate_actions` sang API có cấu trúc (mapping tại `docs/evidence/corporate-actions/FIELD_MAPPING_VNBROKER.md`).

## GATES

| Gate | Kết quả |
|---|---|
| PyPI 3.8.1 tồn tại, artifact + upload time | ✅ verify trực tiếp JSON |
| Cài venv tạm + probe 3 mã | ✅ chạy thật, output ở trên |
| Pipeline tests 66/66 | ✅ chạy tại HEAD `b8514bf2` (trước bump, Entry 574); pin bump là thay đổi dependency declaration, không đổi code — re-run trong deploy gate |
| `check-multi-agent` | ✅ exit 0 trước sửa |
| Full BE/FE/deploy sau bump | **CHƯA CHẠY** — để CI/deploy staging |

**Kết luận**: Slice 4 (bump pin) hoàn tất. Re-probe phát hiện **lỗi P0 mới phía package** (`ex_date=None`); pipeline vninvest vẫn an toàn vì dùng legacy `events()`. Không bật flag, không chuyển ingest sang `corporate_actions()` cho tới khi package sửa + release 3.8.2.
