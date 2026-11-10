# Evidence — Offline verify license vni1 (P3.4, 2026-11-10)

> KHÔNG chứa key/blob/PAT. Key và PAT chỉ tồn tại trong ENV transient lúc chạy, không ghi file.

## Thủ tục (tái hiện được, không cần secret trong repo)

1. Re-issue (đúng flow tài liệu handoff): `POST https://saas.edusuccess.vn/api/v1/licenses`
   body `{"product_code":"vninvestcharts_widget"}`, header `Authorization: Bearer $VNI_PAT`
   (`$VNI_PAT` = test PAT verify-login-temp, ENV transient) + `Idempotency-Key` ngẫu nhiên.
2. Node script (file tạm ngoài repo, đã xoá): import engine bundle
   `packages/web/node_modules/@vninvestcharts/engine-core/dist/index.js`
   → `parseLicenseKey(key)` → `verifyLicenseKey(key, {})` → in metadata/boolean.
3. Đối chiếu code: `LICENSE_PRODUCT`, `activePublicKeys` kids, thứ tự check trong
   `verifyLicenseKey` (kid filter → chữ ký → tier → product), `parseLicenseKey`
   yêu cầu `t:string`, `e:number` (đọc từ dist minified theo symbol).

## Kết quả (log thật, đã lược key material)

- `ISSUED: serial 85e47857… / tier pro / caps 40 / exp 2026-11-17T23:59:59Z` (HTTP 201)
- `parse: t=pro, p=vninvestcharts_widget, capsN=40, e=1794959999` → parse OK
- `kids: ["prod-2026-10-17","e2e-2026-10-31","prod-2026-11-09"]` (payload `k="primary"`)
- `verify: NULL/invalid`; key giả mạo (đổi 4 ký tự cuối) cũng NULL (fail-closed đúng)
- Suy ra (đọc code, không đoán): chốt 1 = kid mismatch (`candidates.length===0 → null`
  trước khi check chữ ký); chốt 2 = product mismatch (`p !== LICENSE_PRODUCT`).

## Kết luận

Hai chốt độc lập khiến mọi key vnsaas cấp hiện tại không verify được trong
widget 0.4.1/engine 0.5.5. End-to-end unlock cần Owner quyết hướng (A)/(B)/(C)
trong `docs/PLAN_P34_LICENSE_20261110.md` §1b. Slice này giữ lại app-side readiness
(prop passthrough + test + tài liệu rào cản).
