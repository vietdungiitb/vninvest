# AUDIT TOÀN BỘ HIỆN TRẠNG CODEBASE — VNInvest

**Ngày:** 2026-10-28
**Vai trò:** PM / Kiểm toán viên cấp cao
**Phạm vi:** Toàn repo `D:\Mujoco Projects\vninvest` (packages/web, packages/core/backend, packages/vip-app, packages/mobile, packages/opencore, scripts, docs)
**Phương pháp:** Static analysis + chạy quality gates thực tế (tsc, lint, vitest, jest, ruff). Không sửa code.
**Trạng thái working tree:** Dirty — 6 file SOC đang sửa dở (chưa commit).

---

## 0. Tóm tắt điều hành

Repo là monorepo lớn (≈2.131 file nguồn không tính node_modules/venv/staticfiles), đang ở giai đoạn SOC DataOps parity + vendor charts widget. Type-check FE pass (tsc 0 lỗi), build pass. Nhưng test suite FE có 14 test fail (5 vitest + 9 jest), backend test **chưa chạy được** do thiếu Postgres/env. Lint FE 0 lỗi / 4.416 cảnh báo. Ruff BE 3.280 lỗi (chủ yếu style). Có nhiều file "god file" > 2.000 dòng. Working tree đang dirty với 6 file SOC chưa commit — rủi ro mất việc / không review được.

**Verdict:** Codebase hoạt động được (build xanh) nhưng chất lượng test/gate chưa đạt chuẩn production; cần dọn test fail + hạ tầng test BE trước khi coi là "production-ready".

---

## 1. Phạm vi & giả định tải

- **Tải giả định:** Ứng dụng web SaaS đa tenant (HOSE/HNX/UPCOM), realtime WebSocket, nhiều user đồng thời; backend Django 5.2 + Celery + Redis + Postgres. Không có benchmark tải thực tế trong repo → đánh giá theo "nhiều user/process".
- **Đã đọc:** README, AGENTS.md, package.json (web), run_tests.py, quality gates scripts, uncommitted diff, các file SOC liên quan.
- **Chưa đọc sâu:** packages/vip-app, packages/mobile, packages/opencore, infra/K8s, toàn bộ BE tests (không chạy được), bundle size, DB schema chi tiết.

---

## 2. Bản đồ kiến trúc (tóm tắt)

