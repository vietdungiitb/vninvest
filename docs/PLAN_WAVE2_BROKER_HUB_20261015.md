# KẾ HOẠCH THỰC THI WAVE 2 — Broker Hub UI (một chu trình khép kín)

- **Ngày:** 2026-10-15 · **Người lập:** PM (toàn quyền, quyết định dưới đây là chốt, không hỏi lại)
- **Phạm vi:** B2.1 → B2.7 (PLAN mục 4) · **Ước lượng:** ~9 ngày · **Lực lượng:** 2 agent song song + PM hợp nhất
- **SCOPE (file):** §1 bảng Owner + claim `mbw2-hub`/`mbw2-data` ở Pha 0. Ngoài bảng ⇒ báo PM, không tự mở rộng.
- **LIMIT:** sửa plan tối đa 3 vòng audit (đã dùng 1: NEED_REVISION 2026-10-15); thực thi: mỗi step lỗi retry tối đa 3 lần rồi ghi blocker. Quá LIMIT ⇒ trả partial, không loop lấy xanh.
- **Non-goals (không làm):** sửa BE · migration mới · đụng `package.json`/checker config (deny-list) · đụng orderTicket/legacy DNSE trading · đổi màu tăng/giảm · đồng bộ watchlist 2 chiều.
- **Lessons áp dụng:** [L-001, L-002, L-003, L-006, L-008, L-A01, L-G01, L-G02, L-G03, L-G04, L-G07, L-G08, L-V02, L-V03, L-F01, L-F03, L-F08, L-F09, L-F10, L-T01, L-T02] + TDD fail-before
- **Nguồn sự thật:** PLAN mục 4 · `docs/HANDOFF_MBW1_20261015.md` · ledger Entry 317 · `docs/PLAN_AUDIT_WAVE2_20261015.md` (vòng 1 NEED_REVISION — đã sửa hết O1–O9/C1–C7 ở bản này). Trích dẫn code @ `a7e35e67e` (code BE/FE không đổi tới HEAD bản này — `git diff 42a5e1439..HEAD -- packages/core packages/web/src` exit 0).

## §0. Quyết định PM (khóa)

1. **MỘT nhánh wave duy nhất** `feat/mbw2-broker-hub` → `dev`, **MỘT PR cuối wave.** Không branch/slice nhỏ.
2. **Phân công theo BỀ MẶT, không theo slice** — 2 claim, ranh giới file không giao nhau:
   - Agent HUB: vỏ + kết nối + hợp nhất (B2.1, B2.2, B2.6) + **chủ duy nhất soc-css**.
   - Agent DATA: dữ liệu đọc + adapter (B2.3, B2.4, B2.5 + mở rộng `broker.js`).
   - B2.7 tách đôi không giao nhau: HUB giữ key `brokerHub.hub.*` + `routes.broker`; DATA giữ key `brokerHub.data.*`. Không có file "Chung" (O3).
3. **Contract đóng băng ở Pha 0** (§2). Cấm đổi sau Pha 0 nếu chưa báo PM.
4. **Wave 2 là FE-only.** Phát hiện thiếu API BE ⇒ **STOP, mở ticket, không tự mở rộng** (ADR-006).
5. **Verify FE chạy LOCAL** (vitest/jsdom + build — deterministic, không cần DB/secret). VPS chỉ dùng cho **regression BE 1 lần cuối wave**. FE-trên-VPS ghi `CHƯA CHẠY` (chưa từng chứng minh được node_modules — L-006/L-007).
6. Entry cũ `portfolios-broker`/`portfolios-manage-broker`: **giữ entry + redirect về `/broker`**, không xoá (tránh link chết + giữ history). Không để B2.6 tự quyết lúc code (O4).
7. Màu tăng/giảm giữ chuẩn Bloomberg (L-F08). Cấm `soc.module.css` (L-F03).

## §1. Bản đồ kiến trúc (đã đọc thật @ a7e35e67e)

