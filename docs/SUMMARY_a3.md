# SUMMARY — worker `a3` · S3 (AC-4 / AC-3.1…AC-3.6) — `check-h1-graph.mjs`

- **Nhánh**: `feat/uiux-wave4` · **Ngày**: 2026-10-09
- **Phạm vi**: script tĩnh trả lời **mỗi route có render `<h1>` hay không**, đi theo **đồ thị import thật**.
- **Không** sửa file nào đang tồn tại. **Không** chạy UIUX scanner, **không** chạy `npm run test:components`, **không** `git add/commit/stash/restore`.

---

## 1. File đã tạo

| File | Dòng | Ghi chú |
|---|---|---|
| `docs/audit-uiux/scripts/check-h1-graph.mjs` | 1 290 | script duy nhất |
| `docs/audit-uiux/scripts/__fixtures__/case-01-route-without-h1/**` | 5 file | fixture ÂM — route thiếu h1 |
| `docs/audit-uiux/scripts/__fixtures__/case-02-dynamic-tag/**` | 5 file | fixture ÂM — tag động (`e(tag,…)`) |
| `docs/audit-uiux/scripts/__fixtures__/case-03-unresolved-import/**` | 5 file | fixture ÂM — import trỏ file không tồn tại |
| `docs/audit-uiux/scripts/__fixtures__/case-04-multiline-alias-transitive/**` | 7 file | fixture DƯƠNG — h1 nhiều dòng qua alias, 3 tầng sâu |
| `docs/audit-uiux/scripts/__fixtures__/case-05-h1-in-comment-and-string/**` | 6 file | fixture DƯƠNG — `<h1>` trong JSDoc + string **không** được đếm |
| `docs/audit-uiux/scripts/__fixtures__/case-06-entry-not-main/**` | 7 file | fixture DƯƠNG — entry là `boot.tsx`, `main.tsx` có h1 nhưng không ai nạp (hazard 7) |
| `docs/audit-uiux/scripts/__fixtures__/case-07-dead-registry-entry/**` | 6 file | fixture ÂM — registry entry không ai tham chiếu |
| `docs/audit-uiux/scripts/__fixtures__/case-08-mask-regex-in-template/**` | 5 file | fixture DƯƠNG — regression masker (xem §7) |
| `docs/SUMMARY_a3.md` | file này | |

**46 file mới, 0 file sửa.** (`git status --short` xác nhận: `?? docs/audit-uiux/scripts/check-h1-graph.mjs`, `?? docs/audit-uiux/scripts/__fixtures__/`, `?? docs/SUMMARY_a3.md`; các `M`/`??` còn lại thuộc a1/a2.)

---

## 2. Ba corrections trong đề bài — ĐÃ TỰ KIỂM CHỨNG LẠI

| Correction | Kết quả kiểm chứng |
|---|---|
| `build.rollupOptions.input` **không tồn tại** | ✅ Đúng. `packages/web/vite.config.ts` chỉ có `build.rollupOptions.output.manualChunks` (`:49-105`). Script tự kiểm tra bằng regex mỗi lần chạy và in `KHÔNG có build.rollupOptions.input (đã đọc thật)` — không nói theo tài liệu. |
| Entry = `index.html:27` | ✅ Đúng. `packages/web/index.html:27` = `<script type="module" src="/src/main.tsx"></script>`. Script đọc `root` từ config (config **không** khai `root` ⇒ mặc định Vite = thư mục chứa config = `packages/web`), rồi regex `<script type="module" src>` trong `index.html`. |
| Registry ở `src/pages/pageRegistry.js` | ✅ Đúng. `pageRegistry.js` 15 898 B, 320 dòng; route entry thật `core-stock-detail` ở `:234-235`. |

⚠ **Bổ sung đính chính (plan §3 AC-3.1 nói "đọc `root` từ `vite.config.ts`")**: `vite.config.ts` **không có** key `root`. Script in rõ `root = packages/web (vite.config.ts KHÔNG khai root ⇒ mặc định Vite là thư mục chứa config)` thay vì im lặng giả định.

