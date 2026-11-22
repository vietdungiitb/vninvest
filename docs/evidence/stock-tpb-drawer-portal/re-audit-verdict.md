# B8 — Re-audit S1 drawer portal: PASS

- **Date**: 2026-11-22 · **Commit**: `8d25153c4` · **Auditor**: độc lập, chỉ đọc.
- `createPortal` đúng (import react-dom, guard document + fallback inline, đóng → null, không rò overlay).
- Test chứng minh portal bằng Drawer thật, mở qua nút config thật, assert đi bộ lên body không qua `.sdp-page`.
- Gate auditor tự chạy: vitest file mới 2/2, drawer cũ 3/3, tsc 0.
- Không regression luồng đóng/mở/config. Điểm nhỏ (không chặn): chưa test `onConfigChange` xuyên portal → bổ sung sau.
