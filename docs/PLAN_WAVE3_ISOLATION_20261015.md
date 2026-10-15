# KẾ HOẠCH THỰC THI WAVE 3 — Cô lập & gộp danh mục (P1, ~5 ngày)

- **Ngày:** 2026-10-15 · **Người lập:** PM/supervisor (toàn quyền, quyết định dưới đây là chốt, không hỏi lại)
- **Phạm vi:** B3.1 → B3.4 (PLAN_MULTI_BROKER_SYNC mục 4) + 6 ticket nợ HANDOFF_MBW2 §3 · **Ước lượng:** ~5 ngày · **Lực lượng:** 2 agent song song + PM hợp nhất
- **SCOPE (file):** §1 bảng Owner + claim `mbw3-be`/`mbw3-fe` ở Pha 0. Ngoài bảng ⇒ báo PM, không tự mở rộng.
- **LIMIT:** sửa plan tối đa 3 vòng audit (đang vòng 0); thực thi: mỗi step lỗi retry tối đa 3 lần rồi ghi blocker. Quá LIMIT ⇒ trả partial, không loop lấy xanh.
- **Non-goals (không làm):** đặt lệnh tiền thật SSI/TCBS · đồng bộ watchlist 2 chiều · đụng `package.json`/checker config (deny-list) · đổi màu tăng/giảm · sửa orderTicket/legacy DNSE trading · E2E 2 SubAccount thật (giữ CHƯA CHẠY, ticket riêng TEST-E2E).
- **Lessons áp dụng:** [L-001, L-002, L-003, L-004, L-006, L-007, L-008, L-A01, L-M01, L-M02, L-M03, L-V02, L-V03, L-T01] + TDD fail-before
- **Nguồn sự thật:** `docs/PLAN_MULTI_BROKER_SYNC_20261014.md` mục 4 (§Wave 3) + mục 5 (watchlist) · `docs/adr/ADR-005-danh-muc-tuong-minh-theo-nguon.md` · `docs/adr/ADR-007-holdings-tach-bach-watchlist-thu-cong.md` · `docs/HANDOFF_MBW2_20261015.md` · ledger Entry 320. Trích dẫn code @ `389e43658` (dev sạch, đồng bộ origin/dev).

## §0. Quyết định PM (khóa)

