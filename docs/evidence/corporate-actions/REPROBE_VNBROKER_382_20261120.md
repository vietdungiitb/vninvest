# RE-PROBE — vnbroker 3.8.2 sau fix P0 `ex_date=None` (2026-11-20)

- **Scope**: Slice 4 vòng 2 — bump `3.8.1 → 3.8.2`, verify fix P0 đã báo ở `REPROBE_VNBROKER_381_20261120.md`.
- **Nguồn sự thật**:
  - PyPI JSON `https://pypi.org/pypi/vnbroker/3.8.2/json` → `version=3.8.2`, `upload=2026-11-20T15:03:56Z`, wheel `628137` bytes, sdist `521899`, `yanked=false`, sha256 wheel `899946f9…2ab`.
  - GitHub Release + tag `v3.8.2`, workflow `44758095521` success (theo owner; repo public, billing đã khôi phục).
  - Source fix tại `vnbroker@main:e996cb4:vnbroker/common/corporate_actions.py:128` (`_is_event_row`), `:168` (lọc event), `:171-172` (`_pick("exrightDate", …)`).
- **Môi trường probe**: venv tạm `/tmp/vnb382venv` trong container staging `vninvest-core-api`, cài với `--index-url https://pypi.org/simple` (mirror mặc định trên máy còn stale 3.8.1). **Không** đụng `/app`, không Docker local, không DB dùng chung.

## TÓM TẮT — ĐẠT TOÀN BỘ KỲ VỌNG

| Symbol | rows | `ex_date` non-null | null | parsed_from_text | unparsed |
|---|---:|---:|---:|---:|---:|
| VNM | 57 | **57** | **0** | 52 | 5 |
| FPT | 79 | **79** | **0** | 48 | 31 |
| VCB | 23 | **23** | **0** | 19 | 4 |

- ✅ Contract 14 cột đúng (`COLUMNS_OK True`).
- ✅ `group_id` đúng dạng `SYMBOL:YYYY-MM-DD` (vd `VNM:2010-02-25`).
- ✅ ESOP bị giữ `unparsed`: VNM 4/4, FPT 28/28 (`all_unparsed True`) — rule C-02 được package tôn trọng.
- ✅ Facade `Company(source='VCI', symbol='VNM').corporate_actions()` ⇒ 57 dòng, `source='VCI'`, 57 `ex_date`.
- ✅ **Golden VNM `2024-09-24`**: 2 dòng riêng, ID `…fdfbb` = 950 VND + `…fdfbc` = 1.500 VND, cùng `group_id='VNM:2024-09-24'`, cùng `parse_status='parsed_from_text'` ⇒ R3 (không gộp mất gốc) đúng.
- ✅ Bug 3.8.1 (`ex_date=None` 100% + 1000 dòng tin tức) **đã đóng** ở 3.8.2.

## LỆNH TÁI TẠO

```bash
# pip mirror stale → dùng PyPI trực tiếp
docker exec vninvest-core-api sh -c 'python -m venv /tmp/vnb382venv && \
  /tmp/vnb382venv/bin/pip install -q --index-url https://pypi.org/simple vnbroker==3.8.2'
# probe: C:\Users\Pham Viet Dung\AppData\Local\Temp\opencode\probe382.sh
(Get-Content probe382.sh -Raw) -replace "`r","" | ssh ... "bash -s"
# golden: probe382-golden.sh (lọc ex_date == '2024-09-24')
```

## OUTPUT THẬT (trích)

```
INSTALLED 3.8.2
VERSION 3.8.2
COLUMNS_OK True
SYM VNM rows 57 ex_date_nonnull 57 null_ex_date 0
STATUS {'parsed_from_text': 52, 'unparsed': 5}
ESOP_ROWS 4 all_unparsed True
SYM FPT rows 79 ex_date_nonnull 79 null_ex_date 0
ESOP_ROWS 28 all_unparsed True
SYM VCB rows 23 ex_date_nonnull 23 null_ex_date 0
FACADE 57 source VCI ex_date_nonnull 57

GOLDEN_ROWS 2
[{'ex_date':'2024-09-24','action_type':'DIV','cash_amount':Decimal('950'),
  'source_event_id':'6708f3eb0ec61045ab7fdfbb','parse_status':'parsed_from_text','group_id':'VNM:2024-09-24'},
 {'ex_date':'2024-09-24','action_type':'DIV','cash_amount':Decimal('1500'),
  'source_event_id':'6708f3eb0ec61045ab7fdfbc','parse_status':'parsed_from_text','group_id':'VNM:2024-09-24'}]
```

## HẬU QUẢ VỚI PIPELINE VNINVEST

- Pin `requirements.txt:38` → `vnbroker==3.8.2`.
- Pipeline hiện tại **vẫn dùng legacy `events()` + parser riêng** — không thay đổi bởi bump (release notes xác nhận không breaking). 66/66 test ở Entry 574 vẫn là baseline.
- Điều kiện kỹ thuật để **chuyển ingest sang field số đã đạt**: hợp đồng 14 cột, `ex_date` sạch, ESOP unparsed, golden 2 DIV, mapping tại `FIELD_MAPPING_VNBROKER.md`.
- **Vẫn giữ `CORPORATE_ACTIONS_ENABLED=False`** cho tới khi: (a) full BE/FE + deploy staging xanh, và (b) owner đối chiếu Q1/Q2 (số tiền 950+1.500 thật) — Entry 573 §F.1. Chuyển ingest là slice riêng, có test song song parser-cũ vs field-mới trước khi bỏ parser.

## CẬP NHẬT TÀI LIỆU LIÊN QUAN

- `REPROBE_VNBROKER_381_20261120.md` — lỗi P0 ở đó đã được fix ở 3.8.2; giữ làm bằng chứng phát hiện.
- `FIELD_MAPPING_VNBROKER.md` — bỏ cảnh báo "chưa dùng được", thay bằng trạng thái "đã verify 3.8.2, sẵn sàng map".

**Gates**: PyPI verify ✅ · probe 3 mã + golden ✅ · `check-multi-agent` exit 0. **CHƯA CHẠY**: full BE/FE suite + deploy staging sau bump (CI/deploy gate), chuyển ingest sang field số (slice riêng).
