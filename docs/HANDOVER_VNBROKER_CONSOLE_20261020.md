# HANDOVER — VNBroker Console (tab quản trị nhà cung cấp dữ liệu thị trường)

> **Ngày:** 2026-10-20 · **Nhánh:** `feat/vnbroker-console` → `dev` · **Claim:** `vnbroker-console` (`docs/CLAIMS.md`)
> **Tài liệu gốc:** `docs/AUDIT_VNBROKER_CONSOLE_20261019.md` (Entry 384 audit · §J vòng 2)
> **Ledger:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` — Entry **384** (audit) · **385** (triển khai v1) · **386** (audit UI/UX vòng 2) · **387** (light theme — xem cuối)
> **Ảnh + số đo:** `docs/evidence/vnbroker-console/`

---

## 1. TÓM TẮT 1 DÒNG

Tab VNBroker trước đây **trông như hoạt động nhưng gần như mọi con số đều sai hoặc là số bịa** (apply mất 100% chỉnh sửa, bảng benchmark chết, circuit breaker luôn "CLOSED", throughput/error rate bịa, "thử nghiệm kết nối" luôn thành công). Nay đã **sửa hết ở cả FE lẫn BE**, dữ liệu hiển thị là **số đo thật từ runtime**, và console **đọc được ở cả dark lẫn light theme**.

---

## 2. NHẬT KÝ (timeline)

| # | Thời điểm | Việc | Kết quả |
|---|---|---|---|
| 1 | 2026-10-19 buổi sáng | Audit tab VNBroker (đọc code FE + BE, đọc schema, đọc i18n) | Tìm ra **8 lỗi P0 + 10 lỗi P1 + 7 lỗi P2**; audit cũ 2026-09-16 mới chỉ ghi 2 lỗi P2 ⇒ **thiếu sót** |
| 2 | 2026-10-19 | Ghi tài liệu `docs/AUDIT_VNBROKER_CONSOLE_20261019.md` + Entry 384 + lesson L-F11 | Owner duyệt 4 câu hỏi (Q1–Q4) |
| 3 | 2026-10-19 | Owner chốt: **Q1=B** (sửa BE) · **Q2=B** (health per-provider) · **Q3=C** (class + token mới) · **Q4=A** (giữ 9 tab) | Mở rộng claim |
| 4 | 2026-10-19 | **Slice 2 (FE)**: sửa 9 hàm adapter · viết lại panel 463→1089 dòng · i18n · CSS/token | 8 lỗi P0 đã đóng |
| 5 | 2026-10-19 | **Slice 3 (BE)**: tầng đo runtime + model `VnbrokerProviderHealth` + migration `0007` + circuit breaker thật + test-connection thật + endpoint `provider-health` | Config SOC **có hiệu lực runtime** (F-26) |
| 6 | 2026-10-19 | Deploy staging (theo **branch**, chưa merge `dev`) + chụp ảnh | Ảnh lộ **3 lỗi layout** + **form trống** |
| 7 | 2026-10-20 | **Audit vòng 2**: 2 UI agent (Accessibility Auditor · UI Designer) + skill `pbakaus/layout` + `jakubkrehel/better-interface` | 9 lỗi BE↔FE + 9 lỗi A11Y + 15 finding layout (đo pixel thật) |
| 8 | 2026-10-20 | Sửa layout + A11Y + BE↔FE (5 khối tải độc lập, timeout 30s, poll 60s, chặn trạng thái BE từ chối) | Đo lại: nút bằng nhau 0.01px, không tràn ngang, 0 console error |
| 9 | 2026-10-20 | **Light theme**: đo lại bằng script composite nền thật | Tìm ra nguyên nhân gốc **app-wide** (nền `body` vẫn tối) ⇒ khoá bảng màu tối cho console; light **0 FAIL** |

---

## 3. DANH SÁCH COMMIT

| Commit | Nội dung |
|---|---|
| `35ccd0827` | claim `vnbroker-console` (Slice 1, doc-only) |
| `c6531958e` | audit + Entry 384 + lesson L-F11 |
| `9cf90c38e` | mở rộng claim (Slice 2 FE + Slice 3 BE) |
| `037e81ca7` | **Slice 2 (FE)**: adapter 9 hàm + panel 6 vùng + i18n + CSS/token + 8 test |
| `911ea4582` | **Slice 3 (BE)**: tầng đo runtime + model + migration 0007 + circuit breaker + test-connection + endpoint mới + 14 test BE |
| `6b4c0b4ee` | đồng bộ `docs/system-design` (catalog model/API) |
| `95f9164f7` | ảnh evidence vòng 1 |
| `bbd2f09b9` | **audit vòng 2**: layout + A11Y + BE↔FE (3 yêu cầu Owner + 9 + 9) |
| `4b6924acd` | tách 5 khối tải + timeout 30s + vùng live + bỏ false dirty |
| `771f4d7a3` | ảnh evidence vòng 2 + §J + Entry 386 |
| `ab0cb4989` | light theme (v1 — hướng sai, đã bỏ ở commit sau) |
| `be91b239e` | **light theme (đúng)**: khoá bảng màu tối cho console |

---

## 4. FILE ĐÃ ĐỔI

### FE
| File | Thay đổi |
|---|---|
| `packages/web/src/adapters/core/soc.js` | 9 hàm VNBroker về 1 shape; thêm `getSocVnbrokerProviderHealth` + `getSocVnbrokerOwnership`; **xoá** `getSocVnbrokerMetrics` (số bịa) |
| `packages/web/src/components/soc/SocVnbrokerPanel.tsx` | viết lại 463 → 1089 dòng, 6 vùng, 5 khối tải độc lập, poll 60s, A11Y đầy đủ |
| `packages/web/src/components/soc/SocConfigPreviewModal.tsx` | thành `dialog` thật (role/aria-modal/Escape/focus) — file dùng chung |
| `packages/web/src/components/soc/SocTabNavigation.tsx` | tab đang chọn tự `scrollIntoView` |
| `packages/web/src/components/soc/soc.components.css` | **+** class `vnb*` (không sửa rule dùng chung) |
| `packages/web/src/components/soc/soc.tokens.css` | **+** `--vnb-tile-min`, `--vnb-kpi-min`, `--soc-status-*` |
| `packages/web/src/components/soc/socStatusColors.ts` | dùng token `--soc-status-*` (giá trị không đổi) |
| `packages/web/src/i18n/{vi,en}.js` | **+36** key, gộp 2 key trùng, dùng lại 13 key chết |
| `packages/web/src/components/__tests__/soc-vnbroker-console.component.test.tsx` | 8 → **12** test (mới) |
| `packages/web/src/adapters/core/__tests__/soc.test.js` | 13 test mới assert **shape** (không chỉ URL) + 1 test chặn hàm số bịa |

### BE
| File | Thay đổi |
|---|---|
| `packages/core/backend/src/market_data/vnbroker_provider_health.py` | **mới** (335 dòng): đo latency, ghi health row, circuit breaker open/half-open, probe provider thật, cầu nối config SOC → runtime |
| `packages/core/backend/src/market_data/models.py` | **+** `VnbrokerProviderHealth` |
| `packages/core/backend/src/market_data/migrations/0007_vnbrokerproviderhealth.py` | **mới** (số do `makemigrations` sinh) |
| `packages/core/backend/src/market_data/vnbroker_adapter.py` | đo latency thật, ghi health row, **bỏ qua provider khi mạch mở**, ưu tiên `preferred_provider` của config SOC, chuỗi fallback theo config |
| `packages/core/backend/src/service_ops/views/vnbroker.py` | circuit breaker + test-connection **thật**; **+** `VnbrokerProviderHealthView` |
| `packages/core/backend/src/service_ops/urls.py` | **+** route `vnbroker/provider-health/` |
| `packages/core/backend/src/service_ops/tests/test_vnbroker_console.py` | **mới** (14 test) |
| `packages/core/backend/src/market_data/tests/test_vnbroker_daily_history_guard.py` | cập nhật để kích hoạt kịch bản DNSE qua nguồn quyết định mới |

---

## 5. SỐ ĐO VERIFY (staging, đo bằng script, có control)

| Phép đo | Trước | Sau | Ngưỡng |
|---|---|---|---|
| 2 nút trong tile lệch rộng | 31px | **0.01px** | ≤ 1px |
| 3 tile hàng nút lệch cao độ | 70px | **0px** | ≤ 1px |
| Độ rộng input các nhóm lệch | 331px (4 bề rộng khác nhau) | **25.53px** | ≤ 32px |
| Tràn ngang 1680→430 | CÓ (769–860px) | **KHÔNG** (6/6 viewport) | không tràn |
| Panel hiện | ~60s (7 request chặn nhau) | shell 13.7s · form 20.8s | — |
| Console error | — | **0** | 0 |
| Contrast dark theme | — | **0 FAIL** (thấp nhất 7.28) | ≥ 4.5 |
| Contrast light theme | 3 FAIL (1.43 / 1.47 / 2.06) | **0 FAIL** (thấp nhất 7.28) | ≥ 4.5 |
| Dữ liệu provider trên staging | số bịa | `kbs healthy closed 70 req 0 fail` — **thay đổi giữa 2 lần chụp** (poll chạy) | số thật |

Bằng chứng: `docs/evidence/vnbroker-console/measure-result.json` · `contrast-light.json` · `contrast-dark.json` · 5 ảnh PNG.

---

## 6. GATE ĐÃ CHẠY THẬT

| Gate | Kết quả |
|---|---|
| `npx tsc --noEmit` | **PASS** (0) |
| `npx eslint` (file đã sửa) | **PASS** (0 error; warning `react/jsx-no-literals` cùng loại với các file JSX sẵn có) |
| `npx vitest run` (panel) | **12/12 PASS** (fail-before 8/8 trên panel cũ) |
| `jest soc.test.js` | **98/98 PASS** |
| BE `test service_ops.tests.test_vnbroker_console` | **14/14 PASS** |
| BE `test market_data + test_soc_tasks + test_vnbroker_console` | **219/219 PASS** |
| `npm run build` | **PASS** |
| `node scripts/i18n-scan-strict.mjs` | **PASS** (0) |
| `npm run check:contrast` | **PASS** (0) |
| `node scripts/check-lessons.mjs` | **PASS** (48/60 lesson) |
| `node packages/web/scripts/check-multi-agent.mjs` | **PASS** (0 lỗi) |
| `node scripts/normalize-eol.mjs` | **PASS** (0) |
| `node scripts/pre-push-gate.mjs` | **23 PASS / 0 SKIP / 0 FAIL** |
| `bash scripts/deploy-staging.sh --verify` (VPS) | **PASS** (6 container healthy, 0 crash-loop) |

### Lỗi **nền có sẵn** — đã chứng minh KHÔNG do slice này
| Lỗi | Bằng chứng |
|---|---|
| `npm run test`: 3 suite FAIL (`route-contract` · `field-contract` · `WorkstationLayout`) | **stash** 9 file của tôi → chạy lại trên base `e7b008f25` → FAIL **y hệt** 3 suite / 9 test (nguyên nhân `__dirname is not defined` trong file test) |
| BE `test market_data + service_ops`: 675 test, failures=3 errors=5 | 6 lỗi trong domain broker DNSE/SSI/TCBS → **stash phần BE + worktree riêng tại base** → FAIL y hệt |
| `npm run check:tokens` exit 1 | `brokerData.css #c4b5fd` — ngoài scope, đã ghi trong claim `pfmodalsurface` |

