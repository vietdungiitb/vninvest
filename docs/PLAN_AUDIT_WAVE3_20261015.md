# AUDIT ĐỘC LẬP — `docs/PLAN_WAVE3_ISOLATION_20261015.md` (vòng 2, re-audit sau sửa vòng 1)

- **Ngày audit vòng 2:** 2026-10-15 · **Auditor:** độc lập với người lập plan · **Chế độ:** read-only (không sửa code, chỉ ghi đè file output này)
- **HEAD đã audit:** `389e43658` (dev, `git rev-parse HEAD` khớp; `git status` sạch ngoại trừ 2 file plan/audit mới chưa track)
- **Tài liệu đã đọc:** plan Wave 3 bản mới (138 dòng) · audit vòng 1 (mục VÒNG 1 cuối file này) · `STAGING_VPS_RUNBOOK.md:421-492` (§12) · `PLAN_MULTI_BROKER_SYNC_20261014.md` mục 4 (§Wave 3, dòng 104-132) + mục 6 (câu 4 backfill DNSE, dòng 168-175) · `ADR-005` (27 dòng) · `ADR-007` (34 dòng)

## TÓM TẮT VÒNG 2 — 5 findings quan trọng nhất

Vòng 1 sửa đúng 4/5 điểm (O-1/O-2/O-4/F-05 **ĐÓNG**, xác minh tới từng dòng code). Điểm còn lại duy nhất chặn thực thi: (1) bảng chuyển làn `kind` thêm action `convert` nhưng **không ghi endpoint/method/payload nào** phục vụ nó — trong khi câu "kind read-only qua API" (`plan:59`) vẫn còn nguyên, tạo mâu thuẫn biểu kiến: đổi `kind` qua HTTP action có phải "write kind qua API" không? Không trả lời thì BE agent có 2 cách hiểu trái ngược nhau (mở `kind` thành field writable vs dựng action riêng) → **O-5, 3 câu là xong**; (2) tin tốt: `role=secondary` trong AC2 khớp văn bản model (`models.py:561-563`), và GET bindings mới **không cần động `urls.py`** (routeigor đã có ở `urls.py:117`, chỉ thêm `'GET'` vào `@api_view`) — 2 chỗ tưởng là lỗ hoá ra đã kín; (3) B3.4 đúng `0025:14-41` tới từng dòng, nhưng cột `provider` **vốn đã NOT NULL ở DB** (`models.py:508-519`) nên "AlterField NOT NULL" của nó thực chất là migration validation-level (`blank=False`), khác cơ chế với `broker_config` — plan gộp chung 1 từ; (4) AC2 "+ audit" thiếu tên `ActionChoices` (làm được với `CREATE`/`UPDATE` có sẵn, không cần migration `ops_audit`, nhưng plan phải nêu); (5) 6 dọn-drift vòng 1 (F-07/08/09/10/11/12) **rơi mất**, kiểm tra @ HEAD thấy vẫn y nguyên (ADR-005:10 vẫn "4 làn"). Vì còn đúng 1 objection bắt buộc sửa → verdict **NEED_REVISION**.

## 1. Đối chiếu từng fix vòng 1 (objection | chỗ sửa trong plan | xác minh code @ 389e43658 | kết luận)

