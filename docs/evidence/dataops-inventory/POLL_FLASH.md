# DataOps flash skeleton khi polling (2026-11-20)

## Reproduce

3 ảnh chụp liên tiếp: skeleton 4 card → skeleton → có số liệu `4.6M / 1.400 / ...`. Chu kỳ lặp ~15s.

## Root cause (đã đọc code)

- `DataOpsContext.tsx:176-194`: `refreshAll()` chạy ngay + `setInterval(..., 15000)`; mỗi lần gọi `setLoading(inventory:true)`, `setLoading(runs:true)`.
- `SocDataOpsPanel.tsx:103`: `const isLoading = loading.inventory || loading.runs;` ⇒ mỗi poll thay toàn bộ hero metric bằng 4 skeleton rồi khi response về lại render số liệu.
- `SocDataInventorySection.tsx:78`: `if (loading.inventory) return skeleton` ⇒ phần "Kho dữ liệu" cũng flash theo.

## Fix

Pure helper `shouldShowDataOpsSkeleton(inventory, loading)` ở `dataopsLoading.ts`:
- `true` chỉ khi **chưa có inventory** (`!inventory`) và đang loading.
- Khi đã có dữ liệu, refresh nền vẫn giữ số liệu cũ trên màn hình (không render skeleton).

Dùng helper ở cả 2 component. Không đổi API, không migration.

## AC

1. Test helper: no-data+loading → true; data+loading → false; data+!loading → false. Fail-before (import chưa tồn tại) → pass-after.
2. Playwright trên staging theo dõi >30s: sau khi có số liệu, skeleton không xuất hiện lại dù polling chạy ít nhất 2 lần.
3. `pre-push-gate` 36 PASS.

## Gate

- vitest file test mới PASS.
- Deploy staging + Playwright verify.
