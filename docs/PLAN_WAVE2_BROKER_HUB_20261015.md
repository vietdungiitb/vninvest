# KẾ HOẠCH THỰC THI WAVE 2 — Broker Hub UI (một chu trình khép kín)

- **Ngày:** 2026-10-15 · **Người lập:** PM (toàn quyền, quyết định dưới đây là chốt, không hỏi lại)
- **Phạm vi:** B2.1 → B2.7 (PLAN mục 4) · **Ước lượng:** ~9 ngày · **Lực lượng:** 2 agent song song + PM hợp nhất
- **Lessons áp dụng:** [L-001, L-002, L-003, L-006, L-008, L-A01, L-G01, L-G02, L-G03, L-G04, L-G07, L-V02, L-V03, L-F01, L-F03, L-F08, L-F09, L-F10, L-T01, L-T02] + TDD fail-before
- **Nguồn sự thật:** PLAN mục 4 · `docs/HANDOFF_MBW1_20261015.md` · ledger Entry 317 · file:line trong §1 (đã đọc thật, không đoán)

## §0. Quyết định PM (khóa)

1. **MỘT nhánh wave duy nhất** `feat/mbw2-broker-hub` → `dev`, **MỘT PR cuối wave.** Không branch/slice nhỏ (bài học Wave 1: 11 commit rời gây tốn 3 vòng push/gate).
2. **Phân công theo BỀ MẶT, không theo slice** — 2 claim, ranh giới file không giao nhau:
   - Agent HUB: vỏ + kết nối + hợp nhất (B2.1, B2.2, B2.6).
   - Agent DATA: dữ liệu đọc + adapter (B2.3, B2.4, B2.5 + mở rộng `broker.js`).
   - B2.7 (i18n) làm chung ở Pha 2, ai xong bề mặt mình trước thì quét trước.
3. **Contract đóng băng ở Pha 0** (§2). Cấm đổi signature adapter/route/i18n-key sau Pha 0 nếu chưa báo PM.
4. **Wave 2 là FE-only.** BE đã đủ từ B1.6 (§2 bảng endpoint). Phát hiện thiếu API BE ⇒ **STOP, mở ticket, không tự mở rộng** (read-only wave, ADR-006).
5. **Verify FE chạy LOCAL** (vitest/jsdom + build — không cần DB/secret, deterministic). VPS chỉ dùng cho **regression BE 1 lần cuối wave** (suite broker 61 test). Lý do ghi rõ: FE trên VPS chưa từng chứng minh được (thiếu node_modules, HANDOFF_MBW1 §4) — ép chạy VPS mà không có môi trường là vi phạm L-006/L-007. Ghi `CHƯA CHẠY` cho phần FE-trên-VPS thay vì giả vờ.
6. **Không migration mới** (dự kiến). Nếu phát sinh ⇒ 1 agent sở hữu, sinh bằng `makemigrations` sau rebase, không tự đặt số.
7. Màu tăng/giảm giữ chuẩn Bloomberg (L-F08: xanh=tăng, đỏ=giảm) — cấm "sửa cho giống sàn châu Á".

## §1. Bản đồ kiến trúc (đã đọc thật)