⚠ **Một điều chỉnh nữa mà kế hoạch chưa nêu**: repo có **1 001 import có đuôi `.js` trỏ tới file `.ts/.tsx` thật** (vd `import { ShellToast } from './components/ShellToast.js'` → file là `.tsx`). Resolve theo tên file thuần sẽ để lại **305 import không resolve** và toàn bộ phân tích sập thành `KHONG VERIFY DUOC`. Script bám đúng quy tắc Vite (`knownTsOutputRE = /\.(?:js|mjs|cjs|jsx)$/` trong `node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js`, hàm `tryCleanFsResolve`) và in ra số lần dùng từng quy tắc.

---

## 3. Lệnh + output + exit code (đều chạy thật)

cwd = repo root `C:\Mujoco Projects\vninvest`.

> ⚠ Khi redirect ra file bằng `>` trong PowerShell, byte stream của native command bị double-encode. Đã dùng `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)` trước khi `>`. Xem `>` trực tiếp thì không có vấn đề.

| # | Lệnh | Exit | Kết quả |
|---|---|---|---|
| C1 | `node docs/audit-uiux/scripts/check-h1-graph.mjs` | **0** | báo cáo 557 dòng |
| C2 | `node docs/audit-uiux/scripts/check-h1-graph.mjs --self-test` | **0** | `✓ self-test PASS — 8/8 fixture (4 âm + 4 dương)` |
| C3 | `node docs/audit-uiux/scripts/check-h1-graph.mjs --json` | **0** | JSON hợp lệ, `counts.*` ở dưới |
| C4 | `node docs/audit-uiux/scripts/check-h1-graph.mjs --gate` | **1** | `✗ FAIL (1 vi phạm)` → `[unreferenced-registry-entry] shell-ai-command-center` |
| C5 | `node docs/audit-uiux/scripts/check-h1-graph.mjs --list-routes` | **0** | 62 dòng TSV |
| C6 | `node docs/audit-uiux/scripts/check-h1-graph.mjs --help` | **0** | in header |

**Exit 0 trong vận hành bình thường**: C1/C2/C3/C5/C6 đều 0. `--gate` **cố ý** đỏ trên repo thật vì 1 vi phạm thật (xem §6).

### Số đo chính (từ C3)

```
counts: {"routes":62,"coH1RenderReachable":62,"h1ChiTrongClosure":0,
         "khongTimThayCoPhanDong":0,"khongTimThayTinh":0,"khongVerify":0,
         "dynamicSites":307,"dynamicRoutes":40,"routesWithUnresolvedImports":0}
stats : modules=305  entryClosure=305  unresolvedImports=0  parseErrors=0
        assets=23  externals=30
resolveRules: exact 3940 · ts-output(.js→.tsx) 725 · ts-output(.js→.ts) 274
             · ext(.ts) 118 · ext(.tsx) 109 · ext(.js) 28 · index(.js) 9
unreferencedRegistryIds: ["shell-ai-command-center"]
crossFileForwarders: []
```

Thời gian chạy: **≈5 s** (đo bằng `Stopwatch`, không phải cảm nhận).

---

## 4. Số route và CÁCH suy ra (AC-3.6) — **không** dùng glob

**Số route = 62**, lấy từ **`src/pages/pageRegistry.js`**: regex trên bản copy đã che comment, khớp `makePageEntry("<routeId>", "<status>", () => import("<spec>"))`.

**Xác minh độc lập** (không tin script của mình):
```
node -e 'const fs=require("fs");const t=fs.readFileSync("src/pages/pageRegistry.js","utf8");
  const ids=[...t.matchAll(/makePageEntry\(\s*"([^"]+)"/g)].map(m=>m[1]);
  console.log("occurrences =",ids.length,"unique =",new Set(ids).size);'
→ occurrences = 62 unique = 62
```

**Vì sao KHÔNG glob `pages/**/*Page.tsx`** — đã kiểm chứng trên đĩa:
- `src/pages/portfolio/` có **6** file `Portfolio*Page.tsx`: `PortfolioOverviewPage` · `PortfolioHoldingsPage` · `PortfolioAllocationPage` · `PortfolioAnalyticsPage` · `PortfolioActivityPage` (**5 sub-tab**) · `PortfolioWorkspacePage` (**entry thật**).
- Registry chỉ import `./portfolio/PortfolioWorkspacePage.tsx` (`pageRegistry.js:214-215`).
⇒ glob sẽ ra **6 route thay vì 1**. Script in cả 2 trục để đối chiếu: `registry → 62 entry` vs `<Route path=…> trong entry file: 66 path`.