---

## 7. CÒN MỞ (cần Owner / ticket riêng)

| # | Việc | Mức | Vì sao không làm ở đây |
|---|---|---|---|
| 1 | **App light theme chưa hoàn thiện**: `index.css:53` `--color-bg-primary: #020617` không có override light + `body` dùng class `bg-gray-950` ⇒ **mọi** trang đều giữ nền tối ở light theme. Các surface đảo token sang sáng ⇒ chữ tối trên nền tối | **cao** | Sửa là **thay đổi thiết kế toàn app** (mọi trang) + blast radius rất lớn. Cần Owner quyết định. Console VNBroker đã tự khoá bảng màu tối nên đọc được; các surface SOC khác (BrokerHub · SocBroker · SocUsers) **vẫn còn** lỗi này ⇒ nên mở 1 ticket riêng |
| 2 | **PR chưa tạo** — branch `feat/vnbroker-console` đã push (12 commit) | thấp | Theo quy trình: PR mở khi Owner duyệt; **chưa merge `dev`** ⇒ staging đang chạy **branch**, không phải `dev` |
| 3 | E2E Playwright trong repo (`tests/visual/`) chưa viết spec cho console | thấp | Đã có script Playwright đo đầy đủ (đã lưu ngoài repo) + 12 test vitest; spec E2E chính thức là việc khác |
| 4 | 3 lesson mới (L-T03 `Edit` khớp mờ · L-T04 `git stash` đổi LF→CRLF · L-F11 đọc CSS đã build) đã ghi; **chưa** ghi lesson "timeout phải chọn từ số đo thật" | thấp | Là lỗi **quy trình** (tôi đoán số), không phải bẫy công cụ ⇒ ghi vào ledger 386 thay vì lesson |
| 5 | Benchmark **chưa có report** trên staging ⇒ mục "khuyến nghị" chưa chạy thật | thấp | Cần chạy benchmark thật (30s × provider × concurrency) — làm khi có nhu cầu |

