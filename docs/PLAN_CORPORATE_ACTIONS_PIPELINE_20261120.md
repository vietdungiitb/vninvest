# Corporate Actions Pipeline — Implementation Plan

> **For agentic workers:** dùng skill repo `workflow-dev-loop` (vninvest profile — repo có `docs/CLAIMS.md` + `packages/web/scripts/check-multi-agent.mjs`) + `project-lessons`; khi chạy song song thêm `multi-agent-workflow`. Mỗi task TDD fail-before, steps dùng checkbox `- [ ]`. `Lessons áp dụng: [L-001, L-002, L-003, L-M02, L-V01, L-V02, L-V04, L-F04, L-T01, L-T02]` (chi tiết §B1b).

**Goal:** Xây pipeline corporate action phía vninvest — parse/ingest sự kiện từ `vnbroker` 3.7.2, lưu `CorporateAction` + `AdjFactor`, tính `adj_close` cho `DailyPrice`, và phục vụ qua bars API — theo contract đã bàn giao, có plan B parse-from-text khi đối tác chưa trả field số.

**Architecture:** Tách 4 lớp trong `packages/core/backend/src/market_data/corporate_actions/`: `parser.py` (text → số có `parse_status`), `ingest.py` (gọi trực tiếp `vnbroker.explorer.vci.company.Company.events()`, không qua facade KBS rỗng), `adjustment.py` (factor theo `ex_date`, cộng tiền cùng ngày, nhân dồn, có guard), rồi Celery task trong `data_ingest/tasks.py` điều phối. `DailyPrice.close` **không** bị ghi đè; hệ quả nằm ở `DailyPrice.adj_close` + bảng `AdjFactor` để recompute được.

**Tech Stack:** Django 5 / Django REST Framework / Celery beat / PostgreSQL / `vnbroker==3.7.2` / `Decimal` / `pytest`-style Django `TestCase`.

