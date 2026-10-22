> **K? LU?N S?A (2026-10-22) � DOC N�Y �� B? ��NH CH�NH.**
> K? ho?ch ban d?u d? ki?n xo� 5 file (38 route / 827 d�ng). **Khi ch?y `manage.py check` + full BE suite
> tr�n VPS staging th� ph�t hi?n: 5 file d� **�?U C�N THAM CHI?U TH?T** ? **KH�NG XO� �U?C**.
> Ri�ng `market_data/urls.py` (6 route) **dang serve** (`core_urls.py:39` c� `from .urls import ...`).
> Chi ti?t 2 l?n grep sai + 4 test b?o v? dang d? s?n: **ledger Entry 402** + **lesson L-V09**.
> Branch n�y **kh�ng xo� 1 d�ng code**; n� ch? s?a t�i li?u + ghi lesson.
# IMPLEMENTATION PLAN — W0.2 XOÁ CODE CHẾT THẬT (44 route / 841 dòng)

**Agent:** `w0-2-dead-code` · **Branch:** `feat/w0-2-dead-code` -> `dev`
**Base:** `origin/dev` @ `f9b2d607e` · **Worktree:** `C:\Mujoco Projects\agent-w0-2`
**Nguồn:** `docs/ROADMAP_MASTER_2026Q4_2027.md` §4.2 W0.2 · `docs/MASTER_TRACKING_2026Q4.md` §6
**Lessons áp dụng:** L-001 L-002 L-003 L-007 L-008 L-M02 L-M05 L-M08 L-V01 L-V02 L-V04 L-G01 L-G02 L-G04 L-G05 L-G07 L-G08 L-T01 L-T02 L-A01

---

## 0. ĐÍNH CHÍNH TIỀN ĐỀ — audit trước (và bản 3 của roadmap) đã SAI

Roadmap §4.2 W0.2 ghi: *"Xoá code chết: `contracts/admin_ops` (2 126 LOC, 26 route) + `market_data/urls.py` (6) + `market_data/public_urls.py` (34) + `ops_audit/urls_parity.py` (4)"*.

**Đo lại bằng code thật (L-V02 — gốc rễ kế thừa phải có phản chứng) cho thấy `contracts/admin_ops` KHÔNG xoá được:**

| Bằng chứng | Nội dung |
|---|---|
| `vninvest_core/urls.py:77` | `re_path(r'^api/admin-ops/.*$', admin_ops_gone)` ⇒ **production** mọi `/api/admin-ops/*` trả **410 GONE** ⇒ phần `admin_ops` **không serve prod** |
| `tests/test_admin_ops_contract_api.py:55` | `@override_settings(ROOT_URLCONF='tests.urls_test_admin_ops')` ⇒ **test** dùng URLconf riêng `tests/urls_test_admin_ops.py:4` → `include('vninvest_core.contracts.admin_ops.urls')` ⇒ **26 route admin_ops CÒN SỐNG trong test** (740 dòng test) |
| **Vì sao audit báo sai** | Audit grep `"contracts.admin_ops"` (**có dấu chấm**) trong khi code include bằng **chuỗi** `'vninvest_core.contracts.admin_ops.urls'` ⇒ **0 hit giả** ⇒ kết luận "không được include" sai |

⇒ **`admin_ops` là code "chết ở prod, sống ở test"** — xoá = mất 740 dòng bằng chứng contract. **KHÔNG tự quyết** ⇒ tách khỏi scope, giao Owner (xem §4).

## 1. Scope (chỉ phần CHẮC CHẮN đúng — 0 hit thật)

Quét **855 file `.py`** (`src/` + `tests/`) bằng script, bỏ qua comment, tìm mọi tham chiếu thật:

| File xoá | Dòng | Route | Tham chiếu thật |
|---|---|---|---|
| `src/market_data/urls.py` | 14 | 6 | **0** |
| `src/market_data/public_urls.py` | 84 | 34 | **0** (cả 33 view nó trỏ tới đều được `core_urls.py` dùng ⇒ xoá url KHÔNG chết view) |
| `src/ops_audit/urls_parity.py` | 44 | 4 | **0** |
| `src/ops_audit/views_parity.py` | 293 | — | **0** (chỉ `urls_parity.py` import) |
| `src/ops_audit/models_parity.py` | 297 | — | **0** |
| `src/ops_audit/serializers_parity.py` | 109 | — | **0** |
| **TỔNG** | **841** | **44** | |

## 2. AC

1. `manage.py check` **PASS** (0 lỗi) trên VPS staging
2. **BE full suite** trên VPS staging: **3 468 test / failures=11 / errors=224 / skipped=7** — **khớp đúng baseline** ⇒ **0 hồi quy**
3. `pre-push-gate` **34 PASS / 0 FAIL**
4. `git diff --numstat`: deletions lớn hơn insertions là **đúng** (xoá file) — kiểm bằng `git diff --stat` cho thấy đúng 6 file bị xoá, **không** có file nào sửa bất thường (L-G05: cảnh báo khi deletions > dòng sửa — ở đây deletions = số dòng file bị xoá, **có chủ đích**)
5. Route count trong `src/**/urls*.py` **khớp** URLconf thật sau khi xoá

## 3. Non-goals

- **KHÔNG** xoá `contracts/admin_ops` (2 470 dòng) + 2 file test (740 dòng) + `tests/urls_test_admin_ops.py` ⇒ **cần Owner chốt** (giữ bằng chứng contract hay xoá cả 3 210 dòng)
- **KHÔNG** đụng `market_data/views.py` hay `stock_mgmt_native_views.py` (33 view còn dùng bởi `core_urls.py`)
- **KHÔNG** sửa `ops_audit/envelope.py` (chỉ có comment mô tả `views_parity.py` — sau khi xoá, comment sẽ lỗi thời ⇒ ghi TODO trong ledger, sửa ở slice sau)

## 4. Việc giao Owner (tách khỏi scope)

| # | Câu hỏi |
|---|---|
| Q1 | `contracts/admin_ops` (2 470 dòng) + 740 dòng test: **giữ** (bằng chứng contract, dù production trả 410) hay **xoá cả 3 210 dòng**? |

## 5. Ghi chú thực thi

- **Docker local không khởi động được** ⇒ `new-agent.ps1` fail bước 2/7 (tạo DB) ⇒ tạo worktree **thủ công** (L-M05): branch + worktree + junction `node_modules` + `sh scripts/agent-install-hooks.sh` (verify `core.hooksPath=.githooks`).
- **Mọi test chạy trên VPS staging** theo `docs/STAGING_VPS_RUNBOOK.md` §12.3 (quy định cứng 2026-10-22) — **không** local Docker. Dọn: DB tạm **DROP** + worktree VPS **remove** + `node_modules` VPS **xoá** + `docker ps` xác nhận không còn container thử nghiệm.
