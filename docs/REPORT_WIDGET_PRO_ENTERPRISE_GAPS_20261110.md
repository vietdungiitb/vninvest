# BÁO CÁO — Việc cần làm (vnsaas + vninvestcharts-widget) để widget nhúng vào dự án chạy trơn tru ở tier pro/enterprise

Ngày: 2026-11-10 · Phạm vi: repo `vnsaas` (license/entitlement server) + repo `vninvestcharts-widget` (+engine) · Không đụng code, chỉ nghiên cứu + đề xuất.
Nguồn sự thật đã đọc: vnsaas `license/signing.py,keyring.py,views.py,serializers.py,urls.py`, `entitlement/urls.py`, `commercial/{urls,views,serializers}.py`, `identity_access/views.py`; widget `dist/index.js`, `dist/dts/**`, engine `dist/index.js` + `index.d.ts`; widget repo `src/widget/adapters/subscriptionTier.ts` (commit `48bcff9d`, CHƯA release); vninvest `VNStockChartPanel.js`, `useTenantTier.js`, nginx `docker/nginx.conf`.

## 0. Tóm tắt điều hành

Widget có 3 kênh tier, hiện trạng:

| Kênh | Trạng thái | Ghi chú |
|---|---|---|
| (A) Offline license `vni1.*` | **BLOCKED — 2 chốt độc lập** | Key vnsaas cấp không verify được trong build hiện tại (kid + product) |
| (B) Server PAT validation | **BLOCKED (bản published) / ĐÃ FIX (bản repo, chưa release)** | Envelope mismatch + thiếu SaaS billing leg ở 0.4.1; repo dev đã có slice WIDGET_SAAS_TIER |
| (C) App-side tier (vninvest `useTenantTier`) | **XONG, đang chạy** (Entry 444) | Gating UI panels của app; không ảnh hưởng widget-internal |

**3 quyết định cần Owner** (chi tiết §4): (1) chốt tương thích kid/product theo hướng nào (server sửa hay widget sửa); (2) release widget chứa WIDGET_SAAS_TIER + bump vninvest; (3) ai/cái gì gọi `POST /activations` ở lần chạy đầu (hiện không bên nào gọi).

## 1. Phát hiện load-bearing (đã verify bằng code + chạy thật)

**F1. Kid mismatch — server ký `k="primary"`, widget không biết kid này.**
- Server: `vnsaas/.../license/keyring.py:DEFAULT_KEY_ID = "primary"`; `signing.py:173` (`payload["k"] = get_signing_key().key_id`).
- Widget/engine: `getLicensePublicKeys()` chỉ có `["prod-2026-10-17","e2e-2026-10-31","prod-2026-11-09"]` (engine-core dist, verify runtime).
- `verifyLicenseKey` filter theo kid trước tiên → candidates rỗng → return null (engine-core dist `verifyLicenseKey`).
- Đã chứng minh bằng key server-issued thật (re-issue qua `POST /api/v1/licenses`, parse OK `t=pro/p=vninvestcharts_widget/caps=40/e=17-11`) → verify NULL.

**F2. Product mismatch — server phát hành `p="vninvestcharts_widget"`, widget chỉ chấp nhận `p="vninvestcharts"`.**
- Server: `signing.py:165` (`"p": product_code` — từ subscription product).
- Widget: `LICENSE_PRODUCT = "vninvestcharts"` + check `parsed.payload.p !== LICENSE_PRODUCT → return null` (engine-core dist).
- Kể cả khi F1 được gỡ, F2 vẫn chặn. Hai chốt độc lập.

**F3. Published widget (0.4.1) đọc tier server SAI contract.**
- Widget 0.4.1: `fetch(${base}/core/v1/auth/me)` rồi `planToTier(M.plan)` — đọc raw, trong khi vninvest bọc `{data:{plan}}` (envelope) và vnsaas `/auth/me` không có field plan (`identity_access/views.py:68-...` chỉ trả user/role/tenant).
- Repo widget dev đã sửa (slice WIDGET_SAAS_TIER_20261110, commit `48bcff9d`, `subscriptionTier.ts`: `extractPlan` chịu cả flat + enveloped; fallback sang vnsaas `GET /api/v1/billing/subscription/<product>` trả `tier_code` flat) nhưng **0.4.1 trên registry KHÔNG có** (grep dist = 0 hit) → chưa dùng được.

