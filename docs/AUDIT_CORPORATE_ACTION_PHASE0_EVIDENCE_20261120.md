# AUDIT — Corporate Actions Pipeline, bằng chứng Phase 0 (2026-11-20)

- **Scope**: re-verify B1 của `docs/PLAN_CORPORATE_ACTIONS_PIPELINE_20261120.md`, probe read-only các quyết định D3/D4/D6, chốt D1/D2/D5/D7.
- **Môi trường**: repo `dev@3845063a5` (branch làm việc `docs/corp-action-phase0-evidence`); package `vnbroker==3.7.2` trong container staging `vninvest-core-api` trên VPS `14.225.255.47` (`/usr/local/lib/python3.13/site-packages/vnbroker`).
- **Nguyên tắc**: mọi số kèm lệnh tái tạo; citation dạng `branch@sha:path:line` hoặc `vnbroker-3.7.2@container:path:line`; read-only, không đụng code/DB staging.

## TÓM TẮT 5 ĐIỂM QUAN TRỌNG NHẤT

1. **B1 của plan SAI ở phần router**: repo `dev` **có** `docs/CLAIMS.md`, `docs/AGENT_PROTOCOL.md`, `packages/web/scripts/check-multi-agent.mjs`, `.opencode/skills/workflow-dev-loop/SKILL.md`, `docs/LESSONS/`. Plan kết luận "Generic profile" vì chạy `node scripts/check-multi-agent.mjs` (sai đường dẫn) và `git ls-tree origin/main` (main không có tooling). Gate đúng `node packages/web/scripts/check-multi-agent.mjs` chạy thật: **exit 0** ⇒ dùng **VNSAAS profile**.
2. **D3 (DNSE) ĐÓNG**: `get_corporate_action_history` **có thật** trong `vnbroker-3.7.2@container:connector/dnse/client.py:612` và `connector/dnse/services/account_service.py:56`, nhưng là API **theo tài khoản** — chữ ký `(account_no, market_type, from_date, to_date, dry_run)`; class `DNSEClient` bắt buộc `api_key` + `api_secret`. Không phải feed thị trường công khai ⇒ không giải quyết được R1. `explorer/dnse/company.py:257-265 events()` vẫn trả rỗng. Critique C3 đúng về "chưa probe", sai về kỳ vọng "có thể thay regex".
3. **D4 (ID) ĐÓNG ở mức thực tế**: VCI `events()` trả cột `id` (hex 24 ký tự). Fetch VNM 2 lần cùng `from_date=20240101` ⇒ **cùng 9 dòng, cùng `id`** (vd `6708f3eb0ec61045ab7fdfbb` = DIV 950 VND, `6708f3eb0ec61045ab7fdfbc` = DIV 1.500 VND, cùng `2024-09-24`). ⇒ dùng `id` làm `source_event_id`; ổn định ngắn hạn đã chứng minh, dài hạn vẫn là câu hỏi gửi vnbroker.
4. **D6 (event codes) ĐÓNG**: VCI mặc định `DIV,ISS` (`vnbroker-3.7.2@container:explorer/vci/company.py:111-112`). Probe `event_codes='DIV,ISS,SPLIT,RIGHTS'` và `'SPLIT'`/`'RIGHTS'` riêng lẻ ⇒ chỉ `DIV`/`ISS` có `event_code`+`exright_date`; `SPLIT`/`RIGHTS`/`ALL` trả 1000 dòng tin tức, **không có** `event_code`. Enum contract thu hẹp đúng `DIV,ISS`.
5. **D1 chọn phương án an toàn**: 2 DIV cùng `2024-09-24` có **2 `id` khác nhau** ⇒ không phải trùng bản ghi provider, nhưng **chưa có đối chiếu độc lập** số tiền (TCBS token chưa có, chưa xem disclosure). Chọn `Σ cash` động; **không** hardcode 2.450 / 0.9755 trong test; assert dedup theo `source_event_id`.

## 1. ĐÍNH CHÍNH B1 — ROUTER VNSAAS