| File | Trách nhiệm | Owner | Note |
|---|---|---|---|
| `packages/web/src/adapters/core/broker.js:8-38` | Adapter config hiện có 7 method (providers/schema/config/test-connection/jobs) | DATA (mở rộng +10 §2) | HUB chỉ tiêu thụ, cấm sửa |
| `packages/core/backend/src/user_workspace/urls.py:109-117` | 9 endpoint hub + `urls.py:105` route `broker/<p>/status/` (trong freeze, O7/C2) | — (đóng băng, không sửa) | Đã verify 9 path + catalog |
| `packages/web/src/pages/PortfoliosBrokerPage.tsx:1-54` | Route cũ `/portfolios/manage/broker` | HUB (B2.6 dời + redirect) | Comment `:14-16` STALE ("~28 chuỗi hardcode" — panel đã i18n xong, C7) ⇒ B2.6 sửa comment khi dời |
| `packages/web/src/components/DNSEConnectionPanel.js` (68 lượt `t("dnsePanel.*")`) | Panel DNSE cũ | HUB | Key `dnsePanel:` có sẵn `vi.js:6770`, `en.js:6744`; phần đặt lệnh giữ cảnh báo thử nghiệm |
| `packages/web/src/app/routeCatalog.js:156-159` | Ghi chú "đủ 8 trường" schema route | HUB | Thêm entry `broker` đủ 8 trường; **đếm route theo registry, không theo tên file** (L-G07) |
| `packages/web/src/pages/pageRegistry.js:224-225` | Entry `portfolios-broker` cũ | HUB | Giữ + redirect (quyết định §0.6) |
| `packages/web/src/main.tsx:33-38,164-171` | Mapping registry + Route (`manage/broker` trước `manage`) | HUB | Thêm route `/broker` đúng thứ tự |
| `packages/web/src/layouts/full/vertical/sidebar/sidebaritems.ts:18` | Menu hiện chỉ có `/portfolios` | HUB | Thêm mục `/broker` |
| `packages/web/src/pages/portfolio/PortfolioHoldingsPage.tsx` | Đích B2.5 (chưa có badge nguồn) | DATA | Pha 0 confirm file chính xác trong claim; ứng viên phụ: `PortfolioWorkspacePage.tsx`, `pages/portfolio/manage/` |
| `packages/web/src/i18n/vi.js`, `en.js` | Key mới: HUB `brokerHub.hub.*`, DATA `brokerHub.data.*`; ngoại lệ duy nhất `routes.broker` cho titleKey (O8) | Tách đôi theo prefix | Gate: `i18n:scan:strict` + grep tay (§5.1). `check:i18n-hardcoded` **không viện dẫn** (allowlist không chứa file broker ⇒ pass rỗng — O3) |
| `packages/web/src/components/soc/soc.tokens.css` + `soc.components.css` | Token/class SOC | HUB (chủ duy nhất) | Barrel `soc.module.css:1-3` 0 token/class — cấm đụng |
| `packages/web/src/context/LangContext.js:117-118,133` | `useI18n()` + fallback `defaultValue` | — (dùng, không sửa) | Mọi chuỗi VI có key + defaultValue đầy đủ dấu |
| `docs/adr/ADR-005-danh-muc-tuong-minh-theo-nguon.md` | QĐ-C: `manual\|broker_backed\|aggregate` | — (đọc) | Không nằm ở `system-design/00-GOVERNANCE/adr/` (C5) |

## §2. Contract đóng băng (Pha 0, cấm đổi sau đó)

- **BE (đọc, không sửa):** 9 endpoint hub + `providers/`, `capabilities/`, `config-schema/<p>/`, `<p>/config/`, `<p>/test-connection/`, `<p>/status/`, `jobs/<id>/`.
- **Test khóa shape:** 30 test = drift 6 + views 11 + capabilities 6 + guard 7 (O7). Tổng suite broker **61 unique / 70 lượt run** (beat 9 chạy 2 lần — C4).
- **Adapter `broker.js` (DATA sở hữu, HUB code theo tên này):** `getBrokerAccounts`, `getBrokerAccount(id)`, `getAccountPositions(id)`, `getAccountBalance(id)`, `getAccountOrders(id)`, `syncBrokerAccount(id)`, `getBrokerSyncRuns`, `getBrokerSyncIssues`, `getPortfolioBindings(pid)`, `savePortfolioBindings(pid, data)`.
- **Quy tắc badge join (O5, BE không mang provider/account trên dòng):** badge provider = provider của account trong URL; KHÔNG suy từ dòng dữ liệu; account chưa liên kết config ⇒ badge `unlinked`, không gọi endpoint đọc. Tab "Khớp lệnh" = orders đã khớp (lọc status client-side, ghi rõ giới hạn: không có endpoint fills riêng).
- **Route (HUB):** `{id:"broker", path:"/broker", titleKey:"routes.broker", group:"workspace", buildTargets:["saas","vip"], requiredCapabilities:["workspace.portfolios.manage"], adapter:"core", status:"new"}` + entry pageRegistry + route main.tsx + update contract test 2 chiều.
- **i18n:** prefix tách đôi (§1); mỗi chuỗi có `defaultValue` VI đầy đủ dấu.