**Phân loại từng entry được in ra tường minh** (§4 của báo cáo): `routeId` · `status` (`baseline`/`core`) · `pageRegistry.js:<dòng>` · file entry đã resolve · `closure` · `render` · `h1` · `h1 render-reachable` · `dyn` · `unresolved` · verdict.

**Đối chiếu chéo 2 trục**: script đọc bảng remap trong `main.tsx:22-40` (`resolvePageComponent`) — 7 cặp `routeId → registryId` (`dashboard→core-dashboard`, `whale-alerts→alert-center`, `ai-advisory→whale-advisory`, `watchlist→core-watchlist`, `transactions→core-transactions`, `portfolios→core-portfolios`, `settings→core-user-settings`) + `portfolio-* → portfolio-workspace`. Không có bảng này thì 8 id bị báo nhầm là route chết.

---

## 5. PHẦN ĐỘNG (AC-3.5) — mục riêng, có số đếm được

In ở **§5** của báo cáo, không lẫn vào kết luận:

```
call site createElement có tag KHÔNG xác định tĩnh : 307  (ở 13 file, 27 vị trí nguồn Duy nhất)
import KHÔNG resolve được (trong cây route)         : 0
binding render không ánh xạ được module              : 0
import() có biến — KHÔNG resolve được                : 0
⇒ KHÔNG route nào ở trên được kết luận "chắc chắn không có h1".
```

Phân loại: `tag-local-variable` 244 · `tag-jsx-variable` 62 · `tag-expression` 1 · `tag-conditional` 0 (đã loại 1 false positive ở `ShellMailConfigPage.tsx:484` — conditional nằm ở **đối số 2**, không phải đối số 1).

27 vị trí nguồn duy nhất, ví dụ đã kiểm tay:
- `components/ShellPageTemplate.js:4-5` — `renderElement(type, …)` → `createElement(type, …)`
- `components/ShellSkeleton.tsx:84…163` — `createElement(Bar, …)` với `const Bar = anim === "shimmer" ? Shimmer : Pulse` (`:58`)
- `components/ui/button.tsx:45` — `<Comp />`
- `components/VNStockChartPanel.js:241` — `e(chartComponent, …)`
- `features/dashboard/AIAdvisorAlertPanel.js:233,257` — `e(SeverityIcon,…)`, `e(TrendIcon,…)`
- `components/ui/lucide-icon.tsx:72` — `e(Icon, …)`
- `dashboard/UnifiedAlertCenter.js:258` — `e(f., …)`

**Kiểm chứng lớp gián tiếp (quan trọng, vì nó là nơi h1 thật nằm)**:
```
grep 'renderElement("h' trong src/  →
  ShellPageTemplate.js:77  renderElement("h2", …)
  ShellPageTemplate.js:119 renderElement("h1", …)   ← h1 thật, nằm trong ShellPageChrome
  coreShellPageHelpers.js:276,291,339,374  renderElement("h3", …)
```
⇒ 2 forwarder (`renderElement`) được script resolve; h1 duy nhất của chúng nằm ở `ShellPageTemplate.js:119`, dùng bởi **32 route**. Nếu không có bước resolve forwarder, script sẽ kết luận sai cho 32 route (đã xảy ra, đã sửa — xem §7).

---

## 6. Kết quả + phát hiện thật

**62/62 route** có ít nhất 1 `<h1>` **render-reachable** (mức COMPONENT). 0 route `KHONG VERIFY`, 0 import không resolve, 0 lỗi parse.

**Phát hiện thật #1 — registry entry chết** (gate đỏ):
`pageRegistry.js:201-202` khai `shell-ai-command-center → ./system/ShellAiCommandCenterPage.tsx`.
```
grep "shell-ai-command-center" toàn src/ (514 file) → ĐÚNG 1 dòng: pageRegistry.js:201
```
Không `<Route>` nào trong `main.tsx` dùng id này ⇒ entry chết thật.

**Phát hiện thật #2 — 4 route có 2 `<h1>` trong đồ thị tĩnh**:
`auth-login` · `admin-crawl-control` · `watchlist` · `core-watchlist`.
**Đã kiểm tay cả 4 ⇒ KHÔNG phải defect, là giới hạn của phân tích tĩnh** (xem §8).

---

## 7. Tôi đã tự bắt được **3 bug trong chính script của mình** (và sửa script, không sửa kết luận)

