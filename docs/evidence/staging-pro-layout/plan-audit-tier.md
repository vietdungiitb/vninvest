# Audit: panel tự verify licenseKey → verifiedTier (diff chưa commit)

- Scope: `git diff` trên nhánh `feat/staging-pro-layout` @ `49aa0fbe5` (2 file:
  `packages/web/src/components/VNStockChartPanel.js` +24/-3,
  `packages/web/src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts` +10).
  Ngày audit: 2026-11-11. Auditor độc lập, chỉ đọc.
- Verdict: **NEED_REVISION** (1 P0 crash chắc chắn, phải sửa trước khi commit).

## Kiểm tra theo yêu cầu

1. **Effect cleanup + fail-open**: cleanup `cancelled` đúng
   (`VNStockChartPanel.js:89,94,98` — guard sau cả 2 `.then`, cleanup set true).
   Đường verify fail/null fail-closed: chỉ `setVerifiedTier` khi
   `v.tier === 'pro'|'enterprise'` (`:95`), `.catch(() => {})` (`:97`) nuốt lỗi,
   `null` giữ nguyên tier cũ. Không có fail-open trên đường verify.
2. **Trust-then-verify**: ĐÚNG thứ tự. `ensureLicenseTrustAnchor()` gọi đồng bộ
   ở module scope (`:14`) và đầu effect trước dynamic import (`:90` → import `:91`
   → `verifyLicenseKey` `:92`). Anchor (`src/lib/licenseTrustAnchor.js:13,26-29`)
   static-import `addLicensePublicKey` từ cùng specifier `@vninvestcharts/engine-core`
   mà panel dynamic-import → cùng 1 module instance dưới Vite (1 bản đã cài).
3. **2 bản engine?**: App pin exact `0.5.6` (`packages/web/package.json:73`),
   widget `0.4.4` (`:108`). `node_modules` không tồn tại trong env này nên
   **CHƯA XÁC MINH** file resolve thực tế; nhưng panel-side tự nhất quán
   (anchor + verify cùng specifier → cùng copy), rủi ro dual-copy chỉ còn là
   panel-tier vs widget-internal-unlock lệch nhau (thấp).
4. **S12 vs code; S6/S7 có bị yếu đi?**: S12 assert đúng code
   (`verifyLicenseKey`/`verifiedTier`/`setVerifiedTier` hiện diện, cấm `tenantPat`).
   S6/S7 trong HEAD (`git show HEAD:...test.ts`) giống hệt working tree —
   không test cũ nào bị sửa/yếu đi. Nhưng S12 là source-scan nên **không bắt được
   Objection 1** (xem dưới) — test vẫn xanh dù component crash.
5. **Secret trong diff**: grep `vni1\.|ghp_|BEGIN (RSA|EC|OPENSSH|PRIVATE)` trên
   `git diff` → **0 hit**. PASS. (JWK ở `licenseTrustAnchor.js:15-21` là public key,
   không nằm trong diff.)

## Objections (tối đa 2)

- **O1 [P0 — crash 100% render]: TDZ — `tier` đọc `verifiedTier` trước khi khai báo.**
  `const tier = verifiedTier ?? ...` (`VNStockChartPanel.js:71`) chạy TRƯỚC
  `const [verifiedTier, setVerifiedTier] = useState(null)` (`:86`) trong cùng
  function body → `ReferenceError: Cannot access 'verifiedTier' before initialization`
  mỗi lần render. Fix: chuyển `useState` + effect lên TRƯỚC khối tier gating
  (trước `:70`). Chưa fix thì không commit, mọi test render panel đều đỏ.
- **O2 [P2 — stale elevation]: `verifiedTier` không bao giờ reset.**
  `!licenseKey` thì effect `return` sớm (`:88`) không clear; key đổi từ pro
  sang invalid cũng chỉ bỏ qua (`:95`), comment `:84-85` còn ghi chủ ý
  "không bao giờ hạ tier". Hệ quả: gỡ/downgrade key không hạ tier trong session.
  Fix tối thiểu: trong effect, khi `!licenseKey` thì `setVerifiedTier(null)`;
  khi `verifyLicenseKey` trả null/tier lạ thì `setVerifiedTier(null)`.

Skipped: không chạy vitest/tsc (chỉ audit diff, node_modules vắng); không verify
widget-internal unlock có đọc cùng engine copy không.
Rủi ro còn lại: O1 làm mọi manual-test staging pro hiện tại crash — kết quả verify
tay trước đây (nếu có) không còn giá trị sau khi sửa TDZ, cần re-verify.