## §3. Pha 0 — Mở chu trình (0.5 ngày)

1. `agent-install-hooks` → `agent-sync.ps1` → `git status` main tree.
2. Khai **2 claim riêng, commit riêng, TRƯỚC dòng code đầu tiên** (L-002): `mbw2-hub` + `mbw2-data`, kèm bảng file chốt (sidebar + holdings đã định vị §1).
3. **Fail-before + control:** test mới chạy trên worktree `dev` sạch → phải ĐỎ; 1 test cũ xanh làm control. PM ký cặp ĐỎ/xanh (L-V02). Không tái hiện ⇒ CHƯA XÁC MINH.
4. Đóng băng §2 vào claim. Đổi sau Pha 0 ⇒ báo PM.

## §4. Pha 1 — Song song (không chạm file nhau)

**Agent HUB (B2.1 + B2.2 + B2.6):** route `/broker` + 3 tile (badge capability từ `GET /broker/capabilities/`) + form connect schema-driven 3 lane (render field động từ `config-schema/`, không hardcode field DNSE) + dời 2 bề mặt cũ (redirect, sửa comment stale C7) + mục menu sidebar.
**Agent DATA (B2.3 + B2.4 + B2.5 + adapter):** +10 adapter §2 + Account Manager 4 tab (badge mọi dòng theo quy tắc join §2) + Sync Center (runs/issues, sync → 202 + poll `jobs/<id>/`) + chiều "nguồn" holdings (badge QĐ-C, màu Bloomberg).
**Luật sắt:** 1 handler = 1 patch `setSearchParams` full-state (L-F09); option hook cấp module (L-F10); `tsc --noEmit` sau mỗi sub-step, chỉ PASS khi đã chạy (L-G02); `git status` sau lệnh ghi file (L-V03); `git diff --numstat` trước commit, deletions bất thường dừng (L-G05/L-T01).

## §5. Pha 2 — Hợp nhất (B2.7 + cross-review)

1. B2.7 theo prefix tách đôi → `npm run i18n:scan:strict` exit 0 + grep tay còn sót (lệnh: `Select-String -Path packages/web/src/<bề-mặt> -Pattern '[\u00C0-\u1EF9]'` trừ comment/`defaultValue`) → **0 thiếu VI/EN**. PM verify tay ≥3 key/bề mặt, log `docs/evidence/mbw2/i18n-verify.md` (O9).
2. Cross-review chéo, chỉ soi contract §2 + lessons, không refactor.
3. Bundle `/broker`: BFS cạnh **TĨNH** (`node scripts/measure-route-graph.mjs <chunk>`), đối chiếu `npm run build` (L-F01); verify chunk preload (L-F02). **BUDGET: ≤1450 KB ungzip** (nền `/portfolios/manage/broker` = 14 chunk / 1324.3 KB đo 2026-10-15 bằng lệnh trên). Vượt ⇒ lazy tab nặng.
4. Grep link chết bề mặt cũ (routeCatalog/pageRegistry/main/sidebar/test) — 0 sót.

## §6. Baseline gates (đo trên HEAD `a7e35e67e`, 2026-10-15 — O2)

| Gate (lệnh chính xác) | Exit | Ghi chú |
|---|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | 0 | 0 lỗi, 0 trùng migration |
| `npx tsc --noEmit` (packages/web) | 0 | 0 lỗi |
| `npm run build` (packages/web) | PASS 45.11s | Cảnh báo eval/chunk có sẵn |
| `npm run i18n:scan:strict` (packages/web) | 0 | Warning defaultValue khác nhau có sẵn, không chặn |
| `node scripts/measure-route-graph.mjs PortfoliosBrokerPage` | 0 | Nền 1324.3 KB / 14 chunk (làm ngân sách §5.3) |
| BE suite broker 61 unique (8 labels `user_workspace.tests.test_broker_*` + `test_position_sync`, VPS) | PASS tương đương | Chạy 61/61 trên `42a5e1439`; code BE/FE **không đổi** tới `a7e35e67e` (`git diff` exit 0) — đo lại sau rebase cuối wave (L-G03) |
| `gh pr view 147 --json state,baseRefName,headRefName` | OPEN/dev/`feat/mbw1-sync-engine` | PR Wave 1 đang mở |
| Regression cuối wave (VPS, DB tạm `mbw2_reg`, PM dọn) | CHƯA CHẠY | Labels §2 + fail-before wrap; chạy ở Pha 3 |

## §7. Pha 3 — Gates + PR (một lần duy nhất)

