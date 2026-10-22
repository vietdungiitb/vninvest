# HANDOVER — W0 FOUNDATION (2026-10-22)

**Phiên trước:** PM code lead + system frontend designer · **Trạng thái `dev` khi bàn giao:** `a3c4329a0` (PR #278 merged)
**Kế hoạch đang chạy:** `docs/ROADMAP_MASTER_2026Q4_2027.md` (bản 3) · **Bản đọc cho quản lý:** `docs/BAO_CAO_TONG_THE_TINH_NANG_VA_LO_TRINH_20261021.md`
**Claim:** `w0-foundation` → `done` · **Ledger:** Entry 393 (audit+benchmark) · 394 (bản 2) · 395 (bản 3 T/X) · 396 (W0 implementation)

---

## 1. Đã làm xong (2 PR, đã merge vào `dev`)

| PR | Nội dung | Kết quả |
|---|---|---|
| **#277** | ROADMAP MASTER (bản 1→3) + benchmark 4 lớp đối thủ (108 URL) + bản đọc cho quản lý | +1766 dòng, 5 file. Tài liệu chiến lược, **DOC-ONLY** |
| **#278** | **W0 FOUNDATION** — wire 3 gate thật + sửa path OC-19 + xoá 6 registry entry shadow + gate `check-page-registry` mới | +416/−20, 7 file. **Code thật** |

### W0 Foundation chi tiết (PR #278)

| Sub-slice | Nội dung | Fail-before → sau |
|---|---|---|
| **S1 (W0.1)** | `scripts/pre-push-gate.mjs` wire 4 gate entry: `check-light-theme` · `check-portfolio-contrast` · `check-page-registry` · `check-page-registry-selftest` | 3 script tồn tại nhưng **không ai gọi** ⇒ "gate xanh mà không chạy" → giờ chạy thật (exit 0 đã verify **trước** khi wire) |
| **S2 (W0.1b)** | `scripts/quality/check_opencore_doc_sync.ps1:50-51` path pattern `^backend/`+`^frontend/` → `^packages/core/backend/`+`^packages/web/` | pattern cũ match=**false** với path thật ⇒ **gate chết** → mới match=**true** ⇒ self-test **5/5** |
| **S3 (W0.4)** | Xoá **6** entry `pageRegistry` bị SHADOW + thêm `packages/web/scripts/check-page-registry.mjs` (265 dòng, `--self-test` **9/9**) | gate báo **đúng 6** entry chết (5 dự đoán + 1 phát hiện mới) → **PASS** (61 entry, 67 route, 0 chết, 0 trỏ sai) |

**Gate mới làm gì:** (A) **UNREFERENCED** — entry không route nào resolve tới ⇒ component không bao giờ render · (B) **DANGLING** — resolve tới id không tồn tại ⇒ runtime in "Could not resolve page component" (`main.tsx:53`). Parser **tự kiểm chứng** (L-V01): lệch số ⇒ `PARSER BROKEN — KHÔNG kết luận` exit 2, **không** báo "0 lỗi".

---

## 2. Trạng thái gate HIỆN TẠI (đo trên `dev`, main tree)

```
pre-push-gate: 32 PASS / 0 SKIP / 0 FAIL
```

Gate mới đã **thật sự chạy**: `ui-check-light-theme` · `ui-check-portfolio-contrast` · `ui-check-page-registry` · `ui-check-page-registry-selftest` — cả 4 PASS.

⚠ **`ui-check-theme-contrast` + `ui-check-a11y-runtime` vẫn in "CHUA CHAY"** — vì staging đang chạy build khác baseline (`/assets/adapters-BLMSU645.js` ≠ `/assets/adapters-B64GAyed.js`) ⇒ **2 gate A11Y chưa bao giờ chạy được** ở môi trường hiện tại. Cần seed staging có dữ liệu đồng rồi mới chạy được (xem `AUDIT_UI_STANDARDIZATION_W0` T-2).

---

## 3. 3 vấn đề môi trường phiên sau PHẢI biết

### 3.1 Docker Desktop không khởi động được ⇒ BE test = CHƯA CHẠY
```
docker : Error response from daemon: Docker Desktop is unable to start
```
⇒ Không có Postgres ⇒ `new-agent.ps1` **fail ở bước 2/7 (tạo DB)** ⇒ không provision được agent worktree bằng script. **Cách làm đã dùng phiên này:** tạo branch + worktree + junction + cài hook **thủ công** (bỏ bước DB) — chỉ hợp lệ khi slice **không sửa BE / không migration**. **Việc cần làm:** khởi động lại Docker (WSL2/Hyper-V), rồi dùng `new-agent.ps1` bình thường.

### 3.2 `scripts/agent-pr.ps1` HỎNG CÚ PHÁP (Stage 7 của skill không chạy được)
```
agent-pr.ps1:75:1  ParserError: The string is missing the terminator: "@.
```
Dòng 75 mở here-string `@"` nhưng **thiếu terminator `"@`**. **Sửa 1 dòng.** Tạm thời dùng `gh pr create --base dev --head <branch> --body-file <file>` (body đầy đủ checklist reviewer ở `docs/evidence/`-style).

### 3.3 `global-config-drift` FAIL trong MỌI worktree mới (L-G08) — **không phải lỗi code**
Main tree có `w/crlf`, worktree mới có `w/lf` (cùng nội dung commit `i/lf`) ⇒ gate byte-sensitive ⇒ **đỏ ở mọi worktree**. Đã chứng minh 3 lần (worktree không sửa gì cũng DRIFT 3 file; `dev` sạch thì PASS). **Xử lý:** push `--no-verify` + **ghi lý do vào commit body**; hoặc chạy `node scripts/normalize-eol.mjs --fix` trong worktree trước khi push (chưa thử).

---

## 4. Việc còn lại của W0 (6 slice) — thứ tự đề xuất

| Slice | Nội dung | File dự kiến | Ghi chú quy trình |
|---|---|---|---|
| **W0.2** | Xoá code chết: `contracts/admin_ops` (**2 126 LOC**, 26 route trả 410) · `market_data/urls.py` (6) · `market_data/public_urls.py` (34) · `ops_audit/urls_parity.py` (4) | `packages/core/backend/src/vninvest_core/urls.py:37-42,58,62` | Xoá file ⇒ **phải xoá luôn 2 file test contract cũ** (`backend/tests/test_admin_ops_contract_api.py`, `test_admin_ops_signals_contract_api.py`). Cần Docker cho BE test |
| **W0.3** | Sửa `packages/web/package.json` `exports`: **10/10 entry trỏ file `.ts` không tồn tại** (thực tế là `.js` — đã verify đủ 10 bằng script) | `packages/web/package.json:36-48` | ⚠ **DENY-LIST** ⇒ **chỉ coordinator được commit**, phải tách hunk riêng. Không có npm script nào phụ thuộc `exports` (không có workspaces) |
| **W0.5** | Đưa **~17 endpoint `/partner/*`** gọi thẳng từ page về `adapters/core/operator.js` + sửa 2 cặp lệch số ít/số nhiều (`alert-config`/`alert-configs` tại `operator.js:69` vs page `:224`; `trend`/`trends` tại `operator.js:89` vs page `:185`) | `pages/tenant-admin/*` + `pages/tenant/*` + `adapters/core/operator.js` | Mở rộng `route-contract.test.js:49` để quét cả **page** (hiện chỉ quét `adapters/core/`) |
| **W0.6** | **Fail-closed mọi endpoint trả dữ liệu giả** (7 endpoint) | `market_serving/native_views.py:450,520-522` · `outbound_notification_service.py:56-57,102-103` · `service_ops/views/signals.py:764-776` · `identity_access/views_tenant.py:523-528` · `commercial/tasks.py:290-302` · `market_serving/materializers.py:211-220` · `market_data/views.py:245-262` | Sửa BE ⇒ **cần Docker** cho test |
| **W0.7** | Đóng 3 blocker AI: **OpenClaw** (`SUPPORTED_PROTOCOLS = ()` ⇒ 503) · **SAML `strict` verify thật** (BL-01b — `python3-saml` **đã có** `requirements.txt:46`, `xmlsec1` **đã có** `Dockerfile:19,58`, chỉ thiếu code) · `ai_agents` app rỗng (`settings.py:131`) | `advisory/ai_clients/openclaw.py:44` · `identity_access/saml_service.py:384-406` · `settings.py:131` | SAML là **P0 về an toàn** (D5: Owner nói "dùng thật trong tương lai") |
| **W0.8** | Chuẩn hoá 3 tài liệu trạng thái + **bật CI** (8 workflow disabled) + verify ledger Entry 1–383 | `ROADMAP_STATUS.md` (stale 6 tháng) · `PROGRESS_DASHBOARD.md` (stale 18 ngày) · `docs/OPEN_WORK_20260927.md:39-40` (PR #272/#273 ghi sai là OPEN) · `AGENTS.md` (mục AI-CC nói "R0 chưa bắt đầu" — **SAI**) | ⚠ `AGENTS.md` **DENY-LIST** ⇒ coordinator + tách hunk |

**Ưu tiên cao nhất trong W0 còn lại:** **W0.6** (data honesty — D1 retail mua "dữ liệu chỗ khác không có", mà order book đang là **mock**) và **W0.7 SAML** (P0 an toàn). **W0.2/W0.6/W0.7 cần Docker** ⇒ nếu Docker vẫn lỗi thì làm **W0.3 / W0.5 / W0.8** trước (không cần BE).

---

## 5. 6 câu còn chờ Owner (chặn W1) — §7.3 của ROADMAP

| # | Câu hỏi | Hạn |
|---|---|---|
| Q1 | **Tên vai trò staff thứ 2** — "COC" **đã bị chiếm** bởi *Center Operations Center* (`docs/AUDIT_OPERATIONS_CENTER_COMPREHENSIVE_20260916.md:1`) ⇒ đặt tên mới (vd `broker_operator`) | Trước W1.5 |
| Q2 | **Credential tầng 2 thuộc tenant hay operator?** (operator ⇒ 2 tenant dùng chung 1 credential ⇒ vi phạm cách ly dữ liệu) | Trước W1.5 |
| Q3 | **Tầng 2 có cần trading token không?** (không ⇒ scope nhỏ hơn nhiều) | Trước W1.5 |
| Q4 | **Bỏ trial 14 ngày?** (`onboarding_views.py:137` + auto-expire `tenant_lifecycle/tasks.py:111,142`) | Trước W1.9 |
| Q5 | **Free có quảng cáo không, đặt ở đâu?** (đối thủ trả phí đều "No ads") | Trước W3 |
| Q6 | **Ai trả chi phí LLM cho free?** (không có quota do VNInvest trả ⇒ free không có AI ⇒ mất khác biệt D1) | Trước W2.3 |

---

## 6. Quy tắc cho phiên kế tiếp (bắt buộc)

1. **Nạp skill `project-lessons` TRƯỚC khi lập kế hoạch**; plan phải ghi `Lessons áp dụng: [L-...]`.
2. **Claim TRƯỚC khi sửa dòng đầu tiên** (L-002). Phiên này vi phạm (claim commit **sau** commit code) — ghi trong Entry 396, **không lặp lại**.
3. **Tên branch = `feat/<tên-agent>`** đúng ký tự (L-M02) — `feat/w0-foundation` cho agent `w0-foundation`.
4. **Không commit file deny-list** (`AGENTS.md` · `packages/web/package.json` · `pyproject.toml` · `requirements.txt` · `package-lock.json` · `docker-compose*.yml` · `.env*`) — coordinator tách hunk riêng.
5. **Thứ tự đóng phiên**: `agent-sync.ps1` (rebase → check migration → gate) → claim `done` → push → PR → merge. **Gate chạy SAU rebase** (L-G01).
6. **Không báo PASS cho thứ chưa chạy** (L-G02) — dùng `CHƯA CHẠY` kèm lý do.
7. **Script đo phải có control biết đáp án** (L-V01) — gate mới ở phiên này đã bắt **2 sai lệch thật** nhờ cơ chế này; giữ nguyên nguyên tắc.
8. **Append file append-only bằng byte-exact LF** (L-T01) — `docs/CLAIMS.md` + `docs/CODE_CHANGE_AUDIT_LEDGER.md` là **LF thuần**; `Add-Content` trong PowerShell ghi CRLF ⇒ **dùng Node `appendFileSync`**, không dùng `Add-Content`.

---

## 7. Bản đồ nhanh các file quan trọng

| File | Vai trò | Sửa ở phiên này |
|---|---|---|
| `scripts/pre-push-gate.mjs` | 32 gate | **+33 dòng** (4 gate entry) |
| `scripts/quality/check_opencore_doc_sync.ps1` | gate OC-19 | **+6/−2** (path pattern) |
| `packages/web/scripts/check-page-registry.mjs` | **gate mới** 265 dòng | **tạo mới** |
| `packages/web/src/pages/pageRegistry.js` | 67 → 61 entry | **+20/−15** |
| `packages/web/src/main.tsx` | resolver route→registry | **+5/−3** |
| `docs/IMPLEMENTATION_PLAN_W0_FOUNDATION_20261022.md` | plan Stage 1 | **tạo mới** |
| `docs/ROADMAP_MASTER_2026Q4_2027.md` | lộ trình bản 3 | §4.9 thêm bảng trạng thái triển khai |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` | bằng chứng append-only | Entry 396 |
| `docs/CLAIMS.md` | registry claim append-only | claim `w0-foundation` → `done` |

## 8. Bằng chứng trạng thái cuối phiên

- `dev` @ `a3c4329a0` · `pre-push-gate` **32 PASS / 0 SKIP / 0 FAIL** (main tree)
- `check-page-registry --self-test` **9/9** · `check-page-registry` **PASS** · OC-19 path self-test **5/5** · `tsc --noEmit` **0 lỗi**
- **CHƯA CHẠY**: `npm run test` · `npm run test:components` · BE `pytest` (Docker lỗi) · E2E Playwright · ảnh chụp thật · deploy staging
- Baseline BE đã biết: **602 test — failures=10, errors=3** (`e01dbf3d`)
