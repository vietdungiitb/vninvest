# PLAN — P3.4 license wiring: `licenseKey` prop passthrough (pro tier qua key vni1.* offline) (2026-11-10)

## 1. Quyết định (Owner: "saas đã cấp key+license, nghiên cứu áp dụng pro tier"; "quyết gì làm hết theo khuyến nghị")

**Áp dụng pro tier bằng offline license key** (`vni1.*`, ECDSA, verify hoàn toàn phía client):
- App truyền `licenseKey` (blob do Owner cấp theo tenant) + `onLicenseDiagnostic` (observer có sẵn của widget, silent) vào `<VNInvestCharts>` khi có; không có → bỏ unset (widget đọc local slot như cũ).
- KHÔNG gọi `registerProExtension` trực tiếp: API của nó đòi `ProExtensionModule` (chỉ engine-pro mới có, EULA private, không có trong repo) + key; widget tự nạp extension nội bộ sau khi `verifyLicenseKey` pass (fail-closed).
- KHÔNG đụng BE vninvest, KHÔNG đụng license-server (vnsaas). Supersede `PLAN_P34_TIER_20261110.md:26` ("KHÔNG truyền licenseKey") và comment `useTenantTier.js:10` — quyết định mới thay thế vì key đã tồn tại (xem §2 Owner-provided).
- Giữ nguyên app-side tier gating P3.4 (Entry 444) — license là kênh độc lập, cộng gộp.

## 2. Root cause / bằng chứng đã đọc (không đoán)

- Widget đọc license: localStorage slot `vni_license_key` (`widget/dist/index.js`: `Mi="vni_license_key"`, `Ld()` đọc slot, fallback PAT-slot nếu là blob); prop `licenseKey` (`VNInvestChartsProps.d.ts`) → cùng kênh (không shadow tenantPat).
- `registerProExtension(extension, licenseKey, opts?)` (`plugin/ProPluginRegistry.d.ts:38-46`): cần `extension: ProExtensionModule` (chỉ engine-pro có) + key; **fail-closed** khi không verify được. Không gọi được từ app (không có module).
- `verifyLicenseKey` offline trong `@vninvestcharts/engine-core` (`parseLicenseKey`: `vni1.<payload>.<sig>`, check `t` tier string + `e` expiry number).
- Tier badge: `xF` map là normalize **widget-side cho badge** (`widget/dist/index.js`, custom/internal→enterprise), KHÁC `planToTier` của engine-core (giữ `custom→custom`, `internal→internal`: `engine-core/index.js:2969-2977`) — ghi rõ để audit sau không lẫn.
- Capabilities theo tier: `hasCapability(tier, cap)` + `no_ads`, `dock_pro`, `pro_plugin` (`engine-core/dist/index.js`).
- Quan sát được thật của license (đã hiệu đính sau B3): KHÔNG có pill "PRO" DOM (chuỗi "PRO" chỉ tồn tại trong canvas watermark flow SaveChartAsImage) — thay vào đó là flags (`hideTrademark`, `showWidgetAds:false`, whale/replay/advisory enable) + `onLicenseDiagnostic` observer (`VNInvestChartsProps.d.ts:105`, CS-6).
- Quota/grant server-side, TTL 7 ngày, endpoint `POST /api/v1/licenses`, machine activation, tenant `verify-login-temp`: **Owner-provided, CHƯA XÁC MINH trong repo này** (grep `docs/` 0 hit; payload `parseLicenseKey` chỉ có `t,e,d,k,s,c,n,i`, không machine-binding — `engine-core/index.js:4781-4799`). Không dùng làm căn cứ code.
- Prop `tenantPat`/`client` KHÔNG truyền (Entry 444: envelope mismatch `{data:{...}}` vs raw `M.plan` + thiếu client → widget-internal server tier không chạy). License offline không cần backend.

## 3. Fix (scope: panel + test; KHÔNG secrets trong repo)

- `VNStockChartPanel.js` (dùng `createElement`, KHÔNG phải JSX): thêm prop optional `licenseKey` + `onLicenseDiagnostic` (observer) → forward `licenseKey: licenseKey ?? undefined`, `onLicenseDiagnostic` vào `e(chartComponent, {...})` (widget bỏ qua khi undefined). Sửa S8 cũ (sẽ đỏ vì xuất hiện `licenseKey:`): cho phép `licenseKey`, giữ cấm `tenantPat`/`registerProExtension`. Comment: nguồn = Owner cấp theo tenant; KHÔNG hardcode.
- Test S9 (mới, trong file data-unlock hiện tại): assert panel forward `licenseKey` + `onLicenseDiagnostic` (quét source) + **secret-guard**: `VNStockChartPanel.js` và `useTenantTier.js` KHÔNG chứa blob `vni1.` (quét đúng 2 file implement, không claim "toàn bộ src/").
- Non-goals: không gọi `registerProExtension`; không truyền `tenantPat`/`client`/`debugTier`; không sửa BE vninvest/vnsaas; không migration; không đụng engine-pro; không lưu key/PAT vào repo/env-file tracked.
- Non-goals: không gọi `registerProExtension`; không truyền `tenantPat`/`client`/`debugTier`; không sửa BE vninvest/vnsaas; không migration; không đụng engine-pro; không lưu key/PAT vào repo/env-file tracked.

## 4. Nghiệm thu (Given/When/Then)
- Given staging đã deploy bản mới, When mở `/stocks/VNM` không key (admin tenant free), Then: UI như cũ (không panel phụ, không badge lạ), 0 console error mới.
- Given license hợp lệ được nạp vào slot (Playwright `addInitScript`, key từ ENV transient — KHÔNG commit; verify hành vi widget, S9 mới là test của diff), When mở `/stocks/VNM`, Then: trademark ẩn (`hideTrademark`) HOẶC `onLicenseDiagnostic` sources chứa `"license"` (ghi lại cái nào quan sát được; pill "PRO" DOM KHÔNG tồn tại — đã hiệu đính), không side tape panel/dock rail mới, 0 pageerror.
- Gates: tsc 0, build OK, vitest 10/10 (S1-S9 + mapping 5), check-multi-agent PASS, deploy verify PASS (0 restart).

## 5. Lessons áp dụng: [L-S01, L-S02, L-F12, L-V02, L-V04, L-V05, L-001, L-002]
- B3 audit (subagent độc lập): NEED_REVISION 6 điểm → đã sửa hết trong rev2 (S8 update, GWT2 viết lại theo flags/diagnostic, Owner-claims tách mục CHƯA XÁC MINH, xF vs planToTier ghi rõ, supersede Entry 441-444, S9 scope 2 file).
- Checklist:
  - [x] Root cause đọc từ dist + dts + handoff provision + AGENTS (không đoán)
  - [ ] Test S9 fail-before trước khi sửa code
  - [ ] Key/PAT CHỈ qua ENV transient khi verify, KHÔNG ghi vào file/tài liệu/commit (L-S01/S02: báo cáo chỉ tên file+số dòng)
  - [ ] Screenshot mở xem trực tiếp trước khi báo PASS (L-V05)
  - [ ] Không commit thẳng dev; claim trước code (L-002)

## 6. Rollback
- Revert 1 commit (prop optional, default undefined → hành vi cũ). Không migration, không infra.
