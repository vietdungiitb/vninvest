# PLAN — P3.4 license wiring: `licenseKey` prop passthrough (pro tier qua key vni1.* offline) (2026-11-10)

## 1. Quyết định (Owner: "saas đã cấp key+license, nghiên cứu áp dụng pro tier"; "quyết gì làm hết theo khuyến nghị")

**Áp dụng pro tier bằng offline license key** (`vni1.*`, ECDSA, verify hoàn toàn phía client):
- App truyền `licenseKey` (blob do Owner cấp theo tenant) + `onLicenseDiagnostic` (observer có sẵn của widget, silent) vào `<VNInvestCharts>` khi có; không có → bỏ unset (widget đọc local slot như cũ).
- KHÔNG gọi `registerProExtension` trực tiếp: API của nó đòi `ProExtensionModule` (chỉ engine-pro mới có, EULA private, không có trong repo) + key; widget tự nạp extension nội bộ sau khi `verifyLicenseKey` pass (fail-closed).
- KHÔNG đụng BE vninvest, KHÔNG đụng license-server (vnsaas). Supersede `PLAN_P34_TIER_20261110.md:26` ("KHÔNG truyền licenseKey") và comment `useTenantTier.js:10` — quyết định mới thay thế vì key đã tồn tại (xem §2 Owner-provided).
- Giữ nguyên app-side tier gating P3.4 (Entry 444) — license là kênh độc lập, cộng gộp.

## 1b. KẾT QUẢ NGHIÊN CỨU (B3 + verify thực tế, 2026-11-10) — **BLOCKED, chưa áp dụng được**

Re-issue key mới qua `POST /api/v1/licenses` (dùng test PAT verify-login-temp, đúng flow tài liệu handoff) rồi verify offline bằng engine bundle:
- Parse OK: `t=pro, p=vninvestcharts_widget, caps=40, e=1794959999 (17/11)`, serial mới `85e47857…`.
- `verifyLicenseKey` → **NULL (invalid)**. Hai lý do độc lập, theo thứ tự code (`engine-core/dist/index.js`, `verifyLicenseKey`):
  1. **kid mismatch (chết trước)**: payload `k="primary"`, nhưng embedded keys chỉ có `["prod-2026-10-17","e2e-2026-10-31","prod-2026-11-09"]` (`getLicensePublicKeys`) → candidates rỗng → return null trước khi check chữ ký.
  2. **product mismatch (chết tiếp theo)**: `parsed.payload.p ("vninvestcharts_widget") !== LICENSE_PRODUCT ("vninvestcharts")` → return null ngay cả khi chữ ký đúng.
- Nghĩa là: **mọi key do vnsaas cấp hiện tại đều KHÔNG verify được trong widget 0.4.1/engine 0.5.5**, bất kể code app. End-to-end unlock cần Owner quyết 1 trong các hướng:
  - (A) vnsaas ký bằng `kid` đã embed + `p` mà widget chấp nhận (phía server; Owner + vnsaas team).
  - (B) widget/engine chấp nhận alias product `vninvestcharts_widget` + map kid `primary` (phía widget repo → republish → bump version; nặng).
  - (C) Owner cung cấp public JWK của kid `primary` để host gọi `setLicensePublicKey` (chỉ gỡ được chốt kid, KHÔNG gỡ được chốt product) → vẫn cần (A)/(B) cho product.
- Phạm vi slice này (đã làm xong, đúng và giữ lại): **app-side readiness** — `licenseKey`/`onLicenseDiagnostic` passthrough + secret-guard test + tài liệu rào cản chính xác. Pro-path live E2E ghi `CHƯA CHẠY (blocked)` — không phải "chưa thử".

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
- Test S9 (mới, trong file data-unlock hiện tại): assert panel forward `licenseKey` + `onLicenseDiagnostic` (quét source) + **secret-guard**: `VNStockChartPanel.js` KHÔNG chứa blob thật (regex `vni1\.[A-Za-z0-9_-]{20,}` — comment nhắc format không tính).
- Non-goals: không gọi `registerProExtension`; không truyền `tenantPat`/`client`/`debugTier`; không sửa BE vninvest/vnsaas; không migration; không đụng engine-pro; không lưu key/PAT vào repo/env-file tracked.

## 4. Nghiệm thu (Given/When/Then)
- Given staging đã deploy bản mới (PR #338), When mở `/stocks/VNM` không key (admin tenant free), Then: UI như cũ (không panel phụ, không badge lạ), 0 console error mới. **ĐÃ VERIFY 2026-11-10**: 4 canvas, stacked ẩn 3/3, inline 4/4, 0 pageerror/console-error mới.
- Given key rác trong slot (`vni1.invalid-test-value` — fail-closed path), When mở `/stocks/VNM`, Then: widget bỏ qua êm, UI hệt baseline, 0 pageerror. **ĐÃ VERIFY**: identical baseline.
- Given license server-issued hợp lệ (re-issue qua `POST /api/v1/licenses`, đúng flow handoff), Then: **BLOCKED — widget reject key (kid + product mismatch, xem §1b)**. Pro-path live E2E mở lại khi rào cản được Owner gỡ.
- Gates: tsc 0, build OK, vitest 13/13 (S1-S9 + mapping 4), check-multi-agent PASS, deploy verify PASS (0 restart).
- Dọn dẹp staging: 2 license rows do probe tạo (`c08e0310…`, `85e47857…`) đã revoke (204) — chỉ còn key gốc handoff `023b6d9c…` active. Không commit key/PAT vào repo (L-S01/S02).

## 5. Lessons áp dụng: [L-S01, L-S02, L-F12, L-V02, L-V04, L-V05, L-001, L-002]
- B3 audit (subagent độc lập): NEED_REVISION 6 điểm → đã sửa hết trong rev2 (S8 update, GWT2 viết lại theo flags/diagnostic, Owner-claims tách mục CHƯA XÁC MINH, xF vs planToTier ghi rõ, supersede Entry 441 + Entry 444 "chưa có key", S9 scope 1 file + regex đúng). Vòng 2: 1 điểm nhẹ (evidence verify offline) → đã bổ sung `docs/evidence/p34-license/EVIDENCE_OFFLINE_VERIFY_20261110.md`.
- Checklist:
  - [x] Root cause đọc từ dist + dts + handoff provision + AGENTS (không đoán)
  - [x] Test S9 fail-before trước khi sửa code (RED import-error + assert → GREEN 13/13)
  - [x] Key/PAT CHỈ qua ENV transient lúc chạy, KHÔNG ghi vào file/tài liệu/commit (L-S01/S02: báo cáo tên file+số dòng, serial rút gọn)
  - [x] Screenshot + DOM counts mở xem trực tiếp trước khi báo PASS (L-V05)
  - [x] Không commit thẳng dev; claim trước code (L-002)

## 6. Rollback
- Revert 1 commit (prop optional, default undefined → hành vi cũ). Không migration, không infra.
