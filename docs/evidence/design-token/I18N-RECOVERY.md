# I18N recovery — 47 wiped keys restored (2026-09-25)

## Root cause (trung thực)
Chạy `git checkout -- src/i18n/` sau `check:shell` để dọn scanner noise đã xóa nhầm ~54 dòng uncommitted của AI CC session (Entries 198–211). Scanner log "Added ..." là nhiễu (keys đã tồn tại đúng, không ghi gì thêm).

## Damage assessment (authoritative, `find-missing-final.mjs` đánh giá runtime từng key)
- 165 keys được gọi trong src → **47 keys missing cả vi+en** (parity giữ nguyên nên parity tests vẫn xanh — che giấu lỗi).
- Không có keys nào thiếu một bên (vi/en đồng bộ).

## Khôi phục (diff hiện tại: +107/-1)
- Nguồn VERIFIED (evidence/tests gốc): F-gates key table (apiKey*/systemPrompt*/filter*/chart*), E-gates table (actorPlaceholder/reasonPrefix/auditShowing/promptDrawerFooter/perPage), EN_KEYS trong `AISliceE.i18n.component.test.js`, TRANSLATIONS trong `AICommandCenterPage.component.test.js`, B-gates (tab keys + `fallbackReset: 'Reset'`), banner `defaultValue` (budgetSoftWarning EN).
- Nguồn RECONSTRUCTED (keys đúng, prose cần owner duyệt — không ảnh hưởng functional): `tabOverview/tabRuntime/tabAudit/tabAgents/tabUsage/backToHub`, `promptHistory*` ×8, `actions/loading/yes/no`, `budgetSoftWarning` VI.
- Khôi phục thêm 2 dòng DEPRECATED comment (Entry 201) + sửa `fallbackQuotaReset` EN `'Resets'` → `'Reset'` (theo B-gates).
- Giữ script `find-missing-final.mjs` làm gate kiểm tra lại bất cứ lúc nào (expect 0 missing).

## Gates
- `find-missing-final.mjs`: **0 missing vi + en** (trước: 47+47).
- vitest AI CC 5 files: **26/26 PASS** (parity, contract-smoke, Slice E, usage dashboard, CC page).
- Full suite: 465/466 (1 flaky `useAlertCenterSnapshot.pagination` — pass lẻ, đã verify trước đó, không liên quan i18n).
- tsc 0 · `i18n:scan` exit 0 (log "Added" là nhiễu, keys đã tồn tại).

## Follow-up cho AI CC owner
Duyệt prose 12 keys reconstructed (tabs/backToHub/promptHistory×8/actions/loading) — sửa text trực tiếp trong dict, không cần đụng code/tests.
