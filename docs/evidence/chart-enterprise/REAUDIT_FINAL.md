# B8 — Re-audit độc lập (2026-11-22)

> Auditor: subagent khác session, CHỈ ĐỌC. Revision `042037f3a61955912d7ca7121dde417f4febdc99`.
> **Verdict: `AGREE`** — 0 objection kỹ thuật chặn code; 3 reservation phải đóng trong B9.

## Tự kiểm chứng của auditor

| Lệnh | Kết quả |
|---|---|
| `git rev-parse --abbrev-ref HEAD` + `git log --oneline -12` | `feat/chart-enterprise-demo`, HEAD `042037f3a`, tree sạch |
| `node packages/web/scripts/check-staging.mjs --url https://docker.edusuccess.vn --commit 042037f3a` | `STAGING_OK commit=042037f3a dirty=false` |
| `curl .../api/v1/entitlement` | 200, `tier_code=enterprise`, `status=active`, end `2126-10-29` |
| `curl .../health.json` | `{"ok":true,"commit":"042037f3a","dirty":false}` |
| `vitest run` 2 file entitlement/parity | 2 files / 8 tests PASS |
| `git ls-files --eol` 8 file slice | 8/8 `i/lf w/lf` |
| Quét 130 chunk trong dist | `enterpriseBinding` có trong RightSidebarDockHost + VNStockChartPanel |

## Code & luật cứng

- Tier chain `VNStockChartPanel.js:83-93`: `verifiedTier ?? preloadedTier ?? tierProp ?? serverTier` đúng.
- `main.tsx:283-312`: preload chạy trước `root.render()` ⇒ không flash FREE.
- `chartDemoEntitlement.js:49-68`: timeout 2500 ms, fail-closed, `free → null`.
- `chartEnterpriseBinding.js:28-89`: 6 method; 5 method có API thật, method thứ 6 trả note trung thực.
- `widgetProRegisterStub` + alias Vite khớp D4b; `package.json:107` pin tarball local;
  `Dockerfile:9,40-51`; `nginx.conf:257-268` exact-match thắng `^~ /api/v1/`; compose mount root-only.
- 6 luật cứng: auditor độc lập ✅ · LIMIT 3 ✅ · EOL/numstat ✅ · không ghi tiếng Việt qua console ✅ ·
  số có lệnh tái hiện ✅ · verdict thành văn bản (file này) ✅.
- Secrets: 0 hit PAT/serial thật trong file slice + evidence. Token lộ trong chat là rủi ro đã biết,
  có khuyến nghị rotate.

## Reservation (đóng trong B9)

- **R1 (blocker thủ tục):** ledger mới tới Entry 611; 6 commit code chưa có Entry ⇒ phải append **Entry 612**.
- **R2 (major tài liệu):** bảng "Còn lại / blocker" trong `JOURNAL_20261122.md` stale (vẫn ghi Task 3/5/6/7, B7, B8 là CHƯA CHẠY) ⇒ phải cập nhật.
- **R3 (minor):** E2E browser có đăng nhập / screenshot **CHƯA CHẠY** — giữ nguyên nhãn, không báo PASS.

## Kết luận

Đủ điều kiện sang B9 sau khi đóng R1 + R2 trong cùng phiên. Không có lỗi code cần sửa.