---

## 8. TÁI LẬP (để người khác kiểm chứng)

```bash
# 1. Deploy branch lên staging (KHÔNG merge dev)
ssh -i "$HOME/.ssh/id_ed25519" root@14.225.255.47 \
  "cd /opt/vninvest && REPO_BRANCH=feat/vnbroker-console bash scripts/deploy-staging.sh"

# 2. Kiểm tra stack
ssh -i "$HOME/.ssh/id_ed25519" root@14.225.255.47 \
  "cd /opt/vninvest && bash scripts/deploy-staging.sh --verify"

# 3. Mở trang
#    https://docker.edusuccess.vn/operations-center?tab=vnbroker
#    (đăng nhập: testuser@vninvest.vn / TestPass123!  — xem packages/web/tests/visual/auth.setup.ts)

# 4. Chạy gate
cd packages/web
npx tsc --noEmit && npx vitest run src/components/__tests__/soc-vnbroker-console.component.test.tsx
node --experimental-vm-modules node_modules/jest/bin/jest.js --no-coverage src/adapters/core/__tests__/soc.test.js

# 5. BE test (cần Postgres)
export CORE_DATABASE_URL="postgresql://<user>:<pass>@127.0.0.1:5434/<db>"
export DJANGO_DEBUG=1 PYTHONIOENCODING=utf-8
cd packages/core/backend
python manage.py test service_ops.tests.test_vnbroker_console market_data -v 1
```

