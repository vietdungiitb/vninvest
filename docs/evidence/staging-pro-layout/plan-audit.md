# B3 plan-audit — slice `staging-pro-layout` (2026-11-11)

> Auditor độc lập B3, CHỈ ĐỌC. Phạm vi: nhánh `feat/staging-pro-layout`,
> plan `docs/PLAN_STAGING_PRO_LAYOUT_20261111.md` (41 dòng),
> working diff chưa commit (3 file) + evidence `docs/evidence/staging-pro-layout/`.
> Test execution KHÔNG chạy (ngoài phạm vi auditor; owner/dev-loop chạy gates).

## 1. Phạm vi diff — PASS (có lưu ý stack)

- `git status --short`: chỉ 3 file modified, untracked là plan + evidence mới:
  `M packages/web/src/components/VNStockChartPanel.css`,
  `M packages/web/src/components/VNStockChartPanel.js`,
  `M packages/web/src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts`.
  Cả 3 đều nằm trong SCOPE plan (§2: panel js/css/test). Tái hiện:
  `git status --short` · `git diff --stat`.
- `git diff origin/dev...HEAD --stat` (19 file) chứa thêm `package.json`,
  `package-lock.json`, `lib/licenseTrustAnchor.js`, plans/evidence JWK + widget-bump —
  NHƯNG `git log --oneline origin/dev..HEAD` (15 commit) cho thấy đó là các slice
  trước STACK trên cùng nhánh (đã có audit riêng:
  `docs/evidence/staging-pro-jwk/plan-audit.md`,
  `docs/evidence/widget-bump-044/plan-audit.md`,
  `docs/evidence/widget-bump-044p/plan-audit.md`), không phải change của slice này.
- Lưu ý (không chặn): khi mở PR slice này, bảo đảm các slice stack được merge
  trước hoặc PR chỉ chứa working diff hiện tại, tránh mang cả 15 commit vào 1 PR.

## 2. `showDock: isPro` — PASS

- `packages/web/src/components/VNStockChartPanel.js:71`:
  `const isPro = tier === 'pro' || tier === 'enterprise'`, với
  `:69-70` `serverTier` từ `useTenantTier()` (`:9` import) và `tier` ưu tiên prop —
  đúng ngữ cảnh, biến đã định nghĩa phía trên chỗ dùng (`:275` `showDock: isPro`).
- Comment cũ free-upsell (`showDock: false` + "hien upsell khoa") ĐÃ được thay bằng
  comment tier-gating (`:272-274`), không còn mâu thuẫn.
- Tái hiện: `git diff -- packages/web/src/components/VNStockChartPanel.js`.

## 3. CSS mới — PASS

- `packages/web/src/components/VNStockChartPanel.css` (toàn file 10 dòng):
  không còn rule `display: none` nào; override đúng
  `:8-9` `.vnstock-chart-panel [data-rsc-chart-status-line="true"] { opacity: 1 !important; }`.
- Selector attribute ổn định thay class hash `.Gc` (lý do ghi rõ ở `:1-7`).
  Không secret, không `vni1.` (grep 0 hit `vni1\.[A-Za-z0-9_-]{20,}` trong
  `packages/web/src/components/`).
- Tái hiện: đọc file 10 dòng + `git diff -- packages/web/src/components/VNStockChartPanel.css`.

## 4. Evidence G1 — PASS (2 ghi nhận, không chặn)

- Khớp: `facts.json:13` `dockCount: 0` (pre-fix, `showDock:false`),
  `:17-18` `hasGcTotal/hasGcHidden: 0` (0 match `.Gc` trên widget hiện tại);
  `facts12.json:2-13` opacity `"0"` cả before/during/after hover;
  `facts13.json:2` inline `"top: 8px; left: 8px; opacity: 0;"` —
  đúng giả thuyết plan §1(c): statusline tồn tại nhưng vô hình do inline opacity 0.
- `facts3.json:57-87` O/H/L/C có trong header app (nguồn hiển thị thay thế).
- Ghi nhận 1: `facts2.json:4-5` `statusLineCount: 0` (selector đếm 0 node) trong khi
  facts12/13 đo được node — selector probe không nhất quán, không ảnh hưởng kết luận
  (cả hai đều chỉ ra "statusline không nhìn thấy").
- Ghi nhận 2: `demo-facts.json:8` demo cũng `dockCount: 0` — mở dock cho Pro là
  VƯỢT demo-parity (có chủ đích, DataWindow là tính năng pro), không phải regress.
- `08-statusline-zoom.png` + `demo-facts.json` tồn tại (glob); nội dung ảnh không
  đọc visual trong audit này.
- Lưu ý: plan §3-G1 chỉ liệt kê loại facts cần thu, các con số nằm ở evidence
  (không restate trong plan) — chấp nhận được, evidence là nguồn sự thật.

## 5. Test S6/S7 sửa + S8–S11 — PASS

- S6 (`...test.ts:61-69`) và S7 (`:71-82`): ghi rõ `"sua 2026-11-11"` + comment lý do
  (dock mở theo tier; `.Gc` 0 match trên 0.4.4 nên cấm `display:none`/class hash) —
  decision đổi được tài liệu hoá, KHÔNG phải xoá lấp liếm.
- Đối chiếu code↔assert (đọc cả hai file):
  S8 (`:84-92`): `useTenantTier` (`VNStockChartPanel.js:9,69`), `licenseKey:` (`:298`),
  không `tenantPat`/`registerProExtension`/`debugTier` (grep file js: chỉ 5 hit
  `licenseKey|onLicenseDiagnostic`, 0 hit cấm) ✓.
  S9 (`:94-102`): `licenseKey` + `onLicenseDiagnostic` (`:52,:298-299`), không blob ✓.
  S10 (`:103-119`): `ensureLicenseTrustAnchor` (panel, từ commit slice JWK trước),
  `VITE_VNINVEST_LICENSE_KEY` + `licenseKey` ở `StockDetailPage.tsx`
  (diff committed), `licenseTrustAnchor.js:13,20,29`
  (`addLicensePublicKey`, `kid: "primary"`, JWK public — không phải secret) ✓.
  S11 (`:120-133`): `showDock: isPro` (`:275`), CSS không `.Gc` + có
  `data-rsc-chart-status-line` (`VNStockChartPanel.css:8`) ✓.
- Chuỗi `showDock === false` còn lại trong comment (`:274`) không trigger regex
  `showDock:\s*false` của test ✓. Không chạy test ở đây (ghi CHƯA CHẠY).

## 6. Secret trong diff — PASS

- `git diff` (working) grep `BEGIN PRIVATE|ghp_|github_pat_|sk-` = 0 hit;
  `vni1\.[A-Za-z0-9_-]{20,}` trong `packages/web/src/components/` = 0 hit
  (chuỗi `vni1\.` duy nhất nằm trong regex guard của test S9/S10, không phải blob).
- Trust anchor là JWK PUBLIC (`kid: primary`), `licenseKey` chỉ đi qua
  `VITE_VNINVEST_LICENSE_KEY` build-arg (secret nằm trên VPS, fail-closed free).

## Objection: 0 (tối đa 3) · Ghi nhận không chặn: 2 (stack-PR §1, selector facts2 + demo-dock §4)

## VERDICT: PASS — cho commit working diff (3 file) + ledger entry + merge sau gates xanh