| # | Bug | Hậu quả nếu để nguyên | Bằng chứng |
|---|---|---|---|
| 1 | Masker: skip chuỗi `'…'`/`"…"` bằng hàm dành cho **template literal** | Nuốt hết phần còn lại của file | `case-01` lúc đầu cho `h1=0` trên fixture có `<h1>` thật |
| 2 | Masker: không xử lý **regex literal bên trong `${ … }`** | Mất mọi `<h1>` **phía sau** dòng đó, **không cảnh báo**. Đã làm `AlertCenterPage.tsx` mất 300+ dòng JSX ⇒ route bị kết luận sai | Bằng chứng chạy thật (masker cũ vs mới, trên chính fixture): `masker CŨ → 0`, `masker MỚI → 1` ⇒ **`case-08` là guard thật**, không phải hình thức |
| 3 | Đồ thị render ở mức **MODULE**, và lan truyền local ref không có **owner** | `ShellPanel` (được render) kéo theo `ShellPageChrome` ⇒ h1 của `ShellPageChrome` bị quy cho `ai-command-center` | Truy tay: chỉ `AICommandCenterPage.tsx` → `ShellPanel`; `AICommandCenterForm.tsx`/`AISettingsErrorBoundary.tsx` **không** hề import `ShellPageTemplate` (grep xác nhận) |

Ngoài ra đã bắt & sửa: `.css` bị parse như module JS (`modules` 323 → **305** sau khi tách asset); generic TypeScript (`useRef<Response>`) bị đọc thành JSX (155 → **0**); `.Provider` bị đếm là tag động (155 → 0).

---

## 8. Spot-check tay (10 route/file) — `file:line`