> ⚠ **Bẫy khi chạy script đo trên Windows**: `Out-File -Encoding utf8` của PowerShell 5.1 **thêm BOM** ⇒ commit message bắt đầu bằng `EF BB BF`. Dùng `node -e "fs.writeFileSync(p, msg, 'utf8')"` (xem lesson L-T03/L-T04).
> ⚠ **Bẫy khi chạy generator Python**: `print()` tiếng Việt có dấu ⇒ `UnicodeEncodeError` trên cp1252 ⇒ **phải set `PYTHONIOENCODING=utf-8`** (đã gặp khi sinh `docs/system-design`).

---

## 9. QUY TRÌNH ĐÃ TUÂN THỦ

- **Claim trước, sửa sau** — 3 dòng claim (audit → mở rộng → đóng), commit riêng, không đụng file của agent khác.
- **Không commit file shared** (`AGENTS.md`, `packages/web/package.json`, `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*`).
- **Migration**: không tự đặt số — để `makemigrations` sinh (`0007_vnbrokerproviderhealth`), head `0006` đọc từ thư mục thật.
- **Ledger**: 4 Entry (384/385/386/387), mỗi Entry 1 `## Entry N` riêng + số lấy từ `--next-entry` (không đoán).
- **Lessons**: 3 lesson mới (`docs/LESSONS/tooling-traps-2.md` L-T03/L-T04 · `docs/LESSONS/css-soc.md` L-F11) + `INDEX.md` + `SKILL.md`; `check-lessons` 0 lỗi (48/60).
- **Mọi khẳng định đo được**: có `file:line`, có bằng chứng chạy thật, có **control** cho script đo (L-V01), và **ảnh đã mở ra xem** (L-V05).
- **Lỗi của chính mình đã ghi nhận, không giấu**: (a) `Edit` tool khớp mờ làm hỏng 2 test BE; (b) timeout 12s đoán ⇒ mất dữ liệu ở 1 lần deploy; (c) `git stash` làm churn LF→CRLF 2 lần; (d) override light theme hướng sai (đã revert ở `be91b239e`).

---

## 10. VÒNG AUDIT CUỐI (2026-10-20, sau khi deploy tổng thể)

Audit lại **toàn bộ** công việc đã làm — không chỉ phần UI — bằng cách chạy lại từng gate trên đúng commit đã deploy, rồi đo lại trên staging.

### 10.1. Gate (chạy lại toàn bộ trên `6a127002e`)