**Spec:** 
- `docs/handoffs/HANDOFF_2026-11-20_VNBROKER_CORPORATE_ACTION.md` (R1–R8, contract §5, công thức §6, golden §7, AC §8)
- `docs/AUDIT_VNBROKER_CORPORATE_ACTION_SOURCE_20261120.md` (`a6e7bb7f2`, PR #453)
- `docs/AUDIT_CRITIQUE_VNBROKER_CORPORATE_ACTION_20261120.md` (phản biện C1–C13 — plan này là phần implement của nó)

## B1 — Đo lường (chạy thật 2026-11-20; đính chính ở B1b)

| Lệnh | Kết quả thật |
|---|---|
| `git status --short --branch` | branch `docs/handoff-vnbroker-to-main`, `?? docs/AUDIT_CRITIQUE_...md` + `?? docs/PLAN_...md` (chưa commit) |
| `git log --oneline -1 origin/dev` / `origin/main` | `3845063a5` / `117b2de98` |
| `git grep -n -i "adjusted" origin/main -- packages/core/backend/src` | chỉ `models.py:80`, `admin.py`, `serializers.py`, migration — **không có** contract bars; code `adjusted:false + note` chỉ có `dev@3845063a5:packages/core/backend/src/market_data/stock_mgmt_native_views.py:4381-4384` (C4) |

### B1b — Đính chính router (phát hiện lúc chạy Phase 0)

B1 do người viết plan kết luận "Generic profile" là **SAI**: đã chạy `node scripts/check-multi-agent.mjs` (đường dẫn cũ) ⇒ `MODULE_NOT_FOUND`, và `git ls-tree origin/main` ⇒ không thấy tooling. Trên `dev@3845063a5`:

| Lệnh đúng | Kết quả |
|---|---|
| `git ls-tree -r --name-only origin/dev \| Select-String '^docs/CLAIMS.md$\|^docs/AGENT_PROTOCOL.md$\|^packages/web/scripts/check-multi-agent.mjs$'` | cả 3 đều có |
| `node packages/web/scripts/check-multi-agent.mjs` | **exit 0** — 0 lỗi, 0 trùng migration (chỉ cảnh báo CLAIMS stale) |
| `Test-Path .opencode/skills/workflow-dev-loop/SKILL.md` / `docs/LESSONS/INDEX.md` | `True` |

⇒ **Router: vninvest profile** (9 bước), không phải Generic. Bằng chứng: `docs/AUDIT_CORPORATE_ACTION_PHASE0_EVIDENCE_20261120.md` §1. Slice docs đã khai claim riêng `dccfe1ba6` (agent `corp-action-phase0-evidence` = tên branch bỏ tiền tố `docs/`). Slice code dùng branch `feat/corporate-actions` + claim agent `corporate-actions`, 1 worktree, DB riêng, không commit thẳng `dev`/`main`.

**Đã đọc system-design**: repo `dev` không có `docs/system-design/`; xây mới có lý do — evidence qua `AGENTS.md` §"AI Audit/Research Framework" + mã nguồn `dev@3845063a5`.

**Baseline gate**: chạy được ở B1b — `check-multi-agent` exit 0. Gate code (tsc/test/build) **CHƯA ĐO**; thiết lập ở Task 1–8 bằng `python manage.py test market_data.tests.test_corporate_action_*` trên VPS staging, DB tạm riêng (không Docker local, không DB dùng chung). Mọi số kèm lệnh tái tạo; cái không tái tạo được ghi `CHƯA CHẠY`.

---

## Global Constraints (mọi task kế thừa)

- `vnbroker==3.7.2` (`packages/core/backend/requirements.txt`, verify `git show origin/dev:packages/core/backend/requirements.txt | Select-String vnbroker`). **Không** pip install/nâng version trong slice này.
- Mọi số tiền/tỉ lệ dùng `Decimal`; KHÔNG dùng `float` cho `cash_amount_per_share` / `stock_ratio_pct`. Precision chuẩn: `Decimal(28, 10)` cho factor, `Decimal(18, 2)` cho tiền.
- `DailyPrice.close` là dữ liệu thô, **không bao giờ** bị ghi đè. Chỉ ghi `adj_close` (field mới) + `is_adjusted`.
- Mọi `file:line` trong doc/code review phải dạng `dev@<sha>:path:line` hoặc `main@<sha>:...` (C4). Citation trần bị cấm.
- Feature flag `CORPORATE_ACTIONS_ENABLED` (env, default `False`) — plan B của C11: parse-from-text chạy được ngay nhưng không đổi API bars cho đến khi owner chốt contract.
- Không gửi token qua file/handoff; đọc `TCBS_TOKEN` từ env/secret manager (C10).
- Migration do `makemigrations` sinh, không tự đặt số; phải chạy được trên DB có dữ liệu và có đường rollback.
- Backend test **chỉ trên VPS staging với DB tạm riêng**; không `docker ps`, không DB staging dùng chung.
- Gốc nhánh: `dev@3845063a5`. Mọi task commit riêng, merge commit khi xong (không squash).

## Review Focus (5 failure mode dễ gặp nhất — mỗi cái có test ghim ở task tương ứng)

| # | Input / điều kiện | Hành vi kỳ vọng | Test ghim ở |
|---|---|---|---|
| 1 | VNM 2 DIV cùng `2024-09-24` (950 + 1.500) | `Σ cash` **động**, không fix 2.450; dedup theo `source_event_id` (VCI `id`) trước khi cộng; 2 ID khác nhau ⇒ 2 event | Task 4 `test_two_div_same_ex_date` |
| 2 | 5 event `unparsed` của VNM | Chỉ flag `adjusted:false` cho ex_date bị ảnh hưởng; **không** vô hiệu hoá toàn mã | Task 4 `test_unparsed_is_per_date` |
| 3 | `Σ cash ≥ P_prev` hoặc `ratio ≤ -100` | Không sinh factor ≤ 0; log cảnh báo, giữ `adjusted:false` | Task 4 `test_invalid_factor_guard` |
| 4 | Cùng `source_event_id` fetch lại 2 lần (title đổi) | Upsert/update, không tạo bản ghi trùng; AC7 idempotent | Task 3 `test_idempotent_refetch` |
| 5 | Provider chính trả rỗng, fallback cũng rỗng | Không xoá dữ liệu cũ; ghi `source` + giữ state, client không crash | Task 3 `test_all_providers_empty_keeps_existing` |

---

## Ma trận truy vết REQ → task → test

| Yêu cầu | Nguồn | Task | Test |
|---|---|---|---|
| R1 field số cash/ratio (plan B parse nếu đối tác chưa trả) | handoff §4 | 2 | `test_corporate_action_parser.py::test_parse_cash_with_comma_and_dot` |
| R2 API thống nhất + `source` + fallback + dedup | handoff §4 | 3 | `test_corporate_action_ingest.py::test_idempotent_refetch`, `::test_all_providers_empty_keeps_existing` |
| R3 semantics nhiều sự kiện cùng ex_date | handoff §4 / C1 | 4 | `test_corporate_action_adjustment.py::test_two_div_same_ex_date` |
| R4 KBS rỗng | handoff §4 / C12 | dependency register §Phase 0 (ngoài code) | — |
| R5 TCBS auth | handoff §4 / C10 | 3 (env `TCBS_TOKEN`) | `test_corporate_action_ingest.py::test_tcbs_token_from_env` |
| R6 `parse_status`, không suy diễn | handoff §4 / C2 | 2, 4 | `::test_unparsed_status`, `::test_unparsed_is_per_date` |
| R7 độ sâu lịch sử + rate limit | handoff §4 / C9 | 5 | `test_corporate_action_sync_task.py::test_incremental_only_new_ex_dates` |
| R8 factor/adj_close series | handoff §4 | 4, 6 | `::test_adj_factor_table`, `test_ohlcv_bars_native_api.py::test_adj_close_exposed` |
| C1 golden tự mâu thuẫn | critique | Phase 0 + 4 | `test_two_div_same_ex_date` |
| C2 rule unparsed toàn mã | critique | 4 | `test_unparsed_is_per_date` |
| C3 DNSE `get_corporate_action_history` | critique | Phase 0 (ĐÓNG: account-scoped, không dùng) + 3 (ghi `source='DNSE_UNAVAILABLE'` nếu thử) | evidence doc §2 |
| C4 evidence sai giữa dev/main | critique | Phase 0 + 7, 8 | citation check Task 8 |
| C5 enum parse_status | critique | 1, 2 | parser status enum test |
| C6 `source_event_id` chưa verified | critique | Phase 0 + 3 | `test_idempotent_refetch` |
| C7 P_prev/guard/precision | critique | 4 | `test_invalid_factor_guard`, `test_golden_numeric_values` |
| C8 SPLIT/RIGHTS bị lọc mất | critique | Phase 0 + 3 | `test_event_code_coverage` |
| C9 recompute khi correction | critique | 4, 5 | `test_is_latest_supersedes_old` |

---

## SCOPE / LIMIT / Non-goals / Rollback

- **SCOPE**: 8 task, backend-only (`market_data` + `data_ingest`), docs/ledger. Không đụng frontend, không đụng `vnbroker` package, không đụng requirements.
- **LIMIT**: tối đa 3 vòng sửa/task; quá ⇒ ghi blocker, dừng, báo partial state. Re-audit ở Task 8 phải 0 blocker + 0 major.
- **Non-goals**: không tự tính `adj_close` trong package vnbroker; không tích hợp feed VSDC/HOSE; không sửa `close` thô; không mở PR khi flag còn default `False` và contract chưa chốt; không gửi token.
- **Rollback**: revert migration bằng `makemigrations` inverse + drop 3 field/bảng mới; feature flag default `False` ⇒ API bars giữ nguyên contract cũ. Không có dữ liệu production bị ghi đè (chỉ field mới).

---

## Phase 0 — Quyết định phải chốt TRƯỚC dòng code đầu tiên (gate B3→B4)

Auditor độc lập (không phải người viết plan) review plan + critique + evidence, verdict `PASS`/`AGREE` ghi thành file (`docs/evidence/corporate-actions/PHASE0_AUDIT.md`) mới được khai claim slice code. **D1–D7 đã chốt 2026-11-20** (bằng chứng `docs/AUDIT_CORPORATE_ACTION_PHASE0_EVIDENCE_20261120.md`):

| # | Quyết định | Giá trị chốt | Gate |
|---|---|---|---|
| D1 | Golden VNM (C1) | **`Σ cash` động** — 2 DIV có 2 `id` VCI khác nhau nhưng chưa đối chiếu độc lập số tiền ⇒ **không** assert 2.450/0.9755; assert dedup + số event | Đóng |
| D2 | Unparsed (C2) | **per-date**: `AdjFactor.status='partial'` chỉ ex_date bị ảnh hưởng, không vô hiệu hoá toàn mã | Đóng |
| D3 | DNSE `get_corporate_action_history` (C3) | **Đã probe 3.7.2**: method có nhưng account-scoped (`account_no` + `DNSEClient(api_key, api_secret)`) ⇒ không dùng; R1 giữ P0 | Đóng |
| D4 | `source_event_id` VCI (C6) | **dùng cột `id`** (hex 24, ổn định qua 2 lần fetch); fallback hash **không chứa `raw_title`** + `is_latest` supersede | Đóng (độ ổn định dài hạn vẫn hỏi vnbroker) |
| D5 | `P_prev`/precision (C7) | raw close phiên liền trước (`max(date < ex_date)`), `Decimal(28,10)` factor, `Decimal(18,2)` tiền | Xác nhận |
| D6 | Event code coverage (C8) | **`DIV,ISS`**; `SPLIT`/`RIGHTS` trả tin tức, không có `event_code` ⇒ enum thu hẹp + log unknown | Đóng |
| D7 | Sửa handoff (C1/C4/C12) | Đã xoá 2450 cứng, gắn `dev@3845063a5:`/`main@117b2de98:`, đổi ngôn ngữ KBS, thêm 3 câu hỏi; **PR #455 đã merge** ⇒ sửa bằng PR mới, không "gửi PR #455" | Đóng trong docs slice `dccfe1ba6` trở đi |

---

## File Structure (khoá trước khi chia task)

```
packages/core/backend/src/market_data/models.py                     # + CorporateAction, + AdjFactor, + DailyPrice.adj_close
packages/core/backend/src/market_data/migrations/000X_*.py           # do makemigrations sinh
packages/core/backend/src/market_data/admin.py                       # register 2 model mới
packages/core/backend/src/market_data/corporate_actions/__init__.py   # package mới (export facade)
packages/core/backend/src/market_data/corporate_actions/parser.py     # parse_event_title
packages/core/backend/src/market_data/corporate_actions/ingest.py     # fetch + upsert từ VCI
packages/core/backend/src/market_data/corporate_actions/adjustment.py # compute_adj_factors + apply_adjustments
packages/core/backend/src/data_ingest/tasks.py                        # + sync_corporate_actions task
packages/core/backend/src/vninvest_core/settings.py                   # + beat entry
packages/core/backend/src/market_data/stock_mgmt_native_views.py      # bars: + adj_close/adjusted/note
packages/core/backend/src/market_data/tests/test_corporate_action_parser.py       (mới)
packages/core/backend/src/market_data/tests/test_corporate_action_ingest.py       (mới)
packages/core/backend/src/market_data/tests/test_corporate_action_adjustment.py   (mới)
packages/core/backend/src/market_data/tests/test_corporate_action_sync_task.py    (mới)
packages/core/backend/src/market_data/tests/test_ohlcv_bars_native_api.py         (sửa)
docs/CODE_CHANGE_AUDIT_LEDGER.md                                     # Entry 570 (569 = Phase 0 docs)
docs/handoffs/HANDOFF_2026-11-20_VNBROKER_CORPORATE_ACTION.md        # sửa theo D7
```

---

## Task 1 — Model + migration

**Files:** Modify `market_data/models.py`, `market_data/admin.py`; Create migration do `makemigrations` sinh; Test `market_data/tests/test_corporate_action_models.py` (mới).

**Interfaces**
- Consumes: `DailyPrice` (`market_data/models.py:63-93`, `dev@3845063a5`).
- Produces: `CorporateAction`, `AdjFactor`, `DailyPrice.adj_close` — dùng ở Task 2–7.

Fields chốt:
- `CorporateAction`: `symbol CharField(32)`, `action_type CharField(4)` (`DIV`/`ISS`), `ex_date DateField`, `record_date`/`payment_date` null, `cash_amount_per_share Decimal(18,2) null`, `stock_ratio_pct Decimal(18,4) null`, `currency CharField(3) default 'VND'`, `source CharField(8)`, `source_event_id CharField(128)`, `raw_title TextField`, `parse_status CharField(20)` ∈ `{structured, parsed_from_text, unparsed}`, `is_latest BooleanField default True`, `fetched_at DateTimeField`. Constraint `unique(source, source_event_id)`; index `(symbol, ex_date)`.
- `AdjFactor`: `symbol CharField(32)`, `ex_date DateField`, `prev_close Decimal(18,2)`, `cash_factor Decimal(28,10)`, `stock_factor Decimal(28,10)`, `factor_total Decimal(28,10)`, `status CharField(16)`, `computed_at DateTimeField`; `unique(symbol, ex_date)`.
- `DailyPrice.adj_close Decimal(18,2) null=True blank=True` (additive).

- [ ] **Step 1 — Viết test fail-before**: `test_corporate_action_models.py` — 3 test: tạo `CorporateAction` với 2 `source_event_id` khác cùng `(symbol, ex_date)` ⇒ 2 row; tạo trùng `(source, source_event_id)` ⇒ `IntegrityError`; `DailyPrice.objects.create(...).adj_close is None` mặc định.
- [ ] **Step 2 — Chạy test, expect FAIL** `ModuleNotFoundError: market_data.corporate_actions` / field không tồn tại.
- [ ] **Step 3 — Thêm 3 model vào `models.py` + đăng ký admin**. Không tự viết migration tay.
- [ ] **Step 4 — `python manage.py makemigrations market_data`** (trên staging, DB tạm), commit file sinh ra; verify `python manage.py migrate --plan` không lỗi.
- [ ] **Step 5 — Chạy lại test expect PASS**; `git diff --numstat` khớp số dòng dự kiến (không mojibake).
- [ ] **Step 6 — Commit** `feat: add CorporateAction, AdjFactor and DailyPrice.adj_close`.

---

## Task 2 — Parser (plan B parse-from-text)

**Files:** Create `corporate_actions/__init__.py`, `corporate_actions/parser.py`, `tests/test_corporate_action_parser.py`.

**Interfaces**
- Consumes: `event_title_vi`, `event_code` từ VCI DataFrame (audit §A: `vnbroker-3.7.2@container:explorer/vci/company.py:104-116,303-318`, `a6e7bb7f2`).
- Produces: `ParsedAmount(cash_amount: Decimal|None, stock_ratio_pct: Decimal|None, status: Literal['structured','parsed_from_text','unparsed'], ambiguous_cash_pct: bool=False)`; `parse_event_title(title: str, action_type: str) -> ParsedAmount`.

- [ ] **Step 1 — Test fail-before** (5 case, value lấy từ audit §B):
  - `"Trả cổ tức bằng tiền mặt - Đợt 1 2024 - 1,500 VND"`, `DIV` ⇒ `Decimal('1500')`, status `parsed_from_text`.
  - `"... 2.000 VND"` (dấu chấm nghìn) ⇒ `Decimal('2000')` — regex của audit chỉ bắt `,`, đây là lỗi tiềm ẩn.
  - `"Phát hành cổ phiếu - Cổ phiếu thưởng tỉ lệ 50.0%"`, `ISS` ⇒ `Decimal('50.0')`.
  - `"Trả cổ tức ... tỉ lệ 20%"`, `DIV` ⇒ `cash_amount=None`, `ambiguous_cash_pct=True`, `status='unparsed'` (cổ tức % trên mệnh giá **không** được hiểu là tỉ lệ cổ phiếu thưởng — C8/C5).
  - `"Phát hành cho CBCNV"` / `"Phát hành riêng lẻ"`, `ISS` ⇒ all None, `status='unparsed'`.
- [ ] **Step 2 — Chạy expect FAIL**.
- [ ] **Step 3 — Implement `parse_event_title`**: regex `(?P<amt>\d[\d.,]*)\s*VND` và `(?P<pct>\d+(?:\.\d+)?)\s*%`; normalise `,` và `.` nghìn bằngrule: nếu cả hai xuất hiện, dấu cuối cùng là thập phân; nếu chỉ một dấu và có 3 chữ số sau ⇒ nghìn; dùng `Decimal`, không `float`. `ambiguous_cash_pct=True` khi `action_type=='DIV'` và chỉ có `%`.
- [ ] **Step 4 — Test PASS**; thêm assert kiểu `isinstance(result.cash_amount, Decimal)`.
- [ ] **Step 5 — Commit** `feat: parse corporate action amounts with parse_status`.

---

## Task 3 — Ingest (VCI trực tiếp + dedup + provider rỗng)

**Files:** Create `corporate_actions/ingest.py`, `tests/test_corporate_action_ingest.py`.

**Interfaces**
- Consumes: `parse_event_title` (Task 2), `CorporateAction` (Task 1), `vnbroker==3.7.2`.
- Produces: `fetch_corporate_actions(symbol: str, from_date: date, to_date: date | None = None) -> list[dict]`, `upsert_corporate_actions(symbol: str, rows: list[dict]) -> tuple[int,int]`.

- [ ] **Step 1 — Test fail-before** (mock `vnbroker.explorer.vci.company.Company`, không gọi mạng thật):
  - `test_fetch_uses_vci_directly`: assert patch đích là `vnbroker.explorer.vci.company.Company`, **không** phải `vnbroker.api.company.Company` (facade KBS — audit VCA-02).
  - `test_idempotent_refetch`: fetch 2 lần cùng `source_event_id`, title đổi ⇒ vẫn 1 row, `raw_title` được update, `is_latest=True` (C6).
  - `test_all_providers_empty_keeps_existing`: seed 1 row có `source='VCI'`, fetch trả `[]` (mọi provider rỗng) ⇒ row cũ vẫn tồn tại, **giữ nguyên `source`**, không xoá (AC6).
  - `test_tcbs_token_from_env`: mock auth error, assert đọc `os.getenv('TCBS_TOKEN')`, không hardcode token (C10).
  - `test_tcbs_provider_auth_error_mapped`: mock lỗi auth ⇒ normalize thành mã `PROVIDER_AUTH` + thông báo hướng dẫn cấu hình (AC5), không để exception chung lọt ra.
  - `test_fallback_id_collision_two_div_same_ex_date`: test double bỏ cột `id`, trả 2 DIV cùng `(symbol, ex_date, action_type)` với amount 950/1.500 ⇒ vẫn **2 row**, hash khác nhau; nếu vẫn va chạm thì sinh suffix + log `FALLBACK_ID_COLLISION` (O3 re-audit).
  - `test_event_code_coverage`: assert gọi `event_codes` lấy từ constant `SUPPORTED_EVENT_CODES`; test double trả mã lạ ⇒ log warning + bỏ qua, không crash (C8).
  - `test_dnse_probe_recorded`: D3 đã đóng bằng probe Phase 0 (method account-scoped, cần `DNSEClient(api_key, api_secret)` + `account_no`) — test chỉ đảm bảo ingest **không** fallback sang DNSE; nếu thử thì ghi `source='DNSE_UNAVAILABLE'` + note, không dùng làm nguồn.
- [ ] **Step 2 — Chạy expect FAIL**.
- [ ] **Step 3 — Implement**: `fetch_corporate_actions` gọi `VCI(symbol).events(from_date=from_date.strftime('%Y%m%d'), event_codes=...)`, map cột sang dict, chạy parser, sinh `source_event_id` từ **cột `id` của VCI** (D4 — khóa chính, probe 9/9 dòng có `id`). Fallback khi thiếu `id`: `hashlib.sha256(f"{symbol}|{ex_date}|{action_type}|{cash_normalized}|{ratio_normalized}".encode()).hexdigest()[:32]` — **đưa amount/ratio đã chuẩn hoá vào hash** để 2 DIV cùng ex_date không va chạm, nhưng **KHÔNG đưa `raw_title`** (nếu không, test đổi title sẽ tạo row mới ⇒ AC7 fail). Nếu sau đó vẫn va chạm (cùng amount, title khác) ⇒ sinh suffix theo thứ tự xuất hiện + log `FALLBACK_ID_COLLISION`. Ghi log `FALLBACK_ID`. `upsert` dùng `update_or_create(source, source_event_id)`; title đổi ⇒ update `raw_title` + giữ `is_latest=True`, supersede bản cũ.
- [ ] **Step 4 — Test PASS**.
- [ ] **Step 5 — Commit** `feat: ingest corporate actions from VCI with idempotent upsert`.

---

## Task 4 — Adjustment engine (factor theo ex_date)

**Files:** Create `corporate_actions/adjustment.py`, `tests/test_corporate_action_adjustment.py`.

**Interfaces**
- Consumes: `CorporateAction`, `AdjFactor`, `DailyPrice` (Task 1); `parse_status` (Task 2).
- Produces: `compute_adj_factors(symbol: str) -> list[AdjFactor]`, `apply_adjustments(symbol: str) -> int`.

- [ ] **Step 1 — Test fail-before + golden** (giá trị cụ thể để assert — C7):
  - `test_two_div_same_ex_date`: 2 DIV `2024-09-24` 950 + 1.500 (2 `source_event_id` VCI khác nhau), `P_prev=100000`. **D1 chốt: KHÔNG hardcode 2.450/0.9755** — assert `Σ cash` lấy từ fixture, `cash_factor = (P_prev - Σ cash)/P_prev` (fixture 950+1.500 ⇒ 0.9755 nhưng tính động), assert 2 event được cộng đủ + dedup: 2 row **cùng** `source_event_id` ⇒ chỉ tính 1 lần (C1). Không assert khi chưa có đối chiếu độc lập số tiền.
  - `test_golden_numeric_values`: FPT ISS 15% ⇒ `stock_factor = 1/1.15` làm tròn `Decimal(28,10)`; VCB cash 450 + stock 49.5% ⇒ `factor_total = cash_factor × stock_factor`, assert expected numeric.
  - `test_unparsed_is_per_date`: 5 unparsed VNM ⇒ `AdjFactor.status='partial'` chỉ cho ex_date liên quan; ex_date khác vẫn `computed`, `apply_adjustments` chỉ set `adj_close` cho ngày có factorComputed (C2).
  - `test_invalid_factor_guard`: `Σ cash = 120000 > P_prev=100000` ⇒ không tạo `AdjFactor`, `adjusted` giữ False, có `logger.warning`.
  - `test_adj_factor_table`: `unique(symbol, ex_date)`; recompute lại ghi đè factor cũ (C9).
  - `test_is_latest_supersedes_old`: chỉ event `is_latest=True` được dùng tính factor.
  - Helper `_prev_close(symbol, ex_date)` lấy `DailyPrice.close` của **ngày giao dịch liền trước** (max `date < ex_date`), không phải `ex_date - 1 day`; assert trong test.
- [ ] **Step 2 — Chạy expect FAIL**.
- [ ] **Step 3 — Implement**: group event theo `ex_date`, cộng `cash_amount_per_share` (sau dedup), nhân dồn `1/(1+ratio/100)`; `factor_total = cash_factor * stock_factor`; validate `0 < factor ≤ 1` else log + skip; `apply_adjustments` walk ex_date theo thứ tự tăng, tích ∏ factor cho mọi `ex_date > t`, ghi `DailyPrice.adj_close` làm tròn 2 chữ số, set `is_adjusted=True` chỉ khi không có unparsed ảnh hưởng.
- [ ] **Step 4 — Test PASS**; assert `close` thô không đổi (`self.assertEqual(row.close, 100000)`).
- [ ] **Step 5 — Commit** `feat: compute corporate action adjustment factors`.

---

## Task 5 — Celery task + beat schedule (incremental,rate-limit friendly)

**Files:** Modify `data_ingest/tasks.py`, `vninvest_core/settings.py`; Create `tests/test_corporate_action_sync_task.py`.

**Interfaces**
- Consumes: `upsert_corporate_actions`, `compute_adj_factors`, `apply_adjustments` (Task 3–4).
- Produces: `sync_corporate_actions(symbol: str, from_date: date | None = None) -> dict` stats.

- [ ] **Step 1 — Test fail-before**: `test_incremental_only_new_ex_dates` — seed `CorporateAction` đến `2026-01-01`, task gọi fetch với `from_date = max(ex_date) - 7 days` (không phải `2010-01-01`) ⇒ chứng minh không full-history mỗi đêm (C9/R7); `test_stats_shape` ⇒ dict có `fetched/created/updated/factors/applied`.
- [ ] **Step 2 — Chạy expect FAIL**.
- [ ] **Step 3 — Implement task với `@shared_task(bind=True)`, guard `CORPORATE_ACTIONS_ENABLED`, queue `enrichment_offhours`; beat entry `'sync-corporate-actions-nightly'` `crontab(hour=18, minute=30)` (sau backfill giá 17:05, `dev@3845063a5:packages/core/backend/src/vninvest_core/settings.py:776-783`); kwargs `_scheduler_job_key` theo pattern existing.
- [ ] **Step 4 — Test PASS**; chạy `python manage.py check` + `celery -A vninvest_core inspect registered` trên staging (ghi output thật hoặc `CHƯA CHẠY`).
- [ ] **Step 5 — Commit** `feat: nightly incremental corporate action sync`.

---

## Task 6 — Bars API phơi bày `adj_close`

**Files:** Modify `market_data/stock_mgmt_native_views.py` (đích `dev@3845063a5:4381-4384` — **không** có trên `main`, xem C4); Modify `tests/test_ohlcv_bars_native_api.py`.

**Interfaces**
- Consumes: `DailyPrice.adj_close`, `AdjFactor.status` (Task 1/4).
- Produces: mỗi bar dict có thêm `adj_close: float|None`, `adjusted: bool`, `note: str|None`.

- [ ] **Step 1 — Test fail-before**: `test_adj_close_exposed` — seed DailyPrice `close=100000`, `adj_close=97550`, gọi `GET /core/v1/stock-management/stocks/VNM/bars/?timeframe=D` ⇒ assert `adj_close == 97550`, `adjusted is True`, `raw close` vẫn `100000`; `test_unparsed_keeps_false` — có unparsed ⇒ `adjusted False` + `note` chứa mã ex_date.
- [ ] **Step 2 — Chạy expect FAIL**.
- [ ] **Step 3 — Implement trong `_ohlcv_bar_from_daily` / response assembly**: chỉ thêm key khi flag bật; khi flag tắt giữ nguyên contract hiện tại (`adjusted:false + note`) trên dev.
- [ ] **Step 4 — Test PASS**; chạy full `market_data.tests.test_ohlcv_bars_native_api` (không suy diện từ 1 test).
- [ ] **Step 5 — Commit** `feat: expose adj_close in bars API behind flag`.

---

## Task 7 — Docs, ledger, handoff revision (docs-only)

**Files:** Modify `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `docs/handoffs/HANDOFF_2026-11-20_VNBROKER_CORPORATE_ACTION.md`.

- [x] **Step 1 — Sửa handoff theo D7 (ĐÃ LÀM ở docs slice Phase 0, commit `dccfe1ba6` trở đi)**: xoá "2.450" khỏi §7/AC3; thống nhất `parse_status`; gắn `dev@3845063a5:`/`main@117b2de98:`; đổi KBS → "probe params hiện tại trả rỗng, đang hỏi Q3"; thêm 3 câu hỏi (ID VCI, P_prev/precision, SPLIT/RIGHTS) + câu DNSE account-scoped. PR #455 đã merge ⇒ mở PR mới, không gửi lại PR cũ.
- [ ] **Step 2 — Thêm Entry 570** vào ledger (Entry 569 đã dùng cho Phase 0 docs) với lệnh tái tạo migrations/golden/gate + `CHƯA CHẠY`. Không round-trip file tiếng Việt qua PowerShell; dùng `edit`, verify `git diff --numstat`.
- [ ] **Step 3 — Verification**: `git grep -n "2.450" docs/handoffs/HANDOFF_2026-11-20_...` ⇒ 0 hit (trừ trích dẫn audit); `git grep -n "stock_mgmt_native_views.py:"` ⇒ mọi hit có `@sha`.
- [ ] **Step 4 — Commit** `docs: revise handoff + ledger entry 570`.

---

## Task 8 — Re-audit độc lập + bàn giao (gate B8→B9)

- [ ] Auditor **khác người** tự chạy lại mọi lệnh trong plan, kiểm 5 Review Focus, verdict 0 blocker + 0 major.
- [ ] Nếu `NEED_REVISION` ⇒ sửa task tương ứng, tối đa 3 vòng; quá ⇒ ghi blocker, dừng.
- [ ] `REPORT_FINAL` + cập nhật `PROGRESS`, đóng branch claim (nếu có), merge commit vào `dev`, rebase + **chạy lại mọi gate** sau rebase, rồi cherry-pick/merge sang `main` (nhớ `main` hiện **không** có `adjusted` contract — C4).
- [ ] Xuất bản handoff đã sửa + trả lời 6+3 câu hỏi cho vnbroker; chỉ bật flag sau khi owner chốt D1–D7.

---

## Self-review (checklist writing-plans)

1. **Spec coverage**: R1→T2, R2→T3, R3→T4, R5→T3, R6→T2/T4, R7→T5, R8→T4/T6; R4 là external (dependency register). C1→T4+Phase0, C2→T4, C3→T3+Phase0, C4→T6+T7, C5→T1/T2, C6→T3, C7→T4, C8→T3+Phase0, C9→T4/T5, C10→T3, C11→flag global, C12→T7, C13→B1. ✅
2. **Step scan**: mỗi step là 1 hành động, có expected output; không có "handle edge cases" trần. ✅
3. **Type consistency**: `ParsedAmount`, `parse_event_title`, `fetch_corporate_actions`, `upsert_corporate_actions`, `compute_adj_factors`, `apply_adjustments`, `sync_corporate_actions` — tên/signature dùng nhất quán ở mọi task. ✅
4. **Review Focus**: 5 dòng, mỗi dòng có test ghim cụ thể ở Task 3/4. ✅
5. **Proportion**: plan dài hơn spec (~186 dòng) nhưng phần lớn là task/test signature, không phải transcript code; chấp nhận được cho pipeline 8 task. ✅

---

## Execution Handoff

Plan đã lưu tại `docs/PLAN_CORPORATE_ACTIONS_PIPELINE_20261120.md`. Cần reviewer độc lập chốt Phase 0 (đặc biệt D1/D2/D4/D7) trước khi khai branch `feat/corporate-actions`.

Chọn cách chạy:
- **Subagent-driven** — mỗi task một subagent implement + một reviewer check riêng, rồi review toàn branch. Phù hợp vì 8 task dính chặt qua interface (parser → ingest → engine → API); sai ở task 2 lan sang task 6.
- **Native** — tôi tự chạy toàn bộ task trong phiên, rồi 1 reviewer cuối. Nhanh hơn, nhưng không có review độc lập giữa các task.

Khuyến nghị **subagent-driven** vì Golden VNM/P_prev là dữ liệu tài chính — một sai sót lan ra mọi MA/backtest. Bạn muốn chạy theo cách nào, và đã chốt D1–D7 chưa?