| # | Fix vòng 1 trong plan mới | Xác minh độc lập | Kết luận |
|---|---|---|---|
| O-1 | §0.5 (`plan:20`): suites FE → VPS §12.4, local chỉ §12.2 + câu "Chạy suite ở local rồi báo PASS = vi phạm §12" ×3 (`plan:20,124,138`); §6 (`plan:93-96`): tsc/makemigrations local-cho-phép, build/i18n-scan **VPS**; AC9 (`plan:124`) gắn location từng gate | Grep `[Ll]ocal` toàn plan → đúng 6 hit, **0 hit** đòi PASS local cho suite. Đối chiếu runbook: §12.1 (`runbook:427-434`) bắt test/build lên VPS; §12.2 (`runbook:436-440`) cho local đúng tập plan liệt kê (`tsc/eslint/makemigrations --check/grep`). `i18n:scan:strict` **tồn tại** trong `package.json` scripts (đếm thật, không đoán) | **ĐÓNG.** Trừ 1 nốt ruồi: §5.3 (`plan:83`) "đối chiếu `npm run build`" thiếu tag location (hiểu ngầm VPS theo §6, nên gắn chữ để khỏi cãi nhau) → F-15 |
| O-2 | §0.6 (`plan:21`) + §2 (`plan:64`) + AC6 (`plan:121`): giữ entry `portfoliosManage.title` (`routeCatalog.js:213-222`), **xoá** entry `routes.portfolios` (`:146-155`), dời comment D-01 (`:138-145`) | `PortfoliosPage.tsx:189` render đúng `t("portfoliosManage.title")` ✓; `main.tsx:164` đăng ký path `portfolios/manage` + `:33` map `portfolios-manage→core-portfolios` ✓; 2 entry trùng id+path, **mọi trường còn lại giống hệt** (group/buildTargets/capabilities/adapter) — xoá entry 1 không mất capability nào ✓; contract test (`route-catalog-contract.component.test.ts:1-52`, đúng 52 dòng) assert bằng `Set` cả 2 chiều → **trùng id vẫn xanh**, mù thật như vòng 1 đã nói ✓ | **ĐÓNG.** Cả 3 nơi trong plan nêu đúng tên entry, FE agent không còn cửa chọn sai |
| O-3 | Bảng chuyển làn (`plan:49-58`): 4 hàng + backfill DNSE `"DNSE — <số TK>"` + exit-criterion Pha 0 "inventory mọi write path + fail-before ĐỎ cho mỗi chuyển làn" (`plan:58`) | Grep `\.kind\s*=` toàn `user_workspace/` (trừ tests): **0 write** production — chỉ 1 read `views_broker.py:599` (`==`) + 1 `inspect.Parameter.kind` (`broker/adapters.py:78`), khớp đúng câu plan:49 ✓; điểm mở rộng tự nhiên có sẵn (`views_broker.py:594` đọc `action`, `:626-629` raise khi lạ) → thêm nhánh `convert` là implementable ✓; write path B3.2 có thật (`views.py:301` POST transactions, `:186-192` PATCH portfolio) ✓ | **ĐÓNG 90%, dư 10% → O-5.** Bảng + inventory đã có; nhưng `convert` không gắn endpoint/method/payload nào + va với "kind read-only qua API" (`plan:59`) — xem O-5 |
| O-4 | B3.4 viết lại (`plan:61`): thừa nhận 0025 + 2 bộ đếm độc lập + NOT NULL từng cột + "NULL không về 0 là kết quả hợp lệ" | `migrations/0025_auto_20261014_1713.py:14-41`: `SOURCE_TO_PROVIDER` 4 key (`:14-19`, gồm `TCB→tcbs`) + `strip().upper()` (`:27`) + tương-thích-tenant (`:34-37`) + chỉ link khi duy-nhất (`:38-39`) + update (`:40-41`) — **khớp từng dòng**, range `14-41` chính xác ✓ | **ĐÓNG.** 2 nốt ruồi: thiếu câu lệnh đếm mẫu + `provider` đã NOT NULL-DB (cơ chế khác `broker_config`) → F-16/F-17 |
| F-05 | AC6 + §2 (`plan:64,121`): "gate thật là grep `id: "portfolios-manage"` == 1" + ghi rõ contract test mù trùng id | Đúng test 52 dòng, mù thật (xác minh mục O-2). Plan giữ grep làm gate chính ở cả 2 nơi ✓ | **ĐÓNG.** Thiếu ticket follow-up "thêm assert uniqueness vào contract test" (vòng 1 đã đề xuất) → gộp vào F-19 |

## 2. Objection mới (vòng 2)

- **O-5 (F-03-dư, GAP | major | `plan:49-59`): `convert` không có hình hài endpoint + mâu thuẫn biểu kiến với "kind read-only qua API".**
  Thực tế code: `portfolio_broker_bindings_api` (`views_broker.py:572-629 @ 389e43658`) là `@api_view(['PATCH'])` duy-nhất trên route đã đăng ký (`urls.py:117`), dispatch bằng `action` (`:594`), hiện chỉ biết `add`/`remove` (`:598-625`), còn lại raise (`:626-629`).
  Plan viết bảng chuyển làn qua "action `convert`" nhưng **không nêu**: (a) action này sống ở endpoint nào (cùng PATCH broker-bindings? endpoint mới?); (b) method + payload (`{action:'convert', target_kind, confirmed:true}`?); (c) quan hệ với câu "kind **read-only qua API**" (`plan:59`).
  Trả lời câu hỏi audit: **CÓ, đây là contradiction cần giải quyết** — đọc chữ thì "read-only qua API" cấm mọi đổi `kind` qua HTTP, trong khi `convert` (qua HTTP) lại đổi `kind`. Lối ra đúng đắn duy nhất: read-only áp dụng cho **serializer field** (`PortfolioSerializer` phải `read_only kind`, PATCH `/portfolios/<id>/` không được set `kind` — bắt buộc vì `views.py:186-192` nhận mọi field `partial=True`), còn `convert` là **dedicated action** (server đếm bindings rồi mới đổi). Plan hiện không viết câu phân biệt này ⇒ BE agent có thể mở `kind` thành writable (phá read-only) hoặc từ chối implement `convert` (phá AC2/AC3).
  **Đề xuất (3 câu, vào §2 BE-KIND):** "`convert` là nhánh `action:'convert'` mới trên cùng PATCH `broker-bindings/` (`urls.py:117`, không thêm route), payload `{action:'convert', target_kind, confirmed:true}`; `PortfolioSerializer.kind` khai `read_only=True` nên PATCH portfolio không set được `kind`; server đếm bindings hiện tại rồi mới đổi, sai điều kiện ⇒ 400 + mã `kind_transition_invalid`." Không sửa thì AC2/AC3 treo ở "ai đặt, bằng đường nào".

## 3. Findings mới (minor, không chặn mở wave — sửa trong cùng PR chạm file hoặc ghi reservation)

