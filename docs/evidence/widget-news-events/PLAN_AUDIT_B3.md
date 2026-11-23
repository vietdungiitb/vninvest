# B3 — Verdict audit độc lập: `docs/PLAN_WIDGET_NEWS_EVENTS_API_20261123.md`

**Verdict: NEED_REVISION** (5 objections, tất cả sửa được trong file plan, không chạm code).
Ngày audit: 2026-11-23 · Branch: `feat/chart-enterprise-demo` · Auditor: subagent độc lập (chỉ đọc).

**Tóm tắt 5 điểm:** (1) Plan bỏ sót claim in-progress `w0-9` đang giữ đúng 2 file SCOPE Task 3 — lỗ hổng lớn nhất.
(2) Plan bỏ sót 2 claim in-progress trên `market.js` (đều đã RELEASE/merge nhưng phải ghi nhận như vet-finish).
(3) Mọi citation `CLAIMS.md:1879/:1936` trong plan đã drift so với file hiện tại (`:1896/:1952`, `:40/:1953`).
(4) Đường dẫn `node_modules/@vninvestcharts/...` sai tiền tố (phải là `packages/web/node_modules/...`) + thiếu chữ ký types chính xác.
(5) Task 2 ghi "chờ release stale" trong khi coordinator đã release từ 2026-11-13 — điều kiện mở khóa diễn đạt sai.
Phần lõi kỹ thuật (contract widget, model BE, news view, mapper plan) **đúng hết** — sửa 5 điểm trên là đạt AGREE.

## Điểm đã verify ĐÚNG (không cần sửa)

- `fetchCorporateEvents?(symbol, from, to)` tồn tại: `packages/web/node_modules/@vninvestcharts/engine-core/dist/index.d.ts:855` (chữ ký thật xem O4).
- Props `:83-89` (`showCorporateEvents`/`corporateEvents`/`corporateEventsMode`), `CorporateEventsOverlay.d.ts:1-11`, helper `widget/adapters/corporateEvents.d.ts:11` — đúng.
- `NewsItem` (`adapter.d.ts:46-56`) + `fetchSymbolNews?(symbol, limit?)` (`adapter.d.ts:76`) — đúng.
- `core_urls.py`: 0 hit `corporate`; news route `:65`; view `:2271-2358` bỏ qua `limit`/`page_size` (chỉ đọc `force`), cache key `stock_news:{symbol}`, TTL 7200 — đúng.
- `CorporateAction` (`models.py:100-151`, DIV/ISS, `ex_date`, unique `source_event_id`) — đúng.
- `createChartStockDataAdapter` (`chartAdapter.js:59-221`), không hàm news/events — đúng.
- `VNStockChartPanel.js:503-506` comment + `showCorporateEvents: false`; test S5 `:63-67` — đúng từng dòng.
- Auth `require_pat_scopes_or_human_session(request, 'market:read')` tại `:1695` và `:2295`; profile events `:1730-1752`; `vnbroker_adapter.py:1186-1203`; `tasks.py:3514` (`sync_all_corporate_actions`); flag `CORPORATE_ACTIONS_ENABLED` `:4044-4061` — đúng.
- `Lessons áp dụng:` có tại plan `:14`; cả 8 ID tồn tại (`L-B01` backend.md, `L-V01/V02/V04` verification.md, `L-T01/T02` tooling-traps.md, `L-F10` frontend.md, `L-F12` frontend.md + css-soc.md).
- SCOPE không chạm deny-list `AGENT_PROTOCOL.md` §2 (AGENTS.md, package.json, CLAIMS.md-append-only, lock files, compose/.env).
- Bằng chứng stale vet-finish đúng: `feat/vet-finish` không tồn tại (local + remote), `d150e5df7` là ancestor của cả `origin/dev` và HEAD.
- `check-multi-agent.mjs` chạy lại: **exit 0** + cảnh báo stale (khớp mô tả plan).
- `eventsTitle` tồn tại cả 2 locale (`locales/vi|en/stockDetail.js:358`); mount `core/v1/` → `market_data.core_urls` (`vninvest_core/urls.py:66`) nên route Task 1 đúng prefix.

## Objections (bắt buộc sửa trong plan)

