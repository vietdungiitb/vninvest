# IMPLEMENTATION PLAN — W0 FOUNDATION (W0.1 + W0.1b + W0.4)

**Agent:** `w0-foundation` · **Branch:** `feat/w0-foundation` -> `dev`
**Base:** `origin/dev` @ `bd3c33df2` (PR #277 merged) · **Worktree:** `C:\Mujoco Projects\agent-w0-foundation`
**Nguồn:** `docs/ROADMAP_MASTER_2026Q4_2027.md` §4.2 (W0.1 · W0.2) + §4.3 (W0.4) + `docs/BAO_CAO_TONG_THE_TINH_NANG_VA_LO_TRINH_20261021.md` §4
**Lessons áp dụng:** L-V01 (script đo phải có **control** biết đáp án) · L-V02 (gốc rễ kế thừa phải có phản chứng) · L-V04 (assert giá trị thật) · L-G02 (không báo PASS cho thứ chưa chạy) · L-G04 (số đếm tách mức độ) · L-G05 (`deletions` bất thường = dừng) · L-G07 (đếm route theo **registry**) · L-T01 (append byte-exact LF) · L-T02 (citation đúng file + dòng) · L-M02 (tên branch = `feat/<tên-agent>`) · L-002 (khai claim **trước** khi sửa dòng đầu tiên)

---

## 0. Bối cảnh — vì sao W0 đứng trước mọi thứ

Ledger Entry 391 + audit bản 3 phát hiện **3 gate "false-green"**: gate tưởng chạy thực tế không chạy. Hệ quả: **mọi báo cáo "PASS" của các wave sau là không kiểm chứng được** ⇒ phải chặn trước khi làm thêm bất cứ việc gì khác (nguyên tắc M0 = W0 xanh).

## 1. Scope chính xác (3 sub-slice)

### S1 — W0.1: wire 2 gate đang tồn tại nhưng không được gọi

| Mục | Chi tiết |
|---|---|
| **Vấn đề** | `packages/web/scripts/check-light-theme.mjs` (tạo ở Entry 391 T3) **không** được gọi từ `scripts/pre-push-gate.mjs` (520 dòng, grep literal `light-theme` = **0 hit**). `check-portfolio-contrast.mjs` cũng vậy (mồ côi). Cả hai là gate **tuyệt đối** (không baseline-locked) ⇒ exit != 0 = FAIL thật. |
| **Bằng chứng thiếu** | `scripts/pre-push-gate.mjs:450-495` — vòng lặp gate UI chỉ liệt kê 5 gate: `check-token-conflict`, `check-heading-contract`, `check-focus-ring`, `check-theme-contrast`, `check-a11y-runtime`. Không có `light-theme`. |
| **Control (L-V01)** | Chạy **cả 2 gate** trước khi wire: `check-light-theme` → exit **0** ("227 mau / 424 file · OK - moi mau deu duoc phu o light mode"); `check-portfolio-contrast` → exit **0** ("12 cap × 2 theme >= 4.5:1"). ⇒ wire **không** tạo cổng đỏ giả. Nếu 1 trong 2 exit != 0 ⇒ **dừng, không wire** (gate sẽ chặn push ngay). |
| **Sửa** | `scripts/pre-push-gate.mjs` — thêm 1 khối mới **sau** vòng lặp gate UI (`:495`), **trước** phần tổng kết (`:497`). Tách riêng khỏi vòng lặp baseline-locked vì 2 gate này **không** có file baseline JSON ⇒ không được gộp vào cùng nhóm (vòng lặp đó gọi `skip` khi thiếu file). Xử lý `CHUA CHAY` khi script không spawn được (timeout) giống hệt pattern của vòng lặp UI (`:474-477`) để **timeout ≠ FAIL** (không có bằng chứng để kết luận). |
| **AC** | ① `pre-push-gate` in ra **2 dòng mới** `ui-check-light-theme` + `ui-check-portfolio-contrast` ② grep `light-theme` trong `pre-push-gate.mjs` ≥ 1 hit ③ fail-before: xoá 1 dòng token trong `packages/web/src/theme/light-theme.css` ⇒ gate **FAIL** ⇒ phục hồi ⇒ PASS |
| **Non-goals** | Không sửa `packages/web/scripts/check-light-theme.mjs` hay `check-portfolio-contrast.mjs` (chúng đã đúng). Không thêm npm script (deny-list). |

### S2 — W0.1b: OC-19 doc-sync gate chết vì match path legacy

| Mục | Chi tiết |
|---|---|
| **Vấn đề** | `scripts/quality/check_opencore_doc_sync.ps1:50-51` match `^backend/…` và `^frontend/…`. Repo **không còn** 2 thư mục đó (đã chuyển monorepo `packages/core/backend/…` + `packages/web/…`) ⇒ **không file nào match** ⇒ gate **luôn PASS** (false-green). |
| **Bằng chứng** | `scripts/quality/check_opencore_doc_sync.ps1:50-51` (2 pattern) — đối chiếu `packages/core/backend/src/` và `packages/web/src/` đều **KHÔNG** khớp `^backend/` hay `^frontend/`. |
| **Sửa** | `:50` → `^packages/core/backend/.*(opencore|entitlement|quota|trial|grace|feature_gate|pricing|package|subscription|billing|plan)`; `:51` → `^packages/web/.*(...)` (giữ nguyên danh sách keyword). |
| **AC** | ① Self-test: đường dẫn `packages/core/backend/src/commercial/plan_catalog.py` ⇒ `$requiresGate = $true`; đường dẫn `packages/web/src/pages/…` với keyword ⇒ `$true`; đường dẫn không liên quan (vd `docs/ROADMAP_STATUS.md`) ⇒ `$false` ② fail-before: trước khi sửa, cả 3 case trên đều `$false` (gate chết) |
| **Non-goals** | Không đổi phần còn lại của script (T2/T3/T4, `$mustAlways`). Không thêm script mới. |

### S3 — W0.4: 5 entry page-registry bị shadow + gate chống tái phát

| Mục | Chi tiết |
|---|---|
| **Vấn đề** | `packages/web/src/pages/pageRegistry.js` chứa 5 entry **không bao giờ được resolve**: `dashboard` (`:196-197`), `transactions` (`:198-199`), `watchlist` (`:200-201`), `portfolios` (`:202-203`), `settings` (`:206-207`). Lý do: `packages/web/src/main.tsx:22-49` (`resolvePageComponent`) map routeId ⇒ registryId **khác**: `dashboard→core-dashboard` (`:24`), `watchlist→core-watchlist` (`:27`), `transactions→core-transactions` (`:28`), `portfolios→portfolio-workspace` (`:32`), `settings→core-user-settings` (`:49`). ⇒ 5 entry + component của chúng là **code chết trong registry**. |
| **Bằng chứng** | Đọc `main.tsx:22-49` — không nhánh nào trả về `dashboard`/`transactions`/`watchlist`/`portfolios`/`settings` làm `registryId`. Đối chiếu `pageRegistry.js:176-250`. |
| **Sửa** | ① Xoá 5 khối `makePageEntry(...)` tương ứng trong `pageRegistry.js` ② Thêm gate mới `packages/web/scripts/check-page-registry.mjs` |
| **Gate mới — cách kiểm** | **Không parse bằng regex** (L-V01): script `import()` runtime 2 module ESM `packages/web/src/app/routeCatalog.js` + `packages/web/src/pages/pageRegistry.js` để lấy id thật, rồi đối chiếu với **nguồn sự thật thứ 3** = `packages/web/src/main.tsx` (string literal `registryId = '…'` / `resolvePageComponent('…')`). Với mỗi registry id, hỏi: "id này có xuất hiện như literal trong `main.tsx` không?" Không ⇒ **unreferenced** ⇒ FAIL. |
| **Control (L-V01)** | Trước khi xoá 5 entry, gate **phải báo đúng 5** (không phải 0, không phải 20) — đó là đáp án biết trước. Sau khi xoá ⇒ **0**. Ngoài ra gate có `--self-test`: tự tạo 2 case (1 file giả có 1 entry không ai dùng ⇒ phải báo; 1 file giả với 1 entry được dùng ⇒ không báo) ⇒ chứng minh gate **thật sự bắt lỗi**, không phải tautology. |
| **Non-goals** | **KHÔNG** xoá 5 file `Shell*Page.tsx` (837 LOC): chúng còn được export công khai tại `packages/web/src/index.js:22-26` **và** `packages/web/scripts/check-shell.mjs:38-43` import từ đó ⇒ xoá file sẽ phá import của script còn lại. Việc dọn file + API `src/index.js` là **slice riêng** (cần quyết định public API của package) ⇒ ghi vào handoff. Cũng **không** đụng `ShellSupportPage` / `ShellAiCommandCenterPage` (đã có quyết định riêng tại `pageRegistry.js:208-220`) và **không** đụng `portfolios-broker` (còn test sống tại `pages/broker/__tests__/BrokerHubRedirect.component.test.tsx:19,30-31`). |

## 2. File dự kiến sửa (claim)

| File | Loại | Vì sao |
|---|---|---|
| `scripts/pre-push-gate.mjs` | SỬA | wire 2 gate |
| `scripts/quality/check_opencore_doc_sync.ps1` | SỬA | path pattern legacy |
| `packages/web/src/pages/pageRegistry.js` | SỬA | xoá 5 entry shadow |
| `packages/web/scripts/check-page-registry.mjs` | **TẠO MỚI** | gate chống tái phát (+ `--self-test`) |

**KHÔNG chạm file deny-list** (§2 protocol): `AGENTS.md` · `packages/web/package.json` · `pyproject.toml` · `requirements.txt` · `package-lock.json` · `docker-compose*.yml` · `.env*`.
⇒ Vì `packages/web/package.json` **không** được chạm, gate mới **không có npm script**; nó được gọi trực tiếp từ `scripts/pre-push-gate.mjs` (file không nằm trong deny-list).

## 3. Rủi ro & kế hoạch giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Wire gate đang đỏ ⇒ chặn push vô í | **Control bắt buộc**: chạy cả 2 gate trước khi wire; exit != 0 ⇒ **dừng** |
| Gate mới là tautology (luôn PASS) | `--self-test` với **2 case** (1 phải báo, 1 phải không báo) + fail-before trên repo thật (phải báo đúng 5) |
| Xoá entry làm hỏng route | Mọi route đều đi qua `resolvePageComponent` (`main.tsx:22-57`); sau khi xoá, `tsc` + `vitest` + route contract test phải xanh |
| Số liệu "5 entry" sai (audit có thể đã lỗi thời) | **L-V02**: đọc `main.tsx:22-49` bằng mắt + script, **không** tin báo cáo cũ. Nếu script báo ≠ 5 ⇒ **dừng và đính chính plan** |
| `deletions` bất thường (L-G05) | `git diff --numstat` sau mỗi lần sửa; deletions phải ≤ số dòng sửa |

## 4. Cổng chất lượng (Stage 6)

`node scripts/pre-push-gate.mjs` (kỳ vọng **≥30 PASS**) · `node scripts/check-lessons.mjs` · `node packages/web/scripts/check-multi-agent.mjs` · `npx tsc --noEmit` (packages/web) · `npm run lint` (packages/web) · `npm run test:components` (packages/web) · `node packages/web/scripts/check-page-registry.mjs --self-test` · `node packages/web/scripts/check-light-theme.mjs` · `node packages/web/scripts/check-portfolio-contrast.mjs`

**CHƯA CHẠY (ghi rõ, không suy ra)**: BE `pytest` (Docker Desktop **không khởi động được** ⇒ không có Postgres ⇒ không tạo được DB riêng cho agent) · E2E Playwright · ảnh chụp thật · deploy staging.

## 5. Non-goals toàn phiên

- Không đụng BE (`packages/core/backend/**`) ⇒ **không migration** ⇒ không có rủi ro trùng số migration.
- Không sửa `AGENTS.md` (deny-list) ⇒ mục W0.8 của ROADMAP **giữ nguyên cho phiên sau**.
- Không sửa `packages/web/package.json` (deny-list) ⇒ **W0.3 (sửa `exports` 10/10 trỏ file `.ts` không tồn tại) giữ nguyên cho phiên sau** — ghi vào handoff.
- Không deploy staging, không merge vào `dev` trực tiếp.