- **[F-15] RISK | low | `plan:83` (§5.3).** "đối chiếu `npm run build`" thiếu tag location. Sửa: thêm "(VPS §12.4)".
- **[F-16] GAP | low | `plan:61` (B3.4).** Thiếu câu lệnh đếm mẫu mà vòng 1 đã yêu cầu (2 query `SubAccount.provider=''` / `broker_config IS NULL`); cụm "staging/prod-read" mơ hồ — "prod-read" nghĩa là đọc DB production? Sửa: cho 2 lệnh `manage.py shell -c` (chạy VPS §12.3) + đổi thành "query read-only trên staging".
- **[F-17] RISK | low | `plan:61` vs `models.py:508-529 @ 389e43658`.** Cột `provider` đã `null=False` ở DB (`default=''`, `blank=True`); B3.4 của nó là migration validation-level (`blank=False`, không rewrite table), khác cơ chế với `broker_config` (`null=True`, NOT NULL-DB cần 0 NULL thật). Sửa: tách 1 dòng nêu cơ chế từng cột.
- **[F-18] GAP | low | AC2 (`plan:117`) "+ audit".** `bindings_api` hiện không ghi audit (`views_broker.py:598-625` không có `AuditEvent`); `ActionChoices` chỉ có 6 giá trị generic (`ops_audit/models.py:13-19`: create/update/delete/access/auth/revoke) — làm được (dùng `CREATE`/`UPDATE`, không cần migration `ops_audit`, không vỡ scope slice BE) nhưng plan phải nêu giá trị nào + hành vi khi audit hỏng (fail-open hay fail-closed; tiền lệ fail-loud ở `views_dnse.py:228-235`). Sửa: 1 câu vào contract.
- **[F-19] INFO | residual vòng 1 rơi mất (đã re-check @ HEAD, còn nguyên).** (a) ADR-005:10 vẫn "1 trong **4** làn" nhưng liệt kê 3 (`models.py:29-32` đúng 3) — sửa 1 chữ; (b) `views.py:229-240` comment stale "Portfolio **không có** field archive" — sai từ B0.2 (`models.py:63-64`); (c) thiếu câu cấm phát minh `source='broker'` cho Watchlist (code chỉ `manual`/`derived`, `models.py:237-243`); (d) drift dòng: `broker.js:135-138` (hàm tới `:141`), `sourceBadge.tsx:71-77` (SET tại `:74`); (e) `models.py:510-512` comment "them 'tcb'" dễ đọc thành thêm choice; (f) `plan:34` "(nguồn derived)" gán nhầm cho `PositionSnapshot.source` (giá trị broker-origin là `'broker'`); (g) follow-up "assert uniqueness id" cho contract test chưa thành ticket; (h) ownership `docs/evidence/mbw3/i18n-verify.md` + `vps-fe-probe.md` chưa gắn agent (BE/FE).
  Ghi chú công bằng: AC2 `role=secondary` **KHÔNG phải lỗi** — khớp văn bản model (`models.py:561-563`: "gop thu cong (B3.1) tao them binding co `role='secondary'`"); default `PRIMARY` (`:593`) là cho auto-binding. Không cần sửa.

## 4. Re-check slice / contract / gate / migration (vòng 2)

- **Disjoint (§1): PASS.** Không giao file; i18n FE-độc-quyền, `models.py`/`migrations/` BE-độc-quyền. Tin tốt mới: BE-READ **không cần `urls.py`** (route đã có `urls.py:117`, cùng path với contract GET) nên không có lỗ scope ẩn.
- **VPS-FE-PROBE (§5.4 + §0.5): giữ reservation vòng 1** (timebox, chấp nhận CHƯA CHẠY; runbook §12.4 vẫn "CHƯA KIỂM CHỨNG", `runbook:477-487`). Chưa có bằng chứng node/RAM trên VPS — không chặn wave vì là trả nợ song song.
- **Migration risk: thấp.** B3.4 cho phép partial (không ép NOT NULL) nên không có đường crash; lưu ý duy nhất là NOT NULL-có-điều-kiện không sinh tự động bằng `makemigrations` (cần sửa tay có guard) → BE tự xử, đã có L-M01/M02/M03.
- **Gate đòi PASS từ thứ đỏ: không còn.** §6 giữ 4 dòng "kỳ vọng" + yêu cầu "Đo lại Pha 0"; AC9/AC10 gắn location đầy đủ sau fix O-1.

## 5. Verdict vòng 2: NEED_REVISION

- **Objections còn mở: O-5 (1 cái).** O-1/O-2/O-4/F-05 **ĐÃ ĐÓNG**; O-3 đóng 90%, phần dư đã tách thành O-5.
- **Điều kiện mở wave:** thêm ~5 dòng vào §2 BE-KIND theo đề xuất O-5 (endpoint + payload + `read_only` + mã lỗi). F-15..F-19 là reservations, sửa trong lúc thực thi không cần audit lại.
- **confidence: high** — mọi citation đã mở file thật @ `389e43658`; số liệu có lệnh tái tạo: `git rev-parse HEAD` (=`389e43658`); grep `\.kind\s*=` (0 write production); grep `Parameter.kind` (1 hit `adapters.py:78`); đọc `0025:14-41`, `views_broker.py:570-629`, `urls.py:117`, `routeCatalog.js:138-155/213-222`, `main.tsx:33,164`, `PortfoliosPage.tsx:189`, `ops_audit/models.py:13-19`, `models.py:29-32/508-529/561-614`, script list `package.json`.

