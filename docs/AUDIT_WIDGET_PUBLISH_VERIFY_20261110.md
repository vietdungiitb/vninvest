# AUDIT — Verify publish 0.4.3/0.5.6 + đối chiếu quyết định unified Pro/Enterprise (follow-up 2026-11-10)

> Phạm vi: kiểm chứng các cập nhật của `vninvestcharts-widget` + `vninvestcharts-engine`
> và `vnsaas` theo tài liệu quyết định thống nhất (W1–W6, V0–V7).
> Phương pháp: read-only — đọc code thật (grep/read), đối chiếu tarball đã publish,
> verify mật mã cục bộ (boolean-only, không ghi/trích key material). KHÔNG sửa code,
> KHÔNG commit ngoài báo cáo này. Ngày: 2026-11-10 (UTC).
> Doc này supersede verdict "W2 CHƯA XONG" trong `docs/AUDIT_WIDGET_PRO_ACTIVATION_20261110.md`
> (cùng nhánh) — publish xảy ra 15:54 UTC, sau thời điểm audit trước.

## 0. Verdict (5 findings nghiêm trọng nhất)

1. **[ĐÃ XONG — W1/W2/W3/W5 published]** `@vninvestcharts/widget@0.4.3` + `engine-core@0.5.6`
   đã có trên GH registry (`0.4.3` lúc `2026-11-10T15:54:40Z`); verify tarball: `.d.ts`
   đủ `fetchSubscriptionTier`/`fetchSaasBillingTier`/`ensureMachineActivationOnce`/`showLegend`,
   JS runtime chứa endpoint literals (`billing/subscription`, `/api/v1/activations`,
   `saas-billing`, `Idempotency-Key` — mỗi chuỗi 3 hits trên `index/iframe/iife`);
   `engine-core@0.5.6` chứa `LICENSE_PRODUCTS = [LICENSE_PRODUCT, "vninvestcharts_widget"]`
   + `has_prod_kid: true`. Product-gate (F2) đã được sửa ở phía publish.
2. **[BLOCKER còn lại — kid mismatch]** Server vẫn ký `k = "primary"` (`vnsaas/.../license/keyring.py:57`
   + `signing.py:173` đã xác minh phiên trước); engine nhúng 3 kid
   (`prod-2026-10-17`, `e2e-2026-10-31`, `prod-2026-11-09`) — không có `"primary"`;
   `public_jwk()` chỉ là helper (`keyring.py:194`), **không có route nào** expose
   (`license/urls.py:17-52` chỉ có `activations`, `licenses`, `licenses/clock`,
   `licenses/<serial>`). Key server-issued verify offline vẫn NULL — W1 không sửa rào này.
   V1a cần ops xác nhận `LICENSE_SIGNING_KEY_PATH` (file local khớp embedded là bằng chứng
   key cũ *tồn tại*, KHÔNG phải server *đang dùng* nó).
3. **[MISSING — app chưa bump]** `vninvest/packages/web/package.json:73-75,108-109` vẫn ghim
   `engine-*/0.5.5` + `widget/widget-pro/0.4.1` ⇒ staging/prod của app vẫn chạy bản cũ,
   chưa hưởng W1/W2/W3/W5. Đây là bước 5 của quyết định ("sau W2").
4. **[OPEN — V7]** PAT live `vnp_live_...` còn nguyên văn trong
   `vnsaas/docs/HANDOFF_PROVISION_WIDGET_20261110.md:12`; `scripts/scan-secrets.mjs`
   có rule `vni1.` license-key (`:151-155`) nhưng **không có rule `vnp_`** nào
   (PATTERNS `:98-157` đã đọc toàn bộ) ⇒ scanner mù với chính loại PAT đang lộ.
5. **[OPEN — V3/V4/V5]** Không runbook activations (runbooks chỉ `STAGING_DEPLOY` +
   `TURNSTILE_SETUP`; §3.2 STAGING_DEPLOY là quyền key, không phải fallback activations);
   `CELERY_BEAT_SCHEDULE` (`vnsaas_core/settings.py:868-901`) chỉ có commercial jobs,
   không job license nào (`release_stale_activations` là command chạy tay);
   grants UI chỉ hiện `status` (`MyGrantsPage.tsx:24-31,124-138`), không phân biệt
   approved-vs-effective.

## 1. Bản đồ kiến trúc (file | trách nhiệm)