**F4. Không bên nào gọi license-server endpoints từ runtime.**
- Widget + engine dist: 0 hit `entitlements/*`, `/activations`, `/api/v1/licenses` (đã grep toàn bộ `*.js`). `decide()/verify/entitlements/current/grants` chỉ được gọi bởi tooling/ops (provision script, owner) — không phải luồng runtime của chart.
- Machine activation "client tạo khi chạy lần đầu" (handoff): không code nào trong widget/engine thực hiện → hiện là việc tay/ops, chưa có host flow tự động.

**F5. Demo license không dùng được cho staging/prod.**
- `VNI_DEMO_LICENSE` chỉ tồn tại ở demo build (DefinePlugin, không vào `dist/`, `demoLicense.ts`), domain-bound `charts.edusuccess.vn` → staging `docker.edusuccess.vn` không pass domain check. Đúng thiết kế, nhưng cần nói rõ để khỏi ai "mượn tạm".

## 2. VNSAAS — việc cần làm

| ID | Việc | Bằng chứng | Hướng sửa (chọn 1) | Owner |
|---|---|---|---|---|
| W-S1 (BLOCKER) | Đồng bộ kid ký với widget | `keyring.py:DEFAULT_KEY_ID="primary"` vs embedded kids `prod-2026-11-09…` | (A1) Ký bằng kid đã embed (vd `prod-2026-11-09`, giữ `primary` cho nội bộ); hoặc (A2) công bố public JWK kid `primary` để host `setLicensePublicKey` (chỉ gỡ chốt kid) | vnsaas team + Owner |
| W-S2 (BLOCKER) | Đồng bộ product code với widget | `signing.py:165 "p": product_code` (`vninvestcharts_widget`) vs `LICENSE_PRODUCT="vninvestcharts"` | (A) server map product cho widget-leg (vd `p` chấp nhận được), hoặc (B) widget chấp nhận alias (sang mục W-W1 — chỉ cần 1 bên sửa, không cả hai) | vnsaas team + Owner |
| W-S3 (nên làm) | Quyết định contract `/auth/me` phía vnsaas | `MeView` không trả plan; widget published đọc raw `M.plan` | Giữ nguyên (widget mới dùng billing leg thay thế) HOẶC thêm `plan` vào MeView (đổi contract, cân nhắc kỹ) | vnsaas team |
| W-S4 (quy trình) | Làm rõ ai gọi `POST /activations` lần đầu | 0 hit trong widget/engine | Viết runbook hoặc host-hook (app/provision tool gọi sau khi user login lần đầu); không để "tự xảy ra" | Owner/ops |
| W-S5 (vận hành) | TTL 7 ngày + re-issue thủ công | Handoff + `expires_at` 17/11 | Automation nhắc hạn/rotation (cron + thông báo) hoặc nâng TTL có kiểm soát rủi ro | Owner/ops |
| W-S6 (UX) | Grants approved-nhưng-chưa-hiệu-lực gây nhầm | AND-rule đúng thiết kế; API đã có `is_active` | Surface UI phân biệt approved vs effective (vnsaas frontend) | vnsaas FE |
| W-S7 (ghi nhận) | Revoke không lan tới client offline | Thiết kế offline (chỉ check expiry) | Chấp nhận + giữ TTL ngắn (đang 7 ngày — hợp lý); document rõ | — (đã ổn) |

## 3. VNINVESTCHARTS-WIDGET (+engine) — việc cần làm