---

## PHỤ LỤC — VÒNG 1 (giữ nguyên lịch sử, verdict NEED_REVISION với O-1..O-4 + F-05)

# AUDIT ĐỘC LẬP — `docs/PLAN_WAVE3_ISOLATION_20261015.md` (vòng 0)

- **Ngày audit:** 2026-10-15 · **Auditor:** độc lập với người lập plan · **Chế độ:** read-only (không sửa code, chỉ 1 file output này)
- **HEAD đã audit:** `389e43658` (dev, merge PR #150 docs-only trên nền Wave 2 `f97b3280b`) — mọi citation dưới đây kèm `file:line @ 389e43658`
- **Tài liệu đã đọc:** plan Wave 3 (127 dòng) · `PLAN_MULTI_BROKER_SYNC_20261014.md` mục 4+5 · `ADR-005` · `ADR-007` · `HANDOFF_MBW2_20261015.md`

## TÓM TẮT — 5 findings nghiêm trọng nhất

Plan Wave 3 có bản đồ kiến trúc trung thực hiếm thấy (13/14 citation khớp code tới từng dòng, đã đếm độc lập bằng script), nhưng **chưa đủ điều kiện thực thi**: (1) §0.20 "Verify FE chạy LOCAL" vi phạm trực tiếp quy định Owner-chốt tại `STAGING_VPS_RUNBOOK.md:427-434` (`npm run test*/build` PHẢI chạy VPS, cấm local) — hoặc sửa plan hoặc xin waiver; (2) cơ chế chuyển làn `kind` không được định nghĩa ở đâu (code hiện tại `views_broker.py:599-605 @ 389e43658` chỉ *từ chối* gộp TK thứ 2 vào `broker_backed`, không có chỗ nào *đặt* `aggregate`/`broker_backed`, mà plan lại viết "chuyển làn chỉ qua bindings add/remove"); (3) FE-DUPID không chốt giữ entry nào — bằng chứng code cho thấy phải giữ `portfoliosManage.title` (trang `PortfoliosPage.tsx:189 @ 389e43658` render đúng key này) và xoá entry `routes.portfolios`, nhưng plan chỉ viết "titleKey đúng"; (4) B3.4 bước (i) "data-migration backfill" **đã tồn tại** trong `migrations/0025_auto_20261014_1713.py:14-41 @ 389e43658` (kèm alias `TCB→tcbs` mà plan không nhắc), và điều kiện "0 unmapped" gộp chung 2 bộ đếm độc lập (`provider=''` vs `broker_config NULL` — cái sau có thể **không bao giờ về 0** vì 0025 chỉ link khi đúng 1 config tương thích); (5) AC6 dựa vào "contract test 2 chiều xanh" nhưng test đó (`route-catalog-contract.component.test.ts:1-52 @ 389e43658`) chỉ kiểm path/id tồn tại, **mù hoàn toàn với trùng id** — entry trùng hiện tại vẫn cho test xanh, nên mệnh đề grep trong AC6 mới là gate thật. Vì có 4 điểm bắt buộc sửa trong thân plan → verdict **NEED_REVISION**.

## 1. Bản đồ xác minh (plan §1 ↔ code @ 389e43658)

| # | Citation trong plan | Thực tế `file:line @ 389e43658` | Kết luận |
|---|---|---|---|
| 1 | `views_broker.py:561-629` PATCH-only add/remove, rule broker_backed 1 TK | `views_broker.py:570 @ 389e43658` `@api_view(['PATCH'])`; `def` tại `:572`; rule 1 TK tại `:599-605`; add `:598-618`, remove `:619-625`, raise cuối `:626-629` | **KHỚP** (đếm độc lập: segment 572-630 không chứa `GET`/`POST`) |
| 2 | `serializers.py:43-116` Portfolio thiếu `kind`/`is_archived`; SubAccount thiếu `provider`/`broker_config`/`last_sync_at` | `serializers.py:43 @ 389e43658` `class PortfolioSerializer`, fields tại `:98-101` = 7 field, không có `kind`/`is_archived`; `SubAccountSerializer` tại `:105`, fields `:111-115` = 14 field, không có `provider`/`broker_config`/`last_sync_at` | **KHỚP** |
| 3 | `serializers.py:17-23` Watchlist thiếu `source`/`provider`/`broker_account` | `serializers.py:17-23 @ 389e43658` fields `:22` = id/name/description/is_default/items/created_at | **KHỚP** |
| 4 | `models.py:54-60` `Portfolio.kind` + comment `:53` | `models.py:54-60 @ 389e43658` `kind` CharField; comment enforce-B3.2 tại `:52-53` | **KHỚP** (comment bắt đầu `:52`, lệch 1 dòng, không ảnh hưởng ngữ nghĩa) |
| 5 | `models.py:454-551` SubAccount + comment `:505-507` "contract NOT NULL ở B3.4" | `models.py:454 @ 389e43658` `class SubAccount`; comment expand/backfill tại `:505-507`; `provider` `:508-519` (default `''`, blank); `broker_config` `:520-529` (null=True) | **KHỚP** |
| 6 | `models.py:557-614` `PortfolioBrokerBinding` M:N role primary/secondary, unique | `models.py:557 @ 389e43658` class; RoleChoices `:566-568`; unique `:605-608`; `clean()` tiếp tục sau `:611` | **KHỚP** (class dài hơn `:614` do `clean()`, phần khai báo khớp) |
| 7 | `models.py:209-262` Watchlist đã có `source`/`provider`/`broker_account` | `models.py:209 @ 389e43658` class; `source` `:237-243` (manual/derived); `provider` `:244-252`; `broker_account` `:253-262` | **KHỚP** |
| 8 | `models.py:1603-1613` `PositionSnapshot.source` + `broker_account` FK | `models.py:1603 @ 389e43658` `source` (default `'computed'`); `broker_account` FK `:1605-1613` + comment B0.3 tại `:1604` | **KHỚP** (xem F-12 về nhãn "nguồn derived") |
| 9 | `views.py:370-469` WatchlistListCreate + DetailView, chưa filter scope | `views.py:370 @ 389e43658` ListCreate (`get` `:374-390` không đọc `provider`/`broker_account`); Detail `:401-470` | **KHỚP** (grep segment: 0 hit `provider`, 0 hit `broker_account`) |
| 10 | `migrations/0029_brokersyncrun_brokersyncissue.py` = head | Chuỗi deps `0001→…→0029` liền mạch, **1 leaf duy nhất `0029`** (đếm bằng parse deps, 29 file) | **KHỚP** |
| 11 | `broker.js:13-16,135-138` getPortfolioBindings ĐÃ XOÁ, savePortfolioBindings PATCH giữ | `broker.js:13-16 @ 389e43658` comment BE-01; `savePortfolioBindings` tại `:135-141` | **KHỚP** (hàm dài tới `:141`, plan ghi `:138` — lệch 3 dòng, xem F-07) |
| 12 | `routeCatalog.js:147-155` vs `:213-222` TRÙNG id `portfolios-manage` | `routeCatalog.js:147 @ 389e43658` id+titleKey `routes.portfolios`; `:214 @ 389e43658` id trùng+titleKey `portfoliosManage.title` (đếm độc lập: đúng 2 entry, cùng path `/portfolios/manage`) | **KHỚP** (dòng `{` khối 2 tại `:213`, id tại `:214` — trong dung sai) |
| 13 | `sourceBadge.tsx:71-77` MATCHED_ORDER_STATUSES={FILLED,MATCHED} + ghi giới hạn | `sourceBadge.tsx:74 @ 389e43658` `Set(["FILLED","MATCHED"])`; comment giới hạn tại `:67-73`; helper `:76-82` | **LỆCH NHẸ** (xem F-07 — ngữ nghĩa đúng, số dòng trôi ~3) |
| 14 | `BrokerSettingsSection.tsx:64` + `UserSettingsPage.tsx:5,253` bề mặt cấu hình cũ | `BrokerSettingsSection.tsx:64 @ 389e43658` export; `UserSettingsPage.tsx:5 @ 389e43658` import; `:253` mount | **KHỚP** |
| 15 | `PortfolioHoldingsPage.tsx` badge nguồn B2.5 (ngụ ý) | `PortfolioHoldingsPage.tsx:19 @ 389e43658` import SourceBadge; `source?` tại `:44`; comment BE-02 tại `:40-43` ("BE hiện chưa trả per-row"); **0 hit `kind`, 0 banner** | **KHỚP** (đúng trạng thái "partial fail-closed" mà BE-KIND phải sửa) |
| 16 | i18n key mới `brokerWave3.*` (chưa có) | `vi.js`/`en.js`: **0 hit `brokerWave3`** cả hai file @ 389e43658 | **KHỚP** (đúng là việc tương lai) |
| 17 | Cấm `soc.module.css` (barrel 3 dòng) | `soc.module.css:1-3 @ 389e43658` đúng 3 dòng re-export; `soc.tokens.css` + `soc.components.css` tồn tại | **KHỚP** |

Lệnh tái tạo các số liệu trên (chạy từ root repo, đã chạy thật trong phiên audit):

- Trùng route: `python <tmp>/count_route.py` → `total_ids: 67`, `dups: {'portfolios-manage': 2}`, id tại dòng 147/214, titleKeys `routes.portfolios` vs `portfoliosManage.title`.
- Migration leaf: `python <tmp>/count_wave3d.py` → `heads: ['0029']`, `count: 29`, chuỗi deps liền mạch.
- Serializer fields: `python <tmp>/count_wave3c.py` → Portfolio 7 field / SubAccount 14 field / Watchlist 6 field, đúng danh sách thiếu như plan mô tả.
- PATCH-only: `python <tmp>/count_wave3b.py` → `def` tại 572, `@api_view(['PATCH'])` tại 570, segment không có `GET`.
- Watchlist filter: `count_wave3d.py` → `provider-filter-present: False`.
- i18n: `brokerWave3` = 0 cả hai locale; `check-multi-agent.mjs` → exit 0 (73 cảnh báo claim cũ, 0 lỗi).

## 2. CONTRADICTIONS vòng 1 (plan/doc vs code)

- **C-1 (plan vs quy định Owner-chốt).** Plan `§0.20`: "Verify FE chạy LOCAL (vitest/jsdom + build)" | `docs/STAGING_VPS_RUNBOOK.md:427-434 @ 389e43658`: "`npm run test*`/`test:components`/`npm run build` PHẢI chạy VPS… Cấm chạy suite test trên host local", và `:437-441` liệt kê local chỉ được `tsc/eslint/grep` (vitest/build không có mặt). **Tác động:** agent FE làm đúng plan = vi phạm runbook; làm đúng runbook = vi phạm plan. Phải sửa plan hoặc ghi waiver của Owner. → Objection O-1 (vòng 2: ĐÃ ĐÓNG).
- **C-2 (ADR thừa hưởng vs code).** `ADR-005:10-12`: "Mọi danh mục thuộc đúng 1 trong **4** làn" rồi liệt kê **3** (`manual`/`broker_backed`/`aggregate`) | `models.py:29-32 @ 389e43658` `KindChoices` đúng 3 giá trị. **Tác động:** thấp (plan Wave 3 dùng đúng bộ 3), nhưng số "4" sai sẽ gây hoang mang khi implementer đối chiếu. → F-08 (vòng 2: vẫn còn, xem F-19a).
- **C-3 (comment stale trong code vs code, thừa hưởng).** `views.py:229-240 @ 389e43658` (docstring nhánh 409) viết "model `Portfolio` **không có** field archive" và liệt kê field không gồm `kind`/`is_archived` | `models.py:54-64 @ 389e43658` cả hai field đã tồn tại từ migration 0026 (B0.2). **Tác động:** thấp với Wave 3 (B3.2-BE chạm đúng vùng này nên sẽ đọc phải hướng dẫn sai thời). → F-09 (vòng 2: vẫn còn, xem F-19b).
- **C-4 (doc cũ vs code, ảnh hưởng BE-KIND).** `PLAN_MULTI_BROKER_SYNC_20261014.md:87`: Watchlist `+source(manual|broker|derived)` | `models.py:237-243 @ 389e43658` choices chỉ `manual`/`derived`. **Tác động:** trung bình nếu implementer tin doc cũ và sinh giá trị `'broker'` → vỡ validation. Plan Wave 3 (§2: chỉ "expose", không schema mới) đi đúng hướng code — cần ghi rõ "không phát minh giá trị thứ ba". → F-10 (vòng 2: câu cấm vẫn thiếu, xem F-19c).
- **C-5 (plan vs code đã chạy: B3.4(i) mô tả việc đã xong).** Plan `§2-B3.4(i)`: "data-migration backfill `provider=''` từ `broker_source`" như việc Wave 3 phải làm | `migrations/0025_auto_20261014_1713.py:14-41 @ 389e43658` backfill này **đã chạy ở Wave 0** (map `DNSE/SSI/TCBS/TCB`, strip+upper, chỉ link config khi đúng 1 ứng viên tương thích). **Tác động:** BE agent có thể tạo migration backfill trùng (chạy lại vô hại do idempotent nhưng gây nhiễu leaf và lịch sử). → Objection O-4 (vòng 2: ĐÃ ĐÓNG).

## 3. Findings vòng 1

- **[F-01] ERROR | blocker** — "Verify FE chạy LOCAL" vs runbook cấm suite local → O-1 (vòng 2: ĐÃ ĐÓNG).
- **[F-02] GAP | major** — FE-DUPID không chốt giữ entry nào → O-2 (vòng 2: ĐÃ ĐÓNG).
- **[F-03] GAP | major** — chuyển làn `kind` không định nghĩa → O-3 (vòng 2: đóng 90%, dư thành O-5).
- **[F-04] GAP | major** — B3.4 backfill-trùng + gộp 2 bộ đếm → O-4 (vòng 2: ĐÃ ĐÓNG).
- **[F-05] RISK | major** — contract test mù trùng id → giữ grep làm gate chính (vòng 2: ĐÃ ĐÓNG, thiếu ticket uniqueness-assert → F-19g).
- **[F-06] RISK | medium** — guard B3.2 mới nêu 2 ví dụ; kiểm kê write path phải là exit-criterion Pha 0 (vòng 2: plan:58 đã ghi thành exit-criterion — ĐÃ ĐÓNG).
- **[F-07..F-12]** drift chữ/comment minor (vòng 2: rơi mất, còn nguyên @ HEAD → F-19d/e/f).
- **[F-13] RISK | low** — ownership evidence/ledger 2 agent (vòng 2: §7.3 phân auditor/supervisor nhưng evidence `mbw3/*` chưa gắn agent → F-19h).
- **[F-14] INFO** — §6 baseline trung thực (4 dòng "kỳ vọng" + yêu cầu đo lại Pha 0).

## 4. Verdict vòng 1: NEED_REVISION (O-1..O-4 bắt buộc sửa; R-a..R-g reservations khi thực thi)

---

## VÒNG 3 — AUDIT CHỐT O-5 (2026-10-15, HEAD `389e43658`)

- **Auditor:** độc lập với người lập plan · **Chế độ:** read-only (không sửa code, chỉ append file audit này)
- **HEAD đã audit:** `389e43658` (`git rev-parse HEAD` = `389e43658`; `git status --short` sạch ngoại trừ 2 file untracked `docs/PLAN_WAVE3_ISOLATION_20261015.md` + `docs/PLAN_AUDIT_WAVE3_20261015.md`)
- **Tài liệu đã đọc:** plan Wave 3 bản mới nhất (139 dòng) · audit vòng 1+2 trong chính file này · code thật @ `389e43658` (mở đúng file, đọc đúng dòng, trích nguyên văn — L-T02)
- **Lessons áp dụng:** [L-V02, L-T02, L-T01] — gốc rễ kế thừa từ vòng 2 phải đối chiếu code thật trước khi chốt (L-V02); citation là (file, dòng, byte-giải-mã-thành), đã mở đúng file (L-T02); append bằng Edit tool, kiểm `git diff --numstat` sau sửa (L-T01)

### 1. Đối chiếu O-5: `convert` đã có đủ hình hài chưa? → ĐÓNG

Yêu cầu vòng 2 (mục O-5): ghi vào §2 BE-KIND (a) endpoint/method của `convert`, (b) payload, (c) quan hệ với câu "kind read-only qua API", kèm mã lỗi. Plan mới đáp ứng cả 3 tại `plan:59-60`:

- **(a) Endpoint + method + không thêm route: ĐỦ.** Plan viết "`convert` là nhánh mới trên **PATCH `workspace/portfolios/<id>/broker-bindings/` hiện có** (`urls.py:117`, không thêm route)" (`docs/PLAN_WAVE3_ISOLATION_20261015.md:60`). Code thật @ `389e43658`: `packages/core/backend/src/user_workspace/urls.py:117` = `path('workspace/portfolios/<int:portfolio_id>/broker-bindings/', views_broker.portfolio_broker_bindings_api, name='portfolio-broker-bindings')` — route đã tồn tại, khớp đúng số dòng plan trích. View là `@api_view(['PATCH'])` (`packages/core/backend/src/user_workspace/views_broker.py:570 @ 389e43658`), `def portfolio_broker_bindings_api` tại `:572`, dispatch bằng `action` tại `:594` (`action = str(data.get('action', '')).strip().lower()`), hiện chỉ biết `add` (`:598-618`) / `remove` (`:619-625`), còn lại raise tại `:626-629` — điểm mở rộng tự nhiên cho nhánh `convert` thứ 3, không cần động `urls.py`. Khớp đúng nhận định vòng 2 "GET bindings mới không cần động urls.py" mở rộng sang `convert`.
- **(b) Payload: ĐỦ (khác tên key so với đề xuất, không phải blocker).** Plan chốt payload `{action: 'convert', kind: '<manual|broker_backed|aggregate>'}` + confirm 2 bước ở FE (`plan:60`). Vòng 2 đề xuất `{action:'convert', target_kind, confirmed:true}`. Khác biệt duy nhất là tên key (`kind` vs `target_kind`) và vị trí confirm (FE 2 bước thay vì field server `confirmed`). Cả hai đều là contract explicit, đóng băng ở Pha 0, BE/FE cùng đọc 1 plan nên không có cửa hiểu sai; `kind` trùng tên model field nên tự nhiên hơn. Không giữ NEED_REVISION vì khác tên key.
- **(c) Codes từ chối: ĐỦ, chi tiết hơn đề xuất.** Plan liệt kê 3 mã (`plan:60`): `broker_backed_single_account` (giữ hành vi B1.6), `convert_requires_empty` (về manual còn binding), `convert_needs_binding` (sang aggregate/broker_backed mà 0 binding) + "BE kiểm bảng chuyển làn trên số binding **đếm thật trong transaction**". Vòng 2 chỉ yêu cầu 1 mã ví dụ `kind_transition_invalid`. Plan đi xa hơn: phủ đủ 3 cạnh bảng chuyển làn (`plan:49-56`), tái dùng đúng mã đã có trong code (`views_broker.py:604 @ 389e43658` `code='broker_backed_single_account'`), cộng "đếm thật trong transaction" (atomicity). Mọi convert ghi audit (`plan:60`) — tên `ActionChoices` cụ thể vẫn thiếu nhưng đó là F-18 minor, không chặn implementability.
- **(d) Phân biệt 2 write path (contradiction biểu kiến vòng 2): ĐÃ GIẢI QUYẾT BẰNG VĂN BẢN.** Plan viết nguyên văn "`kind` **read-only trên `PortfolioSerializer`** (PATCH portfolio chung không đặt được `kind`) — đường chuyển làn duy nhất là action `convert` dưới đây (O-5 vòng audit 2, không phải contradiction: 2 write path khác nhau, 1 cho phép + 1 cấm)" (`plan:59`). Đây đúng là lối ra vòng 2 yêu cầu. Cơ sở code @ `389e43658`: `PortfolioSerializer.Meta.fields` tại `packages/core/backend/src/user_workspace/serializers.py:98-101` hiện là 7 field, **không có `kind`** (xác nhận read path chưa expose `kind`, BE-KIND thêm `kind` dạng read-only là delta đúng); `PortfolioDetailView.patch` tại `packages/core/backend/src/user_workspace/views.py:186-192` dùng `PortfolioSerializer(portfolio, data=request.data, partial=True)` (`:189`) nên mọi field writable đều set được qua PATCH portfolio chung — bắt buộc `kind` phải `read_only=True` như plan quy định, nếu không BE agent có thể mở `kind` thành writable (đúng mối lo O-5). Plan đã chặn đúng chỗ này bằng 1 câu.

### 2. Reservations F-15..F-19 — đã biết, không chặn mở wave (owner + stage đóng từng cái)

- **[F-15] RISK low — `plan:85` thiếu tag location cho `npm run build`.** Vẫn còn @ bản mới (đúng như vòng 2 dự báo). **Owner: FE · Stage đóng: Pha 2 (§5.3) — thêm "(VPS §12.4)" khi chạm §5.3 hoặc trước PR, không cần audit lại.**
- **[F-16] GAP low — B3.4 (`plan:62`) thiếu 2 lệnh đếm mẫu + cụm "staging/prod-read" mơ hồ.** Vẫn còn. **Owner: BE · Stage đóng: Pha 0/Pha 1 (B3.4) — bổ sung 2 `manage.py shell -c` đếm `SubAccount.provider=''` / `broker_config IS NULL` (chạy VPS §12.3, query read-only staging) khi thực thi B3.4.**
- **[F-17] RISK low — `plan:62` gộp cơ chế NOT NULL của 2 cột.** `provider` đã `null=False` ở DB (migration validation-level `blank=False`), khác `broker_config` (`null=True`, cần 0 NULL thật). Plan chưa tách. **Owner: BE · Stage đóng: Pha 1 (B3.4) — thêm 1 dòng nêu cơ chế từng cột.**
- **[F-18] GAP low — AC2/convert "+ audit" (`plan:60,117`) chưa nêu giá trị `ActionChoices` + fail-open/closed.** `views_broker.py:598-625 @ 389e43658` hiện không ghi audit; `ActionChoices` chỉ có 6 giá trị generic. Plan đã ghi "mọi convert ghi audit" nhưng chưa nêu `CREATE`/`UPDATE` nào + hành vi khi audit hỏng. **Owner: BE · Stage đóng: Pha 1 (nhánh `convert`) — ghi 1 câu vào contract trước khi code.**
- **[F-19] INFO residual (a–h) — re-check @ `389e43658`, còn nguyên, không chặn.** (a) ADR-005:10 "4 làn" vs 3 giá trị thật; (b) `views.py:229-240` comment stale archive; (c) thiếu câu cấm phát minh `source='broker'` cho Watchlist; (d) drift dòng `broker.js:135-141` / `sourceBadge.tsx:71-82`; (e) `models.py:510-512` comment "them 'tcb'"; (f) `plan:34` nhãn "(nguồn derived)" gán cho `PositionSnapshot.source`; (g) thiếu ticket "assert uniqueness id" cho contract test; (h) ownership `docs/evidence/mbw3/*.md` chưa gắn agent. **Owner: PM/supervisor (a, f, g, h) + BE (b, c, e) + FE (d, g) · Stage đóng: trong lúc thực thi, trước PR wave (không cần audit lại).**

### 3. Verdict vòng 3 (chốt): AGREE — O-5 ĐÃ ĐÓNG, đủ điều kiện mở wave với reservations

- **O-5: ĐÓNG.** Action `convert` đã gắn đúng endpoint PATCH `broker-bindings/` (`urls.py:117 @ 389e43658`) + payload explicit + 3 codes từ chối + phân biệt 2 write path (serializer read-only vs `convert` cho phép) tại `plan:59-60`. Vòng 3/3 — không còn blocker/major thật nào để giữ NEED_REVISION.
- **Điều kiện mở wave:** giữ nguyên contract §2 (đóng băng ở Pha 0); F-15..F-19 là reservations, sửa trong lúc thực thi theo owner/stage ở mục 2, không cần vòng audit 4.
- **confidence: high** — mọi khẳng định đã mở file thật @ `389e43658` (`urls.py:117`, `views_broker.py:570,572,594,598-629`, `serializers.py:96-102`, `views.py:186-192`).

---

## VERDICT TỔNG HỢP CUỐI FILE (sau 3 vòng): AGREE — mở wave 3 được, O-5 đóng, reservations F-15..F-19 sửa trong lúc thực thi