| File | Trách nhiệm | Note |
|---|---|---|
| `widget/src/widget/adapters/subscriptionTier.ts:181-214` | Leg billing: auth/me → SaaS billing | Đã publish 0.4.3 (d.ts + JS literals) |
| `widget/src/widget/adapters/licenseActivation.ts:40-109` | W5 activation hook transport | Đã publish 0.4.3 |
| `widget/src/widget/contexts/SaaSFeatureContext.tsx:559-624` | Gọi hook sau SaaS leg | `ensureMachineActivationOnce(client.getBase(), effectivePat)` `:624` |
| `widget/src/widget/VNInvestChartsProps.ts` + `TIER_OBSERVABLES_2026-11-10.md` | W3/W4 showLegend + observables | `.d.ts` 0.4.3 có `showLegend` 6 hits |
| `engine/.../licenseValidator.ts` (dist 0.5.6) | W1 allowlist + kid filter | `LICENSE_PRODUCTS` + 3 kids trong tarball |
| `vnsaas/.../license/keyring.py:57,194` | Ký `primary` / helper `public_jwk` | Chưa expose endpoint |
| `vnsaas/.../license/urls.py:17-52` | Routes license | Không có public-key route |
| `vnsaas/.../identity_access/views.py:68-104` | MeView (V2) | Không có `plan` — đúng quyết định |
| `vnsaas/.../features/grants/MyGrantsPage.tsx:24-31,124-138` | Grants UI (V5) | Chỉ `status`, thiếu effective |
| `vnsaas/scripts/scan-secrets.mjs:98-157` | Scanner (V7) | Có `vni1.` rule, thiếu `vnp_` rule |

## 2. Luồng dữ liệu đã trace (PAT-only tenant → tier)

1. Widget `fetchSubscriptionTier(base, pat)` (`subscriptionTier.ts:204-214`): gọi
   `GET {base}/core/v1/auth/me` (`:149`); 404-route → ghi cache `saas`,
   gọi `GET {base}/api/v1/billing/subscription/vninvestcharts_widget` (`:186`).
2. Published 0.4.3 JS chứa cả 2 literals (`billing/subscription` 3 hits,
   `/api/v1/activations` 3 hits, node scan trực tiếp dist — không qua grep preview).
3. Server leg: `MeView.get` chỉ trả user/tenant (`views.py:86-103`), tier chuẩn ở
   `/entitlements/current` (AND-rule, BE đã có) — đúng V2.
4. Rào offline: server đúc key `p=vninvestcharts_widget`, `k="primary"`; engine 0.5.6
   chấp nhận `p` (W1) nhưng lọc kid trước verify ⇒ `k="primary"` không khớp 3 kid nhúng
   ⇒ verify NULL. Chưa có kênh phân phối JWK (không endpoint) và host chưa tiêm
   `setLicensePublicKey` (lối thoát đã ghi trong quyết định, chưa áp dụng ở app).

## 3. CONTRADICTIONS (doc vs code)

| # | Doc nói | Thực tế | Tác động |
|---|---|---|---|
| C1 | Audit trước (cùng nhánh): "W2 CHƯA XONG, 0 tag" | Registry `time` cho `0.4.3: 2026-11-10T15:54:40Z`; tarball verify đủ W1/W2/W3/W5 | Verdict cũ hết hiệu lực; publish đi đường manual (0 tag trên cả 2 remote — `git ls-remote --tags`: widget chỉ `drawing-ssot-before-delete`, engine trống) |
| C2 | Journal widget `8243afca`: "5 packages published" | Registry xác nhận `widget@0.4.3`, `engine-core@0.5.6` (đủ), `widget-pro@0.4.3`; `engine-pro` không publish (journal nói cố ý, dep `^0.5.1` tự nhận core mới) | Khớp; nhưng thiếu tag ⇒ provenance manual, lần sau nên tag để `release.yml` (chạy theo tag `v*`) có hiệu lực |
| C3 | Quyết định: "gộp W1+W2 một release" | Đúng đã xảy ra (0.5.6 chứa W1, 0.4.3 chứa W2/W3/W5) | Phần widget/engine của quyết định coi như xong ở tầng publish |
| C4 | Handoff: key test hết hạn 2026-11-17 (TTL 7 ngày) | Chưa verify runtime bằng key thật sau sửa đổi (mục tồn đọng của quyết định §7) | Vẫn mở — cần `verifyLicenseKey` với key thật sau khi app bump |

## 4. Findings chi tiết