| File | Trách nhiệm | Owner | Note |
|---|---|---|---|
| `packages/web/src/adapters/core/broker.js:1-39` | Adapter config (providers/schema/config/test-connection/jobs) | DATA (mở rộng) | Thiếu 9 endpoint hub B1.6 → DATA thêm, HUB chỉ tiêu thụ |
| `packages/core/backend/src/user_workspace/urls.py` (broker/*) | 9 endpoint hub: `accounts/`, `<id>/`, `positions/`, `balance/`, `orders/`, `sync/`, `sync-runs/`, `sync-issues/`, `portfolios/<id>/broker-bindings/` | — (đóng băng, không sửa) | Đã verify tên path + view tương ứng |
| `packages/web/src/pages/PortfoliosBrokerPage.tsx:1-54` | Route cũ `/portfolios/manage/broker` + `DNSEConnectionPanel` | HUB (B2.6 dời/redirect) | Panel đã i18n xong (`dnsePanel.*`) |
| `packages/web/src/components/DNSEConnectionPanel.js` | Panel DNSE cũ (config+sync+order thử nghiệm) | HUB | B2.6: giữ logic, dời vào `/broker`; phần đặt lệnh giữ nguyên cảnh báo thử nghiệm |
| `packages/web/src/app/routeCatalog.js:146-155` | Schema route 8 trường bắt buộc + contract 2 chiều với `main.tsx` | HUB | Thêm id `broker` path `/broker` đủ 8 trường; **đếm route theo registry, không theo tên file** (L-G07) |
| `packages/web/src/pages/pageRegistry.js:223-224` | Entry `portfolios-broker` cũ | HUB | B2.6 quyết định giữ-redirect hay xoá (không để link chết) |
| `packages/web/src/i18n/vi.js:6767+`, `en.js:6741+` | Key `dnsePanel.*` có sẵn | Chung (B2.7) | Key mới prefix `brokerHub.*` cả 2 locale, `i18n:scan` 0 thiếu |
| `packages/web/src/context/LangContext.js` | `useI18n()` + `t(key, {defaultValue})` | — (dùng, không sửa) | Mọi chuỗi VI phải có key + defaultValue VI đầy đủ dấu |
| `packages/web/src/components/soc/soc.tokens.css` + `soc.components.css` | Token/class SOC | Chung | **Cấm** thêm vào `soc.module.css` (barrel 3 dòng — L-F03) |
| Sidebar/nav chứa `/portfolios/manage` | Vị trí menu | HUB | **CHƯA XÁC MINH** file sidebar — Pha 0 phải định vị rồi mới code |

## §2. Contract đóng băng (Pha 0, cấm đổi sau đó)

- **BE (đọc, không sửa):** 9 endpoint hub + `providers/`, `capabilities/`, `config-schema/<p>/`, `<p>/config/`, `<p>/test-connection/`, `jobs/<id>/`. Shape đã khóa bởi 24 contract test B1.6 (views 11 + capabilities 6 + guard 7).
- **Adapter `broker.js` (DATA sở hữu):** thêm `getBrokerAccounts()`, `getBrokerAccount(id)`, `getAccountPositions(id)`, `getAccountBalance(id)`, `getAccountOrders(id)`, `syncBrokerAccount(id)`, `getBrokerSyncRuns()`, `getBrokerSyncIssues()`, `getPortfolioBindings(pid)`, `savePortfolioBindings(pid, data)` — tên này chốt, HUB code theo tên này.
- **Route (HUB sở hữu):** `{id:"broker", path:"/broker", titleKey:"routes.broker", group:"workspace", buildTargets:["saas","vip"], requiredCapabilities:["workspace.portfolios.manage"], adapter:"core", status:"new"}` + entry `pageRegistry` + route `main.tsx` + update contract test 2 chiều.
- **i18n:** prefix `brokerHub.*`; mỗi chuỗi có `defaultValue` tiếng Việt đầy đủ dấu.

## §3. Pha 0 — Mở chu trình (0.5 ngày, PM + 2 agent)

1. `agent-install-hooks` → `agent-sync.ps1` → `git status` main tree.
2. Khai **2 claim riêng, commit riêng, TRƯỚC dòng code đầu tiên** (L-002): `mbw2-hub` (file HUB) + `mbw2-data` (file DATA). Rà claim agent khác trước khi khai (L-001).
3. Định vị file sidebar/nav (mục CHƯA XÁC MINH ở §1) + holdings workspace hiện tại (đích B2.5) — ghi file:line vào claim.
4. **Fail-before + control:** viết test mới trước, chạy trên worktree `dev` sạch → phải ĐỎ (lỗi import/thiếu route, không phải lỗi môi trường). Đồng thời chạy 1 test cũ xanh làm control (L-V02: không tái hiện được ⇒ CHƯA XÁC MINH).
5. Đóng băng §2 vào claim (paste signature). Ai muốn đổi sau Pha 0 ⇒ báo PM.

## §4. Pha 1 — Song song (2 agent, không chạm file nhau)

**Agent HUB (B2.1 + B2.2 + B2.6):** route `/broker` + 3 tile multi-account (badge capability từ `GET /broker/capabilities/`) + form connect schema-driven 3 lane (`config-schema/` → render field động, không hardcode field DNSE) + dời 2 bề mặt cũ về `/broker` (redirect, không để link chết — grep toàn repo sau khi dời).
**Agent DATA (B2.3 + B2.4 + B2.5 + adapter):** mở rộng `broker.js` (§2) + Account Manager 4 tab (Vị thế/Sổ lệnh/Khớp lệnh/Số dư, mọi dòng badge provider + tiểu khoản) + Sync Center (runs/issues, nút sync → 202 + poll `jobs/<id>/`) + chiều "nguồn" trong holdings workspace (badge `manual|broker_backed|aggregate` theo QĐ-C/ADR-005, màu Bloomberg).
**Luật sắt cả 2:** 1 handler = 1 patch `setSearchParams` full-state (L-F09); option hook ở cấp module (L-F10); `tsc --noEmit` sau mỗi sub-step, chỉ báo PASS khi đã chạy (L-G02); `git status` sau mỗi lệnh có thể ghi file (L-V03); `git diff --numstat` trước commit, deletions bất thường thì dừng (L-G05/L-T01).

## §5. Pha 2 — Hợp nhất (B2.7 + cross-review)

1. B2.7: mỗi agent i18n hoá bề mặt mình → chạy `i18n:scan:strict` + `check:i18n-hardcoded` → **0 thiếu cả VI/EN**. Số liệu báo cáo phải phân loại (L-G04), verify tay ≥3 key.
2. Cross-review chéo: HUB review DATA và ngược lại, chỉ soi contract §2 + lessons, không refactor.
3. Đo bundle `/broker`: BFS cạnh import **TĨNH** (`measure-route-graph.mjs`), đối chiếu `npm run build` (L-F01); verify chunk preload đúng (L-F02). Vượt ngân sách ⇒ lazy tab nặng, không nhét vào tải đầu.
4. Grep link chết: `/portfolios/manage/broker` còn reference ở đâu (routeCatalog/pageRegistry/main/sidebar/test) — 0 sót.

## §6. Pha 3 — Gates + PR (một lần duy nhất)

1. `agent-sync.ps1`: **rebase → check migration → gate** (L-G01/L-003). Gate chạy trên code **sau rebase** (L-G03).
2. Regression BE trên VPS 1 lần (suite broker 61 test, DB tạm, dọn sau chạy).
3. Evidence + ledger Entry + claim `done` + push + **1 PR** `feat/mbw2-broker-hub` → `dev`.
4. Sau merge: `agent-cleanup.ps1 -Branch feat/mbw2-broker-hub -Execute` + dọn worktree/DB VPS.

## §7. STOP conditions (gặp là dừng, báo PM, không tự xử)

- Thiếu API BE cho B2.3/B2.4 ⇒ ticket BE, wave dừng phần đó (quyết định §0.4).
- Cần migration ⇒ 1 owner, sinh sau rebase (quyết định §0.6).
- Gate đỏ trên dev sạch/worktree trắng giống hệt ⇒ lỗi môi trường, thí nghiệm đối chứng rồi ghi body commit (L-G08).
- Muốn `--no-verify` ⇒ ghi lý do vào commit body, không lách im lặng.

## §8. Exit criteria (Wave 2 ĐÓNG khi đủ tất cả)

- [ ] `/broker` sống: 3 tile + badge capability thật từ BE.
- [ ] Connect schema-driven chạy 3 lane (DNSE/SSI/TCBS), không field hardcode.
- [ ] 4 tab Account Manager đọc endpoint thật, badge provider + tiểu khoản mọi dòng.
- [ ] Sync Center hiện runs/issues, sync trả 202 + poll job.
- [ ] Holdings có chiều "nguồn", màu Bloomberg, đúng QĐ-C.
- [ ] 0 link chết tới bề mặt cũ (grep 0 sót).
- [ ] `i18n:scan` 0 thiếu VI/EN; `tsc` 0; `npm run build` PASS; vitest mới xanh + fail-before đã đỏ trước đó; bundle `/broker` trong ngân sách.
- [ ] Regression BE VPS xanh; ledger Entry + claim done + 1 PR merged.

## MANDATORY CHECKLIST (tick trước khi coi wave xong)

- [ ] Claim khai + commit riêng TRƯỚC dòng code đầu (L-002)
- [ ] Không commit file shared ngoài claim; không commit thẳng dev (L-001, L-008)
- [ ] Mọi PASS đều có lệnh + exit code; chưa chạy ⇒ ghi CHƯA CHẠY (L-006/L-G02)
- [ ] Gate chạy sau rebase, trên môi trường đích (L-G01, L-G03)
- [ ] Fail-before đỏ + control xanh trước khi sửa (L-V02)
- [ ] `git status` sau lệnh ghi file; deletions kiểm tra (L-V03, L-G05)
- [ ] Không token/class vào `soc.module.css` (L-F03); màu Bloomberg (L-F08)
- [ ] Đếm route theo registry (L-G07); số liệu phân loại + verify tay (L-G04)
