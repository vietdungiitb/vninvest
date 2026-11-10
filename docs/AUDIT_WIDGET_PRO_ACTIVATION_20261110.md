# AUDIT — Triển khai quyết định thống nhất Pro/Enterprise Widget (2026-11-10)

> Phạm vi: xác minh các cập nhật của `vnsaas` + `vninvestcharts-widget` (+`vninvestcharts-engine`)
> theo tài liệu quyết định thống nhất (user cung cấp nội bộ dung).
> Phương pháp: đọc code thật (grep/read), đối chiếu commit, verify mật mã cục bộ
> (chỉ boolean, không ghi/trích key material). KHÔNG sửa code, KHÔNG commit ngoài báo cáo này.

## 0. Verdict (1 đoạn)

- **W-W2 (publish) CHƯA XONG**: widget repo đã có đủ code (W1 allowlist, W5 activation hook, showLegend, SaaS billing leg) nhưng **chưa có tag release nào** trên cả 2 remote → registry vẫn ở bản cũ, chưa dùng được. Blocker lớn nhất lúc này.
- **V1 kid/product (D1)**: đã xác minh thêm 1 mắt xích — file private key local `prod-private-2026-11-09` KHỚP embedded kid cùng tên (verify mật mã cục bộ, boolean-only). Nhưng server đang ký bằng kid `"primary"` (không đổi), và chưa có bằng chứng server còn/quản lý key cũ → D1 vẫn ở trạng thái "conditional", cần ops xác nhận `LICENSE_SIGNING_KEY_PATH` trỏ key nào.
- **V7 (PAT lộ trong handoff) CHƯA LÀM**: PAT còn nguyên văn trong `docs/HANDOFF_PROVISION_WIDGET_2023.../HANDOFF_PROVISION_WIDGET_2026-11-10.md:12`; scan-secrets KHÔNG có rule bắt `vni_*`/`vnp_live_*`.
- **V3/V4 (runbook activation + automation nhắc hạn/revoke)**: không tìm thấy (runbooks chỉ có STAGING_DEPLOY + TURNSTILE_SETUP; beat schedule không có job license nào).
- **W3/W5/W4 (showLegend, activation hook, observables doc)**: code đã có trong repo, chờ W2 publish.

## 1. Bằng chứng đã xác minh (file:line)

### 1.1 Rào kid (F1) — ĐÚNG, bổ sung bằng chứng mới
- Engine lọc kid trước khi verify: `vninvestcharts-engine/.../licenseValidator.ts` (`getLicensePublicKeys` → candidates rỗng → return null). Đã đối chiếu dist 0.4.1/0.5.5.
- Server luôn ký `k = DEFAULT_KEY_ID = "primary"`: `vnsaas/.../license/keyring.py:57` + `signing.py:173` (`payload["k"] = get_signing_key().key_id`).
- Embedded kids: `prod-2026-10-17`, `e2e-2026-10-31`, `prod-2026-11-09` (engine dist + `test/licenseValidator.test.ts:119-121` — rebuttal đã xác minh, tôi đối chiếu khớp).
- **MỚI (audit này)**: file local `D:\Mujoco Projects\.vni-license-keys\prod-private-2026-11-09.json`
  (không nằm trong repo) derive ra public key **KHỚP** embedded `prod-2026-11-09`
  (so sánh `x` bằng ECDH, chỉ in boolean — không đọc/ghi key material ra đâu).
  ⇒ Key cũ **tồn tại ở local**, trùng kid embedded. NHƯNG: chưa xác minh server
  (`LICENSE_SIGNING_KEY_PATH`) đang trỏ key nào — đó mới là điều kiện đủ của V1a.

### 1.2 Rào product (F2) — ĐÚNG, đã có W1 nhưng chưa tới tay user
- Engine 0.5.5: `LICENSE_PRODUCT = "vninvestcharts"` + check `p !== ... → null`.
  Server phát hành `p = product_code` = `"vninvestcharts_widget"` (`vnsaas/.../license/signing.py:165`).
- Fix W1 đã merge trong engine repo: `d53c4... feat(license): W1 accept SaaS
  product alias` → `LICENSE_PRODUCTS = ["vninvestcharts", "vninvestcharts_widget"]`
  + test matrix. **Nhưng**: engine repo KHÔNG có tag release nào
  (`git ls-remote --tags` trống) → npm/GH Packages chưa có bản chứa W1.
- Kết luận: rào product đã được sửa ở source, chưa được phát hành.

### 1.3 W2 publish — CHƯA XONG (blocker lớn nhất hiện tại)
- Widget repo `package.json` = 0.4.3, engine bump 0.5.6 (`ca7d6f13 chore(release)`),
  nhưng **0 tag** trên cả 2 remote (`git ls-remote --tags`: widget chỉ có
  `drawing-ssot-before-delete`; engine trống) → workflow `release.yml` (chạy theo tag
  `v*`) chưa từng chạy cho các bản này → registry công cộng/npm vẫn 404, GH Packages
  (nếu có) vẫn ở bản cũ không chứa WIDGET_SA Molecular Tier (`grep dist = 0 hit`,
  đã xác minh ở phiên trước).
- Uncommitted changes trong widget repo (PLAN_VNSAAS_WIDGET_ACTIONS, claims JSON,
  demo/license tests) — có agent khác đang làm dở, không đụng tới.