| Lệnh thật | Kết quả |
|---|---|
| `git ls-tree -r --name-only origin/dev \| Select-String '^docs/CLAIMS.md$\|^docs/AGENT_PROTOCOL.md$\|^packages/web/scripts/check-multi-agent.mjs$'` | 3 file đều có trên `dev` |
| `git ls-tree -r --name-only origin/main \| ... (tương tự)` | 0 kết quả — tooling chỉ có trên `dev` |
| `Test-Path docs/CLAIMS.md`, `docs/AGENT_PROTOCOL.md`, `packages/web/scripts/check-multi-agent.mjs`, `.opencode/skills/workflow-dev-loop/SKILL.md` | `True` ×4 trên working tree hiện tại |
| `node packages/web/scripts/check-multi-agent.mjs` | `0 lỗi, 0 trùng số migration — PASS`, **exit 0** |
| `node scripts/check-multi-agent.mjs` (lệnh cũ trong plan) | `MODULE_NOT_FOUND`, exit 1 — **sai đường dẫn, không phải thiếu tooling** |

Hệ quả: plan §B1 dòng 21-23 phải sửa; dùng VNSAAS 9 bước; nạp `project-lessons` (bắt buộc) + `multi-agent-workflow` (khi ≥2 agent); khai claim trước khi sửa. Đã làm: claim `corp-action-phase0-evidence` commit riêng `dccfe1ba6`.

## 2. PROBE D3 — DNSE `get_corporate_action_history`

```
$ grep -Rni 'get_corporate_action_history' /usr/local/lib/python3.13/site-packages/vnbroker --include='*.py'
connector/dnse/services/account_service.py:56:    def get_corporate_action_history(
connector/dnse/client.py:612:    def get_corporate_action_history(
connector/dnse/client.py:622:            self._account.get_corporate_action_history(
```
Source (`account_service.py:56-71`):
```python
def get_corporate_action_history(self, account_no: str, market_type: str,
                                 from_date: str | None = None, to_date: str | None = None,
                                 dry_run: bool = False):
    query = {"marketType": market_type}
    ...
    return self._http.request("GET", f"/accounts/{account_no}/corporate-actions", query=query, dry_run=dry_run)
```
`client.py:612-626` bọc qua `_resolve_output(...)`; class `DNSEClient.__init__(api_key, api_secret, base_url=..., ...)`. Dry-run với `api_key` thiếu ⇒ `TypeError: DNSEClient.__init__() missing 2 required positional arguments: 'api_key' and 'api_secret'`.

**Kết luận D3**: method tồn tại nhưng **account-scoped**, cần credential DNSE openapi + số tài khoản. Không thể thay feed công khai VCI. R1 (field số) giữ P0. Ghi rõ vào handoff để không bị hiểu nhầm như critique C3.

## 3. PROBE D4 — VCI `source_event_id`

Lệnh:
```bash
docker exec -i vninvest-core-api python - <<'PY'
from vnbroker.explorer.vci.company import Company as VCI
for i in range(2):
    df = VCI('VNM').events(from_date='20240101', event_codes='DIV,ISS')
    ev = df[df['exright_date'].notna()]
    print('FETCH', i, 'rows', len(ev), 'cols', list(ev.columns))
    print(ev[['id','event_code','exright_date','event_title_vi']].head(6).to_dict('records'))
PY
```
Output thật ( FETCH 0 / FETCH 1 **giống hệt** ):
```
rows 9 · cols ['symbol','id','news_title','news_short_content','is_event','public_date',
               'display_date','event','event_code','event_name_vi','event_name_en',
               'event_title_vi','event_title_en','exright_date']
{'id':'6708f3eb0ec61045ab7fdcd6','event_code':'DIV','exright_date':'2024-03-15','event_title_vi':'... 900 VND'}
{'id':'6708f3eb0ec61045ab7fdfbb','event_code':'DIV','exright_date':'2024-09-24','event_title_vi':'... 950 VND'}
{'id':'6708f3eb0ec61045ab7fdfbc','event_code':'DIV','exright_date':'2024-09-24','event_title_vi':'... 1,500 VND'}
```
**Kết luận D4**: `id` dùng được làm khóa dedup chính. Fallback khi thiếu `id` **không được chứa `raw_title`** (nếu không, test đổi title ⇒ 2 row, AC7 fail) — dùng `sha256(symbol|ex_date|action_type)[:32]` + cờ `FALLBACK_ID` + `is_latest` supersede.