1. `agent-sync.ps1`: **rebase → check migration → gate** (L-G01). Gate chạy trên code **sau rebase** (L-G03). Gate đỏ giống hệt trên dev sạch/worktree trắng ⇒ thí nghiệm đối chứng, ghi body commit (L-G08).
2. Regression BE VPS 1 lần (§6 dòng cuối) + dọn DB.
3. Phân công artifact (C6): auditor giữ `PLAN_AUDIT`; supervisor viết `TEST_REPORT`/`REPORT_FINAL`/`PROGRESS`. Evidence + ledger Entry + claim `done` + push + **1 PR**. PR body để bảng gate TRỐNG cho reviewer điền (skill Stage 7).
4. Sau merge: `agent-cleanup.ps1 -Branch feat/mbw2-broker-hub -Execute` + dọn worktree/DB VPS.

## §8. STOP conditions

- Thiếu API BE ⇒ ticket BE, dừng phần đó (§0.4). · Cần migration ⇒ 1 owner, sinh sau rebase.
- Muốn `--no-verify` ⇒ ghi lý do commit body. · Quá LIMIT (§đầu) ⇒ partial, dừng.

## §9. Exit criteria — AC Given/When/Then (O1; auditor tái audit theo đúng các AC này)

- **AC1 tiles:** Given 2 SubAccount khác provider (DNSE đã config + SSI chưa config), When mở `/broker`, Then thấy 2 tile kèm badge lấy chữ từ `GET /broker/capabilities/` (đối chiếu response log trong evidence, không phải ảnh chụp tay).
- **AC2 connect:** Given lane SSI chưa config, When mở form connect, Then các field render khớp `GET /broker/config-schema/ssi` (diff key-by-key), không field hardcode DNSE; When lưu thiếu field bắt buộc, Then báo đúng key `brokerHub.hub.*` cả VI/EN.
- **AC3 tabs:** Given account có ≥1 position, When mở từng tab Vị thế/Sổ lệnh/Khớp lệnh/Số dư, Then mỗi dòng hiện badge provider+tiểu khoản đúng quy tắc join §2 (so với URL account); account `unlinked` Then badge `unlinked` và 0 request đọc nào được gửi (kiểm bằng log network test).
- **AC4 sync:** Given account đã liên kết, When bấm Đồng bộ, Then trả 202 + `job_id`, poll `jobs/<id>/` tới trạng thái cuối, Sync Center hiện run mới trong `sync-runs/`.
- **AC5 holdings:** Given portfolio có holding từ broker_backed + manual, When mở holdings, Then mỗi dòng có badge nguồn đúng QĐ-C, màu Bloomberg (xanh tăng/đỏ giảm).
- **AC6 unification:** Given vào URL cũ `/portfolios/manage/broker`, Then redirect về `/broker`; grep toàn repo 0 reference chết (lệnh + output 0 trong evidence).
- **AC7 i18n:** `i18n:scan:strict` exit 0 + grep tay 0 sót + PM verify ≥3 key/bề mặt (log `docs/evidence/mbw2/i18n-verify.md`).
- **AC8 build:** `tsc` 0 + `npm run build` PASS + bundle `/broker` ≤1450 KB tĩnh + vitest mới xanh (fail-before đã ĐỎ trước đó, CONTROL xanh có chữ ký PM).
- **AC9 regression:** BE VPS xanh labels §6 trên DB `mbw2_reg` (đã dọn); ledger Entry + 2 claim done + 1 PR merged.

## MANDATORY CHECKLIST

- [ ] Claim khai + commit riêng TRƯỚC dòng code đầu (L-002)
- [ ] Không commit file shared ngoài claim; không commit thẳng dev (L-001, L-008)
- [ ] Mọi PASS có lệnh + exit code; chưa chạy ⇒ CHƯA CHẠY (L-006/L-G02)
- [ ] Gate sau rebase, trên môi trường đích (L-G01, L-G03); gate lạ ⇒ đối chứng dev sạch (L-G08)
- [ ] Fail-before ĐỎ + control xanh, PM ký (L-V02)
- [ ] `git status` sau lệnh ghi file; deletions kiểm tra (L-V03, L-G05)
- [ ] Không token/class vào `soc.module.css` (L-F03); màu Bloomberg (L-F08); prefix i18n tách đôi, ngoại lệ duy nhất `routes.broker`
- [ ] Đếm route theo registry (L-G07); số liệu phân loại + lệnh tái tạo (L-G04)
- [ ] AC §9 kiểm theo observable user, không proxy (O1); badge join đúng §2 (O5)