### 1.4 W3/W4/W5 — code xong, chờ release
- `showLegend` prop + `TIER_OBSERVABLES_2026-11-10.md`: commit `739faaa` (đã đọc diff:
  prop + test + doc đầy đủ).
- Activation hook: `Saa VeryFeatureContext` gọi `ensureMachineActivationOnce` sau SaaS
  validation (`a2aa230a`, có cờ `saasBackend`, fail-silent không phá tier).
- V4 (automation nhắc hạn): **không tìm thấy** (beat schedule vnsaas không có job
  license nào; chỉ có management commands `gen_license_keypair`, `release_stale_activations`).

### 1.5 V7 revoke/scan — CHƯA LÀM
- PAT `vni_live_...` còn nguyên văn trong `vnsaas/docs/HANDOFF_PROVISION_WIDGET_2026-11-10.md:12`.
- `vnsaas/scripts/scan-secrets.mjs`: KHÔNG có pattern nào bắt `vni_*`/`vnp_live_*`
  (đã đọc PATTERNS list) → scanner hiện tại không phát hiện.
- 2 license rows do probe tạo đã revoke (204) — chỉ còn key gốc handoff active.

### 1.6 V3 runbook — CHƯA CÓ
- `vnsaas/docs/runbooks/` chỉ có STAGING_DEPLOY + TURNSTILE_SETUP; không runbook activations.

## 2. CONTRADICTIONS (doc vs code)

| # | Doc nói | Code thực tế | Tác động |
|---|---|---|---|
| C1 | Quyết định: "gộp W1+W2 một release" | W1 đã merge engine nhưng W2 (tag/publish) chưa xảy ra; widget W2 bump xong nhưng 0 tag | Pro tier vẫn unreachable cho mọi consumer |
| C2 | Handoff: "machine activation do client tạo khi chạy lần đầu" | 0 hit `activations` trong widget+engine dist; hook W5 mới chỉ ở src chưa publish | Chưa có runtime nào tự kích hoạt; V3 runbook vẫn cần |
| C3 | Báo cáo trước: "published 0.4.1" | Rebuttal + git log: 0.4.2 đã publish (b231cec5) nhưng vẫn thiếu slice SaaS (48bcff9d merge sau) | Số version đúng: "≤0.4.2 đều thiếu SaaS leg" |

## 3. Findings

- [F-AUD-01 | BLOCKER]: **Chưa có tag release nào** → W1/W-W2/W3/W5 và SaaS tier đều chưa tới tay consumer. Đề xuất: tag + publish ngay khi CI xanh (release.yml chạy theo tag `v*`).
- [F-AUD-02 | BLOCKER]: **V1a cần ops xác minh `LICENSE_SIGNING_KEY_PATH` trỏ key nào** (5 phút). File local khớp embedded là bằng chứng key cũ *tồn tại*, KHÔNG phải bằng chứng server *đang dùng* nó. Nếu server không còn key cũ → D1 chỉ còn đường widget (W-W1 đã xong, chờ W2).
- [F-AUD-03 | HIGH]: **V7 chưa làm** — PAT còn nguyên văn trong handoff; scanner mù với `vni_*`/`vnp_live_*`. Đề xuất: revoke PAT test, scrub handoff (giữ prefix+expiry), thêm rule scan-secrets.
- [F-AUD-04 | MEDIUM]: **V3/V4 chưa có** (không runbook activations, không automation TTL). Đề xuất: runbook 1 trang + beat/cron job nhắc hạn trước 17/11 (TTL key test) và 10/12 (sub).
- [F-AUD-05 | LOW]: Uncommitted work trong widget repo (PLAN_VNSAAS_WIDGET_ACTIONS, claims JSON, demo/license tests) — không đánh giá vì đang dở; merge xong thì kiểm tra lại.

## 4. Quyết định cần Owner (kế thừa D1–D4, cập nhật trạng thái)

| # | Quyết định | Trạng thái sau audit |
|---|---|---|
| D1 | Server ký lại (V1a) vs widget allowlist (W-W1) | W-W1 đã code xong (chờ publish). V1a vẫn mở NHƯNG cần V0 xác minh server key trước; nếu key cũ mất → đóng V1a, chỉ còn W-W1 |
| D2 | Release W-W2 + bump vninvest | BẮT BUỘC và đang nghẽn ở tag/publish — ưu tiên #1 |
| D3 | Ai gọi activations | Widget đã có hook (W5, chờ publish); runbook ops làm fallback — chưa có, cần viết |
| D4 | TTL 7 ngày + automation | Giữ TTL; automation chưa có — cần ticket riêng |

## 5. Next steps / owner

1. (5 phút, ops) Xác nhận `LICENSE_SIGNING_KEY_PATH` trên VPS trỏ key nào (so public part, không cần xem private).
2. Tag + publish widget 0.4.3 / engine 0.5.6 (CI release theo tag), rồi bump vninvest.
3. V7: revoke PAT test + scrub handoff + thêm rule scan-secrets.
4. Viết runbook activations 1 trang + job nhắc TTL.
5. Sau publish: verify E2E pro (key thật qua `licenseKey` prop — vninvest đã sẵn Entry 445).

## 6. Ghi chú phương pháp

- Read-only toàn bộ (không sửa repo nào, không chạy migration, không đụng secret vào file).
- Key material: chỉ dùng boolean-compare cục bộ cho R1; không in/không lưu key ở đâu.
- Uncommitted work trong widget repo được ghi nhận nhưng không đánh giá nội dung (đang dở).