| Gate | Kết quả | Ghi chú |
|---|---|---|
| `npx tsc --noEmit` | **0 lỗi** | |
| `npx vitest run` (toàn bộ) | **169 file / 1154 test PASS** | 2 test FAIL lúc đầu do **pin list i18n lỗi thời** (đã gỡ 2 mục) |
| `jest` (toàn bộ) | 18/21 suite PASS · **3 suite FAIL** | **y hệt bộ lỗi nền** đã chứng minh bằng worktree tại base `e7b008f25` |
| BE `manage.py test tests` (toàn bộ) | **1071 test** · 5 FAIL | **y hệt bộ lỗi nền** (`copilot provider removed` ×4 + `admin UI menu` ×1) |
| BE `test market_data + test_soc_tasks + test_vnbroker_console` | **219/219 PASS** | |
| `npm run build` | **PASS** | |
| `node scripts/i18n-scan-strict.mjs` | **0** | |
| `npm run check:contrast` | **PASS** (7 tone × 2 mode) | |
| `npm run check:tokens` | exit 1 | lỗi **nền**: `brokerData.css #c4b5fd` (ngoài scope) |
| `node scripts/check-lessons.mjs` | **0** (48/60 lesson, 12 file) | |
| `node packages/web/scripts/check-multi-agent.mjs` | **0 lỗi** | |
| `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | **PASS** (0 trùng mới) | |
| `node scripts/pre-push-gate.mjs` | **23 PASS / 0 SKIP / 0 FAIL** | |
| `bash scripts/deploy-staging.sh --verify` | **PASS** | 6 container healthy · 0 restart · mem 1–4% |

### 10.2. Số đo lại trên staging (sau deploy tổng thể)

| Phép đo | Kết quả | Ngưỡng |
|---|---|---|
| 2 nút trong tile lệch rộng | **0.01px** | ≤ 1px |
| 3 tile hàng nút lệch cao độ | **0px** | ≤ 1px |
| Độ rộng input các nhóm lệch | **25.53px** | ≤ 32px |
| Tràn ngang 1680 / 1280 / 1024 / 840 / 768 / 430 | **OK** cả 6 | không tràn |
| Badge dirty | 0 → 1 khi đổi provider chính | đúng |
| Checkbox dự phòng của provider chính | **khoá** (vci→kbs thì khoá chuyển sang vci) | đúng |
| `<select>` benchmark có label | **có** | có |
| Heading trong panel | **15** (h2/h3/h4) | ≥3 |
| `aria-label` nút trong tile | **6/6 khác nhau** | 6/6 |
| Console error | **0** | 0 |
| Contrast **light** theme | **0 FAIL** (thấp nhất 7.28) | ≥ 4.5 |
| Contrast **dark** theme | **0 FAIL** (thấp nhất 7.28) | ≥ 4.5 |
| Dữ liệu form trên staging | `preferred=kbs · rpm=60 · retry=3 · read=30s · burst=10 · cb=5` — **khớp config thật** | |
| Nhãn CB / health | `BÌNH THƯỜNG (CLOSED)` · `Hoạt động tốt` — **đã dịch** | |

### 10.3. Một lỗi do tôi phát hiện ở vòng audit cuối

`vitest` báo 2 FAIL ở gate **"nested duplicate keys are pinned"** — không phải lỗi mới mà là **hệ quả đúng** của việc tôi gộp 2 key trùng: danh sách `KNOWN_NESTED_DUPLICATES` vẫn pin `soc.vnbroker.benchmark_title` + `soc.vnbroker.reset_confirm` ⇒ phải gỡ 2 mục đó (đã làm, commit `6a127002e`). Đây là cơ chế gate hoạt động đúng: **ghi nhận việc sửa bằng cách bỏ mục khỏi pin list**, không nới gate.

### 10.4. Sự cố quy trình trong phiên (đã xử lý, ghi để không lặp lại)

| Sự cố | Xử lý |
|---|---|
| Agent `agent-infra-p0` **dùng cùng working tree** và switch branch giữa lúc tôi đang commit ⇒ commit handover của tôi rơi lên branch của họ, và file bị `git checkout` của họ **xoá khỏi disk** | Khôi phục bằng `git checkout <commit> -- <path>` (commit object còn nguyên), dùng `git branch -f` + `git reset --mixed` để **tách 2 branch mà không đụng file chưa commit của họ**. Đã xác nhận: `feat/vnbroker-console` = commit của tôi, `feat/agent-infra-p0` = `e4bf14eb2` của họ (nguyên vẹn) |
| `agent-sync.ps1` fail ở bước 5c với `OperationalError: connection timeout` | **Không phải lỗi code** — Docker Desktop đã tắt giữa chừng ⇒ Postgres không chạy. Khởi động lại Docker → chạy lại ⇒ BE test chạy được (1071 test, 5 FAIL nền) |
| `git stash push/pop` làm churn LF→CRLF (2 lần) | `node scripts/normalize-eol.mjs --fix` + kiểm `git diff --numstat` — đã ghi lesson **L-T04** |

---

## 11. LIÊN KẾT

- `docs/AUDIT_VNBROKER_CONSOLE_20261019.md` — tài liệu gốc (audit + §J vòng 2)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` — Entry 384 / 385 / 386 / 387
- `docs/CLAIMS.md` — claim `vnbroker-console`
- `docs/evidence/vnbroker-console/` — ảnh + JSON đo
- `docs/LESSONS/css-soc.md` (L-F11) · `docs/LESSONS/tooling-traps-2.md` (L-T03, L-T04)
- `docs/system-design/` — catalog model/API đã đồng bộ
