# AUDIT — Handoff Wave 1 (widget feature leverage) + Kế hoạch thực hiện tiếp

> Ngày: 2026-11-12. Nguồn handoff: `docs/evidence/widget-feat-leverage/HANDOFF_WAVE1_20261112.md` + `JOURNAL_20261112.md` (Entry 0/W-A..W-F-MERGE/OWNER-DECISIONS/HANDOFF) + `docs/PLAN_WIDGET_FEATURE_LEVERAGE_20261112.md`. Base: `origin/dev` @ `f4562a5bd` (PR #350 merged). Branch hiện tại: `feat/widget-handoff-wave1` (chỉ docs, không code production).
> Audit do: agent hiện tại (solo, không multi-agent). Mục tiêu: rà soát handoff đội trước, xác minh sự thật bằng code/gate, lập kế hoạch Wave 1 (W-G..W-K) + các việc dở.

## 0. Tóm tắt điều hành

- **Wave 0 HOÀN THÀNH 6/6** (W-A advisory, W-B tape, W-C boundary/empty, W-D measurement, W-E CVD/timezone, W-F upsell/telemetry) đã merge PR #342–#347, ledger Entry 457–462. Handoff Wave 1 là chính xác về trạng thái merge.
- **Baseline đã xác minh lại** (không tin số): `npx tsc --noEmit` exit 0; vitest panel data-unlock 18/18; utils 14/14; `check-ledger-entry` 74/74 max=462; `check-multi-agent` 0 lỗi (chỉ warning stale path trong claim cũ). Handoff nói "123/123 (17 file)" — **CHƯA CHẠY lại full subset** (timeout infra >15p), ghi CHƯA CHẠY trung thực. Không suy diễn.
- **Wave 1 (5 slice M) CHƯA BẮT ĐẦU** — Owner đã chốt scope (§8 plan: W-G đăng ký catalog; W-H localStorage first; W-L enterprise only; advisory giữ cả hai). Unblocked về quyết định.
- **Blocker ngoài scope Wave 1**: W-M corporate events overlay chờ BE endpoint (roadmap W5.3, [X]); smoke E2E staging Pro cần key/VPS; pro-path live verify cần BE subscription pro test; `registerProExtension` chờ key vni1.*.
- **B3 re-audit 2026-11-12 đổi thứ tự Wave 1** (không đổi scope Owner):
  - **W-I: premise SAI** — drawings **đã persist mặc định** (`rsc-drawings-v1-<symbol>-<tf>`) vì panel chạy uncontrolled. W-I re-scope còn: bỏ mount `DrawingDock` chết + guard test + characterization test cho persistence.
  - **W-J: prop chết** — `onDrawingAlert` có trong dts nhưng bundle 0.4.4 không đọc từ props; widget tự render alert host local-only; alert center app không có endpoint create. → defer.
  - **W-K: prop TỒN TẠI** — correction: `onComparisonChange` ở `VNInvestChartsProps.d.ts:291`, widget gọi thật khi overlays đổi. Thêm mã qua ref `addCompareSymbol`; khả thi.
  - **W-H: NEED_REVISION** — `workspaceId` không thuộc props; single chart tự lưu pane layout vào key nội bộ `rsc-pane-layout-v2`; serializer chỉ dùng trong SettingsModal export/import; không có `getPanes()` trên ref. Cần host UI + quyết định shape → hoãn.
- **Thứ tự thực thi mới**: W-I (nhỏ) → W-K (khả thi) → W-J (defer) → W-H (defer, cần thiết kế). Tất cả FE-only, không BE/migration → không chạm deny-list.
- **Tiến độ (cập nhật sau W-I)**: **W-I DONE** — PR #351 merged (`05aa8271a`), ledger Entry 464, claim `widget-wi-drawing-persist` → done. **Tiếp theo: W-K.**

## 1. Audit handoff — verify sự thật

### 1.1 Đã xác minh (code/gate thật)

| Claim handoff | Verify | Kết quả |
|---|---|---|
| Wave 0 6/6 merged PR #342–#347 | `git log --oneline` | ✅ merge commits `191d2f8ca`, `68088815e`, `51f25e9d3`, `089711e`, `f515f5d`, `64fbbea` có trong `origin/dev` |
| `origin/dev` @ `42e51ce2f` + handoff PR #350 | `git rev-parse origin/dev` | ✅ `f4562a5bd` (handoff merge) |
| tsc 0 | chạy thật | ✅ exit 0 |
| panel data-unlock 18/18 | vitest thật | ✅ |
| utils 14/14 (advisory 8 + tape 6) | vitest thật | ✅ |
| check-ledger-entry max=462 | chạy thật | ✅ 74/74 |
| check-multi-agent 0 lỗi | chạy thật | ✅ (chỉ warning stale path claim cũ) |
| Orphan untracked 6 entry | `git status --short` | ✅ 6 entry (3 file + a4-roadmap dir + 2 file). Handoff ghi "7" — minor (đếm file trong dir). |
| `VNStockChartPanel.js` ~480 dòng, props W-A..W-F đã wire | đọc file | ✅ 508 dòng, đầy đủ props advisory/tape/measurement/cvd/timezone/upsell/telemetry |
| `VNInvestSignalAdapter.js` pure mappers | đọc file | ✅ mapToOHLCVBars, mapToWhaleOrders, mapToCvdSeries, mapTapeTradesToEntries, mapAdvisorySessionToResult |
| `useTenantTier` tồn tại | đọc | ✅ (P3.4 app-side) |
| Widget 0.4.4 + engine 0.5.6 + pro 0.4.4 | package.json | ✅ |
| `registerIndicators` không ở widget, ở engine-core | grep node_modules | ✅ `engine-core/dist/index.d.ts` |

### 1.2 Stale / không verify được (ghi rõ, không suy diễn)

1. **`staging-pro-layout2` (full-bleed StockDetailPage)** — handoff nói claim `in-progress` của session khác, nhưng **không có claim row trong CLAIMS.md** và **không có branch local**. Có thể claim row nằm trên branch chưa merge hoặc orphan. → **KHÔNG ĐỤNG `StockDetailPage.*`** cho đến khi xác minh (đúng handoff §1). Advisory tab riêng trên StockDetailTabs vẫn giữ cả hai (Owner chốt).
2. **Orphan untracked files** (6 entry) — thuộc session khác/archive. Handoff dặn stash `-u` trước `agent-sync`. **Rủi ro**: `git stash push -u` sẽ stash cả 2 file `staging-pro-layout/*` thuộc claim khác → có thể gây conflict khi pop. → Khi thực hiện slice, stash **có pathspec loại trừ** 2 file staging-pro-layout, hoặc dùng `git stash push -u -- <paths>` chỉ file của mình. Ghi rõ trong plan.
3. **Baseline "vitest 123/123 (17 file)"** — CHƯA CHẠY lại (timeout infra >15p). Đã verify subset nhỏ (panel 18 + utils 14). Full subset ghi CHƯA CHẠY trung thực.
4. **`check-multi-agent` warning stale path** — claim cũ ghi file không tồn tại (e.g. `packages/web/src/types/vninvestcharts-widget.d.ts` đã xoá ở PR #321). Không blocker, nhưng làm nhiễu gate. → Có thể dọn claim text sau, ngoài scope Wave 1.
5. **Lint errors pre-existing (2)** ở `ShellMailConfigPage.tsx`, `VipLocalControlPage.tsx` — không liên quan widget, giữ nguyên.

### 1.3 Contradictions plan ↔ code (nếu có)

- Plan §1 baseline ghi `VNStockChartPanel.js` 362 dòng; thực tế 508 dòng (đã tăng qua W-A..W-F). → Plan §1 stale, không ảnh hưởng Wave 1 (đọc file thật trước code).
- Plan §8 có 2 bản câu hỏi (đã chốt + chờ) — Owner đã chốt 5/5 (Entry OWNER-DECISIONS). Plan §8 phần "CHỜ" là stale. → Dùng bản đã chốt.

## 2. Inventory việc dở (ngoài Wave 1)

| # | Việc | Trạng thái | Blocker | Ưu tiên |
|---|---|---|---|---|
| I-1 | Smoke E2E staging Pro (dock tabs advisory/tape, boundary/empty copy, measurement, CVD histogram, upgrade nudge) | CHƯA CHẠY | key/VPS + SSH | P2 (sau Wave 1) |
| I-2 | Pro-path live verify (BE tạo subscription pro test trên staging) | CHƯA CHẠY | BE data | P2 |
| I-3 | `registerProExtension` khi Owner phát hành key vni1.* | Blocked | Owner key | P3 |
| I-4 | Envelope BE/widget thống nhất cho widget-internal gating | Blocked | BE contract | P3 |
| I-5 | E2E full | CHƯA CHẠY | infra | P3 |
| I-6 | whaleThreshold + zoomSpeed/maxVisibleBars/historyMinResidentBars wire | Cắt no-guess (W-E) | bằng chứng unit | P3 |
| I-7 | Corporate events overlay (W-M) | Blocked BE (roadmap W5.3) | BE endpoint | Wave 2 |
| I-8 | Multi-chart workspace (W-L) enterprise | Wave 2 | tier gating + bundle | Wave 2 |
| I-9 | Bar replay (W-N) | Wave 2 | UI controls | Wave 2 |
| I-10 | Pre-existing lint errors (2 file) | Không liên quan | — | P4 |

## 3. Kế hoạch Wave 1 (W-G..W-K)

Owner đã chốt scope (không hỏi lại). Chạy theo vòng kín `workflow-dev-loop`: project-lessons → journal plan → B3 audit độc lập → khai claim → TDD fail-before → code → gates → B8 re-audit → ledger + claim done → PR → merge → verify parent → journal MERGE.

### 3.1 Thứ tự slice & dependency

| Thứ tự | Slice | Effort | Phụ thuộc | File chạm (dự kiến) | Ghi chú |
|---|---|---|---|---|---|
| 1 | **W-I** Drawing persistence (verify default + guard) | S | không | panel + 2 test | ✅ **DONE** — PR #351 (`05aa8271a`), Entry 464. Premise SAI: persistence đã bật mặc định. Thay đổi thật: `showDrawingDock: isPro` (pro có drawing dock; trước đó nút toggle bấm vô hiệu) + bỏ mount `<DrawingDock>` chết + S19/S20 + characterization test. |
| 2 | **W-K** Comparison overlays | S | không | panel + utils mới + test | ✅ **Re-scope S**: widget ĐÃ có UI compare (nút compare → CompareModal có symbol search) ⇒ host chỉ **quan sát**: wire `onComparisonChange` + chip "đang so sánh" + nút xoá (`removeCompareSymbol`). Không tier-gate (widget không gate). |
| 3 | **W-J** Drawing alerts → alert center | — | — | — | **DEFER**: prop `onDrawingAlert` chết trong bundle 0.4.4; alert center không có create endpoint. |
| 4 | **W-H** Workspace serializer (layout save/share) | L | cần thiết kế | host UI + internal key | **DEFER**: `workspaceId` dead prop; serializer chỉ dùng SettingsModal; không có `getPanes()` trên ref. |
| — | **W-G** Custom indicator registration | — | — | — | **BỎ** (doc-only, Owner chọn Option A 2026-11-12): registry math-only, chart không đọc registry. |

**Gợi ý gộp**: W-I và W-K cùng chạm panel nhưng khác mục đích → tách PR. W-J/W-H defer, không gộp.

### 3.2 Gates bắt buộc mỗi slice (không báo PASS cho thứ chưa chạy)

- `npx tsc --noEmit` (packages/web) — exit 0
- `npm run build` — PASS (ghi thời gian thật)
- vitest subset: `src/utils` + panel test + `src/features/stock-detail` + hooks liên quan (không full 181 file — timeout infra)
- `check-multi-agent` — PASS
- `check-ledger-entry` — PASS (max tăng +1)
- B3 audit độc lập (subagent read-only) — PASS/NEED_REVISION → sửa journal
- B8 re-audit độc lập — PASS trước merge
- eslint: 0 errors mới (4 warnings có sẵn không tính)
- Ledger Entry mới + claim done + journal MERGE
- Verify merge parent chứa đủ commit local (`git log <merge>^2`)

### 3.3 Rủi ro & guard

1. **TDZ runtime** (bài học W-C): test source-scan + tsc xanh nhưng runtime crash. → B8 đọc độc lập là tuyến phòng thủ; mọi `useState` mới khai trước effect dùng nó.
2. **BOM PowerShell** (bài học W-A): `Set-Content -Encoding utf8` thêm BOM phá `check-ledger-entry`. → Dùng `edit` tool cho ledger/claims; nếu lỡ PowerShell, strip BOM ngay.
3. **Merge parent thiếu commit** (PR #341): trước `gh pr create` luôn `git status` + `git log origin/<branch>..HEAD`.
4. **Full vitest timeout >15p**: chạy subset, ghi CHƯA CHẠY trung thực. Không suy diễn "chắc là được".
5. **Stash orphans**: stash với pathspec loại trừ 2 file staging-pro-layout (thuộc claim khác). Hoặc để untracked (không ảnh hưởng build/tsc). Khuyến nghị: **không stash**, để untracked; chỉ đảm bảo không commit nhầm (kiểm tra `git status --short` + `git diff --cached` trước commit).
6. **Claim identity**: tên agent trong CLAIMS.md PHẢI bằng tên branch bỏ tiền tố. Khai claim trước dòng code đầu.
7. **No `npm install`** khi chưa hỏi (junction node_modules dùng chung).

### 3.4 Bẫy môi trường (đọc trước dòng code đầu — handoff §4)

1. Không có `pwsh` — chỉ `powershell` 5.1. `agent-sync.ps1` exit 1 ở cuối do gọi nội bộ `pwsh` (sau khi đã xong). Chạy bù bằng tay: `check_opencore_doc_sync.ps1` + `check_large_files.ps1`.
2. `Set-Content -Encoding utf8` thêm BOM → dùng `edit` tool.
3. Verify merge parent sau `gh pr merge`.
4. Full vitest 181 file timeout >15p → subset.
5. Test source-scan KHÔNG bắt TDZ runtime → B8 độc lập bắt buộc.
6. Claim row sửa bằng node script (tránh lệch encoding khi edit có dấu); kiểm tra `git diff` row không bị nhân đôi.

## 4. Kế hoạch chi tiết từng slice (Wave 1)

### W-G — Custom indicator registration (M) — ⚠️ B3 audit: NEED_REVISION (plan không implementable như viết)

**B3 verdict (subagent read-only, 2026-11-12):** Widget indicator registry (`registerIndicator` trong widget, singular, `IndicatorDefinition`) là **math-only kernel** — `compute(bars)` chỉ nhận bars, không có injection contract cho dữ liệu ngoài (whale orders, CVD series), và chart **không đọc** registry khi render (0 internal call site `getIndicator` trong bundle). Prop `indicators`/`customIndicators`/`registeredIndicators` **không tồn tại** trong `VNInvestChartsProps.d.ts`. Chỉ có prop chuyên biệt: `enableWhale`/`whaleThreshold`/`whaleOrders`, `enableCVD`/`externalCvdSeries`/`cvdMode`, `darkFlowStrength`/`darkFlowSignalType`. Dark Flow badge (`DarkFlowBadge`) tồn tại trong `lib/indicators/overlays/` nhưng **không được export** từ public-api và có 0 reference trong bundle → không wired.

**Hệ quả:**
- Whale & CVD VN **đã bật/tắt được qua widget settings UI** (`showWhaleFlow`/`showCVD`) + prop chuyên biệt — đã wire đầy đủ trong panel (W-A..W-F era). Đăng ký qua `registerIndicator` sẽ **không** thêm vào picker/settings → công việc thừa, không đạt AC "user bật/tắt qua UI widget".
- Dark Flow **không có đường toggle nào** hiện tại (badge đã bị gỡ ở cleanup Entry 441 theo quyết định sản phẩm). Không thể host-overlay vì `DarkFlowBadge` không export. Bật lại = sửa widget package (vi phạm non-goal) hoặc chờ widget wiring.

**Đề xuất re-scope (cần Owner xác nhận):**
- **W-Ga (doc-only, S)**: ghi nhận trong plan + evidence rằng Whale/CVD đã toggle qua widget settings (không cần code). Cập nhật `MASTER_TRACKING` indicator count (7 → 7, không tăng).
- **W-Gb (blocked, L)**: Dark Flow re-enable chờ widget export `DarkFlowBadge` hoặc prop `darkFlowStrength` wired. Giữ non-goal "không sửa widget".
- **Hoặc bỏ W-G hoàn toàn** và chuyển sang W-H (localStorage serializer, unblocked, rõ ràng).

**KHÔNG implement W-G theo kế hoạch gốc** (registerIndicators engine-core) — sẽ tạo dead code và không đạt AC.

**Sự thật cần verify trước code (B3)**:
- `registerIndicators` signature: `registerIndicators(entries: readonly IndicatorCatalogEntry[])` (engine-core dts :1399). Cần đọc `IndicatorCatalogEntry` shape (grep dts).
- Widget có expose `registerIndicators`/`getIndicator`/`listIndicators` không, hay phải gọi trực tiếp engine-core? Handoff baseline ghi widget export `getIndicator`/`registerIndicator`/`registerIndicators`. Verify bằng grep widget dist.
- Data adapter: whale/dark-flow/CVD hiện truyền qua prop `whaleOrders`/`enableCVD`/`externalCvdSeries`. Đăng ký thành indicator ⇒ cần adapter data → indicator series. Xem `chartAdapter.js` + `mapToWhaleOrders`/`mapToCvdSeries`/`orderFlowData`.

**Thiết kế smallest diff**:
- new `src/lib/widgetIndicators.js`: định nghĩa 3 `IndicatorCatalogEntry` + hàm `registerVNIndicators()` gọi `registerIndicators([...])` idempotent (guard đã register).
- Gọi ở module scope panel (hoặc lazy khi widget load) — phải sau khi engine-core available.
- Giữ prop path hiện tại (không xóa) để không phá demo-parity; indicator catalog là additive.
- Test: source-scan assert `registerIndicators` + 3 id; unit test pure (nếu mapper pure).

**Rủi ro**: adapter data sai → test fail-before + verify staging. Bundle size indicator registration nhẹ (chỉ metadata). Không thêm dependency.

**AC đo được**: widget catalog hiển thị 3 indicator mới; `listIndicators()` chứa id; test assert registration call.

### W-H — Workspace serializer (M)

**Mục tiêu**: lưu/khôi phục layout pane/indicator/drawing qua localStorage (Owner chốt localStorage first, không BE/migration).

**Sự thật verify**:
- Widget export `WorkspaceSerializer` (public-api.d.ts). Đọc dts shape: props/methods (serialize/deserialize/storage key).
- Panel đã có `workspaceId` prop (`workspaceId ?? \`stock-${symbol}\``). Serializer có thể dùng workspaceId làm key.

**Thiết kế**: new component `WorkspaceToolbar` (hoặc hook) dùng `WorkspaceSerializer` + localStorage; wire `showWorkspaceToolbar`? Hiện chưa set (W0.9). Thêm prop `showWorkspaceToolbar: true` + serializer. Test source-scan.

**B3 verdict (subagent read-only `ses_e3080cefaffeSpsdx8karBR6fq`, 2026-11-12): NEED_REVISION (partial).**
- `workspaceId` panel đang truyền (`VNStockChartPanel.js:405,483`) **không thuộc `VNInvestChartsProps`** → dead prop.
- Single chart **đã tự lưu pane layout** vào key nội bộ `rsc-pane-layout-v2` (raw localStorage, không scope theo symbol/user) — không cần serializer cho AC "layout survives reload".
- `WorkspaceSerializer` public nhưng chỉ được dùng trong `SettingsModal` export/import workspace JSON; capability `share_local` = pro.
- `WorkspaceManager`/`WorkspaceToolbar` **không export**; ref không có `getPanes()` → host không đọc/ghi workspace state sạch được.
- Hệ quả: muốn "save/share layout" phải (a) đọc key nội bộ `rsc-pane-layout-v2` (fragile, schema drift), hoặc (b) remount chart với layout mới. Rủi ro cao, cần Owner chốt shape (toolbar riêng? dùng export/import của widget?). **Hoãn sau W-I/W-K.**

**Rủi ro**: schema drift → version schema + migration (localStorage version field). Scope cắt: chỉ layout pane/indicator, không drawing (W-I riêng).

### W-I — Drawing persistence (M) → re-scope **S** (premise SAI)

**Mục tiêu gốc**: drawings persist across reload qua localStorage adapter.

**B3 verdict (tự verify bằng source bundle + dts, 2026-11-12): premise SAI — persistence đã bật mặc định.**
- `VNInvestChartsProps.d.ts:45-46` có `drawingStorageKey` + `drawingStorageAdapter` (optional).
- Chuỗi forward: `Rp` (VNInvestCharts) spread `...e` → `S_` → `sD({...e, ...})` → `useDrawingWorkspaceController` (widget bundle, các offset 349103/863697/899452).
- `useDrawingWorkspaceController` bật storage khi `enabled && !isControlled` (`engine-react/dist/index.js`, `isControlled = drawings !== void 0`). Panel **không** truyền `drawings`/`defaultDrawings` → uncontrolled → **storage chạy**.
- Default adapter: `createLocalStorageAdapter(DRAWINGS_KEY_PREFIX = 'rsc-drawings-v1')`; key = `rsc-drawings-v1-<encodeURIComponent(symbol)>-<timeframe>` (`engine-drawing/dist/index.js`, `drawingsKey`). Lưu debounce 300 ms + flush khi unmount.
- ⇒ AC "drawings persist across reload" **đã đạt** mà không cần prop nào. Test reload hiện chưa có → thêm characterization test.
- **Dead wiring phát hiện thêm**: panel mount `<DrawingDock workspaceId=...>` (`VNStockChartPanel.js:483`) nhưng `DrawingDockProps` yêu cầu `isOpen`/`activeTab`/`labels`/`onClose`/`onTabChange`; thiếu `isOpen` → component `return null`. Dock thật do widget tự render (`jg` + controller state).
- **Giới hạn ghi nhận (follow-up, không làm trong W-I)**:
  - Không có prop public `onStorageError` trên `VNInvestCharts` → quota error chỉ `console.warn`, không toast.
  - Key không scope user/tenant → cùng browser đổi account vẫn thấy drawings cũ (privacy). Cần Owner quyết định scope + migration trước khi đổi prefix (tránh orphan drawings).
- **Không đổi `drawingStorageKey`/prefix** trong slice này: đổi prefix sẽ orphan toàn bộ drawings đã lưu dưới `rsc-drawings-v1-*`.

**Thiết kế (re-scope)**:
- Bỏ mount `DrawingDock` chết khỏi panel (giữ import nếu còn dùng? không — xoá cả destructure nếu không dùng).
- Thêm comment ngắn tại panel: persistence là default của widget; **không** truyền `drawings` (controlled-mode sẽ tắt persistence).
- Test:
  - `S19` source-scan: panel không mount `DrawingDock` standalone (fail-before khi chưa xoá).
  - `S20` source-scan: panel không truyền `drawings`/`defaultDrawings` + có `drawingUiEnabled: true` (guard uncontrolled).
  - Characterization test mới (jsdom): `useDrawingWorkspaceController` lưu/đọc drawings qua default adapter theo `symbol|timeframe`; remount → load lại; assert key thật `rsc-drawings-v1-...`.

**AC đo được**: test S19 đỏ trước khi xoá dock, xanh sau; test persistence roundtrip xanh; tsc/build/vitest subset xanh; doc ghi rõ follow-up quota + tenant scope.

**Rủi ro**: thấp. Không đổi hành vi người dùng (dock chết vốn render null). Không đụng key lưu trữ.

**B8 verdict (subagent read-only `ses_e305d84f0ffeKRDuqjkRq2jvLH`, 2026-11-12): NEED_REVISION — 0 blocker, core code ĐÚNG.**
- Đúng prop: `showDrawingDock?: boolean` (`VNInvestChartsProps.d.ts:256`), phân biệt `showDock` (right dock, `:236`) vs `showDrawingDock` (drawing dock). `enableDrawingDock` không có consumer nào (grep toàn repo; `StockDetailPage.tsx:279` không truyền).
- **Sửa theo verdict**: (1) comment mô tả đúng `jg()` null khi `!showDrawingDock && !forceOpen` **và** chỉ render khi `dock.isOpen`, nội dung dock nằm trong right dock ⇒ gate thật là `showDock: isPro`; (2) P1 poll storage thay vì sleep 400ms (debounce 300ms ⇒ margin 100ms dễ flaky); (3) S20 chặn thêm `drawingStorageKey:`/`drawingStorageAdapter:`/`instanceId:`; (4) ledger Entry 464.
- **Lỗ phát hiện nhờ B8 (MINOR 7):** `packages/web/tsconfig.json` exclude `src/**/*.test.*` ⇒ `npm run build` **không** type-check file test mới. Chạy `tsc` riêng ⇒ bắt lỗi TS thật (`Property 'state' does not exist on type 'never'`) ⇒ sửa bằng holder object. **Mọi slice sau có file test mới phải tsc riêng.**
- **Follow-up (không làm trong W-I):** nút toggle drawing dock cho free tier bấm vô hiệu (pre-existing, cần ticket widget) · widget không forward `onStorageError` (quota chỉ `console.warn`) · key drawing chưa scope user/tenant (cần Owner chốt scope + migration) · `workspaceId` dead prop (để riêng W-L/W-M).

### W-J — Drawing alerts → alert center (M) → **DEFER**

**Mục tiêu**: `onDrawingAlert(drawing, condition, currentPrice)` wire vào alert center.

**B3 verdict (2026-11-12): KHÔNG khả thi như plan.**
- Prop `onDrawingAlert` **có** trong dts (`VNInvestChartsProps.d.ts:209`, `widgetHelpers.d.ts:264`) nhưng bundle 0.4.4 **không đọc từ props**: grep `onDrawingAlert:` chỉ có 1 hit duy nhất trong internal overlay (`OA`, truyền vào `useDrawingAlertEvaluator`), 0 hit `onDrawingAlert)`/`onDrawingAlert,`/`onDrawingAlert=`. → public prop **chết**.
- Widget tự render alert host `FA({enabled: xn.allows("alert_drawing"), ...})` ngay trong content — local-only (`data-local-only="true"`), không callback ra host. Có license capability `alert_drawing` mới bật.
- Alert center app: `useAlertCenterActions` chỉ ack/mute/seen + refetch; grep `createAlert`/`pushAlert` không có endpoint tạo alert từ client. → không có đích để push.
- Hệ quả: muốn "drawing alert → alert center" phải sửa widget (export callback/event) hoặc thêm BE endpoint create alert + polling. Cả hai ngoài scope Wave 1 FE-only.

**Thiết kế (defer)**: ghi nhận limitation; nếu Owner muốn, mở ticket widget-side (export `onDrawingAlert` đúng nghĩa) + BE alert-create endpoint. Không wire prop chết (sẽ tạo dead code, không ai gọi).

**Rủi ro**: không có. Chỉ doc.

### W-K — Comparison overlays (M) → **KHẢ THI** (correction)

**Mục tiêu**: host thêm/bớt mã so sánh + quan sát overlay state.

**B3 verdict (2026-11-12): prop TỒN TẠI (correction so với audit trước).**
- `VNInvestChartsProps.d.ts:291` — `onComparisonChange?: (overlays: any[]) => void;` (trong interface `VNInvestChartsProps`, dòng 29-325). Bundle gọi thật: `oe.current?.(fe.overlays)` mỗi khi overlays đổi.
- Thêm/bớt mã: ref methods `addCompareSymbol` / `removeCompareSymbol` / `getCompareOverlaySymbols` / `getCompareOverlayEntries` (`widgetHelpers.d.ts:118-130`; multi-chart delegate cùng tên). `SettingsModal`/`IndicatorsSettingsTab` chỉ có remove/update, **không có add** → host phải gọi ref để thêm.
- `VNStockChartPanel` đã có `chartRef` (`:358`, truyền `ref: chartRef` `:460`) → dùng được ngay, không cần prop mới từ widget.

**Thiết kế (SAU B3 sâu hơn — re-scope S: host CHỈ QUAN SÁT, không làm UI thêm mã).**
- **Widget ĐÃ có UI compare sẵn**: toolbar drawing có nút compare (`YA`: `title: g("header.compareTitle")`, **không** tier-gate) → mở modal `Yh` (CompareModal) = **symbol search** + list overlay + thêm/xoá/chuyển % normalize. Series overlay tạo khi map `visiblePanes`: `type:"Comparison", overlaySymbolId, valueMode: percent|absolute`.
- ⇒ Premise plan "app phải tự làm UI chọn mã so sánh" là **THỪA** (tránh UI trùng). Thiếu thật: host **không quan sát** được overlays (prop `onComparisonChange` chưa truyền) ⇒ user không thấy mình đang so sánh mã nào ngoài modal widget.
- **Đã làm**: state `comparedSymbols` + `handleComparisonChange` (→ prop `onComparisonChange`) + `handleRemoveComparison` (→ `chartRef.current?.removeCompareSymbol?.(sym)`) + **chip row** "Đang so sánh:" (chỉ render khi có overlay) có nút xoá `aria-label` tiếng Việt có dấu + pure mapper `mapComparisonOverlaysToSymbols` (file mới `src/utils/comparisonOverlayAdapter.js`).
- **KHÔNG tier-gate**: widget không gate compare (`chart_compare` chỉ nằm trong PAT map, không có runtime check trong đường compare) ⇒ free cũng thấy nút compare của widget; host tự gate sẽ lệch hành vi (chip biến mất trong khi widget vẫn cho thêm).
- **KHÔNG làm input thêm mã** (widget đã có modal search).

**Rủi ro**: overlay series cần **data của mã so sánh** — adapter của panel (`createChartStockDataAdapter`) fetch theo symbol nên mã VN khác vẫn chạy; mã không tồn tại ⇒ widget tự xử lý (chưa verify bằng browser — staging E2E **chưa chạy**). Overlay state scope theo **chart id** chứ không theo symbol ⇒ đổi mã chính thì chip so sánh **vẫn còn** (cần Owner chốt có reset hay không).

**AC đo được**: widget gửi overlays → chip hiện đúng mã; bấm xoá chip → `removeCompareSymbol` được gọi → overlay mất; không có overlay ⇒ không render chip row (không chen layout).

## 5. Kế hoạch thực thi (thứ tự & thời gian)

1. **Chuẩn bị (T0)**: đọc project-lessons (tags: widget, claim, gate, test) → ghi `Lessons áp dụng`. Tạo branch `feat/widget-wi-drawing-persist` từ `origin/dev`, khai claim `widget-wi-drawing-persist` → commit riêng trước code.
2. **W-I** (0.5 ngày): characterization test persistence + S19 fail-before (dock chết) → xoá mount `DrawingDock` + comment → gates → B8 → PR → merge → verify parent → journal MERGE.
3. **W-K** (1 ngày): input + chip list + `onComparisonChange` + ref `addCompareSymbol`/`removeCompareSymbol`; test S21; gates; B8; PR.
4. **W-J** (defer): chỉ doc limitation (prop chết + alert center read-only). Mở ticket widget-side nếu Owner muốn.
5. **W-H** (defer): cần Owner chốt shape (host toolbar? export/import? đọc key nội bộ?). Không code khi chưa chốt.
6. **Wave 1 closeout**: journal tổng + ledger entry closeout (W-G bỏ, W-I/W-K merge, W-J/W-H defer).
7. **Sau Wave 1**: Smoke E2E staging Pro (I-1) gộp 1 phiên.

**Tổng Wave 1 còn lại**: ~1.5 ngày agent (W-I + W-K); W-J/W-H chờ quyết định.

## 6. Open questions / cần Owner (không chặn W-I/W-K)

1. **W-G**: đã chốt bỏ (Option A) — doc-only, không hỏi lại.
2. **W-H**: cần Owner chốt shape "save/share layout": (a) toolbar riêng của host đọc/ghi `rsc-pane-layout-v2` (fragile), (b) chỉ bật export/import có sẵn của widget (SettingsModal, pro), (c) chờ widget export WorkspaceManager. Đề xuất (b) nếu Owner chỉ cần share file JSON; (a) nếu cần auto-save nhiều layout.
3. **W-J**: đã xác định prop chết + không có endpoint create alert → defer. Owner muốn mở ticket widget-side/BE?
4. **W-K**: UI minimal text input (đề xuất) hay reuse symbol search? Mặc định text input, không chặn.
5. **Orphan files**: giữ untracked, không commit (đã ghi). Không cần Owner.
6. **Drawing storage scope**: key hiện không scope user/tenant → cùng browser đổi account thấy drawings cũ. Owner muốn scope theo user (cần migration tránh orphan) hay chấp nhận localStorage-per-browser?

## 7. Gates baseline (để so sánh hồi quy)

- vitest subset: panel data-unlock 18 + utils 14 = 32 (đã verify); hooks trust-telemetry chưa đo.
- tsc exit 0 (đã verify).
- build: chưa đo lần này (W-F baseline 19.7s). Sẽ đo mỗi slice.
- eslint: 0 errors (4 warnings có sẵn).
- check-multi-agent: 0 lỗi (warning stale path).
- check-ledger-entry: 74/74 max=462.

## 8. Việc KHÔNG làm trong Wave 1 (rõ ràng)

- KHÔNG sửa widget package (repo khác).
- KHÔNG thêm dependency mới.
- KHÔNG đụng BE contract lớn (chỉ endpoint nhỏ nếu cần — nhưng Owner chốt localStorage first cho W-H, nên không BE).
- KHÔNG bật corporate events (W-M, Wave 2, chờ BE).
- KHÔNG bật multi-chart (W-L, Wave 2, enterprise).
- KHÔNG đụng `StockDetailPage.*` (staging-pro-layout2 claim khác).
- KHÔNG sửa 10 file shared (deny-list) — ghi yêu cầu vào claim note.

## 9. Next steps (phiên tiếp theo)

1. **W-K (comparison overlays)** — slice kế tiếp, khả thi: prop `onComparisonChange` tồn tại (`VNInvestChartsProps.d.ts:291`, widget gọi thật khi overlays đổi), thêm/bớt mã qua ref `addCompareSymbol`/`removeCompareSymbol` (`widgetHelpers.d.ts:118-130`), panel đã có `chartRef`. Cần: branch mới `feat/widget-wk-comparison` từ `origin/dev` → nạp project-lessons → journal plan (Lessons áp dụng) → khai claim `widget-wk-comparison` → TDD fail-before (S21) → code → gates → B8 → ledger → PR → merge.
2. W-J/W-H: chỉ doc/defer cho tới khi Owner chốt (W-J: widget phải export callback thật + BE create-alert endpoint; W-H: chọn shape save/share layout).
3. Ghi nhận follow-up (chưa xử lý): nút toggle drawing dock cho free tier vô hiệu (ticket widget) · `onStorageError` không được widget forward · scope user/tenant cho key drawing (Owner chốt + migration) · `secret-scan` đỏ do `docs/evidence/staging-pro-layout/facts20.json` (pre-existing trên dev — ticket cho session `staging-pro-layout`).
4. Sau đó: smoke E2E staging Pro (I-1) gộp 1 phiên.

---

**Kết luận audit (cập nhật sau W-I)**: Handoff Wave 1 chính xác về trạng thái Wave 0 và scope đã chốt. Baseline tsc/vitest subset đã verify lại. **B3 re-audit phát hiện 3 premise sai trong plan**: W-G không implementable (đã bỏ), W-I persistence đã bật mặc định (đã re-scope + merge PR #351), W-J prop chết (defer); W-K prop tồn tại (khả thi, tiếp theo); W-H cần thiết kế. Không có blocker mới ngoài những đã ghi (staging-pro-layout2 unverified, orphan files, smoke E2E chưa chạy, secret-scan đỏ pre-existing).