- [F-VFY-01 | CLOSED] **W1/W2/W3/W5 đã tới registry.** Evidence: `npm view ... time`
  (`0.4.1: 10-26`, `0.4.2: 11-10T04:10Z`, `0.4.3: 11-10T15:54:40Z` — sau slice SaaS
  merge 11:53 UTC nên chứa slice); tarball `C:\Temp\wverify` (đã xóa sau verify):
  `dist/dts/.../subscriptionTier.d.ts:56,68` (`fetchSaasBillingTier`,
  `fetchSubscriptionTier`), `licenseActivation.d.ts:26,34`
  (`ensureMachineActivation`, `...Once`), `VNInvestChartsProps.d.ts:231`
  (`showLegend`); JS: endpoint literals 3 hits mỗi chuỗi; engine 0.5.6:
  `LICENSE_PRODUCTS = [LICENSE_PRODUCT, "vninvestcharts_widget"]`, `has_prod_kid: true`.
- [F-VFY-02 | BLOCKER] **kid mismatch còn nguyên.** `DEFAULT_KEY_ID = "primary"`
  (`keyring.py:57`); `public_jwk()` (`:194`) không có route (`urls.py:17-52` đã đọc hết).
  Đề xuất: (a) 5-phút ops: công bố `LICENSE_SIGNING_KEY_PATH` trỏ key nào (so public part);
  (b) nếu còn key cũ → V1a stopgap ≤7 ngày; nếu mất → đóng V1a, chỉ còn W-W1 + host tiêm
  `setLicensePublicKey` hoặc chờ server xoay kid mới vào engine rồi publish tiếp.
- [F-VFY-03 | HIGH] **vninvest chưa bump.** `packages/web/package.json:73-75,108-109`
  (`engine-*: 0.5.5`, `widget/widget-pro: 0.4.1`). Đề xuất: bump lên `0.5.6`/`0.4.3`
  (Entry 444/445 đã chuẩn bị `client` + `tenantPat`), truyền `licenseKey` khi có key thật,
  test cả đường deny (fail-closed), không chỉ demo allow.
- [F-VFY-04 | HIGH] **V7 chưa làm.** PAT nguyên văn `HANDOFF...:12`; scanner thiếu rule
  `vnp_`. Đề xuất: revoke PAT test, scrub handoff (giữ prefix+expiry), thêm rule
  `/\bvnp_(live|test)_[A-Za-z0-9]{20,}/` vào `scan-secrets.mjs` + test case.
- [F-VFY-05 | MEDIUM] **V3/V4 chưa có.** Không runbook activations; không beat job license
  (`settings.py:868-901` chỉ commercial); `release_stale_activations` chạy tay
  (`--help`: "Liet ke (dry-run) hoac thu hoi..."). Đề xuất: runbook 1 trang + cron/beat
  nhắc TTL trước 17/11 (key test) và 10/12 (sub).
- [F-VFY-06 | MEDIUM] **V5/V6 chưa có.** Grants UI `Grant{public_id,product_code,tier_code,status,period_start,period_end}`
  + bảng chỉ 5 cột (`MyGrantsPage.tsx:24-31,124-138`) — không effective. Đề xuất: thêm cột
  hiệu lực (BE đã AND-rule `views.py:59-116` theo quyết định) + ghi rõ revoke offline + TTL ngắn.

## 5. Quality gates audit (read-only)

- Lint/type-check/test: KHÔNG CHẠY (audit read-only theo yêu cầu; các slice ghi
  "S8 PASS / staging CHƯA CHẠY" trong commit message — tin ở mức claim, chưa re-verify).
- i18n: không đụng chạm chuỗi mới ở tầng publish (d.ts là types).
- Scanner đã chạy đọc (không sửa): `scan-secrets.mjs` thiếu rule `vnp_` (xem F-VFY-04).

## 6. Câu hỏi cần làm rõ

1. `LICENSE_SIGNING_KEY_PATH` trên VPS/staging hiện trỏ key nào (public part có khớp
   embedded `prod-2026-11-09` không)? — owner câu trả lời unblock V1a.
2. Vì sao lần xoay kid trước xảy ra (lộ key hay rotation định kỳ)? — quyết định V0 yêu cầu,
   chưa thấy công bố.
3. Publish manual (không tag) có phải quy trình chấp nhận được, hay lần sau bắt buộc tag
   để `release.yml` chạy gates? — đề nghị Owner chốt một dòng.

## 7. Đánh giá tổng thể

Implementable: phần widget/engine coi như xong ở tầng publish; blocker thực tế chuyển sang
(1) kid mismatch (quyết định ops, 5 phút xác minh), (2) app bump + E2E verify bằng key thật,
(3) V7 scrub+rule, (4) V3/V4/V5 tickets riêng. Không nên mở thêm scope widget cho tới khi
(1)+(2) đóng. Ưu tiên: V0-xác-minh-key → bump vninvest → E2E pro cả 2 leg + đường deny →
V7 → V3/V4/V5.