## 4. PROBE D6 — universe `event_code`

| `event_codes` | rows có `exright_date` | `event_code` |
|---|---|---|
| `None` (mặc định) | 9 (2024+) / 57 (2010+) | `DIV` 45, `ISS` 12 |
| `DIV,ISS,SPLIT,RIGHTS` | 57 (2010+) | `DIV` 45, `ISS` 12 |
| `SPLIT` | 1000 | **không có cột** — toàn tin tức |
| `RIGHTS` | 1000 | **không có cột** — toàn tin tức |
| `ALL` | 1000 | **không có cột** — toàn tin tức |

Source: `vnbroker-3.7.2@container:explorer/vci/company.py:111-112` (`if event_codes is None: event_codes = "DIV,ISS"`). Không có constant `SPLIT`/`RIGHTS` trong package.

**Kết luận D6**: enum `CorporateAction.action_type` thu hẹp `DIV|ISS`; log warning cho mã lạ; không assert chia tách/quyền từ VCI.

## 5. QUYẾT ĐỊNH D1–D7 (chốt trong Phase 0)

| # | Quyết định | Giá trị chốt | Bằng chứng |
|---|---|---|---|
| D1 | Golden VNM | **Σ cash động**; không assert 2450/0.9755; assert dedup + số event | §3 (2 ID khác nhau) + critique C1 |
| D2 | Unparsed | **per-date** (`AdjFactor.status='partial'` chỉ ex_date bị ảnh hưởng) | critique C2(a), an toàn hơn |
| D3 | DNSE | **ĐÓNG**: method account-scoped, không dùng | §2 |
| D4 | `source_event_id` | **dùng VCI `id`**; fallback hash không chứa title | §3 |
| D5 | `P_prev` / precision | raw close phiên liền trước (`max(date < ex_date)`), `Decimal(28,10)` factor / `Decimal(18,2)` tiền | plan §Task 4 xác nhận |
| D6 | Event codes | **`DIV,ISS`**, log unknown, enum thu hẹp | §4 |
| D7 | Sửa handoff | xoá 2450 cứng, gắn `dev@3845063a5:`/`main@117b2de98:`, KBS đổi ngôn ngữ, thêm 3 câu hỏi | file handoff đã sửa trong slice này |

## 6. BÀI HỌC ÁP DỤNG / CHECKLIST

`Lessons áp dụng: [L-001, L-002, L-003, L-M02, L-V01, L-V02, L-V04, L-F04, L-T01, L-T02]`

- [x] `git status` + đọc CLAIMS trước khi sửa; claim commit riêng (`dccfe1ba6`); tên agent = branch bỏ tiền tố `docs/`.
- [x] Mọi con số probe có lệnh tái tạo; control âm tính chạy thật (`SPLIT`/`RIGHTS` → không có `event_code`) trước khi kết luận D6.
- [x] Citation gắn `branch@sha`; không đọc tiếng Việt qua console (dùng Read tool).
- [x] `git diff --numstat` sau mỗi lần ghi file; không round-trip file tiếng Việt qua PowerShell.
- [x] Gate chạy trên **code hiện tại** (sau fetch/rebase), exit code lấy trực tiếp không qua pipeline.

## 7. GATES

| Gate | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — 0 lỗi, 0 trùng migration (cảnh báo CLAIMS stale không chặn) |
| Probe package read-only | 4 lượt, output như §2–§4 |
| `npx tsc --noEmit` / BE test / FE test / build | **CHƯA CHẠY** — docs-only, không đổi source; sẽ chạy ở Task 1–8 trên VPS staging DB tạm riêng |