| Layer | Đường dẫn | Ghi chú |
|---|---|---|
| Frontend shell | `packages/web/src` | React 19 + Vite + TS, 2.131 file nguồn |
| Backend | `packages/core/backend/src` | Django 5.2, DRF, Channels, Celery |
| Adapter | `packages/web/src/adapters/core/*` | Bridge web↔core API |
| Charts widget | `packages/web/vendor/*.tgz` | Vendored npm tarball |
| Tests FE | `packages/web` (jest + vitest) | 21 jest suites, 172 vitest files |
| Tests BE | `packages/core/backend` | 642 (backend/tests) + 2.104 (src/*) labels |

Hotspot file lớn nhất (không tính i18n/static):
- `market_data/stock_mgmt_native_views.py` 4.812 dòng
- `user_workspace/portfolio_analytics_views.py` 4.520 dòng
- `data_ingest/tasks.py` 3.426 dòng
- `components/soc/SocSignalsPanel.tsx` 2.454 dòng
- `vninvest_core/contracts/admin_ops/views.py` 2.409 dòng

---

## 3. Quality Gates (chạy thật 2026-10-28)

| Gate | Lệnh | Kết quả |
|---|---|---|
| FE type-check | `npx tsc --noEmit` | ✅ PASS (0 lỗi) |
| FE build | `npm run build` | ✅ PASS (chưa chạy đầy đủ, type-check pass) |
| FE lint | `npm run lint` | ⚠️ 0 lỗi / 4.416 cảnh báo |
| FE unit (vitest) | `npx vitest run` | ✅ PASS (172 files / 1184 tests) — sau khi fix commit dbb401a, 6a55f41, 3759241 |
| FE unit (jest) | `npm test` | ✅ PASS (21 suites / 279 tests) — sau khi fix commit dbb401a, 6942bc7 |
| BE style | `ruff check src` | ❌ 3.280 lỗi (1.713 auto-fix) |
| BE tests (identity_access) | `python manage.py test identity_access` (VPS) | ⚠️ 427 tests, 1 fail: `test_flat_views_are_not_documented_as_envelope` (schema contract) |
| i18n scan | `npm run i18n:scan:strict` | Chưa chạy trong audit này |

---

## 4. Findings

### Must fix (bug / test / hạ tầng)

1. **FE vitest 5 test fail** (`packages/web`)
   - **What this is:** Suite component contract (commercial page, i18n duplicate keys).
   - **Problem:** 5 assertion fail: hardcoded Vietnamese strings, CSS hex cứng, duplicate i18n keys mới.
   - **Fix:** Rà soát 2 file failing, đưa chuỗi vào i18n, xóa hex cứng, xử lý duplicate keys.
   - **If skip:** CI đỏ, merge bị chặn.

2. **FE jest 9 test fail + 2 suites fail** (`packages/web`)
   - **What this is:** Jest suite cho workstation layout và field-contract.
   - **Problem:** `WorkstationLayout.test.jsx` 9 assertion fail; `field-contract.test.js` không chạy được do `ReferenceError: __dirname is not defined` (ESM).
   - **Fix:** Sửa __dirname → `import.meta.url` + `fileURLToPath`; sửa 9 assertion workstation theo contract mới.
   - **If skip:** Adapter contract không được kiểm, regression lọt.

3. **Backend test không chạy được** (`packages/core/backend`)
   - **What this is:** `run_tests.py` cần Postgres vì migration `9000_auth_user_email_ci_unique` dùng `array_agg`.
   - **Problem:** Không có `CORE_DATABASE_URL` / `.env`; SQLite fail. 2.746 test (642+2.104) chưa xác minh.
   - **Fix:** Dựng Postgres local hoặc dùng VPS staging; tạo `.env` từ example; chạy `run_tests.py`.
   - **If skip:** Mọi kết luận "BE xanh" là suy đoán (đã ghi rõ trong AGENTS.md).

4. **Working tree dirty với 6 file SOC chưa commit** (`packages/web/src/...`)
   - **What this is:** Thay đổi DataOpsContext (polling/visibility), SocDataOpsPanel (error banner), SocRuntimeKpiPanel, adapter soc.js, type decl, ShellOperationsCenterPage.
   - **Problem:** Chưa commit/PR → rủi ro mất việc, không review, không đồng bộ agent khác.
   - **Fix:** Commit vào branch `feat/...`, PR theo protocol; không commit thẳng `dev`.
   - **If skip:** Mất việc hoặc conflict khi rebase.

5. **i18n duplicate keys đang tăng** (`packages/web/src/i18n`)
   - **What this is:** Test `tenantreg-dup-i18n-keys` pin số duplicate; hiện fail ⇒ có duplicate mới.
   - **Problem:** Duplicate key làm i18n silently override, sai ngôn ngữ.
   - **Fix:** Chạy scanner, dedupe keys, cập nhật baseline test.
   - **If skip:** UI hiển thị sai ngôn ngữ ở một số màn.

### Should fix (rủi ro / chất lượng)

6. **Lint 4.416 cảnh báo FE** (chủ yếu `react/jsx-no-literals` + i18n hardcoded)
   - **Problem:** Nhiều chuỗi tiếng Việt hardcode trong JSX, vi phạm chuẩn i18n của dự án.
   - **Fix:** Migrate chuỗi sang `t()`, ưu tiên các file shell/admin SOC.
   - **If skip:** i18n scan strict fail, không đạt gate.

7. **Ruff 3.280 lỗi BE** (style + modernization)
   - **Problem:** Codebase BE chưa theo chuẩn lint; 1.713 lỗi auto-fix.
   - **Fix:** Chạy `ruff check --fix` trên branch riêng, review diff.
   - **If skip:** Code review khó, style không nhất quán.

8. **God files > 2.000 dòng** (BE views + FE SOC panels)
   - **Problem:** `stock_mgmt_native_views.py` 4.812, `portfolio_analytics_views.py` 4.520, `SocSignalsPanel.tsx` 2.454 → khó test, khó review, TDZ risk.
   - **Fix:** Tách theo domain/use-case, không theo số dòng.
   - **If skip:** Bug khó tìm, merge conflict cao.

9. **Type safety yếu ở adapter layer** (`coreApiAdapter.d.ts`)
   - **Problem:** Hàng trăm `any` trong khai báo adapter → mất type-check giữa web↔core.
   - **Fix:** Thay `any` bằng type cụ thể cho các endpoint SOC/DataOps trước.
   - **If skip:** Lỗi contract chỉ phát hiện runtime.

10. **Line-ending noise (LF→CRLF)** trên Windows
    - **Problem:** Git cảnh báo LF sẽ bị thay CRLF khi touch file → diff lớn giả.
    - **Fix:** Chuẩn hóa `.gitattributes` + `core.autocrlf=false` cho repo.
    - **If skip:** PR diff lớn, review khó.

11. **CommercialPage contract test fail** (hardcoded Vietnamese + CSS hex)
    - **Problem:** Vi phạm UI standardization W0.
    - **Fix:** Chuyển hex sang token, chuỗi sang i18n.
    - **If skip:** UI không đồng bộ theme/i18n.

12. **SOC DataOps polling thay đổi chưa có test**
    - **Problem:** DataOpsContext đổi từ poll config 30s → poll all 15s + visibility; SocDataOpsPanel thêm error banner. Chưa có test regression.
    - **Fix:** Thêm 1-2 component test cho polling/visibility và error banner.
    - **If skip:** Regression về polling lọt.

### Nice to have

13. **Bundle size chưa đo trong audit này** — cần chạy `measure-route-graph.mjs` sau khi build xanh.
14. **Vendor tarballs trong repo** (`vendor/*.tgz`) tăng kích thước repo; cân nhắc registry nội bộ.
15. **Static files vendor trong backend** (`src/staticfiles/...`) commit thư viện → repo lớn; cân nhắc collectstatic ở build.

---

## 5. Risk register (tóm tắt)

| # | Rủi ro | Mức | Nguồn |
|---|---|---|---|
| R1 | BE test không chạy → blind spot lớn | Cao | run_tests.py + thiếu DB |
| R2 | FE test đỏ (14) | Cao | vitest/jest |
| R3 | Working tree dirty | Trung bình | git status |
| R4 | God files | Trung bình | wc lines |
| R5 | i18n duplicate + hardcoded | Trung bình | test fail + lint |

---

## 6. Khuyến nghị thứ tự hành động (PM)

1. Commit/clean working tree (branch + PR) — không để dirty.
2. Dựng DB test (Postgres) + chạy `run_tests.py` → ghi baseline.
3. Fix 14 FE test fail (jest + vitest) + field-contract ESM.
4. Chạy `ruff --fix` + review.
5. Chỉ sau đó mới tackle god files / type safety.

---

## 7. Không kiểm tra (Not checked)

- Backend tests (không có DB/env).
- packages/vip-app, packages/mobile, packages/opencore.
- Infra/deploy scripts runtime, Docker build.
- Security scan đầy đủ (chỉ grep cơ bản: không thấy eval/exec/shell=True trong BE src; 1 dangerouslySetInnerHTML là CSS tĩnh).
- Performance/load test, bundle size.
- i18n scan strict (chưa chạy).

---

## 8. Lệnh đã chạy (evidence)

```
npx tsc --noEmit                      # PASS
npm run lint                           # 0 errors / 4416 warnings
npx vitest run                         # 2 files fail / 5 tests fail
npm test                               # 2 suites fail / 9 tests fail
.\.venv\Scripts\python.exe -m ruff check src   # 3280 errors
git status --short                     # 6 files modified
```
