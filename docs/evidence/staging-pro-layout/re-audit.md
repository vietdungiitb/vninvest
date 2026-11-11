# Re-audit độc lập B8 — slice `staging-pro-layout` (2026-11-11)

> Auditor B8, CHỈ ĐỌC (không sửa/commit). Nhánh `feat/staging-pro-layout` @ `46975920c`
> (đã gồm fix TDZ + reset + data-tier debug attr). Plan: `docs/PLAN_STAGING_PRO_LAYOUT_20261111.md` (41 dòng).

## VERDICT: PASS — 0 blocker, 0 major còn lại

O1 (P0 TDZ) + O2 (P2 stale tier) từ `plan-audit-tier.md` đã được fix xác minh trên HEAD.
3 objection slot dùng 0; chỉ còn reservations (không chặn).

## 1. Scope diff — PASS (có lưu ý stack)

- 3 commit slice này (`49aa0fbe5`, `db2bdf7d5`, `46975920c`) chỉ chạm:
  `VNStockChartPanel.js` / `.css` / `data-unlock...test.ts`,
  plan + evidence `staging-pro-layout/` + `plan-audit-tier.md` — tất cả trong SCOPE plan §2.
- `git diff origin/dev...HEAD --stat` (50 file) còn chứa `package.json/lock`,
  `lib/licenseTrustAnchor.js`, plans/evidence JWK + widget-bump — là các slice STACK
  trước trên cùng nhánh (đã có audit riêng: `staging-pro-jwk/plan-audit.md`,
  `widget-bump-044/plan-audit.md`, `widget-bump-044p/re-audit.md`), không phải change slice này.
- Lưu ý (không chặn): khi mở PR slice này, bảo đảm các slice stack được merge trước
  hoặc PR chỉ chứa working diff hiện tại, tránh mang cả 15 commit vào 1 PR.

## 2. verifiedTier trên HEAD — PASS (O1 + O2 đã đóng)

`packages/web/src/components/VNStockChartPanel.js`:
- State khai TRƯỚC mọi chỗ đọc: `useState(null)` (`:71`) → `useTenantTier` (`:72`) →
  `tier = verifiedTier ?? ... ?? serverTier` (`:73-75`). O1 TDZ đóng.
- Reset khi mất key: `if (!licenseKey) { setVerifiedTier(null); return; }` (`:88`). O2 nửa 1 đóng.
- Verify không ra pro → null (`:95`), `.catch` → null (`:97`) — fail-closed, không giữ tier cũ. O2 nửa 2 đóng.
- Cleanup `cancelled`: guard sau cả 2 `.then` (`:94`, `:97`), cleanup set true (`:98`) —
  không set state sau unmount.
- `data-tier` expose tier runtime (`:356`, `'data-tier': tier`) — chỉ chuỗi tier, không secret.
- Thứ tự trust-then-verify giữ nguyên: `ensureLicenseTrustAnchor()` module scope + đầu effect
  (`:90`) trước dynamic import engine-core (`:91-92`).

## 3. Bằng chứng đã chạy

| Mục | Kết quả |
|---|---|
| E2E Playwright staging (`docker.edusuccess.vn`, login → `/stocks/CAR`) | PASS (đã chạy — 30+ facts JSON + 19 PNG trong `docs/evidence/staging-pro-layout/`) |
| Dock tabs pro | PASS — `facts24.json` 10 testids (`dock-tab-dataWindow/watchlist/alerts/...`); `facts31.json` afterHover `foundU:true, vis:visible`, 8 tabs |
| `ndOpacity` | PASS — `facts15.json` + `facts16.json`: `"1"` |
| OHLC update | PASS — `facts4.json` O/H/L/C `opacity:"1", visibility:visible`; `facts7.json` `oBefore 141,000.00 → oAfter 18,300.00, updated:true`; `facts16.json` `hasOHLC:true` |
| `data-tier=pro` | PASS — `facts22.json` `{"dataTier":"pro"}`, `facts23.json` `"tier":"pro"` |
| Ảnh `15-final-dock.png`, `20-dock-open.png`, `13-after-tier-fix.png` | PASS — tồn tại (136249 / 23050 / 136244 bytes) |
| `plan-audit.md` + `plan-audit-tier.md` | PASS — tồn tại, O1/O2 đã fix theo đúng yêu cầu |
| `npx tsc --noEmit` + vitest file + `check-multi-agent` cho working diff cuối | CHƯA XÁC MINH trong audit này (auditor không chạy; phải xanh ở pre-push gate) |
| Merge PR + deploy/verify VPS | CHƯA CHẠY — do Owner/agent-ops làm (ghi rõ, không nhận PASS) |

## 4. Secret scan — PASS

- `vni1\.` trong toàn bộ diff `origin/dev...HEAD`: 5 hit, TẤT CẢ là nhắc pattern trong
  comment/doc (`Dockerfile`, `compose.staging.env.example`, `VNStockChartPanel.js:321`,
  2 dòng trong audit docs). Blob regex `vni1\.[A-Za-z0-9_-]{20,}` = **0 hit**.
- Token regex `ghp_[A-Za-z0-9]{10,}|github_pat_...|BEGIN (...PRIVATE)` trong diff = **0 hit**
  (1 dòng match là text mô tả lệnh grep trong audit doc, không phải token).
- Test S9/S10/S12 chỉ assert regex (`not.toMatch(/vni1\.[A-Za-z0-9_-]{20,}/)`), không chứa blob.
  JWK trong `licenseTrustAnchor.js` là PUBLIC key (`kid: primary`), không nằm trong diff slice.

## 5. Reservations (giữ lại, không chặn)

1. `data-tier` debug attr (`VNStockChartPanel.js:356`) giữ lại theo chủ ý commit
   ("tạm, sẽ giữ lại") — chấp nhận, chỉ expose chuỗi tier.
2. Dải trống trái + left-gap app-shell (`facts5/6.json`: sidebar `-translate-x-full`, x=-288;
   workstation-shell margin 136px) — thuộc app-shell, ngoài SCOPE plan (non-goal), chưa đụng.
3. `facts2.json` vs `facts12/13.json` đếm statusline node không nhất quán (ghi nhận cũ từ B3,
   không ảnh hưởng kết luận — cả hai đều chỉ ra statusline vô hình pre-fix, hiện rõ post-fix).
4. tsc/vitest/gates cho 2 commit fix cuối (`db2bdf7d5`, `46975920c`) phải chạy lại xanh
   trước push (pre-push gate sẽ chặn nếu đỏ).

## Objections: 0 (tối đa 3) · Tái hiện: `git show db2bdf7d5` · `git show 46975920c` · đọc `VNStockChartPanel.js:66-99,356` · `Get-Content docs/evidence/staging-pro-layout/facts{22,23,24,31,15,16,4,7}.json`