| ID | Việc | Bằng chứng | Hướng sửa | Owner |
|---|---|---|---|---|
| W-W1 (BLOCKER, mirror W-S1/S2) | Chấp nhận `p="vninvestcharts_widget"` và/hoặc map kid `primary` | `LICENSE_PRODUCT`, kid filter trong engine-core | Chỉ cần 1 trong 2 bên (W-S1/S2 hoặc W-W1) sửa; bên còn lại giữ nguyên. Khuyến nghị: server ký đúng kid+product widget chấp nhận (đỡ phải republish) | widget team + Owner |
| W-W2 (chặn tính năng) | Release slice WIDGET_SAAS_TIER (`48bcff9d`: envelope-agnostic, SaaS billing leg, demo `?pat=/?apiBase=`) | dist 0.4.1 = 0 hit `extractPlan/subscriptionTier` | Release 0.4.2+ → vninvest bump → bật `client`+`tenantPat` (Entry 444 đang tắt có chủ ý) | widget team |
| W-W3 (đề xuất) | Prop điều khiển legend (`showLegend`/tương đương) | vninvest đang CSS-hack class hash `.Gc` (`VNStockChartPanel.css`) — vỡ khi bump | Thêm prop chính thức; document class ổn định hoặc `data-testid` | widget team |
| W-W4 (đề xuất) | Document observable của tier (flags `hideTrademark/no_ads`, effective tier) | Hiện chỉ đọc được từ code (`hideTrademark`, `xF` map) | Ghi rõ "pro trông như thế nào" để host verify không cần đoán | widget team |
| W-W5 (ghi nhận) | Demo license domain-bound + `?pat=` strip-URL | `demoLicense.ts`, `48bcff9d` | Đã tốt. Lưu ý: không dùng blob demo cho staging/prod | — (đã ổn) |

## 4. Ma trận quyết định Owner (tóm tắt)

| # | Quyết định | Khuyến nghị | Nếu không làm |
|---|---|---|---|
| D1 | Sửa phía server (W-S1+W-S2) hay phía widget (W-W1) | **Server** (không republish, không bump): ký kid đã embed + product widget chấp nhận | Pro tier mãi không bật được dù key hợp lệ |
| D2 | Release WIDGET_SAAS_TIER + bump vninvest | **Có**, ngay sau D1 (mở server-tier validation + demo `?pat=`) | Server-tier path tiếp tục dead code |
| D3 | Ai gọi `POST /activations` lần đầu (W-S4) | Chỉ định owner (app hook hoặc ops runbook) trước khi mở rộng tenant | Activation tồn đọng, audit không khớp |
| D4 | TTL 7 ngày giữ hay đổi (W-S5) | Giữ 7 ngày + automation nhắc hạn | Key hết hạn âm thầm → mất pro đột ngột |

## 5. Lộ trình đề xuất (theo thứ tự phụ thuộc)

1. D1 → verify lại `verifyLicenseKey` (offline, 5 phút) → **cột mốc: key verify pass**.
2. W-W2 release + vninvest bump `licenseKey` passthrough đã sẵn (Entry 445) → E2E browser: badge/flags pro hiện → **cột mốc: staging thấy pro**.
3. Truyền `client`+`tenantPat` (cần W-W2) → server-tier validation sống lại → bật lại dock (bỏ `showDock:false`?) theo tier thật.
4. W-S4/W-S5/W-S6 vận hành + UX grants.
5. E2E full + đóng các Entry còn nợ.

## 6. Rủi ro & lưu ý secrets (L-S01/S02)

- PAT/blob test staging đã đi qua chat + shell history phiên này → coi như lộ phạm vi staging. Khuyến nghị: re-issue key mới (1 POST, rẻ) + revoke key `023b6d9c…`/`85e47857…` sau khi test xong; KHÔNG dùng cho production.
- Repo sạch: grep toàn diff `vni1\.[A-Za-z0-9_-]{20,}|vnp_live|ghp_|BEGIN PRIVATE` = 0 hit (B8 đã xác minh). Giữ nguyên tắc: secrets chỉ qua ENV transient, không file, không log.
- 2 license rows do probe tạo đã revoke (204); chỉ còn key gốc handoff active.

## 7. Phụ lục — CONTRADICTIONS (plan/doc vs code, theo khung audit)

1. Handoff nói "demo `?pat=`" (vnsaas) vs widget 0.4.1 không có code `?pat=` — tính năng nằm ở commit widget repo `48bcff9d` CHƯA release → demo staging hiện tại không có.
2. Handoff "machine activation do client tạo khi chạy lần đầu" vs 0 hit `/activations` trong widget/engine dist — không bên nào trong runtime path tự gọi.
3. `PLAN_P34_TIER_20261110` ban đầu ("truyền tenantPat là đủ") vs code widget (envelope + thiếu leg) — đã hiệu đính thành app-side only + license offline (Entry 444/445).