### O1 — Bỏ sót claim `w0-9-chart-data-unlock` giữ 2 file SCOPE Task 3
- Bằng chứng: `docs/CLAIMS.md:1832` (`in-progress`, từ 2026-10-22) FILES liệt kê `packages/web/src/components/VNStockChartPanel.js` (SUA) + `packages/web/src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts` — đúng 2 file Task 3 SCOPE. Plan §B1 chỉ phân tích vet-finish, không hề nhắc dòng này.
- Giảm nhẹ đã có nhưng plan chưa trích: RELEASE row `docs/CLAIMS.md:1950` (coordinator, `released (stale — superseded by dòng done :1821)`, PR #282 merged 55ae65981, worktree `agent-w0-9` không tồn tại). Lưu ý RELEASE chỉ nêu tên file test; `VNStockChartPanel.js` sau đó đã qua nhiều slice `done` (`:2052`, `:2053`, `:2058` own-branch).
- Đề xuất: thêm mục mirror vet-finish vào §B1 (dòng giữ `:1832` + RELEASE `:1950` + done `:1821`), kết luận Task 3 được làm nhưng **B5 phải re-verify đuôi CLAIMS + `git status`**; nếu `:1832` vẫn `in-progress` mà không có xác nhận coordinator mới thì ghi blocker, không tự sửa đè.

### O2 — Bỏ sót 2 claim trên `market.js` (SCOPE Task 3 sửa file này)
- Bằng chứng: `docs/CLAIMS.md:2032` (`stock-f07-slash`, `in-progress`, FILES có `packages/web/src/adapters/core/market.js`) + RELEASE `docs/CLAIMS.md:2044` (merged PR #480); `docs/CLAIMS.md:2039` (`stock-slow-load`, `in-progress`, FILES có `market.js`) + RELEASE `docs/CLAIMS.md:2047`.
- Đề xuất: thêm 2 dòng vào bảng xung đột §B1 (cùng mẫu stale: done + merged + RELEASE), kết luận `market.js` coi như tự do nhưng B5 re-verify.

### O3 — Citation `CLAIMS.md` đã drift
- Bằng chứng: plan ghi vet-finish `CLAIMS.md:1879` → hiện tại dòng đó là header "PM Review 2026-10-22", dòng in-progress thật là `:1896`; plan ghi "release stale `:1936`" → hiện tại `:1936` là dòng `widget-we-tune` (done), RELEASE thật là `:1952` (vet-finish) / `:1953` (chart-widget-team). Riêng `:40` (chart-widget-team in-progress) vẫn đúng.
- Đề xuất: cập nhật số dòng + thêm 1 câu cảnh báo "số dòng CLAIMS drift theo thời gian (append-only); tra cứu bằng nội dung dòng, verify lại tại B5".

### O4 — Sai tiền tố đường dẫn widget + thiếu chữ ký types
- Bằng chứng: `node_modules/@vninvestcharts/` ở root **không tồn tại** (`Get-ChildItem` fail); thực tế `packages/web/node_modules/@vninvestcharts/` (widget 0.4.7-ent, engine-core 0.5.8 — khớp `package.json`). Task 0 ghi "chỉ đọc `node_modules/@vninvestcharts/widget/dist/*`" sẽ grep sai chỗ.
- Chữ ký thật (`index.d.ts:855`): `fetchCorporateEvents?(symbol: string, from: number, to: number): Promise<any[]>` — `from`/`to` là **number (ms epoch)**, trả `any[]` (không phải `CorporateEvent[]`; chỉ helper widget `corporateEvents.d.ts:11` mới trả `CorporateEvent[]`). Liên quan trực tiếp mapper Task 3 (phải tự gán `timeIndex`).
- Đề xuất: sửa mọi citation thành `packages/web/node_modules/...`, ghi chữ ký đầy đủ vào §0 dòng 20.

### O5 — Task 2 "chờ release stale" diễn đạt sai trạng thái
- Bằng chứng: coordinator đã release stale từ 2026-11-13 (`:1952` vet-finish, `:1953` chart-widget-team, `:1950` w0-9, `:2044/:2047` market.js) theo `AGENT_PROTOCOL.md` §3.4.
- Đề xuất: viết lại điều kiện mở khóa Task 2 thành "coordinator **xác nhận RELEASE `:1952` có hiệu lực** cho `stock_mgmt_native_views.py` (hoặc re-release 1 dòng mới), sau đó mở slice con" — thay vì "chờ release" như việc chưa xảy ra. Giữ nguyên thái độ fail-closed (chưa xác nhận thì vẫn BLOCKED).

## CONTRADICTIONS (plan vs code)

| Plan | Thực tế | Tác động |
|---|---|---|
| §0:20 path `node_modules/@vninvestcharts/engine-core/dist/index.d.ts:855` | File chỉ tồn tại ở `packages/web/node_modules/...:855`; root không có thư mục `@vninvestcharts` | Task 0 grep sai đường dẫn → 0 hit oan (thấp, sửa O4 là xong) |
| §0:20 `fetchCorporateEvents?(symbol, from, to)` (không types) | Thật là `(symbol: string, from: number, to: number): Promise<any[]>` | Mapper Task 3 phải tự gán `timeIndex`, không được assume `CorporateEvent[]` (trung bình) |
| §B1: chỉ nêu vet-finish giữ `stock_mgmt_native_views.py` | Thêm `w0-9` `:1832` giữ `VNStockChartPanel.js` + data-unlock test (Task 3 SCOPE) | B5 có thể DỪNG oan hoặc sửa không ghi nhận (cao nhất trong các mục) |
| Task 2: "BLOCKED chờ coordinator/Owner release stale" | RELEASE đã tồn tại từ 2026-11-13 (`:1952` + 4 dòng khác) | Chờ việc đã xong; mở khóa chỉ cần xác nhận hiệu lực (thấp) |
| §B1: "`core_urls.py` (file này không ai giữ in-progress)" | **ĐÚNG** — grep toàn bộ dòng `in-progress`: không dòng nào liệt kê `core_urls.py` trong FILES (hit duy nhất `:1855` nằm ở cột mô tả) | NONE |
| `CLAIMS.md:1879` vet-finish / `:1936` release stale | Hiện tại `:1879` là header PM Review; in-progress thật `:1896`; RELEASE thật `:1952/:1953`; `:1936` là `widget-we-tune` | Tra cứu sai dòng tại B5 (thấp, sửa O3 là xong) |

Ngoài 6 dòng trên: **NONE** — các khẳng định còn lại của §0 (§core_urls 0 hit, model `:100-151`, news view, auth lines, ingest `:3514`, flag `:4044-4061`, panel `:503-506`, test `:63-67`, chartAdapter `:59-221`, lessons, deny-list, gate exit 0) đều khớp code.

## Lệnh đã chạy để verify

```powershell
git rev-parse --abbrev-ref HEAD  # feat/chart-enterprise-demo
git status --short               # chỉ ?? docs/PLAN_WIDGET_NEWS_EVENTS_API_20261123.md
git branch -a --list *vet-finish*  # rỗng
git rev-parse --verify feat/vet-finish  # fatal (không tồn tại)
git log --oneline -1 d150e5df7
git merge-base --is-ancestor d150e5df7 origin/dev  # exit 0
git merge-base --is-ancestor d150e5df7 HEAD         # exit 0
node packages/web/scripts/check-multi-agent.mjs     # exit 0 + cảnh báo stale
# grep: corporate trong core_urls.py (0 hit corporate, news :65-66); corporate trong market_data (model/ingest/tasks/tests)
# read: engine-core index.d.ts:842-863; VNInvestChartsProps.d.ts:83-89; adapter.d.ts:46-77;
#   CorporateEventsOverlay.d.ts:1-11; corporateEvents.d.ts; models.py:100-151; chartAdapter.js:59-221;
#   VNStockChartPanel.js:495-506 (file 673 dòng); data-unlock test :50-89; stock_mgmt_native_views.py
#   :1695/:2295 (auth), :1730-1752 (profile events), :2271-2358 (news view), :4044-4068 (flag);
#   vnbroker_adapter.py:1140-1211; tasks.py:3481-3547; core_urls.py toàn file; vninvest_core/urls.py:66;
#   i18n locales/vi|en/stockDetail.js:358; package.json (@vninvestcharts/widget 0.4.7-ent, engine-core 0.5.8)
# python3: quét CLAIMS.md (2058 dòng) — in-progress rows + RELEASE rows (:40/:1953, :1896/:1898/:1952,
#   :1832/:1950, :2032/:2044, :2039/:2047, :2052/:2053/:2058 done); LESSONS INDEX + 8 ID tồn tại;
#   AGENT_PROTOCOL.md §2 deny-list
```

## Kết luận

Plan đúng về kỹ thuật, sai/thiếu ở 5 điểm phối hợp multi-agent và citation — đều sửa được bằng edit tài liệu.
Sau khi sửa O1–O5 (ước lượng 15–20 dòng plan), đề nghị chuyển verdict thành **AGREE** (có reservation re-verify CLAIMS đuôi tại B5) mà không cần audit lại toàn bộ.

---

# B3 vòng 2 — Verdict audit lại phần sửa (append, không sửa nội dung vòng 1)

**Verdict vòng 2: NEED_REVISION** (vẫn sống: O1', O2', O3', O4'-một phần, O5'-số dòng).
Ngày audit: 2026-11-23 · Branch: `feat/chart-enterprise-demo` · Phạm vi: CHỈ verify phần sửa theo `B3 revision log` (plan `:170-177`).

**Tóm tắt:** hướng sửa đúng (ghi nhận w0-9, reroute tránh `market.js`, Task 2 MỞ, prefix path, chữ ký types),
nhưng HẦU HẾT số dòng CLAIMS mới trong plan (`:1815/:1821/:1932/:1933/:1879/:1881/:1935/:1936/:2015/:2022/:2023`)
**không khớp file hiện tại** — kiểm tra từng dòng dưới đây. Hai lỗi chữ mới: path lặp tiền tố ở Task 3
(`packages/web/packages/web/...`, plan `:135`) và Step 3 còn ghi `market.js#getCorporateActions` (plan `:139`),
mâu thuẫn với reroute. Nội dung đúng (holder sống `:2039` + branch chưa merge) được xác nhận — xem O2'.

## O1' — MỞ LẠI (số dòng trong plan sai toàn bộ)

- Plan `:173` ghi: in-progress `:1815` + done `:1821` (PR #282) + RELEASE `:1933` + xác nhận `:1932`.
- Thực tế `docs/CLAIMS.md` hiện tại (2058 dòng, `git status` sạch — file không đổi từ vòng 1):
  `:1815` = dòng TRỐNG, `:1821` = dòng TRỐNG,
  `:1932` = dòng `widget-wa-advisory` (in-progress, VNInvestSignalAdapter — không liên quan),
  `:1933` = dòng `widget-wb-tape` (in-progress — không liên quan).
- Dòng THẬT: in-progress `:1832` (giữ `VNStockChartPanel.js` + data-unlock test — y như vòng 1),
  done `:1838` (section "W0.9 Chart Data Unlock — DONE (2026-10-22)"), RELEASE `:1950`
  (nội dung khớp mô tả plan: PR #282, merge 55ae65981, worktree `agent-w0-9` không tồn tại).
- Lưu ý: chữ trong RELEASE `:1950` tự nó trích "`in-progress` tại `:1815`, done tại `:1821`" —
  đó là số dòng THỜI ĐIỂM 2026-11-13, không còn đúng hiện tại. Plan đã copy số dòng lịch sử
  trong chữ của dòng RELEASE ra làm số dòng hiện tại.
- Đề xuất: sửa `:173` + §B1 thành `:1832` / `:1838` / `:1950`; bỏ "xác nhận `:1932`"
  (xác nhận chính là bản thân RELEASE `:1950`).

## O2' — MỞ LẠI một phần (số dòng sai; nhưng "holder sống" ĐÚNG và reroute ĐÚNG)

- Plan `:174` ghi: `:2015` (f07-slash) + `:2023` (done PR #480) + `:2022` (slow-load, branch
  `docs/allsymbols-close-claims` còn, chưa merge).
- Thực tế: `:2015` = `dataops-inventory-hang`, `:2022` = `reaudit-corp-actions-next` (done),
  `:2023` = `corp-actions-followups` — cả 3 đều KHÔNG phải claim market.js.
- Dòng THẬT: in-progress `:2032` (f07-slash giữ `market.js`) + done `:2040` (PR #480 merged `45bf2862f`)
  + RELEASE `:2044`; in-progress `:2039` (slow-load giữ `market.js`) + done `:2041` + RELEASE `:2047`.
- Xác minh branch sống bằng lệnh thật (yêu cầu trong task):
  `git rev-parse --verify docs/allsymbols-close-claims` → `54119a128d5a0794bd35e75cc8a34d7bd94f38a5` (CÒN local);
  `git branch -r --list '*allsymbols*'` → `origin/docs/allsymbols-close-claims` (CÒN remote);
  `git merge-base --is-ancestor docs/allsymbols-close-claims origin/dev` → exit 1 (CHƯA merge).
  → Kết luận "HOLDER SỐNG" của plan là ĐÚNG về nội dung, SAI số dòng (`:2022` → phải là `:2039`).
- Reroute CÓ thật trong SCOPE (plan `:69`: `corporate.js` mới, không còn sửa `market.js`) — ĐÚNG, ghi nhận.
  NHƯNG Task 3 Step 3 (plan `:139`) còn nguyên chữ "`market.js#getCorporateActions`" —
  worker làm theo từng chữ sẽ chạm đúng file đang bị holder sống giữ. Phải sửa thành
  `corporate.js#createCorporateClient`.
- Phụ: plan `:41` trích dẫn "file tự do" sai hết (`:943` là đoạn chữ Stripe, không phải claim row;
  `:2041` là done row của slow-load, FILES không hề có `chartAdapter`/`chartEnterpriseBinding`;
  `:114` là `tenantreg-e` released — đúng là released nhưng giữ `transport.js`, không phải `coreApiAdapter`).
  Nội dung "tự do" thì ĐÚNG (grep toàn bộ dòng `in-progress`: không dòng nào giữ `coreApiAdapter.js`,
  `chartAdapter.js` (hit duy nhất `:1760` DOC-ONLY, FILES chỉ là docs), `chartEnterpriseBinding.js`,
  `transport.js`, `corporate.js` mới) — nhưng phải thay bằng citation đúng hoặc ghi "grep 0 hit".
- Kiểm thêm cho reroute: `coreApiAdapter.js` tồn tại; mẫu `createMarketClient({coreGet, corePost})`
  tại `market.js:7` + nối tại `coreApiAdapter.js:63-64` — khớp plan `:125-126`, factory pattern đủ để
  nối `createCorporateClient` mà chỉ đọc (không sửa) `market.js`.

## O3' — KHÔNG bị refute; ngược lại "O3 BÁC" trong revision log là SAI

- Task yêu cầu: đọc lại `:1879/:1881/:1935/:1936/:40` — kết quả:
  `:1879` = header "PM Review 2026-10-22" (KHÔNG phải vet-finish in-progress);
  `:1881` = dòng header bảng `| agent | branch | ...` (KHÔNG phải done);
  `:1935` = `widget-wd-measure` (done); `:1936` = `widget-we-tune` (done);
  `:40` = `chart-widget-team` in-progress (KHỚP — dòng này vòng 1 đã đúng).
- Dòng THẬT: vet-finish in-progress `:1896`, done `:1898` (Entry 415), RELEASE `:1952`;
  chart-widget-team RELEASE `:1953`.
- Vậy O3 vòng 1 (số dòng plan cũ drift) ĐỨNG VỮNG; mục "O3 (BÁC, có bằng chứng)" ở plan `:175`
  là SAI và phải rút lại. Giải thích nguồn lỗi của plan (để khỏi tái phạm):
  các số `:1879/:1815/:1821` trùng khớp với số dòng **được trích DẪN TRONG CHỮ** của các dòng
  RELEASE/closeout (`:1950` trích "`:1815`/`:1821`", `:1951/:1952` trích "`:1879`") —
  tức số dòng thời điểm 2026-11-13, không phải số dòng hiện tại. Còn `:1932/:1933/:2015/:2022/:2023/:1935/:1936`
  không khớp bất kỳ dòng liên quan nào (kể cả trong chữ) — là số dòng sai hoàn toàn.
- Đề xuất: sửa `:175` thành "O3 ĐÚNG — citation đã cập nhật", thay toàn bộ số dòng §B1/Task 2/SCOPE
  theo số THẬT (`:1896/:1898/:1952`, `:40/:1953`, `:1832/:1838/:1950`, `:2032/:2040/:2044`, `:2039/:2041/:2047`).

## O4' — ĐÚNG 90%, còn 1 typo mới

- Grep toàn plan chuỗi `node_modules`: 4 hit — `:20` ✓, `:78` ✓, `:158` ✓ (đều đã có tiền tố
  `packages/web/`), NHƯNG `:135` ghi `packages/web/packages/web/node_modules/@vninvestcharts/...`
  (lặp tiền tố — copy-paste lỗi; worker dùng path này sẽ ENOENT).
- Chữ ký trong plan (`:135`, `:176`): `fetchCorporateEvents(symbol: string, from: number, to: number): Promise<any[]>`
  KHỚP `engine-core/dist/index.d.ts:855` (sai khác duy nhất dấu `?` optional — chấp nhận được).
- Đề xuất: sửa `:135` thành 1 tiền tố.

## O5' — ĐÚNG về trạng thái, SAI số dòng

- Task 2 đã chuyển MỞ + điều kiện "re-verify `grep in-progress stock_mgmt_native_views`" (plan `:104-106`) — ĐÚNG, ghi nhận.
- Nhưng citation `:1935` (plan `:69`, `:104`, `:106`, `:177`) phải là `:1952`; `:1881` (plan `:38`, `:106`) phải là `:1898`.
- Đề xuất: thay số; giữ nguyên điều kiện re-verify.

## CONTRADICTIONS bổ sung (vòng 2, plan sửa vs file hiện tại)

| Plan (sau sửa) | Thực tế | Tác động |
|---|---|---|
| `:173` w0-9 `:1815/:1821/:1933/:1932` | `:1815/:1821` trống; `:1932` wa-advisory; `:1933` wb-tape; thật `:1832/:1838/:1950` | B5 tra sai dòng (cao — đúng file SCOPE Task 3) |
| `:38` vet-finish `:1879`, done `:1881`, RELEASE `:1935` | `:1879` header PM Review; `:1881` header bảng; `:1935` wd-measure; thật `:1896/:1898/:1952` | B5 tra sai dòng (trung bình) |
| `:39-40` chart-widget RELEASE `:1936` | `:1936` we-tune; thật `:1953` (`:40` in-progress thì đúng) | Thấp |
| `:41` market.js `:2015/:2023/:2022`; "tự do" `:943/:114/:2041/:66` | Thật `:2032/:2040/:2044`, `:2039/:2041/:2047`; `:943` là đoạn chữ Stripe; `:2041` không liệt kê file FE | B5 tra sai dòng (trung bình); nội dung holder sống thì đúng |
| `:135` path `packages/web/packages/web/...` | Path thật có 1 tiền tố | Worker copy-paste → ENOENT (thấp, sửa 1 chữ) |
| `:139` Step 3 `market.js#getCorporateActions` | SCOPE đã reroute sang `corporate.js` mới (`:69`, `:125`) | Worker làm theo chữ sẽ chạm file holder sống giữ (cao — mâu thuẫn nội bộ plan) |
| `:175` "O3 (BÁC, có bằng chứng)" | 4/5 dòng trích không khớp file (chỉ `:40` đúng) | Kết luận audit sai, phải rút lại (trung bình) |

## Lệnh vòng 2 đã chạy

```powershell
# đọc CLAIMS.md hiện tại (2058 dòng): :40 :114 :943 :1815 :1821 :1879 :1881 :1932 :1933 :1935 :1936 :2015 :2022 :2023 :2041
# + vùng :1810-1844 (w0-9 section: in-progress :1832, done :1838) + grep toàn file các row w0-9/vet-finish/f07-slash/slow-load
git status --short  # chỉ plan + thư mục evidence untracked (CLAIMS.md không đổi từ vòng 1)
git log --format='%H %ad %s' -3 -- docs/CLAIMS.md  # mới nhất 59c877da4 (2026-11-22)
git rev-parse --verify docs/allsymbols-close-claims  # 54119a1 (CÒN)
git branch -r --list '*allsymbols*'                   # origin/docs/allsymbols-close-claims (CÒN)
git merge-base --is-ancestor docs/allsymbols-close-claims origin/dev  # exit 1 (CHƯA merge)
git rev-parse --verify feat/stock-f07-slash  # 0071af4 (CÒN local — branch lingering sau merge PR #480)
git branch -r --list '*stock-f07*'           # origin/feat/stock-f07-slash (CÒN remote)
# grep plan: 4 hit 'node_modules' (:20 :78 :135-double-prefix :158)
# read coreApiAdapter.js:1-80 (factory + marketClient :63-64); market.js:1-15 (createMarketClient :7)
```

## Kết luận vòng 2

Plan sửa đúng HƯỚNG nhưng sai SỐ DÒNG ở cả 4 nhóm claim (O1'/O2'/O3'/O5') + 2 lỗi chữ
(path lặp tiền tố `:135`, Step 3 còn `market.js` `:139`) + 1 kết luận audit sai cần rút ("O3 BÁC" `:175`).
**Chưa đạt AGREE.** Vòng 3 chỉ cần: thay ~10 số dòng theo bảng trên, sửa 2 chỗ chữ, sửa `:175`
thành "O3 ĐÚNG". Không cần audit lại kỹ thuật (vòng 1 đã PASS toàn bộ phần code/widget/BE/FE).

---

# B3 vòng 3 (cuối) — Reconcile số dòng + verdict cuối

**Verdict vòng 3: AGREE** (reservation duy nhất: re-verify đuôi CLAIMS + `git status` tại B5).

**1. Reconcile (chốt bằng lệnh, không bằng trí nhớ):** chạy ĐÚNG lệnh chỉ định →
`nlines: 2042`, vet-finish `[1879, 1881, 1934, 1935, ...]`, w0-9 `[1815, 1821, 1932, 1933]`,
chart-widget-team `[40, 1934, 1936, 1939]`, stock-f07-slash `[2015, 2023, ...]`,
stock-slow-load `[2022, ...]` — KHỚP plan, KHÁC số vòng 2 của tôi (`:1832/:1896/...`).
Nguyên nhân (đo thật): file chứa 10 byte VT (`0x0b`) + 7 byte FF (`0x0c`), CẢ 17 byte
nằm trước LF-line 1879; `.decode().splitlines()` của tôi tách thêm tại đó (+17),
còn `split(b'\n')` không tách. Đếm LF (2041 ký tự `\n`) là chuẩn xác định.
`git log -1 -- docs/CLAIMS.md` = `59c877da4` (2026-11-22, trước cả vòng 1) +
`git status` sạch → file KHÔNG đổi giữa các vòng; lỗi là phương pháp đếm của tôi,
không phải drift. (NUL tại LF-line 1116 đã xác nhận — chỉ giải thích read-tool báo binary.)
Byte-check: LF-1933 và LF-1935 đều chứa `RELEASE`.

**2. Rút lại:** toàn bộ yêu cầu "đổi số dòng" ở vòng 2 (O1'/O2'/O3'/O5') được RÚT —
số trong plan (`:1815/:1821/:1932/:1933`, `:1879/:1881/:1935/:1936/:40`,
`:2015/:2022/:2023`) là ĐÚNG theo đếm LF. Claim O3-vòng-1 "citation drift" cũng RÚT
theo (cơ chế tưởng là drift hóa ra là lệch đếm của auditor); mục "O3 BÁC" trong
revision log của plan ĐỨNG. Nội dung vòng 2 đã xác nhận (w0-9 stale-released `:1933`,
vet-finish stale-released `:1935`, holder sống `:2022` + branch `docs/allsymbols-close-claims`
chưa merge — verify bằng `rev-parse`/`branch -r`/`merge-base`) giữ nguyên giá trị,
chỉ thay số dòng theo byte-verified.

**3. Defect chữ đã sửa:** `packages/web/packages/web` = 0 hit;
`market.js#getCorporateActions` = 0 hit (reroute `corporate.js` giờ nhất quán toàn plan).

**Kết luận cuối:** plan đạt kỹ thuật (vòng 1) + phối hợp multi-agent đúng số dòng (vòng 3).
Cho qua B4 đồng thuận → B5 khai claim. Reservation: tại B5 đọc lại đuôi CLAIMS
(số dòng trích theo đếm LF) + `git status`; file ai giữ `in-progress` thì DỪNG.