| # | Route | Kết luận script | Kiểm tay | Kết quả |
|---|---|---|---|---|
| 1 | `core-dashboard` | `DashboardPage.tsx:117` | `:108` và `:115` là **comment** trong JSDoc; `:117-118` mới là `e(\n "h1", …)` thật | ✅ **script đúng** — grep thô ra 3 hit (2 sai) |
| 2 | `core-stock-detail` | `WorkstationShell.tsx:53` | `ShellStockDetailPage.js:32-36` bọc `WorkstationShell`; `StockDetailHeader.js:81` **đã là `h2`** (a2 vừa sửa trong worktree) | ✅ |
| 3 | `support` | `SupportPage.tsx:311` | đọc trực tiếp, `e("h1", …)` | ✅ |
| 4 | `dashboard` | `ShellPageTemplate.js:119` | `ShellDashboardPage.tsx:105` `<ShellPageChrome …>`; `:119` là `renderElement("h1", …)` trong `ShellPageChrome` | ✅ (chỉ đúng **sau** khi resolve forwarder) |
| 5 | `auth-login` | 2 h1 (`:134`, `:146`) | hai `return` sớm **loại trừ nhau** (`:127 if (isCheckingSession) return …`) ⇒ thực tế chỉ 1 | ⚠ **script đếm thừa** — giới hạn tĩnh, đã ghi trong `_honesty` |
| 6 | `alert-center` | `ShellPageTemplate.js:119` | `AlertCenterPage.tsx:8` import + `:562 <ShellPageChrome>` | ✅ (lúc đầu **sai** vì bug #2 — đã sửa) |
| 7 | `watchlist` | 2 h1 | `ShellWatchlistPage.tsx:70-72` `if (hasSaasNative) return <WatchlistPage …/>` vs `:117 <ShellPageChrome>` ⇒ loại trừ nhau | ⚠ **đếm thừa** |
| 8 | `admin-crawl-control` | 2 h1 (`:130`, `:150`) | `:126 if (fetchError && jobs.length === 0) return …` ⇒ loại trừ nhau | ⚠ **đếm thừa** |
| 9 | `admin-core-audit-trace` | `AdminCoreAuditTracePage.tsx:225` render-reachable; `adminUi.tsx:24` closure-only | trang render `AdminPanel/AdminMetricCard/AdminValueRow`, **không** render `AdminPageHeader` ⇒ đúng là 1 h1 | ✅ (nếu chỉ đi cạnh module sẽ thành 2 — đó là bug #3) |
| 10 | `admin-users` | `adminUi.tsx:24` | `AdminUsersPage.tsx:13-14` **JSDoc nhắc `<h1>`**; h1 thật đến từ `AdminPageHeader` `adminUi.tsx:24` | ✅ **script đúng**, grep thô sẽ ra 2 hit |

---

## 9. CHƯA CHẠY / ngoài phạm vi

- **CHƯA CHẠY**: `scan-ui-guidelines.mjs`, `npm run test:components`, `tsc`, `lint`, `npm run build` — bị cấm theo lệnh phối hợp (agent khác đang sửa cùng cây).
- **CHƯA CHẠY**: kiểm chứng hành vi runtime bằng trình duyệt. Mọi kết luận ở đây là **tĩnh**; AC-2.x của a2 mới là nơi chứng minh "render đúng 1 h1" bằng DOM thật.
- **CHƯA CHẠY**: `npm install` (không cần — script chỉ dùng `node:fs`/`node:path`/`node:process`/`node:url`).
- **Số đo trong báo cáo phản ánh WORKTREE hiện tại**, trong đó agent a2 đã sửa `StockDetailHeader.js` (`h1`→`h2`). Chạy lại ở commit khác có thể đổi số.
- **Không** thêm entry `docs/CODE_CHANGE_AUDIT_LEDGER.md`: `AGENTS.md` yêu cầu, nhưng nhiệm vụ giao cho a3 chỉ là 2 đường dẫn `docs/audit-uiux/`. **Báo coordinator** để quyết định.

---

## 10. Giới hạn đã biết (in sẵn trong `--json` mục `_honesty`)

1. **Nhánh loại trừ nhau**: đồ thị tĩnh không đánh giá điều kiện ⇒ đếm thừa khi có nhiều `return` sớm (3 trường hợp đã kiểm tay ở §8).
2. **Forwarder xuyên file**: chỉ resolve forwarder **trong cùng file**. `crossFileForwarders = 0` ở repo này (đã kiểm: không module nào import `renderElement`), nhưng nếu có thì script **báo ra chứ không bỏ qua**.
3. **Entry module**: bị coi là render **mọi** component cục bộ — trên xấp xỉ có kiểm soát (chỉ gây thừa, không gây thiếu).
4. **Chưa xử lý**: `React.createElement` gọi qua biến trung gian ngoài các alias đã biết; `h()` tự định nghĩa không gán từ `createElement`.

---

## 11. Rủi ro

- **`--gate` hiện đỏ** trên repo thật (1 vi phạm thật). Nếu ai đó bật gate này vào CI mà chưa xử lý `shell-ai-command-center` thì CI đỏ vĩnh viễn. Khuyến nghị: hoặc xoá entry chết khỏi registry, hoặc chỉ chạy `--gate` sau khi dọn.
- **Số 62 route có thể đổi** nếu agent khác thêm/bớt entry registry ⇒ mọi gate phải đọc lại thay vì hardcode con số.
- Script đọc **worktree**, không đọc HEAD (giống `check-ledger-entry.mjs --from-worktree`). Chạy trong worktree sạch vẫn được vì nó chỉ cần source, không cần `dist`.

---

## 12. Bài học quy trình

**Một "bằng chứng dương" không đáng tin nếu bước dòng của nó từng hỏng âm thầm.**

Cả 3 bug ở §7 đều cho ra kết quả *hợp lý trông* (0 route thiếu h1, 62 route đều có h1, 0 lỗi parse) và **không in cảnh báo nào**. Chúng chỉ lộ ra khi tôi cố kiểm tay một kết luận cụ thể (`dashboard`, `alert-center`, `ai-command-center`) và thấy ngược. Nếu tôi dừng ở "script chạy exit 0, số đẹp, gate bắt được 4 fixture âm" thì sẽ giao một script sai mà vẫn tự cho là PASS — đúng cái mà `AGENTS.md` gọi là *"không báo PASS cho thứ chưa chạy"* mở rộng thành *"không báo PASS cho thứ đã chạy nhưng chưa được kiểm tra bằng một ví dụ mà ta biết đáp án"*.

⇒ Hai thay đổi quy trình tôi sẽ áp dụng từ slice sau:
1. **Mỗi fixture âm phải kèm một ví dụ cụ thể đã biết đáp án** để đối chiếu — không chỉ "gate có đỏ không".
2. **Mọi bước dòng text phải có fixture hồi quy riêng** (`case-08` sinh ra sau bug #2). Fixture chỉ sinh ra *sau khi* đã gặp bug thật — và đó là lý do nó đáng giá hơn 7 fixture viết trước.