1. **MỘT nhánh wave duy nhất** `feat/mbw3-isolation` → `dev`, **MỘT PR cuối wave.** Không branch/slice nhỏ. Agent có nhánh riêng (`feat/mbw3-be`, `feat/mbw3-fe`) merge vào nhánh tích hợp (git cấm 2 worktree chung 1 branch — bẫy #2 HANDOFF).
2. **Phân công theo TẦNG, ranh giới file không giao nhau:**
   - Agent BE: toàn bộ BE Wave 3 (BE-READ + BE-KIND + B3.2-BE + B3.4 + migration) — **chủ duy nhất** `models.py` + `migrations/` (L-M02, Hazard 2: chỉ 1 tay chạm leaf).
   - Agent FE: toàn bộ FE Wave 3 (B3.1-FE + B3.2-FE + B3.3-FE + FE-MERGE + FE-DUPID + FE-STATUS + i18n) — **chủ duy nhất** `vi.js`/`en.js` (tránh Hazard 1: 2 agent cùng append 1 file).
   - BE không thêm message i18n JS nào (message lỗi BE là tiếng Việt trong code, không qua `t()`).
3. **Contract đóng băng ở Pha 0** (§2). Cấm đổi sau Pha 0 nếu chưa báo PM.
4. **Thiếu API BE ngoài §2 ⇒ STOP, mở ticket, không tự mở rộng** (ADR-006).
5. **Verify trên VPS staging theo runbook §12 (Owner chốt 2026-10-14, O-1 vòng audit 1).** BE: §12.3 (DB tạm riêng). FE suites (`npm run test*`, `npm run build`, `i18n:scan`): §12.4. Local chỉ kiểm nhẹ §12.2 (`tsc --noEmit`, eslint, `makemigrations --check`, grep/read, viết code + review diff). **Chạy suite ở local rồi báo PASS = vi phạm §12.** VPS-FE-PROBE (§5.4: slice FE đầu chứng minh FE-trên-VPS + sửa runbook §12.4 theo thực tế — nợ HANDOFF §4) là gate bắt buộc, không phải thử cho biết.
6. Entry trùng `portfolios-manage` (§1): **giữ 1 entry duy nhất**, cộng titleKey đúng + contract test 2 chiều xanh. Không để FE tự quyết lúc code.
7. Màu tăng/giảm giữ chuẩn Bloomberg. Cấm `soc.module.css`. Mọi chuỗi VI có key + defaultValue đầy đủ dấu.

## §1. Bản đồ kiến trúc (đã đọc thật @ 389e43658)

| File | Trách nhiệm | Owner | Note |
|---|---|---|---|
| `packages/core/.../user_workspace/views_broker.py:561-629` | `portfolio_broker_bindings_api` PATCH-only (add/remove, rule broker_backed 1 TK) | BE (BE-READ: thêm GET; B3.2-BE: guard aggregate) | Không có read-endpoint — QĐ BE-01 Wave 2 |
| `packages/core/.../user_workspace/serializers.py:43-116` | `PortfolioSerializer` (thiếu `kind`/`is_archived`), `SubAccountSerializer` (thiếu `provider`/`broker_config`/`last_sync_at`), `WatchlistSerializer:17-23` (thiếu `source`/`provider`/`broker_account`) | BE (BE-KIND) | Chỉ thêm field read, không đổi write path (trừ B3.2-guard + B3.4-nullability) |
| `packages/core/.../user_workspace/models.py:54-60` | `Portfolio.kind` + comment `:53` "enforce o tang view (B3.2)" | BE | B3.2-BE chính là enforce comment này |
| `models.py:454-551` | `SubAccount` + comment `:505-507` "contract NOT NULL o B3.4" | BE (B3.4) | `broker_config` nullable + `provider` default `''` (expand) |
| `models.py:557-614` | `PortfolioBrokerBinding` (M:N, role primary/secondary, unique) | BE (đọc) | B3.1-BE đã xong ở B1.6; Wave 3 chỉ thêm GET |
| `models.py:209-262` | `Watchlist` đã có `source`/`provider`/`broker_account` (B0.2) | BE (đọc) | B3.3-BE = expose + filter, không schema mới |
| `models.py:1603-1613` | `PositionSnapshot.source` + `broker_account` FK (nguồn derived) | BE (đọc) | Derived watchlist đọc từ đây |
| `views.py:370-469` | `WatchlistListCreateView` + `WatchlistDetailView` (CRUD, chưa filter scope) | BE (B3.3: thêm `?provider=&broker_account=`) | Chưa expose scope — BE-KIND sửa serializer |
| `migrations/0029_brokersyncrun_brokersyncissue.py` | Migration head hiện tại | BE (B3.4: `makemigrations` sinh số, không tự đặt — L-M01) | Head đọc trên dev, không tin worktree (L-M02) |
| `packages/web/src/adapters/core/broker.js:13-16,135-138` | `getPortfolioBindings` ĐÃ XOÁ (BE-01), `savePortfolioBindings` PATCH giữ | FE (B3.1: thêm lại GET theo contract §2) | HUB chỉ tiêu thụ — Wave 3 FE sở hữu |
| `packages/web/src/pages/broker/*`, `components/brokerData/*` | Hub + AccountManager 4 tab + SyncCenter (Wave 2 DONE) | FE (B3.1 mount BindingsPanel; FE-STATUS sửa `sourceBadge.tsx:71-77`) | Không sửa logic DATA Wave 2 ngoài §2 |
| `pages/portfolio/PortfolioHoldingsPage.tsx` | Holdings + badge nguồn (B2.5) | FE (B3.2-FE: banner + khóa write khi aggregate) | Fail-closed khi `kind` vắng (BE chưa deploy) |
| `components/BrokerSettingsSection.tsx:64` + `pages/UserSettingsPage.tsx:5,253` | Bề mặt cấu hình broker cũ | FE (FE-MERGE: hợp nhất về `/broker`) | Giữ redirect/deprecate như B2.6, không xoá link |
| `app/routeCatalog.js:147-155` vs `:213-222` | **TRÙNG id `portfolios-manage`** (2 entry, titleKey khác nhau) | FE (FE-DUPID: gộp 1) | Contract test 2 chiều phải xanh sau gộp |
| `components/brokerData/sourceBadge.tsx:71-77` | `MATCHED_ORDER_STATUSES = {FILLED, MATCHED}` + ghi giới hạn | FE (FE-STATUS: mở theo status thật SSI/TCBS) | Giữ tối thiểu FILLED/MATCHED + ghi rõ giới hạn ở UI |
| `src/i18n/vi.js`, `en.js` | Key mới prefix `brokerWave3.*` (1 khối duy nhất, không tách — 1 agent FE nên không cần tách đôi) | FE | Ngoại lệ duy nhất: tái dùng key cũ nếu khớp nghĩa |
| `src/components/soc/soc.tokens.css` + `soc.components.css` | Token/class SOC | FE (dùng, không tạo hệ mới) | Cấm `soc.module.css` |

## §2. Contract đóng băng (Pha 0, cấm đổi sau đó)

- **BE-READ (mới):** `GET workspace/portfolios/<id>/broker-bindings/` → `envelope([{binding_id, sub_account_id, provider, external_id, display_name, role, is_default}])`. 404 khi portfolio không thuộc user/tenant (giống PATCH).
- **Bảng chuyển làn `kind` (O-3 vòng audit 1 — hiện chưa code nào đặt `kind`: grep `\.kind|kind=` trong `broker/` chỉ trúng `inspect.Parameter.kind`, không phải model):**

  | Từ | Tới | Điều kiện | Đường |
  |---|---|---|---|
  | `manual` | `broker_backed` | đúng 1 binding | action `convert` + `kind` (explicit + confirm), BE tự đếm rồi mới đổi |
  | `manual`/`broker_backed` | `aggregate` | ≥1 binding | action `convert` |
  | `aggregate`/`broker_backed` | `manual` | 0 binding còn lại (tách hết trước) | action `convert` |
  | bất kỳ | `broker_backed` với ≥2 binding | — | từ chối `broker_backed_single_account` (giữ hành vi B1.6) |

  Backfill DNSE (PLAN mục 6 câu 4, Owner-chốt): data-migration đặt `broker_backed` + tên `"DNSE — <số TK>"` (BE, không qua API). **Pha 0 exit-criterion:** inventory mọi write path chạm `kind` (grep `\.kind\s*=` + serializer + bindings + backfill) + fail-before ĐỎ cho mỗi chuyển làn.
- **BE-KIND (mở rộng read-only):** portfolio read += `kind`, `is_archived`; subaccount read += `provider`, `broker_config` (id), `last_sync_at`; watchlist read += `source`, `provider`, `broker_account` (+ `GET /watchlists/` thêm filter `?provider=&broker_account=`). `kind` **read-only trên `PortfolioSerializer`** (PATCH portfolio chung không đặt được `kind`) — đường chuyển làn duy nhất là action `convert` dưới đây (O-5 vòng audit 2, không phải contradiction: 2 write path khác nhau, 1 cho phép + 1 cấm).
- **Action `convert` (O-5):** nhánh mới trên **PATCH `workspace/portfolios/<id>/broker-bindings/` hiện có** (`urls.py:117`, không thêm route). Payload `{action: 'convert', kind: '<manual|broker_backed|aggregate>'}` + confirm 2 bước ở FE; BE kiểm bảng chuyển làn (§dưới) trên số binding **đếm thật trong transaction**, từ chối kèm code (`broker_backed_single_account`, `convert_requires_empty` khi về manual còn binding, `convert_needs_binding` khi sang aggregate/broker_backed mà 0 binding); mọi convert ghi audit. Không thêm endpoint/method mới.
- **B3.2-BE (guard):** write trực tiếp vào portfolio `kind=aggregate` ⇒ từ chối `aggregate_read_only` (400/403 + message VI): (1) POST transaction/ledger vào aggregate; (2) PATCH `opening_balance` của aggregate. Cho phép: bindings add/remove (đường gộp hợp pháp), rename, delete. Fail-before liệt kê chính xác write path ở Pha 0.
- **B3.4 (contract, O-4 vòng audit 1):** migration 0025 **đã** backfill `provider` (map DNSE/SSI/TCBS + alias `TCB→tcbs`) + link `broker_config` khi duy-nhất-tương-thích (`migrations/0025:14-41`). Wave 3 không backfill lại mà **audit leftovers** bằng 2 bộ đếm độc lập (staging/prod-read): (i) `SubAccount.provider=''` count; (ii) `SubAccount.broker_config IS NULL` count. Mỗi field chỉ `AlterField NOT NULL` khi bộ đếm của **chính nó** = 0 (`broker_config` NULL có thể không bao giờ về 0 vì 0025 chỉ link khi duy nhất — đó là kết quả hợp lệ, không phải thất bại). Còn sót ⇒ giữ DB nullable + enforce ở serializer + ticket follow-up (partial có lý do, không ép xanh).
- **Adapter `broker.js` (FE sở hữu):** `getPortfolioBindings(pid)` (GET mới), `getWatchlistsScoped({provider, brokerAccountId})`, `getDerivedWatchlist(accountId)` (FE-compute từ positions, read-only, không POST).
- **Quy tắc hiển thị (ADR-007):** holdings vs watchlist **2 khu vực riêng**, badge nguồn mọi dòng; derived gắn nhãn "Đang nắm giữ @ provider/tiểu khoản"; copy empty-state khác nhau.
- **Route (FE-DUPID, O-2 vòng audit 1):** giữ entry `portfoliosManage.title` (`routeCatalog.js:213-222` — đúng trang đang render `PortfoliosPage.tsx:189`), **xoá** entry `routes.portfolios` (`:146-155`) + dời/cập nhật comment D-01 (`:138-145`) theo. Gate thật là grep `id: "portfolios-manage"` == 1 (F-05: contract test 2 chiều mù với trùng id — trùng hiện tại vẫn xanh).

## §3. Pha 0 — Mở chu trình (0.5 ngày)

1. `agent-install-hooks` → `agent-sync.ps1` → `git status` main tree.
2. Khai **2 claim riêng, commit riêng, TRƯỚC dòng code đầu tiên** (L-002): `mbw3-be` + `mbw3-fe`, kèm bảng file chốt §1.
3. Tạo nhánh tích hợp `feat/mbw3-isolation` từ `dev` + 2 worktree (`C:/MujocoProjects/agent-mbw3-be`, `.../agent-mbw3-fe`) + junction node_modules (đường không dấu cách) + nhánh riêng từng agent merge vào nhánh tích hợp.
4. **Fail-before + control:** test mới chạy trên worktree `dev` sạch → phải ĐỎ; 1 test cũ xanh làm control. PM ký cặp ĐỎ/xanh (L-V02).
5. Đóng băng §2 vào claim. Đổi sau Pha 0 ⇒ báo PM.

## §4. Pha 1 — Song song (không chạm file nhau)

**Agent BE (BE-READ + BE-KIND + B3.2-BE + B3.4):** GET bindings + mở rộng 3 serializer (read-only) + filter watchlist + guard aggregate + backfill/NOT NULL có điều kiện + test BE trên VPS staging (DB tạm riêng, runbook §12). 1 tay duy nhất chạm `models.py`/`migrations/`.
**Agent FE (B3.1 + B3.2-FE + B3.3-FE + FE-MERGE + FE-DUPID + FE-STATUS):** BindingsPanel (list GET + add/remove confirm 2 bước + role) + banner/khóa aggregate (fail-closed khi thiếu `kind`) + watchlist scoped filter + derived section + hợp nhất SettingsSection + gộp route trùng + mở status filter + i18n `brokerWave3.*`.
**Luật sắt:** 1 handler = 1 patch `setSearchParams` full-state; option hook cấp module; `tsc --noEmit` sau mỗi sub-step; `git status` sau lệnh ghi file (L-V03); `git diff --numstat` trước commit, deletions bất thường dừng (L-T01); cấm `git checkout --` (L-A01).

## §5. Pha 2 — Hợp nhất (cross-review + i18n + bundle + VPS-FE-PROBE)

1. i18n: `npm run i18n:scan:strict` exit 0 + grep tay còn sót → **0 thiếu VI/EN**. PM verify tay ≥3 key (log `docs/evidence/mbw3/i18n-verify.md`).
2. Cross-review chéo, chỉ soi contract §2 + lessons, không refactor.
3. Bundle `/broker` + mặt mới: BFS cạnh **TĨNH** (`node scripts/measure-route-graph.mjs`), đối chiếu `npm run build`. **BUDGET: ≤1450 KB ungzip** (nền Wave 2: 1355.1/1350.7 KB). Vượt ⇒ lazy tab nặng.
4. **VPS-FE-PROBE (trả nợ HANDOFF §4):** thử dựng FE trên VPS (worktree `/tmp/wt-mbw3-fe`, log có/không `node_modules`), ghi kết quả vào `docs/evidence/mbw3/vps-fe-probe.md` + **sửa `docs/STAGING_VPS_RUNBOOK.md` §12.4 theo thực tế**. Không chứng minh được ⇒ CHƯA CHẠY + runbook ghi đúng giới hạn.
5. Grep link chết bề mặt cũ — 0 sót.

## §6. Baseline gates (đo trên HEAD `389e43658`, 2026-10-15)

| Gate (lệnh chính xác) | Exit | Ghi chú |
|---|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | 0 | Chạy ở Pha 0 sau khai claim |
| `npx tsc --noEmit` (packages/web, local — §12.2 cho phép) | 0 (kỳ vọng) | Đo lại Pha 0, ghi số thật |
| `npm run build` (packages/web, **VPS §12.4** — cấm local) | PASS (kỳ vọng) | Chính thức ở Pha 3; local chỉ feedback, không báo PASS |
| `npm run i18n:scan:strict` (packages/web, **VPS §12.4**) | 0 (kỳ vọng) | Chính thức ở Pha 3 |
| `makemigrations --check --dry-run` + 1 leaf (local — §12.2 cho phép) | 0 (kỳ vọng) | Head 0029; đo lại Pha 0 |
| BE suite broker labels (VPS, DB tạm) | CHƯA CHẠY | Chạy ở Pha 3 (regression cuối wave) |
| E2E 2 SubAccount thật | CHƯA CHẠY | Ticket riêng TEST-E2E, ngoài wave |
| Full BE suite · ruff | CHƯA CHẠY | Nợ từ Wave 2, giữ nguyên |

## §7. Pha 3 — Gates + PR (một lần duy nhất)

1. `agent-sync.ps1`: **rebase → check migration → gate** (L-003). Gate trên code **sau rebase**. **Re-check leaf sau rebase** (L-M03).
2. Regression BE VPS 1 lần (§6) + dọn DB. VPS-FE-PROBE (§5.4).
3. Phân công artifact: auditor giữ `PLAN_AUDIT`; supervisor viết `TEST_REPORT`/`REPORT_FINAL`/`PROGRESS`. Evidence + ledger Entry + claim `done` + push + **1 PR**. PR body để bảng gate TRỐNG cho reviewer điền.
4. Sau merge: `agent-cleanup.ps1 -Branch feat/mbw3-isolation -Execute` + dọn worktree/DB VPS.

## §8. STOP conditions

- Thiếu API BE ngoài §2 ⇒ ticket BE, dừng phần đó. · Cần migration ngoài BE ⇒ 1 owner (BE), sinh sau rebase (L-M01/M02).
- Muốn `--no-verify` ⇒ ghi lý do commit body. · Quá LIMIT ⇒ partial, dừng.
- Backfill còn unmapped ⇒ B3.4 partial (serializer-enforce + ticket), không ép NOT NULL.

## §9. Exit criteria — AC Given/When/Then (auditor tái audit theo đúng các AC này)

- **AC1 bind-read:** Given portfolio có ≥1 binding, When mở panel Gộp danh mục, Then thấy đúng danh sách từ `GET broker-bindings/` (khớp response log, không hardcode).
- **AC2 bind-write:** Given portfolio `manual`, When gộp tiểu khoản (confirm 2 bước), Then binding mới `role=secondary` + audit; When gộp TK thứ 2 vào `broker_backed`, Then bị từ chối `broker_backed_single_account` (giữ hành vi B1.6); When `convert` sang `aggregate` (confirm), Then `kind=aggregate` + giữ nguyên bindings.
- **AC3 aggregate:** Given portfolio `kind=aggregate`, When POST giao dịch trực tiếp / PATCH opening_balance, Then 400/403 `aggregate_read_only`; When gộp thêm TK qua bindings, Then vẫn cho phép; When `convert` về `manual` khi còn binding, Then bị từ chối (phải tách hết trước). FE hiện banner chỉ-đọc + ẩn nút write; `kind` vắng ⇒ banner unknown (fail-closed).
- **AC4 kind/source:** Given portfolio/subaccount/watchlist có dữ liệu, When đọc API, Then response mang `kind`/`provider`/`source` đúng DB (so row DB, không suy từ label).
- **AC5 watchlist:** Given 2 watchlist khác scope, When lọc theo provider/tiểu khoản, Then chỉ hiện đúng scope; derived section tách riêng khỏi manual, empty-copy khác nhau (ADR-007).
- **AC6 dedup:** Given vào `/portfolios/manage`, Then title `portfoliosManage.title` + contract test 2 chiều xanh; gate thật là grep `id: "portfolios-manage"` == 1 toàn repo (F-05: contract test mù trùng id).
- **AC7 settings:** Given vào UserSettings (khối DNSE cũ), Then dẫn về `/broker` (không còn 2 bề mặt cấu hình); grep 0 reference chết.
- **AC8 status:** Given lệnh SSI/TCBS status ngoài {FILLED,MATCHED}, When mở tab Khớp lệnh, Then hiển thị đúng (không rớt silently) + ghi chú giới hạn còn hiệu lực.
- **AC9 build:** `tsc` 0 (local, §12.2) + `npm run build` PASS (**VPS §12.4**) + bundle ≤1450 KB + vitest mới xanh (**VPS §12.4**; fail-before đã ĐỎ, CONTROL xanh có chữ ký PM). Chạy suite ở local rồi báo PASS = vi phạm runbook (O-1).
- **AC10 regression:** BE VPS xanh labels broker trên DB tạm (đã dọn); VPS-FE-PROBE có log + runbook §12.4 đã sửa; ledger Entry + 2 claim done + 1 PR merged.

## MANDATORY CHECKLIST

- [ ] Claim khai + commit riêng TRƯỚC dòng code đầu (L-002)
- [ ] Không commit file shared ngoài claim; không commit thẳng dev (L-001, L-008)
- [ ] Mọi PASS có lệnh + exit code; chưa chạy ⇒ CHƯA CHẠY (L-006, L-007)
- [ ] Gate sau rebase, trên môi trường đích (L-003); re-check leaf sau rebase (L-M03)
- [ ] Fail-before ĐỎ + control xanh, PM ký (L-V02)
- [ ] `git status` sau lệnh ghi file (L-V03); deletions kiểm tra (L-T01); cấm `git checkout --` (L-A01)
- [ ] Migration do `makemigrations` sinh, head đọc trên dev (L-M01, L-M02); 1 tay chạm models/migrations
- [ ] i18n 1 chủ (FE), prefix `brokerWave3.*`; không token/class vào `soc.module.css`; màu Bloomberg
- [ ] AC §9 kiểm theo observable user, không proxy; số liệu có lệnh tái tạo
- [ ] Suite/test/build/i18n-scan chính thức chạy VPS §12; local chỉ tsc/eslint/check nhẹ — chạy local rồi báo PASS = vi phạm (O-1)
