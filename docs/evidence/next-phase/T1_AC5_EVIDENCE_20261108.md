# B1 GATE + B6 T1 (ai-cc-i18n-clean AC5) — evidence 2026-11-08

## B1 gate (trước claim, xử lý OBJ-1)

| | Kết quả |
|---|---|
| Script | `classify-ac5-fixed.js` — chuẩn hoá CRLF trước khi strip, cùng cách strip của AC5 |
| 7 file `SRC9` | FIXED-strip hits = **0** toàn bộ |
| Raw incl comments | Page 36 · Form 33 · AuditLogs 9 · Drawer 0 · ErrorBoundary 1 · Usage 3 · providerModels 11 (tổng 93) |
| Kết luận | **0 hit runtime** (không có string/JSX tiếng Việt). Số "93 dòng comment" trong ledger là hit thô, không phải runtime string. **Không rescope i18n-key.** |

## Gốc rễ (đã chứng minh bằng fail-before)

- Trên worktree Windows `autocrlf=true`, file checkout là CRLF (Form 1010 CRLF/0 LF).
- Regex strip của AC5 (`.replace(/\/\/.*$/, "")` trên từng dòng split `\n`) **không khớp dòng kết thúc bằng `\r`**: `.*` không nuốt `\r` và `$` non-multiline không neo được.
- Fail-before: `npx vitest run src/components/__tests__/ai-cc-i18n-clean.component.test.ts` → **1 failed | 6 passed**, AC5 liệt kê đúng 93 hit comment.
- Fix (gốc rễ, 1 dòng): chuẩn hoá EOL trước khi strip:
  `src = src.replace(/\r\n/g, "\n").replace(/\r/g, "\n");`
- Pass-after: file test **7/7 PASS**, exit 0.

## Acceptance (PLAN T1)

- 0 hit independent scan (script fixed-strip) ✅
- AC5 PASS ✅ (kèm 6 test còn lại)
- Full-suite count re-measured: **CHƯA CHẠY** — thuộc B7 (chạy trên VPS staging; chưa có tổng mới nên không báo 1199/1199).
- Kiểm dương tính (L-V04): không áp dụng — không thêm key/i18n mới, chỉ sửa cách strip trong test.
